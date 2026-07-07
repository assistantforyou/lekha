import { describe, it, expect, beforeEach, vi } from "vitest";

type Store = {
  sets: Map<string, Set<string>>;
  zsets: Map<string, Map<string, number>>;
  strings: Map<string, { value: string; expiresAt?: number }>;
  lists: Map<string, unknown[]>;
};

const store: Store = {
  sets: new Map(),
  zsets: new Map(),
  strings: new Map(),
  lists: new Map(),
};

const sent: { to: string; messages: unknown[] }[] = [];

function reset() {
  store.sets.clear();
  store.zsets.clear();
  store.strings.clear();
  store.lists.clear();
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

function getList(key: string): unknown[] {
  let list = store.lists.get(key);
  if (!list) {
    list = [];
    store.lists.set(key, list);
  }
  return list;
}

vi.mock("@/lib/env", () => ({
  env: () => ({
    TOKEN_ENCRYPTION_KEY: "a".repeat(64),
    OAUTH_STATE_SECRET: "x".repeat(32),
    APP_BASE_URL: "https://test.example",
    ADMIN_LINE_USER_ID: "Uadmin00000000000000000000000000",
    LINE_BOT_USER_ID: "Ubot0000000000000000000000000000",
    ADMIN_GROUP_IDS: "Cadmin00000000000000000000000000",
  }),
}));

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
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
      const z = getZset(key);
      z.set(entry.member, entry.score);
      return 1;
    },
    zscore: async (key: string, member: string) => {
      const score = getZset(key).get(member);
      return score === undefined ? null : score;
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
        if (store.sets.delete(k)) n++;
        if (store.zsets.delete(k)) n++;
        if (store.strings.delete(k)) n++;
        if (store.lists.delete(k)) n++;
      }
      return n;
    },
    keys: async (pattern: string) => {
      const prefix = pattern.replace(/\*$/, "");
      return [...store.strings.keys()].filter((k) => k.startsWith(prefix));
    },
    rpush: async (key: string, value: unknown) => {
      getList(key).push(value);
      return getList(key).length;
    },
    lrange: async <T>(key: string, start: number, end: number) => {
      const list = getList(key);
      const len = list.length;
      const s = Math.max(0, start < 0 ? len + start : start);
      const e = Math.min(len - 1, end < 0 ? len + end : end);
      return list.slice(s, e + 1) as T[];
    },
    multi: () => {
      const commands: Array<() => Promise<unknown>> = [];
      return {
        rpush: (key: string, value: unknown) =>
          commands.push(async () => {
            getList(key).push(value as { userId: string; displayName: string; text: string; ts: number; messageId: string });
            return getList(key).length;
          }),
        ltrim: (key: string, start: number, end: number) =>
          commands.push(async () => {
            const list = getList(key);
            const len = list.length;
            const s = Math.max(0, start < 0 ? len + start : start);
            const e = Math.min(len - 1, end < 0 ? len + end : end);
            store.lists.set(key, list.slice(s, e + 1));
            return "OK";
          }),
        expire: () => commands.push(async () => 1),
        exec: async () => {
          const results: unknown[] = [];
          for (const cmd of commands) results.push(await cmd());
          return results;
        },
      };
    },
  }),
}));

vi.mock("@/lib/line/group-client", () => ({
  getConversationMemberProfile: vi.fn(async (_conversationId: string, userId: string) => ({
    displayName: `Member ${userId.slice(0, 4)}`,
  })),
}));

vi.mock("@/lib/line/client", () => ({
  replyOrPush: vi.fn(async (to: string, _token: string, messages: unknown[]) => {
    sent.push({ to, messages });
    return "reply";
  }),
  reply: vi.fn(async () => true),
  push: vi.fn(async () => true),
  text: (s: string) => ({ type: "text", text: s }),
  getProfile: vi.fn(async (userId: string) => ({ displayName: `User ${userId.slice(0, 4)}` })),
  showLoading: vi.fn(async () => {}),
}));

vi.mock("@/lib/memory/profile", () => ({
  getOrCreateProfile: vi.fn(async (userId: string) => ({ displayName: `User ${userId.slice(0, 4)}` })),
}));

vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn(async () => ({ ok: true, retryAfterSec: 0 })),
}));

vi.mock("@/lib/handlers/text", () => ({
  respondToText: vi.fn(async (_replyToken, userId, _profile, userText, _traceId, opts) => {
    sent.push({ to: userId, messages: [{ type: "text", text: `responded to: ${userText}` }] });
    opts?.onQuoteTokens?.(["quote-token-from-bot"]);
  }),
}));

