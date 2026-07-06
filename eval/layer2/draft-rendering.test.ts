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
import { buildEmailTools } from "@/lib/tools/email";
import { hasDraftConfirmation } from "@/eval/engine/matchers";
import { resetEvalState } from "@/eval/fixtures/state";
import { testProfile, emptyFacts, TEST_USER_ID } from "@/eval/fixtures/user";

beforeEach(async () => {
  await resetEvalState();
});

describe("draft confirmation flow", () => {
  it("sets confirmDraft hint when draft_email succeeds", async () => {
    const scenario: MockLLMScenario = {
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
    mockGenerateText([scenario]);

    const result = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [
      { role: "user", content: "draft an email to my boss saying I'm out tomorrow" },
    ], "trace-draft", {
      tools: buildEmailTools(TEST_USER_ID),
    });

    expect(hasDraftConfirmation(result).pass).toBe(true);
    expect(result.toolCalls?.some((c) => c.toolName === "draft_email")).toBe(true);
  });

  it("does not confirm draft when tool fails", async () => {
    const scenario: MockLLMScenario = {
      result: () => ({
        text: "",
        steps: [{
          toolCalls: [{ toolName: "draft_email", input: { to: ["bad"] } }],
          toolResults: [{ output: { ok: false, error: "missing subject" } }],
        }],
      }),
    };
    mockGenerateText([scenario]);

    const result = await runAgent(TEST_USER_ID, testProfile(), emptyFacts(), [
      { role: "user", content: "draft email" },
    ], "trace-draft-fail", {
      tools: buildEmailTools(TEST_USER_ID),
    });

    expect(result.hints.confirmDraft).toBe(false);
    expect(result.text).toContain("missing subject");
  });
});
