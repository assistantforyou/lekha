import { describe, it, expect, beforeEach, vi } from "vitest";

const lists: Map<string, string[]> = new Map();
function reset() {
  lists.clear();
}

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    lrange: async (key: string) => lists.get(key) ?? [],
    rpush: async (key: string, ...vals: string[]) => {
      const arr = lists.get(key) ?? [];
      arr.push(...vals);
      lists.set(key, arr);
      return arr.length;
    },
    del: async (key: string) => (lists.delete(key) ? 1 : 0),
    multi: () => {
      const ops: Array<() => void> = [];
      const api = {
        del(key: string) {
          ops.push(() => lists.delete(key));
          return api;
        },
        rpush(key: string, ...vals: string[]) {
          ops.push(() => {
            const a = lists.get(key) ?? [];
            a.push(...vals);
            lists.set(key, a);
          });
          return api;
        },
        async exec() {
          ops.forEach((f) => f());
          return [];
        },
      };
      return api;
    },
  }),
}));

vi.mock("@/lib/proactive-schedules", () => ({
  scheduleTaskDeadlineWarning: async () => "warn-id",
  cancelTaskDeadlineWarning: async () => undefined,
}));

import { addTask, listTasks, completeTask } from "@/lib/memory/tasks";

describe("task dedup", () => {
  beforeEach(() => reset());

  it("adds a new task", async () => {
    const { task, deduped } = await addTask("U1", { title: "Finish Q2 report" });
    expect(deduped).toBe(false);
    expect(task.title).toBe("Finish Q2 report");
    expect((await listTasks("U1", "open")).length).toBe(1);
  });

  it("does not duplicate an identical open task (case/whitespace-insensitive)", async () => {
    await addTask("U1", { title: "Finish Q2 report" });
    const { task, deduped } = await addTask("U1", { title: "  finish   Q2 REPORT " });
    expect(deduped).toBe(true);
    expect(task.title).toBe("Finish Q2 report"); // returns the existing one
    expect((await listTasks("U1", "open")).length).toBe(1);
  });

  it("allows re-adding once the original is completed", async () => {
    const { task } = await addTask("U1", { title: "Water plants" });
    await completeTask("U1", task.id);
    const { deduped } = await addTask("U1", { title: "Water plants" });
    expect(deduped).toBe(false);
    expect((await listTasks("U1", "open")).length).toBe(1);
    expect((await listTasks("U1", "all")).length).toBe(2);
  });

  it("isolates dedup per user", async () => {
    await addTask("U1", { title: "Shared task" });
    const { deduped } = await addTask("U2", { title: "Shared task" });
    expect(deduped).toBe(false);
    expect((await listTasks("U2", "open")).length).toBe(1);
  });
});
