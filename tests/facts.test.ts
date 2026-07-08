import { describe, it, expect, beforeEach, vi } from "vitest";

type Store = {
  hashes: Map<string, Map<string, string>>;
  zsets: Map<string, Map<string, number>>;
  strings: Map<string, string>;
};

const store: Store = {
  hashes: new Map(),
  zsets: new Map(),
  strings: new Map(),
};

function reset() {
  store.hashes.clear();
  store.zsets.clear();
  store.strings.clear();
}

function getHash(key: string): Map<string, string> {
  let h = store.hashes.get(key);
  if (!h) {
    h = new Map();
    store.hashes.set(key, h);
  }
  return h;
}

function getZset(key: string): Map<string, number> {
  let z = store.zsets.get(key);
  if (!z) {
    z = new Map();
    store.zsets.set(key, z);
  }
  return z;
}

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
    del: async (key: string) => {
      let n = 0;
      if (store.hashes.delete(key)) n++;
      if (store.zsets.delete(key)) n++;
      if (store.strings.delete(key)) n++;
      return n;
    },
    hset: async (key: string, obj: Record<string, string>) => {
      const h = getHash(key);
      for (const [k, v] of Object.entries(obj)) h.set(k, String(v));
      return Object.keys(obj).length;
    },
    hgetall: async <T extends Record<string, string>>(key: string) => {
      const h = store.hashes.get(key);
      if (!h || h.size === 0) return null;
      return Object.fromEntries(h) as T;
    },
    hdel: async (key: string, ...fields: string[]) => {
      const h = store.hashes.get(key);
      if (!h) return 0;
      let n = 0;
      for (const f of fields) if (h.delete(f)) n++;
      return n;
    },
    hlen: async (key: string) => getHash(key).size,
    zadd: async (
      key: string,
      entry: { score: number; member: string } | Array<{ score: number; member: string }>,
    ) => {
      const z = getZset(key);
      const entries = Array.isArray(entry) ? entry : [entry];
      for (const e of entries) z.set(e.member, e.score);
      return entries.length;
    },
    zrange: async <T extends unknown[]>(
      key: string,
      min: number | string,
      max: number | string,
      opts?: { byScore?: boolean },
    ) => {
      const z = getZset(key);
      let entries = Array.from(z.entries()).sort((a, b) => a[1] - b[1]);
      if (opts?.byScore && typeof min === "number" && max === "+inf") {
        entries = entries.filter(([, score]) => score >= min);
      } else if (typeof min === "number" && typeof max === "number") {
        // rank range
        entries = entries.slice(min, max < 0 ? undefined : max + 1);
      }
      return entries.map(([member]) => member) as T;
    },
    zscore: async (key: string, member: string) => {
      const score = getZset(key).get(member);
      return score === undefined ? null : score;
    },
    zremrangebyrank: async (key: string, start: number, stop: number) => {
      const z = getZset(key);
      const entries = Array.from(z.entries()).sort((a, b) => a[1] - b[1]);
      const end = stop < 0 ? entries.length + stop : stop;
      let n = 0;
      for (let i = start; i <= end; i++) {
        const entry = entries[i];
        if (entry && z.delete(entry[0])) n++;
      }
      return n;
    },
    zremrangebyscore: async (key: string, min: number, max: number) => {
      const z = getZset(key);
      let n = 0;
      for (const [member, score] of z) {
        if (score >= min && score <= max) {
          z.delete(member);
          n++;
        }
      }
      return n;
    },
    zcard: async (key: string) => getZset(key).size,
    multi: () => {
      const ops: (() => unknown)[] = [];
      return {
        hset: (key: string, obj: Record<string, string>) =>
          ops.push(() => {
            const h = getHash(key);
            let n = 0;
            for (const [k, v] of Object.entries(obj)) {
              h.set(k, String(v));
              n++;
            }
            return n;
          }),
        zadd: (key: string, entry: { score: number; member: string }) =>
          ops.push(() => {
            getZset(key).set(entry.member, entry.score);
            return 1;
          }),
        zremrangebyrank: (key: string, start: number, stop: number) =>
          ops.push(() => {
            const z = getZset(key);
            const entries = Array.from(z.entries()).sort((a, b) => a[1] - b[1]);
            const end = stop < 0 ? entries.length + stop : stop;
            let n = 0;
            for (let i = start; i <= end; i++) {
              const entry = entries[i];
              if (entry && z.delete(entry[0])) n++;
            }
            return n;
          }),
        hdel: (key: string, ...fields: string[]) =>
          ops.push(() => {
            const h = store.hashes.get(key);
            if (!h) return 0;
            let n = 0;
            for (const f of fields) if (h.delete(f)) n++;
            return n;
          }),
        del: (key: string) =>
          ops.push(() => {
            let n = 0;
            if (store.hashes.delete(key)) n++;
            if (store.zsets.delete(key)) n++;
            return n;
          }),
        exec: async () => ops.map((fn) => fn()),
      };
    },
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
  _resetFactsCache,
} from "@/lib/memory/facts";

