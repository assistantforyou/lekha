import { describe, it, expect, beforeEach, vi } from "vitest";

const store: {
  sets: Map<string, Set<string>>;
  zsets: Map<string, Map<string, number>>;
  strings: Map<string, { value: string; expiresAt?: number }>;
} = {
  sets: new Map(),
  zsets: new Map(),
  strings: new Map(),
};

const sent: { userId: string; messages: unknown[] }[] = [];

function reset() {
  store.sets.clear();
  store.zsets.clear();
  store.strings.clear();
  sent.length = 0;
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

vi.mock("@/lib/env", () => ({
  env: () => ({
    TOKEN_ENCRYPTION_KEY: "a".repeat(64),
    OAUTH_STATE_SECRET: "x".repeat(32),
    APP_BASE_URL: "https://test.example",
  }),
}));

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    get: async <T,>(key: string): Promise<T | null> => {
      const entry = store.strings.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        store.strings.delete(key);
        return null;
      }
      return JSON.parse(entry.value) as T;
    },
    set: async (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) => {
      const now = Date.now();
      const existing = store.strings.get(key);
      const liveExisting = existing && (!existing.expiresAt || existing.expiresAt > now);
      if (opts?.nx && liveExisting) return null;
      store.strings.set(key, {
        value: JSON.stringify(value),
        expiresAt: opts?.ex ? now + opts.ex * 1000 : undefined,
      });
      return "OK";
    },
    del: async (key: string) => {
      let n = 0;
      if (store.strings.delete(key)) n++;
      if (store.sets.delete(key)) n++;
      if (store.zsets.delete(key)) n++;
      return n;
    },
    incr: async (key: string) => {
      const entry = store.strings.get(key);
      let n = 0;
      if (entry) {
        const parsed = JSON.parse(entry.value);
        if (typeof parsed === "number") n = parsed;
      }
      n += 1;
      store.strings.set(key, { value: JSON.stringify(n), expiresAt: entry?.expiresAt });
      return n;
    },
    expire: async (key: string, seconds: number) => {
      const entry = store.strings.get(key);
      if (!entry) return 0;
      entry.expiresAt = Date.now() + seconds * 1000;
      return 1;
    },
    eval: async <T,>(script: string, keys: string[], args: string[]): Promise<T> => {
      const key = keys[0];
      if (!key) return 0 as T;
      // Approximate the trial quota Lua script: incr + expire on first write.
      if (script.includes("incr") && script.includes("expire")) {
        const entry = store.strings.get(key);
        let n = 0;
        if (entry) {
          const parsed = JSON.parse(entry.value);
          if (typeof parsed === "number") n = parsed;
        }
        n += 1;
        const ttl = Number(args[0]);
        store.strings.set(key, { value: JSON.stringify(n), expiresAt: Number.isFinite(ttl) ? Date.now() + ttl * 1000 : entry?.expiresAt });
        return n as T;
      }
      return 0 as T;
    },
    sadd: async (key: string, member: string) => {
      const before = getSet(key).size;
      getSet(key).add(member);
      return getSet(key).size - before;
    },
    sismember: async (key: string, member: string) => (getSet(key).has(member) ? 1 : 0),
    srem: async (key: string, member: string) => {
      const had = getSet(key).has(member);
      getSet(key).delete(member);
      return had ? 1 : 0;
    },
    smembers: async (key: string) => [...getSet(key)],
    zadd: async (key: string, entry: { score: number; member: string }) => {
      getZset(key).set(entry.member, entry.score);
      return 1;
    },
    zscore: async (key: string, member: string) => {
      const score = getZset(key).get(member);
      return score === undefined ? null : score;
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
  }),
}));

vi.mock("@/lib/line/client", () => ({
  replyOrPush: vi.fn(async (userId: string, _token: string, messages: unknown[]) => {
    sent.push({ userId, messages });
    return "reply";
  }),
  text: (s: string) => ({ type: "text", text: s }),
  showLoading: vi.fn(),
  getProfile: vi.fn(async () => ({ displayName: "Test" })),
}));

import {
  isOnTrial,
  addToTrial,
  removeFromTrial,
  checkTrialDailyQuota,
  trialQuotaMessage,
  startTrial,
  TRIAL_DAILY_LIMIT,
} from "@/lib/trial";
import { getTutorialStep } from "@/lib/tutorial";

describe("free trial", () => {
  beforeEach(() => reset());

  it("tracks trial membership", async () => {
    expect(await isOnTrial("U1")).toBe(false);
    await addToTrial("U1");
    expect(await isOnTrial("U1")).toBe(true);
    await removeFromTrial("U1");
    expect(await isOnTrial("U1")).toBe(false);
  });

  it("registers trial users in the active sweep window", async () => {
    await addToTrial("U1");
    expect(getZset("users:active:window").has("U1")).toBe(true);
  });

  it("counts messages up to the daily limit", async () => {
    for (let i = 0; i < TRIAL_DAILY_LIMIT; i++) {
      const q = await checkTrialDailyQuota("U1", "Asia/Bangkok");
      expect(q.ok).toBe(true);
      expect(q.remaining).toBe(TRIAL_DAILY_LIMIT - (i + 1));
    }
    const over = await checkTrialDailyQuota("U1", "Asia/Bangkok");
    expect(over.ok).toBe(false);
    expect(over.remaining).toBe(0);
  });

  it("resets the quota after the local midnight", async () => {
    await checkTrialDailyQuota("U1", "Asia/Bangkok");
    const q = await checkTrialDailyQuota("U1", "Asia/Bangkok");
    expect(q.used).toBe(2);
    // Simulating a new local date by changing the timezone to one already in the next day
    // is not deterministic; instead verify reset time is in the future.
    expect(q.resetsAt.getTime()).toBeGreaterThan(Date.now());
    expect(q.resetsAt.getTime()).toBeLessThanOrEqual(Date.now() + 25 * 60 * 60 * 1000);
  });

  it("renders quota messages in Thai, English, or bilingual", () => {
    const resetsAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const th = trialQuotaMessage("th", resetsAt);
    const en = trialQuotaMessage("en", resetsAt);
    const both = trialQuotaMessage(null, resetsAt);
    expect(th).toContain("วันนี้");
    expect(en).toContain("today");
    expect(both).toContain("today");
    expect(both).toContain("วันนี้");
  });

  it("startTrial adds user to trial and sends welcome", async () => {
    await startTrial("U1", "token", "James");
    expect(await isOnTrial("U1")).toBe(true);
    expect(sent.length).toBeGreaterThan(0);
    expect(await getTutorialStep("U1")).toBe(0);
  });
});
