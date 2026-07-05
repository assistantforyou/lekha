import { describe, it, expect, beforeEach, vi } from "vitest";

const store: { strings: Map<string, string> } = { strings: new Map() };
const sent: { userId: string; messages: unknown[] }[] = [];

function reset() {
  store.strings.clear();
  sent.length = 0;
  _resetSettingsCache();
}

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    get: async <T,>(key: string): Promise<T | null> => {
      const v = store.strings.get(key);
      return v ? (JSON.parse(v) as T) : null;
    },
    set: async (key: string, value: unknown) => {
      store.strings.set(key, JSON.stringify(value));
      return "OK";
    },
    del: async (key: string) => (store.strings.delete(key) ? 1 : 0),
    multi: () => {
      const ops: (() => unknown)[] = [];
      return {
        lpush: (_k: string, _v: unknown) => ops.push(() => 1),
        ltrim: (_k: string, _s: number, _e: number) => ops.push(() => "OK"),
        llen: (_k: string) => ops.push(() => 0),
        exec: async () => ops.map((fn) => fn()),
      };
    },
    lrange: async <T,>(_k: string, _s: number, _e: number): Promise<T[]> => [],
    incr: async (_k: string) => 1,
    expire: async (_k: string, _s: number) => 1,
  }),
}));

vi.mock("@/lib/line/client", () => ({
  replyOrPush: vi.fn(async (userId: string, _token: string, messages: unknown[]) => {
    sent.push({ userId, messages });
    return "reply";
  }),
  text: (s: string) => ({ type: "text", text: s }),
  showLoading: vi.fn(),
  withQuickReplies: (text: string, buttons: { label: string; text: string }[]) => ({
    type: "quick",
    text,
    buttons,
  }),
}));

import { handleSettingsPostback, handleSettingsCommand } from "@/lib/settings-menu";
import { getSettings, DEFAULTS, _resetSettingsCache, type UserSettings } from "@/lib/memory/settings";
import {
  settingsMainFlex,
  settingsBriefingFlex,
  settingsToolsFlex,
  settingsPersonaFlex,
  settingsMemoryFlex,
  settingsFactsFlex,
  settingsLocaleFlex,
} from "@/lib/line/flex/settings";
import { validateFlexMessage } from "@/lib/line/flex/validate";
import { loadFacts } from "@/lib/memory/facts";

function fullSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return { ...DEFAULTS, ...overrides };
}