describe("structured facts", () => {
  beforeEach(() => {
    reset();
    _resetFactsCache();
  });

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
    // Force-load 501 facts with stepping timestamps.
    const facts = {
      facts: [] as Array<{
        id: string;
        category: "other";
        content: string;
        createdAt: number;
        updatedAt: number;
      }>,
      updatedAt: Date.now(),
    };
    for (let i = 0; i < 501; i++) {
      facts.facts.push({
        id: String(i),
        category: "other",
        content: `f${i}`,
        createdAt: i,
        updatedAt: i,
      });
    }
    store.strings.set("user:U1:facts:v2", JSON.stringify(facts));
    // Trigger save through appendFact: this exercises the cap.
    await appendFact("U1", "fresh", { category: "other" });
    const f = await loadFacts("U1");
    expect(f.facts.length).toBeLessThanOrEqual(500);
    // The freshest entry (just appended) should survive.
    const contents = f.facts.map((x) => x.content);
    expect(contents).toContain("fresh");
    // The oldest (f0) should NOT survive.
    expect(contents).not.toContain("f0");
  });

  it("factsToPromptBlock respects limit param", async () => {
    // Add 10 facts with distinct timestamps so order is deterministic.
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 2));
      await appendFact("U1", `fact${i}`, { category: "other" });
    }
    const f = await loadFacts("U1");
    // Default: all 10 visible (under PROMPT_FACTS_MAX=30).
    const full = factsToPromptBlock(f);
    expect(full.split("- fact").length - 1).toBe(10);
    // With limit=3: only the 3 most-recently-updated appear.
    const narrow = factsToPromptBlock(f, 3);
    expect(narrow.split("- fact").length - 1).toBe(3);
    // The narrowed block should contain the newest facts (highest index).
    expect(narrow).toContain("fact9");
    expect(narrow).not.toContain("fact0");
  });

  it("priority facts are injected before regular facts within the same limit", async () => {
    await appendFact("U1", "regular old", { category: "other" });
    await new Promise((r) => setTimeout(r, 5));
    await appendFact("U1", "priority upload", { category: "context", priority: 1 });
    await new Promise((r) => setTimeout(r, 5));
    await appendFact("U1", "regular new", { category: "other" });

    const f = await loadFacts("U1");
    const block = factsToPromptBlock(f, 2);
    const lines = block.split("\n").filter((l) => l.startsWith("- "));
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("priority upload");
    expect(lines[1]).toContain("regular new");
  });

  it("appendFact upgrades priority on duplicate", async () => {
    await appendFact("U1", "uploaded doc", { category: "context" });
    await appendFact("U1", "uploaded doc", { category: "context", priority: 1 });
    const f = await loadFacts("U1");
    expect(f.facts[0]!.priority).toBe(1);
  });
});
