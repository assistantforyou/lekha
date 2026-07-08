import { describe, it, expect } from "vitest";
import {
  processResult,
  looksLikeTaskList,
  looksLikeWeather,
  looksLikeMemoryRecall,
  looksLikeFinance,
  computeMaxSteps,
  estimatePromptTokens,
} from "@/lib/llm/agent-helpers";

describe("processResult", () => {
  it("renders draft block for draft_email", () => {
    const result = {
      text: "",
      steps: [
        {
          toolCalls: [{ toolName: "draft_email", input: { to: ["a@b.com"], subject: "Hello", body: "Body" } }],
          toolResults: [{ output: { ok: true, id: "d1" } }],
        },
      ],
    };
    const processed = processResult(result, null, [{ toolName: "draft_email", input: { to: ["a@b.com"], subject: "Hello", body: "Body" } }]);
    expect(processed.reply).toContain("📧 Draft email");
    expect(processed.reply).toContain("To: a@b.com");
    expect(processed.hadUnrelayedToolError).toBe(false);
  });

  it("overrides soft apology with real tool error and strips tool name", () => {
    const result = {
      text: "I'm sorry, something went wrong.",
      steps: [
        {
          toolCalls: [{ toolName: "list_tasks", input: {} }],
          toolResults: [{ output: { ok: false, error: "redis unreachable" } }],
        },
      ],
    };
    const processed = processResult(result, null, [{ toolName: "list_tasks", input: {} }]);
    expect(processed.reply).toContain("redis unreachable");
    expect(processed.reply).not.toContain("list_tasks:");
    expect(processed.hadUnrelayedToolError).toBe(true);
  });

  it("returns auth message when need_google_auth is present", () => {
    const result = {
      text: "",
      steps: [
        {
          toolCalls: [{ toolName: "gmail_search", input: {} }],
          toolResults: [{ output: { ok: false, need_google_auth: true, connect_url: "https://example.com", reason: "scopes" } }],
        },
      ],
    };
    const processed = processResult(result, null, []);
    expect(processed.authNeeded).not.toBeNull();
    expect(processed.reply).toBe("");
  });

  it("returns empty reply for morning briefing when tool succeeded", () => {
    const result = {
      text: "",
      steps: [
        {
          toolCalls: [{ toolName: "get_morning_briefing", input: {} }],
          toolResults: [{ toolName: "get_morning_briefing", output: { ok: true, briefingType: "morning", text: "..." } }],
        },
      ],
    };
    const processed = processResult(result, null, [{ toolName: "get_morning_briefing", input: {} }]);
    expect(processed.reply).toBe("");
  });
});

describe("computeMaxSteps", () => {
  it("returns 10 for media hint or staged media", () => {
    expect(computeMaxSteps("media", false, false)).toBe(10);
    expect(computeMaxSteps(undefined, true, false)).toBe(10);
  });

  it("returns 10 for multi-step hints", () => {
    expect(computeMaxSteps("weather", false, true)).toBe(10);
    expect(computeMaxSteps(undefined, false, true)).toBe(10);
  });

  it("returns 8 for specific single-topic hints", () => {
    expect(computeMaxSteps("recent", false, false)).toBe(8);
    expect(computeMaxSteps("email", false, false)).toBe(8);
    expect(computeMaxSteps("reminder", false, false)).toBe(8);
    expect(computeMaxSteps("task", false, false)).toBe(8);
    expect(computeMaxSteps("weather", false, false)).toBe(8);
  });

  it("returns 6 for undefined or other hints", () => {
    expect(computeMaxSteps(undefined, false, false)).toBe(6);
    expect(computeMaxSteps("finance", false, false)).toBe(6);
  });

  it("clamps to [4, 12]", () => {
    expect(computeMaxSteps("media", false, false)).toBe(10);
    expect(computeMaxSteps(undefined, true, false)).toBe(10);
  });
});

describe("estimatePromptTokens", () => {
  it("estimates tokens from system and messages", () => {
    const system = "a".repeat(400);
    const messages = [
      { role: "user" as const, content: "b".repeat(400) },
      { role: "assistant" as const, content: [{ type: "text" as const, text: "c".repeat(400) }] },
    ];
    expect(estimatePromptTokens(system, messages as any)).toBe(300);
  });

  it("ignores non-text content parts", () => {
    const messages = [
      { role: "user" as const, content: [{ type: "image" as const, image: "..." }, { type: "text" as const, text: "hello" }] },
    ];
    expect(estimatePromptTokens("", messages as any)).toBe(Math.ceil("hello".length / 4));
  });
});

describe("deterministic fallbacks", () => {
  it("detects task list queries", () => {
    expect(looksLikeTaskList("show my tasks")).toBe(true);
    expect(looksLikeTaskList("มีงานอะไรเหลือบ้าง")).toBe(true);
    expect(looksLikeTaskList("what's the weather")).toBe(false);
  });

  it("detects weather queries", () => {
    expect(looksLikeWeather("weather in Bangkok")).toBe(true);
    expect(looksLikeWeather("show my tasks")).toBe(false);
  });

  it("detects memory recall queries", () => {
    expect(looksLikeMemoryRecall("what do you remember")).toBe(true);
    expect(looksLikeMemoryRecall("what do you remember about my dog")).toBe(true);
    expect(looksLikeMemoryRecall("show my tasks")).toBe(false);
  });

  it("detects finance fallback queries", () => {
    expect(looksLikeFinance("btc price")).toEqual({ type: "crypto", coin: "btc" });
    expect(looksLikeFinance("NVDA stock price")).toEqual({ type: "stock", ticker: "NVDA" });
    expect(looksLikeFinance("100 USD to THB")).toEqual({ type: "fx", from: "USD", to: "THB", amount: 100 });
    expect(looksLikeFinance("what's the weather")).toBeNull();
  });
});