function assertNoBoxWrap(obj: unknown, path = "root"): void {
  if (!obj || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;
  if (o.type === "box" && "wrap" in o) {
    throw new Error(`wrap found on box at ${path}`);
  }
  if (Array.isArray(o.contents)) {
    for (let i = 0; i < o.contents.length; i++) {
      assertNoBoxWrap((o.contents as unknown[])[i], `${path}.contents[${i}]`);
    }
  }
  for (const key of ["header", "hero", "body", "footer", "action"]) {
    if (o[key]) assertNoBoxWrap(o[key], `${path}.${key}`);
  }
}

function lastMessages(): unknown[] {
  return sent[sent.length - 1]?.messages ?? [];
}

function firstFlex(): Record<string, unknown> | undefined {
  const msgs = lastMessages();
  const m = msgs[0] as Record<string, unknown> | undefined;
  if (m?.type === "flex") return m;
  return undefined;
}

describe("settings Flex menus", () => {
  it("main menu validates and has no wrap on boxes", () => {
    const msg = settingsMainFlex(fullSettings());
    const v = validateFlexMessage(msg);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    assertNoBoxWrap(msg.contents);
  });

  it("briefing menu includes evening/check-in presets and channel hint", () => {
    const msg = settingsBriefingFlex(fullSettings());
    const v = validateFlexMessage(msg);
    expect(v.ok).toBe(true);
    const json = JSON.stringify(msg);
    expect(json).toContain("18:00");
    expect(json).toContain("21:00");
    expect(json).toContain("16:00");
    expect(json).toContain("19:00");
    expect(json).toContain("LINE chat sends the briefing here");
  });

  it("persona menu validates and shows all addressing options", () => {
    const msg = settingsPersonaFlex(fullSettings());
    const v = validateFlexMessage(msg);
    expect(v.ok).toBe(true);
    const json = JSON.stringify(msg);
    expect(json).toContain("First name");
    expect(json).toContain("Sir / Madam");
    expect(json).toContain("Professional");
  });

  it("facts menu renders all facts without truncation", () => {
    const long = "a".repeat(500);
    const msg = settingsFactsFlex([
      { id: "1", category: "preferences", content: long, createdAt: 1, updatedAt: 1 },
      { id: "2", category: "work", content: "short", createdAt: 2, updatedAt: 2 },
    ]);
    const v = validateFlexMessage(msg);
    expect(v.ok).toBe(true);
    const json = JSON.stringify(msg);
    expect(json).toContain(long);
    expect(json).not.toContain(long.slice(0, 120) + "…");
  });

  it("locale, tools, memory menus validate", () => {
    for (const fn of [settingsToolsFlex, settingsMemoryFlex, settingsLocaleFlex]) {
      const msg = fn(fullSettings());
      const v = validateFlexMessage(msg);
      expect(v.ok).toBe(true);
      expect(v.errors).toEqual([]);
      assertNoBoxWrap(msg.contents);
    }
  });
});

describe("settings postback handlers", () => {
  beforeEach(() => reset());

  it("opens main menu", async () => {
    await handleSettingsPostback("U1", "token", []);
    expect(sent.length).toBe(1);
    expect(firstFlex()?.contents).toBeDefined();
  });

  it("sets morning time via postback", async () => {
    await handleSettingsPostback("U1", "token", ["briefing", "set", "morningTime", "08:30"]);
    const s = await getSettings("U1");
    expect(s.morningBriefingTime).toBe("08:30");
    expect(firstFlex()?.altText).toContain("08:30");
  });

  it("toggles evening off", async () => {
    await handleSettingsPostback("U1", "token", ["toggle", "evening", "off"]);
    const s = await getSettings("U1");
    expect(s.eveningSummaryEnabled).toBe(false);
  });

  it("sets persona tone", async () => {
    await handleSettingsPostback("U1", "token", ["persona", "set", "personaTone", "Playful"]);
    const s = await getSettings("U1");
    expect(s.personaTone).toBe("Playful");
  });

  it("disables a tool and updates disabledCategories", async () => {
    await handleSettingsPostback("U1", "token", ["tools", "set", "tool", "email", "false"]);
    const s = await getSettings("U1");
    expect(s.tools.email).toBe(false);
    expect(s.disabledCategories).toContain("email");
  });

  it("prompts for custom time with quick replies", async () => {
    await handleSettingsPostback("U1", "token", ["prompt", "evening"]);
    const msgs = lastMessages();
    expect(msgs.length).toBe(1);
    const q = msgs[0] as { type: string; buttons: { label: string }[] };
    expect(q.type).toBe("quick");
    expect(q.buttons.length).toBe(13);
    expect(q.buttons[0]!.label).toBe("17:00");
  });

  it("deletes a fact", async () => {
    await handleSettingsCommand("U1", "token", "=remember I prefer espresso");
    const before = await loadFacts("U1");
    expect(before.facts.length).toBe(1);
    const id = before.facts[0]!.id;
    await handleSettingsPostback("U1", "token", ["facts", "del", id]);
    const after = await loadFacts("U1");
    expect(after.facts.length).toBe(0);
  });
});

describe("settings typed commands", () => {
  beforeEach(() => reset());

  it("sets timezone, location, language", async () => {
    await handleSettingsCommand("U1", "token", "=set timezone America/New_York");
    await handleSettingsCommand("U1", "token", "=set location Singapore");
    await handleSettingsCommand("U1", "token", "=set language th");
    const s = await getSettings("U1");
    expect(s.timezone).toBe("America/New_York");
    expect(s.location).toBe("Singapore");
    expect(s.language).toBe("th");
  });

  it("sets and turns off briefing times", async () => {
    await handleSettingsCommand("U1", "token", "=set morning 07:30");
    await handleSettingsCommand("U1", "token", "=set evening 21:30");
    await handleSettingsCommand("U1", "token", "=set checkin 20:00");
    let s = await getSettings("U1");
    expect(s.morningBriefingTime).toBe("07:30");
    expect(s.eveningSummaryTime).toBe("21:30");
    expect(s.taskCheckInTime).toBe("20:00");

    await handleSettingsCommand("U1", "token", "=set morning off");
    await handleSettingsCommand("U1", "token", "=set evening off");
    await handleSettingsCommand("U1", "token", "=set checkin off");
    s = await getSettings("U1");
    expect(s.morningBriefingTime).toBeNull();
    expect(s.eveningSummaryEnabled).toBe(false);
    expect(s.taskCheckInEnabled).toBe(false);
  });

  it("rejects invalid time values", async () => {
    await handleSettingsCommand("U1", "token", "=set morning 25:00");
    const last = lastMessages()[0] as { text?: string };
    expect(last.text).toContain("HH:MM");
    const s = await getSettings("U1");
    expect(s.morningBriefingTime).toBe(DEFAULTS.morningBriefingTime);
  });

  it("captures custom time prompt replies", async () => {
    await handleSettingsPostback("U1", "token", ["prompt", "checkin"]);
    await handleSettingsCommand("U1", "token", "18:45");
    const s = await getSettings("U1");
    expect(s.taskCheckInEnabled).toBe(true);
    expect(s.taskCheckInTime).toBe("18:45");
  });

  it("sets compact interval with validation", async () => {
    await handleSettingsCommand("U1", "token", "=set compact 15");
    let s = await getSettings("U1");
    expect(s.memoryCompactAt).toBe(15);

    await handleSettingsCommand("U1", "token", "=set compact abc");
    const last = lastMessages()[0] as { text?: string };
    expect(last.text).toContain("whole number");
    s = await getSettings("U1");
    expect(s.memoryCompactAt).toBe(15);
  });
});
