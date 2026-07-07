import { describe, it, expect, beforeEach, vi } from "vitest";

const store: { sets: Map<string, Set<string>> } = { sets: new Map() };
const sent: { userId: string; messages: unknown[] }[] = [];

function reset() {
  store.sets.clear();
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

vi.mock("@/lib/env", () => ({
  env: () => ({
    TOKEN_ENCRYPTION_KEY: "a".repeat(64),
    OAUTH_STATE_SECRET: "x".repeat(32),
    APP_BASE_URL: "https://test.example",
    ADMIN_LINE_USER_ID: "Uadmin00000000000000000000000000",
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
  }),
}));

vi.mock("@/lib/line/client", () => ({
  replyOrPush: vi.fn(async (userId: string, _token: string, messages: unknown[]) => {
    sent.push({ userId, messages });
    return "reply";
  }),
  text: (s: string) => ({ type: "text", text: s }),
}));

import { buildGate, passesGate } from "@/lib/gate";
import { addToAllowlist } from "@/lib/memory/allowlist";
import { addToTrial } from "@/lib/trial";
import type { LineEvent } from "@/lib/line/types";

function messageEvent(userId: string): LineEvent {
  return {
    type: "message",
    webhookEventId: `evt_${userId}`,
    timestamp: Date.now(),
    source: { type: "user", userId },
    replyToken: `rt_${userId}`,
    message: { type: "text", id: "m1", text: "hi" },
    mode: "active",
  } as LineEvent;
}

describe("access gate", () => {
  beforeEach(() => reset());

  it("lets admins through", async () => {
    const gate = buildGate();
    const ok = await passesGate(messageEvent("Uadmin00000000000000000000000000"), gate);
    expect(ok).toBe(true);
    expect(sent.length).toBe(0);
  });

  it("lets allowlisted users through", async () => {
    await addToAllowlist("Uallowed");
    const gate = buildGate();
    const ok = await passesGate(messageEvent("Uallowed"), gate);
    expect(ok).toBe(true);
    expect(sent.length).toBe(0);
  });

  it("lets trial users through", async () => {
    await addToTrial("Utrial");
    const gate = buildGate();
    const ok = await passesGate(messageEvent("Utrial"), gate);
    expect(ok).toBe(true);
    expect(sent.length).toBe(0);
  });

  it("sends the paywall to unknown users", async () => {
    const gate = buildGate();
    const ok = await passesGate(messageEvent("Unew"), gate);
    expect(ok).toBe(false);
    expect(sent.length).toBe(1);
    const msg = sent[0]!.messages[0] as { type?: string; altText?: string };
    expect(msg.type).toBe("flex");
    expect(msg.altText?.toLowerCase()).toContain("free trial");
    const json = JSON.stringify(msg);
    expect(json).toContain("trial:start");
    expect(json).toContain("Monthly");
    expect(json).toContain("Yearly");
  });
});
