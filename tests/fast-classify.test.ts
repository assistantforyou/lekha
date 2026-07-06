import { describe, it, expect } from "vitest";
import { fastClassify } from "@/lib/fast-classify";
import { BASE_PERSONALITY } from "@/lib/llm/prompts";

describe("fastClassify", () => {
  it("classifies recent/current event queries as 'recent' when they are unambiguous", () => {
    expect(fastClassify("What happened in the election today?")).toBe("recent");
    expect(fastClassify("Latest iPhone release")).toBe("recent");
    expect(fastClassify("Who won last night?")).toBe("recent");
    expect(fastClassify("Is the airport open right now?")).toBe("recent");
    expect(fastClassify("What did they announce this week?")).toBe("recent");
  });

  it("falls back to undefined (all tools) when recent markers overlap with other intents", () => {
    // "Latest" triggers recent AND "AAPL stock price" triggers finance.
    expect(fastClassify("Latest AAPL stock price")).toBeUndefined();
    // "Breaking news" triggers news AND "hurricane" triggers recent.
    expect(fastClassify("Breaking news about the hurricane")).toBeUndefined();
  });

  it("classifies explicit research queries as 'search'", () => {
    expect(fastClassify("search for Thai restaurants")).toBe("search");
    expect(fastClassify("why did the economy crash")).toBe("search");
  });

  it("classifies news queries as 'news'", () => {
    expect(fastClassify("top headlines")).toBe("news");
    expect(fastClassify("news about AI")).toBe("news");
  });

  it("returns undefined for ambiguous or casual messages", () => {
    expect(fastClassify("hello")).toBeUndefined();
    expect(fastClassify("what's up")).toBeUndefined();
    expect(fastClassify("ok")).toBeUndefined();
    expect(fastClassify("tell me a joke")).toBeUndefined();
  });

  it("prefers staged-media hint when media is referenced", () => {
    expect(fastClassify("summarize this file", { hasStagedMedia: true })).toBe("media");
    expect(fastClassify("what's in this image", { hasStagedMedia: true })).toBe("media");
  });

  it("classifies google account queries as 'connect' for both singular and plural phrasing", () => {
    // Regression: \b doesn't match mid-word, so "google\s+account\b" alone
    // never matched the plural "accounts" — the query fell through to the
    // full tool registry instead of narrowing.
    expect(fastClassify("connect my google account")).toBe("connect");
    expect(fastClassify("list my connected google accounts")).toBe("connect");
  });

  it("classifies 'list my reminders' as 'reminder', matching the 'my' the task pattern already allows", () => {
    // Regression: the pattern required "list" immediately followed by
    // "reminder(s)" with no "my" in between, unlike the task pattern
    // (list\s+(my\s+)?tasks?) which already handled this. Fell through to
    // the full tool registry and Gemini blanked on live testing.
    expect(fastClassify("list my reminders")).toBe("reminder");
    expect(fastClassify("list reminders")).toBe("reminder");
  });

  it("handles plural nouns across all intents — \\b doesn't match mid-word", () => {
    // Same bug class as the google-accounts and list-my-reminders regressions
    // above, audited across the whole KEYWORD_MAP after finding it a third
    // time live ("list my scheduled emails" blanked the model on production).
    expect(fastClassify("cancel my reminders")).toBe("reminder");
    expect(fastClassify("delete my reminders")).toBe("reminder");
    expect(fastClassify("add tasks: buy milk, walk the dog")).toBe("task");
    expect(fastClassify("delete my tasks")).toBe("task");
    expect(fastClassify("what calendar events do I have")).toBe("calendar");
    expect(fastClassify("schedule calls for next week")).toBe("calendar");
    expect(fastClassify("list my scheduled emails")).toBe("email");
    expect(fastClassify("send emails to the team")).toBe("email");
    expect(fastClassify("search my memories for that")).toBe("memory");
  });
});

describe("search-first prompt rules", () => {
  it("commands search first for recent/current/live information", () => {
    expect(BASE_PERSONALITY).toMatch(/ALWAYS call web_search or news_search FIRST/i);
    expect(BASE_PERSONALITY).toMatch(/current\/recent\/live information/i);
  });

  it("commands news_search first for news/current events", () => {
    expect(BASE_PERSONALITY).toMatch(/News\/current events → ALWAYS news_search first/i);
  });

  it("commands web_search first for general research", () => {
    expect(BASE_PERSONALITY).toMatch(/General research.*ALWAYS web_search first/i);
  });
});