import { buildGate, type Gate } from "@/lib/gate";
import {
  getConversationId,
  isGroupEvent,
  isMentionOfBot,
  isNameInvocation,
  isReplyToBotQuote,
  recordBotQuoteTokens,
  shouldRespondInGroup,
} from "@/lib/group";
import { hasGroupAccess, addAllowedGroup, isGroupAllowed, addToTeam } from "@/lib/group-access";
import { handleJoin, handleLeave, handleMemberJoined, handleMemberLeft } from "@/lib/handlers/group-lifecycle";
import { handleGroupMessage } from "@/lib/handlers/group-message";
import type { LineMessageEvent, MemberJoinedEvent, MemberLeftEvent } from "@/lib/line/types";

const adminId = "Uadmin00000000000000000000000000";
const botId = "Ubot0000000000000000000000000000";
const groupId = "C11111111111111111111111111111111";
const conversationId = `group:${groupId}`;

function groupMessage(text: string, userId: string, opts?: { mention?: boolean; quoteToken?: string }): LineMessageEvent {
  return {
    type: "message",
    webhookEventId: `evt_${userId}_${Date.now()}`,
    timestamp: Date.now(),
    source: { type: "group", groupId, userId },
    replyToken: `rt_${userId}`,
    message: {
      type: "text",
      id: `m_${userId}_${Date.now()}`,
      text,
      mention: opts?.mention
        ? { mentionees: [{ index: 0, length: 6, userId: botId }] }
        : undefined,
      quoteToken: opts?.quoteToken,
    },
    mode: "active",
  } as LineMessageEvent;
}

function buildMemberEvent(kind: "joined" | "left", members: { userId: string }[], inviterId?: string): MemberJoinedEvent | MemberLeftEvent {
  return {
    type: kind === "joined" ? "memberJoined" : "memberLeft",
    webhookEventId: `evt_${kind}_${Date.now()}`,
    timestamp: Date.now(),
    source: { type: "group", groupId, userId: inviterId },
    replyToken: `rt_${kind}`,
    [kind]: { members },
  } as MemberJoinedEvent | MemberLeftEvent;
}

