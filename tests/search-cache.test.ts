import { describe, it, expect, beforeEach, vi } from "vitest";

const store: { strings: Map<string, string> } = { strings: new Map() };
function reset() { store.strings.clear(); }

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    get: async <T,>(key: string): Promise<T | null> => {
      const v = store.strings.get(key);
      return v ? (JSON.parse(v) as T) : null;
    },
    set: async (key: string, value: unknown) => {
      store.strings.set(key, JSON.stringify(value));
      return "OK";
    },
    del: async (key: string) => (store.strings.delete(key) ? 1 : 0),
  }),
}));

import { fetchCachedWebSearch, fetchCachedNewsSearch } from "@/lib/search-cache";

describe("search cache", () => {
  beforeEach(() => {
    reset();
    vi.restoreAllMocks();
  });

  it("caches web search results and reuses them", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "It is a fruit.",
        results: [{ title: "Apple", url: "https://example.com/apple", content: "Apple info" }],
      }),
    } as Response);

    const first = await fetchCachedWebSearch("what is an apple", "key", 5);
    expect(first.results).toHaveLength(1);
    expect(first.results[0]!.snippet).toBe("Apple info");
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const second = await fetchCachedWebSearch("what is an apple", "key", 5);
    expect(second.results).toEqual(first.results);
    expect(global.fetch).toHaveBeenCalledTimes(1); // cached
  });

  it("caches news search results separately by days", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: "News summary.",
        results: [{ title: "Headline", url: "https://example.com/news", content: "Story", published_date: "2026-06-14" }],
      }),
    } as Response);

    const a = await fetchCachedNewsSearch("thailand news", "key", 2, 5);
    const b = await fetchCachedNewsSearch("thailand news", "key", 7, 5);
    expect(a.stories[0]!.published).toBe("2026-06-14");
    expect(global.fetch).toHaveBeenCalledTimes(2); // different cache keys for different days

    const aAgain = await fetchCachedNewsSearch("thailand news", "key", 2, 5);
    expect(aAgain.stories).toEqual(a.stories);
    expect(global.fetch).toHaveBeenCalledTimes(2); // reused
  });

  it("returns empty results on fetch failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Tavily down"));
    const result = await fetchCachedWebSearch("query", "key", 5);
    expect(result.results).toEqual([]);
    expect(result.answer).toBeNull();
  });
});
