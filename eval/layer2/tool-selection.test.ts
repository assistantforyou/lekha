import { describe, it, expect, beforeEach, vi } from "vitest";

// Load the LLM mock first so the ai module is intercepted.
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
import { buildWeatherTools } from "@/lib/tools/weather";
import { buildTaskTools } from "@/lib/tools/tasks";
import { buildReminderTools } from "@/lib/tools/reminders";
import { buildMemoryTools } from "@/lib/tools/memory";
import { resetEvalState } from "@/eval/fixtures/state";
import { testProfile, testFactsObject, emptyFacts, TEST_USER_ID } from "@/eval/fixtures/user";
import { requiredTool, forbiddenTool } from "@/eval/engine/matchers";

beforeEach(async () => {
  await resetEvalState();
});

function userMessage(text: string) {
  return { role: "user" as const, content: text };
}

describe("tool selection with mocked LLM", () => {
  it("calls weather tool for weather query", async () => {
    const scenario: MockLLMScenario = {
      result: () => ({
        text: "It's sunny in Bangkok.",
        steps: [{
          text: "",
          toolCalls: [{ toolName: "weather", input: { location: "Bangkok" } }],
          toolResults: [{ output: { ok: true, temp: 32 } }],
        }],
      }),
    };
    mockGenerateText([scenario]);

    const result = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [userMessage("weather in Bangkok")], "trace-1", {
      tools: buildWeatherTools(),
      hint: "weather",
    });

    expect(requiredTool(result, "weather").pass).toBe(true);
    expect(result.text).toContain("sunny");
  });

  it("calls list_tasks for task query", async () => {
    const scenario: MockLLMScenario = {
      result: () => ({
        text: "",
        steps: [{
          text: "",
          toolCalls: [{ toolName: "list_tasks", input: {} }],
          toolResults: [{ output: { ok: true, tasks: [] } }],
        }],
      }),
    };
    mockGenerateText([scenario]);

    const result = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [userMessage("show my tasks")], "trace-2", {
      tools: buildTaskTools(TEST_USER_ID),
      hint: "task",
    });

    expect(requiredTool(result, "list_tasks").pass).toBe(true);
  });

  it("calls set_reminder for reminder query", async () => {
    const scenario: MockLLMScenario = {
      result: () => ({
        text: "",
        steps: [{
          text: "",
          toolCalls: [{ toolName: "set_reminder", input: { relative_minutes: 60, message: "call mom" } }],
          toolResults: [{ output: { ok: true, id: "r1" } }],
        }],
      }),
    };
    mockGenerateText([scenario]);

    const result = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [userMessage("remind me to call mom in 1 hour")], "trace-3", {
      tools: buildReminderTools(TEST_USER_ID),
      hint: "reminder",
    });

    expect(requiredTool(result, "set_reminder").pass).toBe(true);
  });

  it("does not call tools for casual chat", async () => {
    const scenario: MockLLMScenario = {
      result: () => ({
        text: "Hi there! How can I help?",
        steps: [],
      }),
    };
    mockGenerateText([scenario]);

    const result = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [userMessage("hi")], "trace-4", {
      tools: { ...buildWeatherTools(), ...buildTaskTools(TEST_USER_ID) },
    });

    expect(forbiddenTool(result, "list_tasks").pass).toBe(true);
    expect(forbiddenTool(result, "weather").pass).toBe(true);
    expect(result.text).toContain("Hi");
  });

  it("calls remember for memory request", async () => {
    const scenario: MockLLMScenario = {
      result: () => ({
        text: "",
        steps: [{
          text: "",
          toolCalls: [{ toolName: "remember", input: { content: "I like Thai iced tea" } }],
          toolResults: [{ output: { ok: true } }],
        }],
      }),
    };
    mockGenerateText([scenario]);

    const result = await runAgent(TEST_USER_ID, testProfile(), testFactsObject(), [userMessage("remember I like Thai iced tea")], "trace-5", {
      tools: buildMemoryTools(TEST_USER_ID),
      hint: "memory",
    });

    expect(requiredTool(result, "remember").pass).toBe(true);
  });
});
