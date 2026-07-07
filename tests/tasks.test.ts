import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/memory/tasks", () => ({
  addTask: vi.fn(),
  listTasks: vi.fn(() => Promise.resolve([])),
  completeTask: vi.fn(),
  completeAllOpenTasks: vi.fn(),
  reopenTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

vi.mock("@/lib/memory/settings", () => ({
  getSettings: vi.fn(() => Promise.resolve({ timezone: "Asia/Bangkok" })),
}));

import { buildTaskTools } from "@/lib/tools/tasks";
import { addTask } from "@/lib/memory/tasks";

describe("buildTaskTools error handling", () => {
  it("add_task returns structured error when persistence throws", async () => {
    vi.mocked(addTask).mockRejectedValueOnce(new Error("QStash region mismatch"));
    const tools = buildTaskTools("U1");
    const result = await tools.add_task!.execute(
      { title: "Download file" },
      { toolCallId: "t1", messages: [] },
    );
    expect(result).toMatchObject({
      ok: false,
      error: "Couldn't save the task right now. Please try again in a moment.",
    });
  });
});
