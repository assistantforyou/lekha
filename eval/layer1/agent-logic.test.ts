import { describe, it, expect } from "vitest";
import {
  processResult,
  looksLikeTaskList,
  looksLikeWeather,
  looksLikeMemoryRecall,
  looksLikeFinance,
} from "@/lib/llm/agent";

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

  it("overrides soft apology with real tool error", () => {
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

  it("detects crypto fallback queries", () => {
    expect(looksLikeFinance("btc price")).toEqual({ type: "crypto", coin: "btc" });
    expect(looksLikeFinance("NVDA stock price")).toBeNull();
    expect(looksLikeFinance("what's the weather")).toBeNull();
  });
});
