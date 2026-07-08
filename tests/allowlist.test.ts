import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory mock for the Upstash Redis client. Implements just enough of the
// surface area that lib/memory/allowlist.ts uses.
type Store = {
  sets: Map<string, Set<string>>;
  hashes: Map<string, Map<string, string>>;
  zsets: Map<string, Map<string, number>>;
  strings: Map<string, { value: string; expiresAt?: number }>;
};

const store: Store = {
  sets: new Map(),
  hashes: new Map(),
  zsets: new Map(),
  strings: new Map(),
};

function reset() {
  store.sets.clear();
  store.hashes.clear();
  store.zsets.clear();
  store.strings.clear();
}

function getSet(key: string): Set<string> {
  let s = store.sets.get(key);
  if (!s) {
    s = new Set();
    store.sets.set(key, s);
  }
  return s;
}

function getZset(key: string): Map<string, number> {
  let z = store.zsets.get(key);
  if (!z) {
    z = new Map();
    store.zsets.set(key, z);
  }
  return z;
}

function getHash(key: string): Map<string, string> {
  let h = store.hashes.get(key);
  if (!h) {
    h = new Map();
    store.hashes.set(key, h);
  }
  return h;
}

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    sismember: async (key: string, member: string) =>
      getSet(key).has(member) ? 1 : 0,
    sadd: async (key: string, member: string) => {
      const before = getSet(key).size;
      getSet(key).add(member);
      return getSet(key).size - before;
    },
    srem: async (key: string, member: string) => {
      const had = getSet(key).has(member);
      getSet(key).delete(member);
      return had ? 1 : 0;
    },
    smembers: async (key: string) => [...getSet(key)],
    hset: async (key: string, obj: Record<string, string>) => {
      const h = getHash(key);
      for (const [k, v] of Object.entries(obj)) h.set(k, String(v));
      return Object.keys(obj).length;
    },
    hgetall: async (key: string) => {
      const h = store.hashes.get(key);
      if (!h || h.size === 0) return null;
      return Object.fromEntries(h);
    },
    zadd: async (key: string, entry: { score: number; member: string }) => {
      getZset(key).set(entry.member, entry.score);
      return 1;
    },
    zrem: async (key: string, member: string) => {
      const had = getZset(key).has(member);
      getZset(key).delete(member);
      return had ? 1 : 0;
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
      }
      return entries.map(([member]) => member) as T;
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
    del: async (key: string) => {
      let n = 0;
      if (store.sets.delete(key)) n++;
      if (store.hashes.delete(key)) n++;
      if (store.zsets.delete(key)) n++;
      if (store.strings.delete(key)) n++;
      return n;
    },
    set: async (
      key: string,
      value: unknown,
      opts?: { ex?: number; nx?: boolean },
    ) => {
      const now = Date.now();
      const existing = store.strings.get(key);
      const liveExisting = existing && (!existing.expiresAt || existing.expiresAt > now);
      if (opts?.nx && liveExisting) return null;
      store.strings.set(key, {
        value: String(value),
        expiresAt: opts?.ex ? now + opts.ex * 1000 : undefined,
      });
      return "OK";
    },
  }),
}));

import {
  isAllowed,
  isPending,
  addToPending,
  approvePending,
  denyPending,
  listPending,
  getPendingInfo,
  shouldNotifyAdminOfPending,
} from "@/lib/memory/allowlist";

describe("allowlist + pending gate", () => {
  beforeEach(() => reset());

  it("new user is neither allowed nor pending", async () => {
    expect(await isAllowed("Uabc")).toBe(false);
    expect(await isPending("Uabc")).toBe(false);
  });

  it("addToPending puts user in pending with info, not allowed", async () => {
    await addToPending("Uabc", { displayName: "Alice", requestedAt: 12345, message: "hi" });
    expect(await isPending("Uabc")).toBe(true);
    expect(await isAllowed("Uabc")).toBe(false);
    const info = await getPendingInfo("Uabc");
    expect(info).toEqual({ displayName: "Alice", requestedAt: 12345, message: "hi" });
  });

  it("approvePending moves user from pending → allowed", async () => {
    await addToPending("Uabc", { displayName: "Alice", requestedAt: 12345 });
    const wasPending = await approvePending("Uabc");
    expect(wasPending).toBe(true);
    expect(await isPending("Uabc")).toBe(false);
    expect(await isAllowed("Uabc")).toBe(true);
    expect(await getPendingInfo("Uabc")).toBeNull();
  });

  it("approvePending on non-pending user still adds to allowlist", async () => {
    const wasPending = await approvePending("Unever");
    expect(wasPending).toBe(false);
    expect(await isAllowed("Unever")).toBe(true);
  });

  it("denyPending removes from pending without adding to allowlist", async () => {
    await addToPending("Uabc", { displayName: "Alice", requestedAt: 12345 });
    const wasPending = await denyPending("Uabc");
    expect(wasPending).toBe(true);
    expect(await isPending("Uabc")).toBe(false);
    expect(await isAllowed("Uabc")).toBe(false);
  });

  it("denyPending on non-pending user is a no-op", async () => {
    const wasPending = await denyPending("Uxxx");
    expect(wasPending).toBe(false);
  });

  it("listPending returns all pending userIds", async () => {
    await addToPending("Ua", { displayName: "A", requestedAt: 1 });
    await addToPending("Ub", { displayName: "B", requestedAt: 2 });
    const list = await listPending();
    expect(list.sort()).toEqual(["Ua", "Ub"]);
  });

  it("shouldNotifyAdminOfPending is rate-limited per user (NX with TTL)", async () => {
    const first = await shouldNotifyAdminOfPending("Uabc");
    const second = await shouldNotifyAdminOfPending("Uabc");
    expect(first).toBe(true);
    expect(second).toBe(false);
  });
});
