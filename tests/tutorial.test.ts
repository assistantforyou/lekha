import { describe, it, expect, beforeEach, vi } from "vitest";

const store: { strings: Map<string, string> } = { strings: new Map() };
const sent: { userId: string; messages: unknown[] }[] = [];

function reset() {
  store.strings.clear();
  sent.length = 0;
}

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    get: async <T,>(key: string): Promise<T | null> => {
      const v = store.strings.get(key);
      return v ? (JSON.parse(v) as T) : null;
    },
    set: async (key: string, value: unknown, _opts?: unknown) => {
      store.strings.set(key, JSON.stringify(value));
      return "OK";
    },
    del: async (key: string) => (store.strings.delete(key) ? 1 : 0),
  }),
}));

vi.mock("@/lib/line/client", () => ({
  replyOrPush: vi.fn(async (userId: string, _token: string, messages: unknown[]) => {
    sent.push({ userId, messages });
    return "reply";
  }),
  text: (s: string) => ({ type: "text", text: s }),
}));

import {
  startTutorial,
  handleTutorialPostback,
  handleTutorialText,
  getTutorialStep,
  TUTORIAL_SECTIONS,
} from "@/lib/tutorial";
import { startOnboarding } from "@/lib/onboarding";
import { getSettings, _resetSettingsCache } from "@/lib/memory/settings";

