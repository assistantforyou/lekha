import { describe, it, expect, beforeEach, vi } from "vitest";

const store: {
  zsets: Map<string, Map<string, number>>;
} = {
  zsets: new Map(),
};

function reset() {
  store.zsets.clear();
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
    zadd: async (key: string, entry: { score: number; member: string }) => {
      getZset(key).set(entry.member, entry.score);
      return 1;
    },
    zcount: async (key: string, min: number | string, max: number | string) => {
      const z = getZset(key);
      let entries = Array.from(z.entries());
      if (typeof min === "number") {
        entries = entries.filter(([, score]) => score >= min);
      }
      if (typeof max === "number") {
        entries = entries.filter(([, score]) => score <= max);
      }
      return entries.length;
    },
    zrange: async <T extends unknown[]>(
      key: string,
      min: number | string,
      max: number | string,
      opts?: { byScore?: boolean; rev?: boolean },
    ) => {
      const z = getZset(key);
      let entries = Array.from(z.entries()).sort((a, b) => a[1] - b[1]);
      if (opts?.byScore && typeof min === "number" && max === "+inf") {
        entries = entries.filter(([, score]) => score >= min);
      } else if (typeof min === "number" && typeof max === "number") {
        entries = entries.slice(min, max < 0 ? undefined : max + 1);
      }
      if (opts?.rev) {
        entries.reverse();
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

import {
  registerUser,
  countActiveUsers,
  listActiveUsersSlice,
  listActiveUsers,
} from "@/lib/memory/user-registry";

describe("user registry", () => {
  beforeEach(() => reset());

  it("counts active users within the default window", async () => {
    await registerUser("U1");
    await registerUser("U2");
    expect(await countActiveUsers()).toBe(2);
  });

  it("excludes users outside the window from count", async () => {
    const now = Date.now();
    getZset("users:active:window").set("U_OLD", now - 31 * 24 * 60 * 60 * 1000);
    await registerUser("U_NEW");
    expect(await countActiveUsers()).toBe(1);
  });

  it("returns active users in descending score order", async () => {
    const now = Date.now();
    getZset("users:active:window").set("U1", now - 2000);
    getZset("users:active:window").set("U2", now - 1000);
    getZset("users:active:window").set("U3", now);
    expect(await listActiveUsersSlice(0, 10)).toEqual(["U3", "U2", "U1"]);
  });

  it("paginates active users by cursor and batch size", async () => {
    const now = Date.now();
    getZset("users:active:window").set("U1", now - 2000);
    getZset("users:active:window").set("U2", now - 1000);
    getZset("users:active:window").set("U3", now);
    expect(await listActiveUsersSlice(0, 2)).toEqual(["U3", "U2"]);
    expect(await listActiveUsersSlice(2, 2)).toEqual(["U1"]);
    expect(await listActiveUsersSlice(3, 2)).toEqual([]);
  });

  it("filters out-of-window users from slices", async () => {
    const now = Date.now();
    getZset("users:active:window").set("U_OLD", now - 31 * 24 * 60 * 60 * 1000);
    getZset("users:active:window").set("U_NEW", now);
    expect(await listActiveUsersSlice(0, 10)).toEqual(["U_NEW"]);
  });

  it("listActiveUsers still returns all users in ascending score order", async () => {
    const now = Date.now();
    getZset("users:active:window").set("U1", now - 1000);
    getZset("users:active:window").set("U2", now);
    expect(await listActiveUsers()).toEqual(["U1", "U2"]);
  });
});
