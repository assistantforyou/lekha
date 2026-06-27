import { redis } from "./redis";
import { createTtlCache } from "./cache";
import {
  scheduleTaskDeadlineWarning,
  cancelTaskDeadlineWarning,
} from "@/lib/proactive-schedules";

const taskCache = createTtlCache<Task[]>(5_000);

export type Task = {
  id: string;
  title: string;
  notes?: string;
  createdAt: number;
  dueAt?: number; // ms, optional deadline
  doneAt?: number; // null/undefined when open
  qstashDeadlineWarnId?: string | null; // one-shot QStash message id
};

const listKey = (userId: string) => `user:${userId}:tasks`;

export async function addTask(userId: string, t: Omit<Task, "id" | "createdAt">): Promise<Task> {
  const task: Task = { id: crypto.randomUUID(), createdAt: Date.now(), ...t };
  if (task.dueAt && task.dueAt > Date.now()) {
    task.qstashDeadlineWarnId = await scheduleTaskDeadlineWarning(
      userId,
      task.id,
      task.title,
      task.dueAt,
    );
  }
  await redis().rpush(listKey(userId), JSON.stringify(task));
  invalidateTaskCache(userId);
  return task;
}

export async function listTasks(
  userId: string,
  filter: "all" | "open" | "done" = "open",
): Promise<Task[]> {
  const cached = taskCache.get(userId, "list", filter);
  if (cached) return cached;

  const raw = await redis().lrange<string | Task>(listKey(userId), 0, -1);
  const items = raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as Task) : r));
  const result = filter === "all" ? items : filter === "done" ? items.filter((t) => t.doneAt) : items.filter((t) => !t.doneAt);
  taskCache.set(userId, result, "list", filter);
  return result;
}

function invalidateTaskCache(userId: string) {
  taskCache.invalidate(userId);
}

export async function completeTask(userId: string, id: string): Promise<Task | null> {
  const all = await listTasks(userId, "all");
  const idx = all.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  const task: Task = { ...all[idx]!, doneAt: Date.now() };
  if (task.qstashDeadlineWarnId) {
    await cancelTaskDeadlineWarning(task.qstashDeadlineWarnId);
  }
  const next = all.map((t, i) => (i === idx ? task : t));
  const k = listKey(userId);
  const tx = redis().multi();
  tx.del(k);
  tx.rpush(k, ...next.map((t) => JSON.stringify(t)));
  await tx.exec();
  invalidateTaskCache(userId);
  return task;
}

export async function reopenTask(userId: string, id: string): Promise<Task | null> {
  const task = await mutateTask(userId, id, (t) => ({ ...t, doneAt: undefined }));
  if (task && task.dueAt && task.dueAt > Date.now()) {
    task.qstashDeadlineWarnId = await scheduleTaskDeadlineWarning(
      userId,
      task.id,
      task.title,
      task.dueAt,
    );
    // Re-persist with the new warn id.
    await mutateTask(userId, id, () => task);
  }
  invalidateTaskCache(userId);
  return task;
}

export async function updateTask(
  userId: string,
  id: string,
  patch: Partial<Pick<Task, "title" | "notes" | "dueAt">>,
): Promise<Task | null> {
  const all = await listTasks(userId, "all");
  const old = all.find((t) => t.id === id);
  const dueAtChanged = patch.dueAt !== undefined && patch.dueAt !== old?.dueAt;
  if (dueAtChanged && old?.qstashDeadlineWarnId) {
    await cancelTaskDeadlineWarning(old.qstashDeadlineWarnId);
  }
  const task = await mutateTask(userId, id, (t) => ({ ...t, ...patch }));
  invalidateTaskCache(userId);
  if (task && dueAtChanged && task.dueAt && task.dueAt > Date.now()) {
    task.qstashDeadlineWarnId = await scheduleTaskDeadlineWarning(
      userId,
      task.id,
      task.title,
      task.dueAt,
    );
    // Re-persist with the new warn id.
    await mutateTask(userId, id, () => task);
  }
  invalidateTaskCache(userId);
  return task;
}

export async function completeAllOpenTasks(userId: string): Promise<Task[]> {
  const all = await listTasks(userId, "all");
  const now = Date.now();
  const completed: Task[] = [];
  const next = all.map((t) => {
    if (t.doneAt) return t;
    if (t.qstashDeadlineWarnId) {
      void cancelTaskDeadlineWarning(t.qstashDeadlineWarnId);
    }
    const done = { ...t, doneAt: now };
    completed.push(done);
    return done;
  });
  if (completed.length === 0) return [];
  const k = listKey(userId);
  const tx = redis().multi();
  tx.del(k);
  tx.rpush(k, ...next.map((t) => JSON.stringify(t)));
  await tx.exec();
  invalidateTaskCache(userId);
  return completed;
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const all = await listTasks(userId, "all");
  const victim = all.find((t) => t.id === id);
  const next = all.filter((t) => t.id !== id);
  if (next.length === all.length) return false;
  if (victim?.qstashDeadlineWarnId) {
    await cancelTaskDeadlineWarning(victim.qstashDeadlineWarnId);
  }
  const k = listKey(userId);
  const tx = redis().multi();
  tx.del(k);
  if (next.length) tx.rpush(k, ...next.map((t) => JSON.stringify(t)));
  await tx.exec();
  invalidateTaskCache(userId);
  return true;
}

async function mutateTask(
  userId: string,
  id: string,
  fn: (t: Task) => Task,
): Promise<Task | null> {
  const all = await listTasks(userId, "all");
  let found: Task | null = null;
  const next = all.map((t) => {
    if (t.id === id) {
      found = fn(t);
      return found;
    }
    return t;
  });
  if (!found) return null;
  const k = listKey(userId);
  const tx = redis().multi();
  tx.del(k);
  tx.rpush(k, ...next.map((t) => JSON.stringify(t)));
  await tx.exec();
  invalidateTaskCache(userId);
  return found;
}