describe("setup tutorial", () => {
  beforeEach(() => {
    reset();
    _resetSettingsCache();
  });

  it("starts with a push welcome when no replyToken is provided", async () => {
    await startTutorial("U1", "", "James");
    expect(sent.length).toBe(1);
    const first = sent[0]!.messages[0] as { text?: string };
    expect(first.text).toContain("Welcome to Lekha");
    expect(first.text).toContain("James");
    // Tutorial step is set so the user can continue after tapping the button.
    expect(await getTutorialStep("U1")).toBe(0);
  });

  it("startOnboarding replies the first step when a replyToken is provided", async () => {
    await startOnboarding("U1", "token", "James");
    expect(await getTutorialStep("U1")).toBe(0);
    expect(sent.length).toBe(1);
    const msg = sent[0]!.messages[0];
    expect(msg).toMatchObject({ type: "flex" });
    // LINE rejects rgba() colors in Flex messages.
    expect(JSON.stringify(msg)).not.toContain("rgba(");
  });

  it("moves through tutorial steps and applies settings", async () => {
    await startTutorial("U1", "token");
    expect(await getTutorialStep("U1")).toBe(0);

    // Step 0: language
    await handleTutorialPostback("U1", "token", ["set", "language", "en"]);
    expect(await getTutorialStep("U1")).toBe(1);
    let s = await getSettings("U1");
    expect(s.language).toBe("en");

    // Step 1: locale
    await handleTutorialPostback("U1", "token", ["set", "timezone", "Asia/Tokyo"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    expect(await getTutorialStep("U1")).toBe(2);
    s = await getSettings("U1");
    expect(s.timezone).toBe("Asia/Tokyo");

    // Step 2: briefings
    await handleTutorialPostback("U1", "token", ["set", "morning", "08:00"]);
    await handleTutorialPostback("U1", "token", ["set", "evening", "off"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    expect(await getTutorialStep("U1")).toBe(3);
    s = await getSettings("U1");
    expect(s.morningBriefingTime).toBe("08:00");
    expect(s.eveningSummaryEnabled).toBe(false);

    // Step 3: tools
    await handleTutorialPostback("U1", "token", ["set", "tools", "minimal"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    expect(await getTutorialStep("U1")).toBe(4);
    s = await getSettings("U1");
    expect(s.tools).toEqual({ todo: true, reminders: true, calendar: false, email: false, drive: false });
    expect(s.disabledCategories).toContain("calendar");

    // Step 4: persona
    await handleTutorialPostback("U1", "token", ["set", "personaTone", "Professional"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    expect(await getTutorialStep("U1")).toBe(5);
    s = await getSettings("U1");
    expect(s.personaTone).toBe("Professional");

    // Step 5: memory
    await handleTutorialPostback("U1", "token", ["set", "memoryCompactAt", "20"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    // Finished: tutorial step cleared and confirmation sent.
    expect(await getTutorialStep("U1")).toBe(-1);
    s = await getSettings("U1");
    expect(s.memoryCompactAt).toBe(20);
    const last = sent[sent.length - 1]!.messages[0] as { text?: string };
    expect(last.text).toContain("all set");
  });

  it("supports back navigation", async () => {
    await startTutorial("U1", "token");
    await handleTutorialPostback("U1", "token", ["next"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    expect(await getTutorialStep("U1")).toBe(2);
    await handleTutorialPostback("U1", "token", ["back"]);
    expect(await getTutorialStep("U1")).toBe(1);
  });

  it("restarts tutorial on =tutorial text", async () => {
    await handleTutorialText("U1", "token", "=tutorial");
    expect(await getTutorialStep("U1")).toBe(0);
  });

  it("blocks normal chat while in tutorial", async () => {
    await startTutorial("U1", "token");
    const handled = await handleTutorialText("U1", "token", "hello");
    expect(handled).toBe(true);
    const last = sent[sent.length - 1]!.messages[0] as { text?: string };
    expect(last.text).toContain("Tap the buttons");
  });

  it("accepts custom timezone input in English and Thai", async () => {
    await startTutorial("U1", "token");
    await handleTutorialPostback("U1", "token", ["set", "language", "en"]);
    await handleTutorialPostback("U1", "token", ["custom", "timezone"]);
    const prompt = sent[sent.length - 1]!.messages[0] as { text?: string };
    expect(prompt.text).toContain("What timezone");

    await handleTutorialText("U1", "token", "Tokyo");
    let s = await getSettings("U1");
    expect(s.timezone).toBe("Asia/Tokyo");

    await handleTutorialPostback("U1", "token", ["custom", "timezone"]);
    await handleTutorialText("U1", "token", "โตเกียว");
    s = await getSettings("U1");
    expect(s.timezone).toBe("Asia/Tokyo");
  });

  it("accepts custom time and location input", async () => {
    await startTutorial("U1", "token");
    await handleTutorialPostback("U1", "token", ["set", "language", "en"]);
    await handleTutorialPostback("U1", "token", ["custom", "morning"]);
    await handleTutorialText("U1", "token", "9:30 AM");
    let s = await getSettings("U1");
    expect(s.morningBriefingTime).toBe("09:30");

    await handleTutorialPostback("U1", "token", ["custom", "location"]);
    await handleTutorialText("U1", "token", "New York");
    s = await getSettings("U1");
    expect(s.location).toBe("New York");
  });

  it("supports new tool presets", async () => {
    await startTutorial("U1", "token");
    await handleTutorialPostback("U1", "token", ["set", "language", "en"]);
    await handleTutorialPostback("U1", "token", ["set", "timezone", "Asia/Bangkok"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    await handleTutorialPostback("U1", "token", ["set", "morning", "08:00"]);
    await handleTutorialPostback("U1", "token", ["next"]);

    await handleTutorialPostback("U1", "token", ["set", "tools", "communication"]);
    const s = await getSettings("U1");
    expect(s.tools).toEqual({ todo: false, reminders: false, calendar: true, email: true, drive: false });
  });

  it("renders Thai after Thai language is chosen", async () => {
    await startTutorial("U1", "token");
    await handleTutorialPostback("U1", "token", ["set", "language", "th"]);
    // A Thai-language bubble should have been sent for the locale step.
    const lastFlex = sent.findLast((m) => (m.messages[0] as { type?: string }).type === "flex");
    expect(lastFlex).toBeDefined();
    const json = JSON.stringify(lastFlex!.messages[0]);
    expect(json).toContain("ตำแหน่งที่ตั้ง");
  });

  it("covers all settings sections", () => {
    expect(TUTORIAL_SECTIONS).toEqual(["language", "locale", "briefing", "tools", "persona", "memory"]);
  });
});
