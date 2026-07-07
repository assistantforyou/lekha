import { describe, it, expect, beforeEach, vi } from "vitest";

// Load the Mastra agent mock first so the generate path is intercepted.
import { mockMastraAgent, type MockMastraScenario } from "@/eval/mocks/mastra-agent";
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

import { runMastraAgent } from "@/mastra/run";
import { resetEvalState } from "@/eval/fixtures/state";
import { testProfile, testSettings, emptyFacts, TEST_USER_ID } from "@/eval/fixtures/user";
import { requiredTool, forbiddenTool } from "@/eval/engine/matchers";

beforeEach(async () => {
  await resetEvalState();
});

function userMessage(text: string) {
  return { role: "user" as const, content: text };
}

function baseOpts(overrides: { hint?: string; facts?: ReturnType<typeof emptyFacts> } = {}) {
  return {
    userId: TEST_USER_ID,
    profile: testProfile(),
    facts: overrides.facts ?? emptyFacts(),
    settings: testSettings(),
    accounts: { accounts: [] as Array<{ email: string }>, activeEmail: null as string | null },
    staged: [] as Array<{
      kind: string;
      messageId: string;
      ts: number;
      fileName?: string;
      contentType?: string;
      sizeBytes?: number;
    }>,
    hasStagedMedia: false,
    hint: overrides.hint,
  };
}

describe("tool selection with mocked Mastra agent", () => {
  it("calls weather tool for weather query", async () => {
    const scenario: MockMastraScenario = {
      result: () => ({
        text: "It's sunny in Bangkok.",
        steps: [{
          text: "",
          toolCalls: [{ toolName: "weather", input: { location: "Bangkok" } }],
          toolResults: [{ output: { ok: true, temp: 32 } }],
        }],
      }),
    };
    mockMastraAgent([scenario]);

    const result = await runMastraAgent([userMessage("weather in Bangkok")], baseOpts({ hint: "weather" }));

    expect(requiredTool(result, "weather").pass).toBe(true);
    expect(result.text).toContain("sunny");
  });

  it("calls list_tasks for task query", async () => {
    const scenario: MockMastraScenario = {
      result: () => ({
        text: "",
        steps: [{
          text: "",
          toolCalls: [{ toolName: "list_tasks", input: {} }],
          toolResults: [{ output: { ok: true, tasks: [] } }],
        }],
      }),
    };
    mockMastraAgent([scenario]);

    const result = await runMastraAgent([userMessage("show my tasks")], baseOpts({ hint: "task" }));

    expect(requiredTool(result, "list_tasks").pass).toBe(true);
  });

  it("calls set_reminder for reminder query", async () => {
    const scenario: MockMastraScenario = {
      result: () => ({
        text: "",
        steps: [{
          text: "",
          toolCalls: [{ toolName: "set_reminder", input: { relative_minutes: 60, message: "call mom" } }],
          toolResults: [{ output: { ok: true, id: "r1" } }],
        }],
      }),
    };
    mockMastraAgent([scenario]);

    const result = await runMastraAgent(
      [userMessage("remind me to call mom in 1 hour")],
      baseOpts({ hint: "reminder" }),
    );

    expect(requiredTool(result, "set_reminder").pass).toBe(true);
  });

  it("does not call tools for casual chat", async () => {
    const scenario: MockMastraScenario = {
      result: () => ({
        text: "Hi there! How can I help?",
        steps: [],
      }),
    };
    mockMastraAgent([scenario]);

    const result = await runMastraAgent([userMessage("hi")], baseOpts());

    expect(forbiddenTool(result, "list_tasks").pass).toBe(true);
    expect(forbiddenTool(result, "weather").pass).toBe(true);
    expect(result.text).toContain("Hi");
  });

  it("calls remember for memory request", async () => {
    const scenario: MockMastraScenario = {
      result: () => ({
        text: "",
        steps: [{
          text: "",
          toolCalls: [{ toolName: "remember", input: { content: "I like Thai iced tea" } }],
          toolResults: [{ output: { ok: true } }],
        }],
      }),
    };
    mockMastraAgent([scenario]);

    const result = await runMastraAgent(
      [userMessage("remember I like Thai iced tea")],
      baseOpts({ facts: emptyFacts(), hint: "memory" }),
    );

    expect(requiredTool(result, "remember").pass).toBe(true);
  });
});
