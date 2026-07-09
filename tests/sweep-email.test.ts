import { describe, it, expect, beforeEach, vi } from "vitest";

const sentEmails: Array<{ userId: string; args: unknown }> = [];
const store: Record<string, unknown> = {};

vi.mock("@/lib/tools/email", () => ({
  sendEmail: vi.fn(async (userId: string, args: unknown) => {
    sentEmails.push({ userId, args });
    return { from: "user@example.com" };
  }),
}));

vi.mock("@/lib/tools/google-auth", () => ({
  listAccounts: vi.fn(async (_userId: string) => ({ accounts: [], activeEmail: "user@example.com" })),
}));

vi.mock("@/lib/memory/sent-log", () => ({
  logSent: vi.fn(async () => {}),
}));

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    get: async <T>(_key: string) => (store[_key] as T) ?? null,
    set: async (_key: string, value: unknown) => {
      store[_key] = value;
      return "OK";
    },
    del: async (_key: string) => {
      const existed = _key in store;
      delete store[_key];
      return existed ? 1 : 0;
    },
    multi: () => ({
      lpush: () => {},
      ltrim: () => {},
      expire: () => {},
      exec: async () => [],
    }),
    lrange: async () => [],
  }),
}));

import { sendBriefingEmail } from "@/lib/sweep";

describe("sendBriefingEmail", () => {
  beforeEach(() => {
    sentEmails.length = 0;
    for (const key of Object.keys(store)) delete store[key];
  });

  it("sends a morning briefing email to the active Gmail account", async () => {
    const result = await sendBriefingEmail(
      "U1",
      { text: "Good morning! Today is busy.", news: [{ title: "News A", url: "https://example.com/a" }] },
      { timezone: "Asia/Bangkok" },
    );
    expect(result).toEqual({ from: "user@example.com" });
    expect(sentEmails.length).toBe(1);
    const args = sentEmails[0]!.args as { to: string[]; subject: string; body: string };
    expect(args.to).toEqual(["user@example.com"]);
    expect(args.subject).toContain("Morning briefing");
    expect(args.body).toContain("Good morning!");
    expect(args.body).toContain("News A");
    expect(args.body).toContain("https://example.com/a");
  });

  it("returns null when no Gmail account is connected", async () => {
    const { listAccounts } = await import("@/lib/tools/google-auth");
    vi.mocked(listAccounts).mockResolvedValueOnce({ accounts: [], activeEmail: null });
    const result = await sendBriefingEmail("U1", { text: "Briefing" }, { timezone: "Asia/Bangkok" });
    expect(result).toBeNull();
    expect(sentEmails.length).toBe(0);
  });
});
