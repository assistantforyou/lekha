import { describe, it, expect, beforeEach, vi } from "vitest";

let staged: { kind: string; messageId: string; contentType: string; fileName?: string; sizeBytes?: number; ts: number }[] = [];
const prereadCalls: { userId: string; messageId: string; fileName?: string; token: string }[] = [];
const prepareCalls: { userId: string; messageId: string; fileName?: string }[] = [];
const replies: { userId: string; messages: unknown[] }[] = [];

vi.mock("@/lib/env", () => ({
  env: () => ({ LINE_CHANNEL_ACCESS_TOKEN: "token" }),
}));

vi.mock("@/lib/line/client", () => ({
  replyOrPush: vi.fn(async (userId: string, _token: string, messages: unknown[]) => {
    replies.push({ userId, messages });
    return "reply";
  }),
  text: (s: string) => ({ type: "text", text: s }),
}));

vi.mock("@/lib/memory/recent-media", () => ({
  appendRecentMedia: vi.fn(async (_userId: string, m: typeof staged[number]) => {
    staged.push(m);
  }),
  listRecentMedia: vi.fn(async (_userId: string) => staged),
  clearRecentMedia: vi.fn(async () => {
    staged = [];
  }),
}));

vi.mock("@/lib/memory/history", () => ({
  appendTurn: vi.fn(async () => {}),
}));

vi.mock("@/lib/memory/settings", () => ({
  getSettings: vi.fn(async (_userId: string) => ({ language: "en" })),
}));

vi.mock("@/lib/i18n", () => ({
  t: vi.fn((_lang: string, key: string, params?: Record<string, string>) => {
    const placeholders = params ?? {};
    return `${key}:${Object.values(placeholders).join(":")}`;
  }),
}));

vi.mock("@/lib/maybe-extract", () => ({
  maybeExtractFacts: vi.fn(async () => {}),
}));

vi.mock("@/lib/llm/preread-doc", () => ({
  prereadDoc: vi.fn(async (userId: string, messageId: string, fileName: string | undefined, token: string) => {
    prereadCalls.push({ userId, messageId, fileName, token });
  }),
}));

vi.mock("@/lib/tools/media-ai", () => ({
  autoProcessAudio: vi.fn(async () => ({ transcript: "" })),
  prepareDocumentForQa: vi.fn(async (userId: string, messageId: string, fileName: string | undefined) => {
    prepareCalls.push({ userId, messageId, fileName });
    return { ok: true as const, title: "Test Doc", pageCount: 1 };
  }),
}));

import { respondToOtherMedia } from "@/lib/handlers/other-media";

describe("other-media handler", () => {
  beforeEach(() => {
    staged = [];
    prereadCalls.length = 0;
    prepareCalls.length = 0;
    replies.length = 0;
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => null },
      body: { cancel: vi.fn() },
    } as unknown as Response);
  });

  it("pre-parses a standalone PDF", async () => {
    await respondToOtherMedia("rt", "U1", "M1", "file", "report.pdf", undefined, undefined);
    expect(prepareCalls).toHaveLength(1);
    expect(prepareCalls[0]!.messageId).toBe("M1");
  });

  it("pre-parses a small PDF even when batched", async () => {
    staged.push({ kind: "file", messageId: "M0", contentType: "application/pdf", fileName: "a.pdf", sizeBytes: 1000, ts: Date.now() - 5000 });
    await respondToOtherMedia("rt", "U1", "M1", "file", "report.pdf", 5 * 1024 * 1024, undefined);
    expect(prepareCalls).toHaveLength(1);
  });

  it("skips pre-parse for a large/unknown-size PDF sent in a batch", async () => {
    staged.push({ kind: "file", messageId: "M0", contentType: "application/pdf", fileName: "a.pdf", sizeBytes: 1000, ts: Date.now() - 5000 });
    await respondToOtherMedia("rt", "U1", "M1", "file", "huge.pdf", undefined, undefined);
    expect(prepareCalls).toHaveLength(0);
  });
});
