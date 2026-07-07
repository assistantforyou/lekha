import { describe, it, expect, beforeEach, vi } from "vitest";

type ListValue = string | object;
type Store = {
  lists: Map<string, ListValue[]>;
  strings: Map<string, { value: string; expiresAt?: number }>;
  sets: Map<string, Set<string>>;
};

const store: Store = {
  lists: new Map(),
  strings: new Map(),
  sets: new Map(),
};

function reset() {
  store.lists.clear();
  store.strings.clear();
  store.sets.clear();
}

function getList(key: string): ListValue[] {
  let list = store.lists.get(key);
  if (!list) {
    list = [];
    store.lists.set(key, list);
  }
  return list;
}

function getSet(key: string): Set<string> {
  let s = store.sets.get(key);
  if (!s) {
    s = new Set();
    store.sets.set(key, s);
  }
  return s;
}

vi.mock("@/lib/line/group-client", () => ({
  getConversationMemberProfile: vi.fn(async (_conversationId: string, userId: string) => {
    if (userId === "unknown") return null;
    return { displayName: `Fetched ${userId}` };
  }),
}));

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    rpush: async (key: string, ...values: unknown[]) => {
      getList(key).push(...(values.map((v) => (typeof v === "string" ? v : v)) as ListValue[]));
      return getList(key).length;
    },
    lrange: async <T>(key: string, start: number, end: number) => {
      const list = getList(key);
      const len = list.length;
      const s = Math.max(0, start < 0 ? len + start : start);
      const e = Math.min(len - 1, end < 0 ? len + end : end);
      return list.slice(s, e + 1) as T[];
    },
    ltrim: async (key: string, start: number, end: number) => {
      const list = getList(key);
      const len = list.length;
      const s = start >= 0 ? start : len + start;
      const e = end >= 0 ? end : len + end;
      store.lists.set(key, list.slice(s, e + 1));
      return "OK";
    },
    expire: async () => 1,
    set: async (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) => {
      const now = Date.now();
      const existing = store.strings.get(key);
      const live = existing && (!existing.expiresAt || existing.expiresAt > now);
      if (opts?.nx && live) return null;
      store.strings.set(key, {
        value: typeof value === "string" ? value : JSON.stringify(value),
        expiresAt: opts?.ex ? now + opts.ex * 1000 : undefined,
      });
      return "OK";
    },
    get: async <T>(key: string) => {
      const entry = store.strings.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt <= Date.now()) {
        store.strings.delete(key);
        return null;
      }
      try {
        return JSON.parse(entry.value) as T;
      } catch {
        return entry.value as T;
      }
    },
    del: async (...keys: string[]) => {
      let n = 0;
      for (const k of keys) {
        if (store.lists.delete(k)) n++;
        if (store.strings.delete(k)) n++;
        if (store.sets.delete(k)) n++;
      }
      return n;
    },
    keys: async (pattern: string) => {
      const prefix = pattern.replace(/\*$/, "");
      return [...store.strings.keys()].filter((k) => k.startsWith(prefix));
    },
    sismember: async (key: string, member: string) => (getSet(key).has(member) ? 1 : 0),
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
    multi: () => {
      const commands: Array<() => Promise<unknown>> = [];
      const tx = {
        rpush: (key: string, value: unknown) => {
          commands.push(async () => {
            getList(key).push(value as ListValue);
            return getList(key).length;
          });
        },
        ltrim: (key: string, start: number, end: number) => {
          commands.push(async () => {
            const list = getList(key);
            const len = list.length;
            const s = Math.max(0, start < 0 ? len + start : start);
            const e = Math.min(len - 1, end < 0 ? len + end : end);
            store.lists.set(key, list.slice(s, e + 1));
            return "OK";
          });
        },
        expire: () => {
          commands.push(async () => 1);
        },
        exec: async () => {
          const results: unknown[] = [];
          for (const cmd of commands) results.push(await cmd());
          return results;
        },
      };
      return tx;
    },
  }),
}));

import {
  appendGroupTurn,
  loadGroupTurns,
  groupTurnsToMessages,
  getSpeakerDisplayName,
  setSpeakerDisplayName,
  clearGroupHistory,
} from "@/lib/memory/group-history";
import { getConversationMemberProfile } from "@/lib/line/group-client";

const conversationId = "group:C11111111111111111111111111111111";
const botUserId = "U00000000000000000000000000000000";

describe("group context", () => {
  beforeEach(() => reset());

  it("appends and loads group turns in chronological order", async () => {
    await appendGroupTurn(conversationId, {
      userId: "Ua",
      displayName: "Alice",
      text: "Hello",
      ts: 1,
      messageId: "m1",
    });
    await appendGroupTurn(conversationId, {
      userId: "Ub",
      displayName: "Bob",
      text: "Hi Alice",
      ts: 2,
      messageId: "m2",
    });
    const turns = await loadGroupTurns(conversationId, 10);
    expect(turns).toHaveLength(2);
    expect(turns[0]?.text).toBe("Hello");
    expect(turns[1]?.text).toBe("Hi Alice");
  });

  it("caps the rolling history", async () => {
    for (let i = 0; i < 60; i++) {
      await appendGroupTurn(conversationId, {
        userId: "U" + i,
        displayName: `User${i}`,
        text: `msg${i}`,
        ts: i,
        messageId: `m${i}`,
      });
    }
    const turns = await loadGroupTurns(conversationId, 100);
    expect(turns).toHaveLength(50);
    expect(turns[0]?.text).toBe("msg10");
    expect(turns[49]?.text).toBe("msg59");
  });

  it("converts turns to model messages with bot as assistant", () => {
    const msgs = groupTurnsToMessages(
      [
        { userId: "Ua", displayName: "Alice", text: "What do you think?", ts: 1, messageId: "m1" },
        { userId: botUserId, displayName: "Lekha", text: "I like the second idea.", ts: 2, messageId: "m2" },
      ],
      botUserId,
    );
    expect(msgs).toEqual([
      { role: "user", content: "[Alice]: What do you think?" },
      { role: "assistant", content: "I like the second idea." },
    ]);
  });

  it("caches speaker display names and avoids refetching", async () => {
    await setSpeakerDisplayName(conversationId, "Ua", "AliceCached");
    const name = await getSpeakerDisplayName(conversationId, "Ua");
    expect(name).toBe("AliceCached");
    expect(getConversationMemberProfile).not.toHaveBeenCalled();
  });

  it("fetches and caches unknown speaker names", async () => {
    const name = await getSpeakerDisplayName(conversationId, "Ub");
    expect(name).toBe("Fetched Ub");
    const cached = await getSpeakerDisplayName(conversationId, "Ub");
    expect(cached).toBe("Fetched Ub");
    expect(getConversationMemberProfile).toHaveBeenCalledTimes(1);
  });

  it("clears history", async () => {
    await appendGroupTurn(conversationId, {
      userId: "Ua",
      displayName: "Alice",
      text: "Hello",
      ts: 1,
      messageId: "m1",
    });
    await clearGroupHistory(conversationId);
    const turns = await loadGroupTurns(conversationId, 10);
    expect(turns).toHaveLength(0);
  });
});
