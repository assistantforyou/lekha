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

import {
  appendFact,
  loadFacts,
  updateFact,
  removeFact,
  clearFacts,
  factsToPromptBlock,
  displayOrder,
} from "@/lib/memory/facts";

describe("structured facts", () => {
  beforeEach(() => reset());

  it("starts empty", async () => {
    const f = await loadFacts("U1");
    expect(f.facts).toEqual([]);
  });

  it("appendFact adds with default category 'other'", async () => {
    await appendFact("U1", "Likes espresso");
    const f = await loadFacts("U1");
    expect(f.facts.length).toBe(1);
    expect(f.facts[0]!.content).toBe("Likes espresso");
    expect(f.facts[0]!.category).toBe("other");
    expect(f.facts[0]!.id).toMatch(/^[0-9a-f]{8,}$/);
  });

  it("dedupes case-insensitively within the same category", async () => {
    await appendFact("U1", "Vegetarian", { category: "preferences" });
    await appendFact("U1", "vegetarian", { category: "preferences" });
    const f = await loadFacts("U1");
    expect(f.facts.length).toBe(1);
  });

  it("allows the same content in different categories", async () => {
    await appendFact("U1", "Bangkok", { category: "context" });
    await appendFact("U1", "Bangkok", { category: "people" });
    const f = await loadFacts("U1");
    expect(f.facts.length).toBe(2);
  });

  it("updateFact replaces by 1-indexed display order", async () => {
    await appendFact("U1", "Old fact");
    const ok = await updateFact("U1", 1, "New fact");
    expect(ok).toBe(true);
    const f = await loadFacts("U1");
    expect(f.facts[0]!.content).toBe("New fact");
  });

  it("removeFact deletes by display index", async () => {
    await appendFact("U1", "a");
    await appendFact("U1", "b");
    const ok = await removeFact("U1", 1);
    expect(ok).toBe(true);
    const f = await loadFacts("U1");
    expect(f.facts.length).toBe(1);
  });

  it("clearFacts wipes everything", async () => {
    await appendFact("U1", "a");
    await appendFact("U1", "b");
    const n = await clearFacts("U1");
    expect(n).toBe(2);
    expect((await loadFacts("U1")).facts).toEqual([]);
  });

  it("displayOrder is newest-updated first", async () => {
    await appendFact("U1", "first");
    await new Promise((r) => setTimeout(r, 5));
    await appendFact("U1", "second");
    const f = await loadFacts("U1");
    const ordered = displayOrder(f.facts);
    expect(ordered[0]!.content).toBe("second");
    expect(ordered[1]!.content).toBe("first");
  });

  it("factsToPromptBlock groups by category", async () => {
    await appendFact("U1", "espresso > filter", { category: "preferences" });
    await appendFact("U1", "mom = mom@gmail.com", { category: "people" });
    const block = factsToPromptBlock(await loadFacts("U1"));
    expect(block).toContain("[preferences]");
    expect(block).toContain("[people]");
    expect(block).toContain("espresso > filter");
    expect(block).toContain("mom = mom@gmail.com");
  });

  it("LRU evicts oldest when exceeding cap", async () => {
    // Force-load 201 facts with stepping timestamps.
    const facts = { facts: [] as Array<{ id: string; category: "other"; content: string; createdAt: number; updatedAt: number }>, updatedAt: Date.now() };
    for (let i = 0; i < 201; i++) {
      facts.facts.push({
        id: String(i),
        category: "other",
        content: `f${i}`,
        createdAt: i,
        updatedAt: i,
      });
    }
    // Save via internal helper path: simulate by writing JSON then reading.
    store.strings.set("user:U1:facts:v2", JSON.stringify(facts));
    // Trigger save through appendFact: this exercises the cap.
    await appendFact("U1", "fresh", { category: "other" });
    const f = await loadFacts("U1");
    expect(f.facts.length).toBeLessThanOrEqual(200);
    // The freshest entry (just appended) should survive.
    const contents = f.facts.map((x) => x.content);
    expect(contents).toContain("fresh");
    // The oldest (f0) should NOT survive.
    expect(contents).not.toContain("f0");
  });
});
