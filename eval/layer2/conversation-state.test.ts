import { describe, it, expect, beforeEach, vi } from "vitest";

import { mockGenerateText, type MockLLMScenario } from "@/eval/mocks/llm";
import { resetRedisMock } from "@/eval/mocks/redis";

vi.mock("@/lib/memory/redis", async () => {
  const { createRedisMock } = await import("@/eval/mocks/redis");
  return { redis: createRedisMock };
});
vi.mock("@/lib/env", async () => {
  const { createEnvMock } = await import("@/eval/mocks/env");
  return createEnvMock();
});
vi.mock("@/lib/line/client", () => ({
  replyOrPush: vi.fn(),
  push: vi.fn(),
  text: (s: string) => ({ type: "text", text: s }),
  showLoading: vi.fn(),
}));
vi.mock("@/lib/memory/audit-log", () => ({ appendAuditEntry: vi.fn(async () => {}) }));

import { runAgent } from "@/lib/llm/agent";
import { buildTaskTools } from "@/lib/tools/tasks";
import { buildReminderTools } from "@/lib/tools/reminders";
import { buildWeatherTools } from "@/lib/tools/weather";
import { resetEvalState } from "@/eval/fixtures/state";
import { testProfile, emptyFacts, TEST_USER_ID } from "@/eval/fixtures/user";

beforeEach(async () => {
  await resetEvalState();
});

describe("conversation state across turns", () => {
  it("remembers previous tool call context in multi-turn scenario", async () => {
    const scenarios: MockLLMScenario[] = [
      {
        match: (params) => String(params.messages.at(-1)?.content).includes("weather"),
        result: () => ({
          text: "It's sunny.",
          steps: [{
            toolCalls: [{ toolName: "weather", input: { location: "Bangkok" } }],
            toolResults: [{ output: { ok: true, temp: 32 } }],
          }],
        }),
      },
      {
        match: (params) => String(params.messages.at(-1)?.content).includes("tasks"),
        result: () => ({
          text: "",
          steps: [{
            toolCalls: [{ toolName: "list_tasks", input: {} }],
            toolResults: [{ output: { ok: true, tasks: [{ id: "1", title: "buy milk" }] } }],
          }],
        }),
      },
    ];
    mockGenerateText(scenarios);

    const tools = { ...buildWeatherTools(), ...buildTaskTools(TEST_USER_ID), ...buildReminderTools(TEST_USER_ID) };

    const first = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [
      { role: "user", content: "weather in Bangkok" },
    ], "trace-multi-1", { tools });
    expect(first.toolCalls?.some((c) => c.toolName === "weather")).toBe(true);

    const second = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [
      { role: "user", content: "show my tasks" },
      { role: "assistant", content: first.historyText },
      { role: "user", content: "now show my tasks" },
    ], "trace-multi-2", { tools, hint: "task" });
    expect(second.toolCalls?.some((c) => c.toolName === "list_tasks")).toBe(true);
  });
});
