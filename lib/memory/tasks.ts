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

const hashKey = (userId: string) => `user:${userId}:tasks:h`;
const legacyListKey = (userId: string) => `user:${userId}:tasks`;

async function migrateFromLegacyList(userId: string): Promise<void> {
  const legacy = await redis().lrange<string>(legacyListKey(userId), 0, -1);
  if (!legacy.length) return;
  const tx = redis().multi();
  for (const raw of legacy) {
    const task = typeof raw === "string" ? (JSON.parse(raw) as Task) : raw;
    tx.hset(hashKey(userId), { [task.id]: JSON.stringify(task) });
  }
  tx.del(legacyListKey(userId));
  await tx.exec();
}

export async function addTask(
  userId: string,
  t: Omit<Task, "id" | "createdAt">,
): Promise<Task> {
  const task: Task = { id: crypto.randomUUID(), createdAt: Date.now(), ...t };
  if (task.dueAt && task.dueAt > Date.now()) {
    task.qstashDeadlineWarnId = await scheduleTaskDeadlineWarning(
      userId,
      task.id,
      task.title,
      task.dueAt,
    );
  }
  await redis().hset(hashKey(userId), { [task.id]: JSON.stringify(task) });
  return task;
}

export async function listTasks(
  userId: string,
  filter: "all" | "open" | "done" = "open",
): Promise<Task[]> {
  const raw = await redis().hgetall<Record<string, string>>(hashKey(userId));
  if (!raw) return [];
  if (Object.keys(raw).length === 0) {
    await migrateFromLegacyList(userId);
    const migrated = await redis().hgetall<Record<string, string>>(hashKey(userId));
    if (!migrated) return [];
    return parseAndFilter(migrated, filter);
  }
  return parseAndFilter(raw, filter);
}

function parseAndFilter(
  raw: Record<string, string>,
  filter: "all" | "open" | "done",
): Task[] {
  const items: Task[] = [];
  for (const value of Object.values(raw)) {
    items.push(JSON.parse(value) as Task);
  }
  return filter === "all"
    ? items
    : filter === "done"
      ? items.filter((t) => t.doneAt)
      : items.filter((t) => !t.doneAt);
}

export async function completeTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  const raw = await redis().hgetall<Record<string, string>>(hashKey(userId));
  if (!raw || !raw[id]) return null;
  const task: Task = { ...(JSON.parse(raw[id]!) as Task), doneAt: Date.now() };
  if (task.qstashDeadlineWarnId) {
    await cancelTaskDeadlineWarning(task.qstashDeadlineWarnId);
  }
  await redis().hset(hashKey(userId), { [id]: JSON.stringify(task) });
  return task;
}

export async function reopenTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  const task = await mutateTask(userId, id, (t) => ({
    ...t,
    doneAt: undefined,
  }));
  if (task && task.dueAt && task.dueAt > Date.now()) {
    task.qstashDeadlineWarnId = await scheduleTaskDeadlineWarning(
      userId,
      task.id,
      task.title,
      task.dueAt,
    );
    await redis().hset(hashKey(userId), { [id]: JSON.stringify(task) });
  }
  return task;
}

export async function updateTask(
  userId: string,
  id: string,
  patch: Partial<Pick<Task, "title" | "notes" | "dueAt">>,
): Promise<Task | null> {
  const raw = await redis().hgetall<Record<string, string>>(hashKey(userId));
  if (!raw || !raw[id]) return null;
  const old = JSON.parse(raw[id]!) as Task;
  const dueAtChanged =
    patch.dueAt !== undefined && patch.dueAt !== old.dueAt;
  if (dueAtChanged && old.qstashDeadlineWarnId) {
    await cancelTaskDeadlineWarning(old.qstashDeadlineWarnId);
  }
  const task: Task = { ...old, ...patch };
  await redis().hset(hashKey(userId), { [id]: JSON.stringify(task) });
  if (task && dueAtChanged && task.dueAt && task.dueAt > Date.now()) {
    task.qstashDeadlineWarnId = await scheduleTaskDeadlineWarning(
      userId,
      task.id,
      task.title,
      task.dueAt,
    );
    await redis().hset(hashKey(userId), { [id]: JSON.stringify(task) });
  }
  return task;
}

export async function completeAllOpenTasks(userId: string): Promise<Task[]> {
  const raw = await redis().hgetall<Record<string, string>>(hashKey(userId));
  if (!raw) return [];
  const now = Date.now();
  const completed: Task[] = [];
  const tx = redis().multi();
  for (const [id, value] of Object.entries(raw)) {
    const task = JSON.parse(value) as Task;
    if (task.doneAt) continue;
    if (task.qstashDeadlineWarnId) {
      void cancelTaskDeadlineWarning(task.qstashDeadlineWarnId);
    }
    const done = { ...task, doneAt: now };
    completed.push(done);
    tx.hset(hashKey(userId), { [id]: JSON.stringify(done) });
  }
  if (completed.length === 0) return [];
  await tx.exec();
  return completed;
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const raw = await redis().hgetall<Record<string, string>>(hashKey(userId));
  if (!raw || !raw[id]) return false;
  const task = JSON.parse(raw[id]!) as Task;
  if (task.qstashDeadlineWarnId) {
    await cancelTaskDeadlineWarning(task.qstashDeadlineWarnId);
  }
  await redis().hdel(hashKey(userId), id);
  return true;
}

async function mutateTask(
  userId: string,
  id: string,
  fn: (t: Task) => Task,
): Promise<Task | null> {
  const raw = await redis().hgetall<Record<string, string>>(hashKey(userId));
  if (!raw || !raw[id]) return null;
  const task = fn(JSON.parse(raw[id]!) as Task);
  await redis().hset(hashKey(userId), { [id]: JSON.stringify(task) });
  return task;
}
