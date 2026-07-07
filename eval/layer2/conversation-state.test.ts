import { describe, it, expect, beforeEach, vi } from "vitest";

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

beforeEach(async () => {
  await resetEvalState();
});

function baseOpts(overrides: { hint?: string } = {}) {
  return {
    userId: TEST_USER_ID,
    profile: testProfile(),
    facts: emptyFacts(),
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

describe("conversation state across turns", () => {
  it("remembers previous tool call context in multi-turn scenario", async () => {
    const scenarios: MockMastraScenario[] = [
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
    mockMastraAgent(scenarios);

    const first = await runMastraAgent(
      [{ role: "user" as const, content: "weather in Bangkok" }],
      baseOpts(),
    );
    expect(first.toolCalls?.some((c) => c.toolName === "weather")).toBe(true);

    const second = await runMastraAgent(
      [
        { role: "user" as const, content: "show my tasks" },
        { role: "assistant" as const, content: first.historyText },
        { role: "user" as const, content: "now show my tasks" },
      ],
      baseOpts({ hint: "task" }),
    );
    expect(second.toolCalls?.some((c) => c.toolName === "list_tasks")).toBe(true);
  });
});
