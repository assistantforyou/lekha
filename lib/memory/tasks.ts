import { redis } from "./redis";
import {
  scheduleTaskDeadlineWarning,
  cancelTaskDeadlineWarning,
} from "@/lib/proactive-schedules";

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
  return task;
}

export async function listTasks(
  userId: string,
  filter: "all" | "open" | "done" = "open",
): Promise<Task[]> {
  const raw = await redis().lrange<string | Task>(listKey(userId), 0, -1);
  const items = raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as Task) : r));
  if (filter === "all") return items;
  if (filter === "done") return items.filter((t) => t.doneAt);
  return items.filter((t) => !t.doneAt);
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
  return found;
}
