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
import { addTask } from "@/lib/memory/tasks";
import { resetEvalState } from "@/eval/fixtures/state";
import { testProfile, emptyFacts, TEST_USER_ID } from "@/eval/fixtures/user";
import { requiredTool } from "@/eval/engine/matchers";

beforeEach(async () => {
  await resetEvalState();
});

describe("deterministic fallback execution", () => {
  it("falls back to list_tasks when model blanks on task query", async () => {
    const scenario: MockLLMScenario = {
      result: () => ({
        text: "I didn't catch that — could you rephrase?",
        steps: [],
      }),
    };
    mockGenerateText([scenario]);

    await addTask(TEST_USER_ID, { title: "buy milk" });

    const result = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [
      { role: "user", content: "show my tasks" },
    ], "trace-fallback-task", {
      tools: buildTaskTools(TEST_USER_ID),
      hint: "task",
    });

    expect(requiredTool(result, "list_tasks").pass).toBe(true);
    expect(result.historyText.length).toBeGreaterThan(0);
    expect(result.hints.flexMessages?.length ?? 0).toBeGreaterThan(0);
  });

  it("falls back to weather when model blanks on weather query", async () => {
    const scenario: MockLLMScenario = {
      result: () => ({
        text: "",
        steps: [],
      }),
    };
    mockGenerateText([scenario]);

    const { buildWeatherTools } = await import("@/lib/tools/weather");
    const result = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [
      { role: "user", content: "weather in Bangkok" },
    ], "trace-fallback-weather", {
      tools: buildWeatherTools(),
      hint: "weather",
    });

    expect(requiredTool(result, "weather").pass).toBe(true);
  });
});
