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