describe("group chat support", () => {
  beforeEach(() => reset());

  it("detects group sources and conversation ids", () => {
    const event = groupMessage("hi", "U1");
    expect(isGroupEvent(event)).toBe(true);
    expect(getConversationId(event.source)).toBe(conversationId);
  });

  it("isNameInvocation matches @Lekha and Lekha:", () => {
    expect(isNameInvocation("@Lekha what is this?")).toBe(true);
    expect(isNameInvocation("Lekha, summarize")).toBe(true);
    expect(isNameInvocation("hello everyone")).toBe(false);
  });

  it("isMentionOfBot uses LINE mention metadata", () => {
    expect(isMentionOfBot({ text: "@Lekha hi", mention: { mentionees: [{ userId: botId }] } }, botId)).toBe(true);
    expect(isMentionOfBot({ text: "@Other hi", mention: { mentionees: [{ userId: "Uother" }] } }, botId)).toBe(false);
  });

  it("shouldRespondInGroup true only on mention or name invocation", () => {
    expect(shouldRespondInGroup(groupMessage("@Lekha what?", "U1", { mention: true }), botId, new Set())).toBe(true);
    expect(shouldRespondInGroup(groupMessage("Lekha, what?", "U1"), botId, new Set())).toBe(true);
    expect(shouldRespondInGroup(groupMessage("what do you think?", "U1"), botId, new Set())).toBe(false);
  });

  it("hasGroupAccess allows admins", async () => {
    const gate = buildGate();
    expect(await hasGroupAccess({ userId: adminId, groupId, gate })).toBe(true);
  });

  it("hasGroupAccess allows explicitly allowed groups", async () => {
    const gate = buildGate();
    await addAllowedGroup(groupId);
    expect(await hasGroupAccess({ userId: "Unew", groupId, gate })).toBe(true);
  });

  it("hasGroupAccess allows env ADMIN_GROUP_IDS", async () => {
    const gate = buildGate();
    expect(await hasGroupAccess({ userId: "Unew", groupId: "Cadmin00000000000000000000000000", gate })).toBe(true);
  });

  it("hasGroupAccess allows team subscribers", async () => {
    const gate = buildGate();
    await addToTeam("Uteam");
    expect(await hasGroupAccess({ userId: "Uteam", groupId, gate })).toBe(true);
  });

  it("hasGroupAccess denies unknown users in unallowed groups", async () => {
    const gate = buildGate();
    expect(await hasGroupAccess({ userId: "Unew", groupId, gate })).toBe(false);
  });

  it("auto-allows group when admin adds the bot", async () => {
    const gate = buildGate();
    const event = buildMemberEvent("joined", [{ userId: botId }], adminId);
    const r = await handleMemberJoined(event as MemberJoinedEvent, gate);
    expect(r).toBe(true);
    expect(await isGroupAllowed(groupId)).toBe(true);
    expect(sent.length).toBe(1);
  });

  it("sends Team paywall when non-admin adds the bot", async () => {
    const gate = buildGate();
    const event = buildMemberEvent("joined", [{ userId: botId }], "Unew");
    const r = await handleMemberJoined(event as MemberJoinedEvent, gate);
    expect(r).toBe(true);
    expect(await isGroupAllowed(groupId)).toBe(false);
    // Group gets the paywall; admins also get a notification with allow/ignore buttons.
    expect(sent.length).toBe(2);
    const groupMsg = sent.find((s) => s.to === groupId);
    expect(groupMsg).toBeDefined();
    expect(JSON.stringify(groupMsg!.messages[0])).toContain("Team");
  });

  it("removes group access on leave", async () => {
    await addAllowedGroup(groupId);
    await handleLeave({ type: "leave", webhookEventId: "e1", timestamp: 1, source: { type: "group", groupId } } as any);
    expect(await isGroupAllowed(groupId)).toBe(false);
  });

  it("removes group access when bot is removed", async () => {
    await addAllowedGroup(groupId);
    const event = buildMemberEvent("left", [{ userId: botId }]);
    await handleMemberLeft(event as MemberLeftEvent);
    expect(await isGroupAllowed(groupId)).toBe(false);
  });

  it("admin /allowgroup authorises the group", async () => {
    const gate = buildGate();
    const targetGroup = "C22222222222222222222222222222222";
    const event = groupMessage(`/allowgroup ${targetGroup}`, adminId);
    const r = await handleGroupMessage(event, gate);
    expect(r).toBe(true);
    expect(await isGroupAllowed(targetGroup)).toBe(true);
    expect(sent.length).toBe(1);
  });

  it("mention triggers response in allowed group", async () => {
    await addAllowedGroup(groupId);
    const gate = buildGate();
    const event = groupMessage("@Lekha what do you think?", "U1", { mention: true });
    const r = await handleGroupMessage(event, gate);
    expect(r).toBe(true);
    expect(sent.length).toBe(1);
    expect(JSON.stringify(sent[0]!)).toContain("responded to");
  });

  it("chatter is ignored even in allowed group", async () => {
    await addAllowedGroup(groupId);
    const gate = buildGate();
    const event = groupMessage("I agree with that idea", "U1");
    const r = await handleGroupMessage(event, gate);
    expect(r).toBe(true);
    expect(sent.length).toBe(0);
  });

  it("mention in unauthorised group sends paywall once", async () => {
    const gate = buildGate();
    const event = groupMessage("@Lekha what?", "U1", { mention: true });
    const r1 = await handleGroupMessage(event, gate);
    const r2 = await handleGroupMessage(event, gate);
    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(sent.length).toBe(1);
    expect(JSON.stringify(sent[0]!.messages[0])).toContain("Team");
  });

  it("replying to a bot message triggers response in allowed group", async () => {
    await addAllowedGroup(groupId);
    await recordBotQuoteTokens(conversationId, ["qt-bot-123"]);
    const gate = buildGate();
    const event = groupMessage("follow up", "U1", { quoteToken: "qt-bot-123" });
    const r = await handleGroupMessage(event, gate);
    expect(r).toBe(true);
    expect(sent.length).toBe(1);
    expect(JSON.stringify(sent[0]!)).toContain("responded to");
  });

  it("replying to a bot message without access sends paywall", async () => {
    await recordBotQuoteTokens(conversationId, ["qt-bot-456"]);
    const gate = buildGate();
    const event = groupMessage("follow up", "U1", { quoteToken: "qt-bot-456" });
    const r = await handleGroupMessage(event, gate);
    expect(r).toBe(true);
    expect(sent.length).toBe(1);
    expect(JSON.stringify(sent[0]!.messages[0])).toContain("Team");
  });

  it("isReplyToBotQuote returns false for unknown or missing quote tokens", async () => {
    await recordBotQuoteTokens(conversationId, ["known"]);
    expect(await isReplyToBotQuote(conversationId, "known")).toBe(true);
    expect(await isReplyToBotQuote(conversationId, "unknown")).toBe(false);
    expect(await isReplyToBotQuote(conversationId, undefined)).toBe(false);
  });
});
