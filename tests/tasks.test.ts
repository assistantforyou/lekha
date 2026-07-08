import { describe, it, expect, beforeEach, vi } from "vitest";

const hashes: Map<string, Map<string, string>> = new Map();

function getHash(key: string): Map<string, string> {
  let h = hashes.get(key);
  if (!h) {
    h = new Map();
    hashes.set(key, h);
  }
  return h;
}

function reset() {
  hashes.clear();
  scheduleCalls.length = 0;
  cancelCalls.length = 0;
}

const scheduleCalls: Array<{
  userId: string;
  taskId: string;
  title: string;
  dueAt: number;
}> = [];
const cancelCalls: string[] = [];

vi.mock("@/lib/proactive-schedules", () => ({
  scheduleTaskDeadlineWarning: vi.fn(
    async (userId: string, taskId: string, title: string, dueAt: number) => {
      scheduleCalls.push({ userId, taskId, title, dueAt });
      return "qstash-msg-id";
    },
  ),
  cancelTaskDeadlineWarning: vi.fn(async (messageId: string) => {
    cancelCalls.push(messageId);
  }),
}));

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    hset: async (key: string, obj: Record<string, string>) => {
      const h = getHash(key);
      for (const [k, v] of Object.entries(obj)) h.set(k, String(v));
      return Object.keys(obj).length;
    },
    hgetall: async <T extends Record<string, string>>(key: string) => {
      const h = hashes.get(key);
      if (!h || h.size === 0) return null;
      return Object.fromEntries(h) as T;
    },
    hdel: async (key: string, ...fields: string[]) => {
      const h = hashes.get(key);
      if (!h) return 0;
      let n = 0;
      for (const f of fields) if (h.delete(f)) n++;
      return n;
    },
    multi: () => {
      const ops: (() => unknown)[] = [];
      return {
        hset: (key: string, obj: Record<string, string>) =>
          ops.push(() => {
            const h = getHash(key);
            for (const [k, v] of Object.entries(obj)) h.set(k, String(v));
            return Object.keys(obj).length;
          }),
        del: (key: string) => ops.push(() => hashes.delete(key)),
        exec: async () => ops.map((fn) => fn()),
      };
    },
    lrange: async <T>(_key: string, _start: number, _end: number): Promise<T[]> => [],
    del: async (key: string) => (hashes.delete(key) ? 1 : 0),
  }),
}));

import {
  addTask,
  listTasks,
  completeTask,
  reopenTask,
  updateTask,
  completeAllOpenTasks,
  deleteTask,
} from "@/lib/memory/tasks";

describe("task hash storage", () => {
  beforeEach(() => reset());

  it("adds and lists open tasks", async () => {
    const task = await addTask("U1", { title: "Buy milk" });
    expect(task.title).toBe("Buy milk");
    expect(task.id).toBeDefined();
    const open = await listTasks("U1", "open");
    expect(open.length).toBe(1);
    expect(open[0]!.title).toBe("Buy milk");
  });

  it("schedules deadline warning for future due date", async () => {
    const dueAt = Date.now() + 24 * 60 * 60 * 1000;
    const task = await addTask("U1", { title: "Due task", dueAt });
    expect(scheduleCalls.length).toBe(1);
    expect(scheduleCalls[0]).toMatchObject({
      userId: "U1",
      taskId: task.id,
      title: "Due task",
      dueAt,
    });
    expect(task.qstashDeadlineWarnId).toBe("qstash-msg-id");
  });

  it("does not schedule warning for past due date", async () => {
    const dueAt = Date.now() - 1000;
    await addTask("U1", { title: "Late task", dueAt });
    expect(scheduleCalls.length).toBe(0);
  });

  it("completes a task and cancels warning", async () => {
    const dueAt = Date.now() + 24 * 60 * 60 * 1000;
    const task = await addTask("U1", { title: "Complete me", dueAt });
    const completed = await completeTask("U1", task.id);
    expect(completed).not.toBeNull();
    expect(completed!.doneAt).toBeDefined();
    expect(cancelCalls).toContain("qstash-msg-id");
    expect((await listTasks("U1", "open")).length).toBe(0);
    expect((await listTasks("U1", "done")).length).toBe(1);
  });

  it("reopens a completed task and reschedules warning", async () => {
    const dueAt = Date.now() + 24 * 60 * 60 * 1000;
    const task = await addTask("U1", { title: "Reopen me", dueAt });
    await completeTask("U1", task.id);
    scheduleCalls.length = 0;
    await reopenTask("U1", task.id);
    expect(scheduleCalls.length).toBe(1);
    expect((await listTasks("U1", "open")).length).toBe(1);
  });

  it("updates a task and reschedules warning when due changes", async () => {
    const dueAt = Date.now() + 24 * 60 * 60 * 1000;
    const task = await addTask("U1", { title: "Move deadline", dueAt });
    scheduleCalls.length = 0;
    const newDueAt = dueAt + 60 * 60 * 1000;
    const updated = await updateTask("U1", task.id, { dueAt: newDueAt });
    expect(updated).not.toBeNull();
    expect(updated!.dueAt).toBe(newDueAt);
    expect(cancelCalls).toContain("qstash-msg-id");
    expect(scheduleCalls[0]).toMatchObject({
      userId: "U1",
      taskId: task.id,
      title: "Move deadline",
      dueAt: newDueAt,
    });
  });

  it("completes all open tasks atomically", async () => {
    const t1 = await addTask("U1", { title: "A" });
    const t2 = await addTask("U1", { title: "B" });
    const completed = await completeAllOpenTasks("U1");
    expect(completed.length).toBe(2);
    expect(completed.map((t) => t.id).sort()).toEqual([t1.id, t2.id].sort());
    expect((await listTasks("U1", "open")).length).toBe(0);
  });

  it("deletes a task", async () => {
    const task = await addTask("U1", { title: "Delete me" });
    const ok = await deleteTask("U1", task.id);
    expect(ok).toBe(true);
    expect((await listTasks("U1", "all")).length).toBe(0);
  });

  it("returns null for unknown task operations", async () => {
    expect(await completeTask("U1", "no-such-id")).toBeNull();
    expect(await reopenTask("U1", "no-such-id")).toBeNull();
    expect(await updateTask("U1", "no-such-id", { title: "x" })).toBeNull();
    expect(await deleteTask("U1", "no-such-id")).toBe(false);
  });
});
