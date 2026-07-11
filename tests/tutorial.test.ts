import { describe, it, expect, beforeEach, vi } from "vitest";

type Store = {
  strings: Map<string, string>;
  hashes: Map<string, Map<string, string>>;
  zsets: Map<string, Map<string, number>>;
};

const store: Store = {
  strings: new Map(),
  hashes: new Map(),
  zsets: new Map(),
};
const sent: { userId: string; messages: unknown[] }[] = [];

function reset() {
  store.strings.clear();
  store.hashes.clear();
  store.zsets.clear();
  sent.length = 0;
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
    set: async (key: string, value: unknown, _opts?: unknown) => {
      store.strings.set(key, JSON.stringify(value));
      return "OK";
    },
    del: async (key: string) => {
      let n = 0;
      if (store.strings.delete(key)) n++;
      if (store.hashes.delete(key)) n++;
      if (store.zsets.delete(key)) n++;
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
    zadd: async (key: string, entry: { score: number; member: string }) => {
      getZset(key).set(entry.member, entry.score);
      return 1;
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
    multi: () => {
      const ops: (() => unknown)[] = [];
      return {
        hset: (k: string, obj: Record<string, string>) =>
          ops.push(() => {
            const h = getHash(k);
            for (const [kk, v] of Object.entries(obj)) h.set(kk, String(v));
            return Object.keys(obj).length;
          }),
        zadd: (k: string, entry: { score: number; member: string }) =>
          ops.push(() => {
            getZset(k).set(entry.member, entry.score);
            return 1;
          }),
        zremrangebyrank: (k: string, start: number, stop: number) =>
          ops.push(() => {
            const z = getZset(k);
            const entries = Array.from(z.entries()).sort((a, b) => a[1] - b[1]);
            const end = stop < 0 ? entries.length + stop : stop;
            let n = 0;
            for (let i = start; i <= end; i++) {
              const entry = entries[i];
              if (entry && z.delete(entry[0])) n++;
            }
            return n;
          }),
        hdel: (k: string, ...fields: string[]) =>
          ops.push(() => {
            const h = store.hashes.get(k);
            if (!h) return 0;
            let n = 0;
            for (const f of fields) if (h.delete(f)) n++;
            return n;
          }),
        del: (k: string) =>
          ops.push(() => {
            let n = 0;
            if (store.strings.delete(k)) n++;
            if (store.hashes.delete(k)) n++;
            if (store.zsets.delete(k)) n++;
            return n;
          }),
        exec: async () => ops.map((fn) => fn()),
      };
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

import {
  startTutorial,
  handleTutorialPostback,
  handleTutorialText,
  getTutorialStep,
  TUTORIAL_SECTIONS,
} from "@/lib/tutorial";
import { startOnboarding } from "@/lib/onboarding";
import { getSettings, _resetSettingsCache } from "@/lib/memory/settings";
import { loadFacts } from "@/lib/memory/facts";

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
    await handleTutorialPostback("U1", "token", ["custom", "preferredName"]);
    await handleTutorialText("U1", "token", "Jamie");
    s = await getSettings("U1");
    expect(s.personaPreferredName).toBe("Jamie");
    await handleTutorialPostback("U1", "token", ["set", "personaTone", "Professional"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    expect(await getTutorialStep("U1")).toBe(5);
    s = await getSettings("U1");
    expect(s.personaTone).toBe("Professional");

    // Step 5: memory — type one seed fact
    await handleTutorialText("U1", "token", "I prefer coffee over tea");
    // Finished: tutorial step cleared and personalized confirmation sent.
    expect(await getTutorialStep("U1")).toBe(-1);
    s = await getSettings("U1");
    expect(s.memoryEnabled).toBe(true);
    expect(s.memoryCompactAt).toBe(10);
    const facts = await loadFacts("U1");
    expect(facts.facts.length).toBe(1);
    expect(facts.facts[0]!.content).toBe("I prefer coffee over tea");
    expect(facts.facts[0]!.priority).toBe(10);
    const last = sent[sent.length - 1]!.messages[0] as { text?: string };
    expect(last.text).toContain("Jamie");
    expect(last.text).toContain("coffee");
  });

  it("supports back navigation", async () => {
    await startTutorial("U1", "token");
    await handleTutorialPostback("U1", "token", ["next"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    expect(await getTutorialStep("U1")).toBe(2);
    await handleTutorialPostback("U1", "token", ["back"]);
    expect(await getTutorialStep("U1")).toBe(1);
  });

  it("restarts tutorial on /tutorial text", async () => {
    await handleTutorialText("U1", "token", "/tutorial");
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

  it("changing language on the locale step updates the current step without advancing", async () => {
    await startTutorial("U1", "token");
    await handleTutorialPostback("U1", "token", ["set", "language", "th"]);
    expect(await getTutorialStep("U1")).toBe(1);

    // Tapping a language button on the locale step should not advance.
    await handleTutorialPostback("U1", "token", ["set", "language", "en"]);
    expect(await getTutorialStep("U1")).toBe(1);
    let s = await getSettings("U1");
    expect(s.language).toBe("en");

    // The re-rendered locale step should now be in English.
    const lastFlex = sent.findLast((m) => (m.messages[0] as { type?: string }).type === "flex");
    expect(lastFlex).toBeDefined();
    const json = JSON.stringify(lastFlex!.messages[0]);
    expect(json).toContain("Location");
    expect(json).not.toContain("ตำแหน่งที่ตั้ง");

    // Advancing manually should show the next step in the newly chosen language.
    await handleTutorialPostback("U1", "token", ["next"]);
    expect(await getTutorialStep("U1")).toBe(2);
    const nextFlex = sent.findLast((m) => (m.messages[0] as { type?: string }).type === "flex");
    expect(JSON.stringify(nextFlex!.messages[0])).toContain("Daily Briefings");
  });

  it("toggles pre-meeting lead times in briefing step", async () => {
    await startTutorial("U1", "token");
    await handleTutorialPostback("U1", "token", ["set", "language", "en"]);
    await handleTutorialPostback("U1", "token", ["set", "timezone", "Asia/Bangkok"]);
    await handleTutorialPostback("U1", "token", ["next"]);
    await handleTutorialPostback("U1", "token", ["set", "morning", "08:00"]);

    // Defaults include 15/60/1440, so the first tap toggles off.
    await handleTutorialPostback("U1", "token", ["set", "preMeetingLead", "15"]);
    let s = await getSettings("U1");
    expect(s.preMeetingLeads).not.toContain(15);

    await handleTutorialPostback("U1", "token", ["set", "preMeetingLead", "15"]);
    s = await getSettings("U1");
    expect(s.preMeetingLeads).toContain(15);
  });

  it("covers all settings sections", () => {
    expect(TUTORIAL_SECTIONS).toEqual(["language", "locale", "briefing", "tools", "persona", "memory"]);
  });

  it("exits the tutorial on cancel/exit/skip words", async () => {
    await startTutorial("U1", "token");
    expect(await getTutorialStep("U1")).toBe(0);
    const exited = await handleTutorialText("U1", "token", "cancel");
    expect(exited).toBe(true);
    expect(await getTutorialStep("U1")).toBe(-1);
    expect(sent[sent.length - 1]!.messages[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Setup exited"),
    });
  });
});
