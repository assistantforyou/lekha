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
import { hasDraftConfirmation } from "@/eval/engine/matchers";
import { resetEvalState } from "@/eval/fixtures/state";
import { testProfile, testSettings, emptyFacts, TEST_USER_ID } from "@/eval/fixtures/user";

beforeEach(async () => {
  await resetEvalState();
});

function baseOpts() {
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
  };
}

describe("draft confirmation flow", () => {
  it("sets confirmDraft hint when draft_email succeeds", async () => {
    const scenario: MockMastraScenario = {
      result: () => ({
        text: "I drafted an email for you.",
        steps: [{
          text: "I drafted an email for you.",
          toolCalls: [{
            toolName: "draft_email",
            input: {
              to: ["boss@example.com"],
              subject: "Out tomorrow",
              body: "Hi, I'll be out tomorrow.",
            },
          }],
          toolResults: [{ output: { ok: true, id: "d1" } }],
        }],
      }),
    };
    mockMastraAgent([scenario]);

    const result = await runMastraAgent(
      [{ role: "user" as const, content: "draft an email to my boss saying I'm out tomorrow" }],
      baseOpts(),
    );

    expect(hasDraftConfirmation(result).pass).toBe(true);
    expect(result.toolCalls?.some((c) => c.toolName === "draft_email")).toBe(true);
  });

  it("does not confirm draft when tool fails", async () => {
    const scenario: MockMastraScenario = {
      result: () => ({
        text: "",
        steps: [{
          toolCalls: [{ toolName: "draft_email", input: { to: ["bad"] } }],
          toolResults: [{ output: { ok: false, error: "missing subject" } }],
        }],
      }),
    };
    mockMastraAgent([scenario]);

    const result = await runMastraAgent(
      [{ role: "user" as const, content: "draft email" }],
      baseOpts(),
    );

    expect(result.hints.confirmDraft).toBe(false);
    expect(result.text).toContain("missing subject");
  });
});
