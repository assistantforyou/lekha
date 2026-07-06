import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { getSettings, updateSettings, type UserSettings } from "@/lib/memory/settings";
import { redis } from "@/lib/memory/redis";
import { settingsMainFlex } from "@/lib/line/flex/settings";
import type { FlexMessage } from "@/lib/line/client";

const ACCENT = "#5B6FF0";
const OK = "#00B894";
const MUTED = "#9CA3AF";
const TEXT = "#333333";

const TUTORIAL_KEY = (userId: string) => `user:${userId}:tutorial:step`;
const TUTORIAL_WAITING_KEY = (userId: string) => `user:${userId}:tutorial:waiting`;

export const TUTORIAL_SECTIONS = ["locale", "briefing", "tools", "persona", "memory"] as const;
type TutorialSection = (typeof TUTORIAL_SECTIONS)[number];
type WaitingField = "timezone" | "location" | "morning" | "evening" | "checkin";

function header(title: string, step: string): object {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: ACCENT,
    paddingAll: "14px",
    contents: [
      { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg" },
      { type: "text", text: step, color: "#BFC4F7", size: "xs" },
    ],
  };
}

function body(contents: object[]): object {
  return { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", contents };
}

function hint(text: string): object {
  return { type: "text", text, size: "xs", color: "#777777", wrap: true };
}

function separator(): object {
  return { type: "separator", margin: "md", color: "#f2f2f2" };
}

function postbackButton(
  label: string,
  data: string,
  style: "primary" | "secondary" = "primary",
): object {
  return {
    type: "button",
    style,
    color: style === "primary" ? ACCENT : undefined,
    height: "sm",
    action: { type: "postback", label, data, displayText: label },
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function chipRow(label: string, buttons: object[], perRow = 3): object {
  const rows = chunk(buttons, perRow).map((group) => ({ type: "box", layout: "horizontal", spacing: "sm", contents: group }));
  return {
    type: "box",
    layout: "vertical",
    margin: "md",
    spacing: "sm",
    contents: [{ type: "text", text: label, weight: "bold", size: "sm", color: TEXT }, ...rows],
  };
}

function optionButton(label: string, data: string, on: boolean): object {
  return postbackButton(label, data, on ? "primary" : "secondary");
}

function customButton(label: string, field: WaitingField): object {
  return postbackButton(label, `tutorial:custom:${field}`, "secondary");
}

// Map common English / Thai inputs to IANA timezones.
const TIMEZONE_ALIASES: Record<string, string> = {
  bangkok: "Asia/Bangkok",
  กรุงเทพ: "Asia/Bangkok",
  กรุงเทพมหานคร: "Asia/Bangkok",
  thailand: "Asia/Bangkok",
  ไทย: "Asia/Bangkok",
  singapore: "Asia/Singapore",
  สิงคโปร์: "Asia/Singapore",
  tokyo: "Asia/Tokyo",
  โตเกียว: "Asia/Tokyo",
  japan: "Asia/Tokyo",
  ญี่ปุ่น: "Asia/Tokyo",
  london: "Europe/London",
  ลอนดอน: "Europe/London",
  uk: "Europe/London",
  england: "Europe/London",
  "new york": "America/New_York",
  นิวยอร์ก: "America/New_York",
  nyc: "America/New_York",
  "los angeles": "America/Los_Angeles",
  แอลเอ: "America/Los_Angeles",
  la: "America/Los_Angeles",
  sydney: "Australia/Sydney",
  ซิดนีย์: "Australia/Sydney",
  hong: "Asia/Hong_Kong",
  "hong kong": "Asia/Hong_Kong",
  ฮ่องกง: "Asia/Hong_Kong",
  dubai: "Asia/Dubai",
  ดูไบ: "Asia/Dubai",
  paris: "Europe/Paris",
  ปารีส: "Europe/Paris",
  berlin: "Europe/Berlin",
  เบอร์ลิน: "Europe/Berlin",
};

function resolveTimezone(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (TIMEZONE_ALIASES[key]) return TIMEZONE_ALIASES[key];
  // Try common IANA forms like "Asia/Tokyo" or "asia-tokyo".
  const normalized = key.replace(/_/g, "/").replace(/-/g, "/");
  if (normalized.includes("/") && !normalized.startsWith("/")) return normalized;
  return null;
}

function parseCustomTime(input: string): string | null {
  const t = input.trim().toLowerCase();
  // "7", "7am", "07:00", "7:00 am", "19:00", "9pm"
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const amp = m[3]?.toLowerCase();
  if (Number.isNaN(h) || h < 1 || h > 12) return null;
  if (Number.isNaN(min) || min < 0 || min > 59) return null;
  if (amp === "pm" && h !== 12) h += 12;
  if (amp === "am" && h === 12) h = 0;
  if (amp && h > 12) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function tutorialBubble(step: number, total: number, title: string, description: string, contents: object[]): FlexMessage {
  return {
    type: "flex",
    altText: `${title} — Setup step ${step} of ${total}.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(title, `Setup step ${step} of ${total}`),
      body: body([hint(description), separator(), ...contents]),
    },
  };
}

function navRow(back: boolean, nextLabel: string): object {
  const contents: object[] = [];
  if (back) contents.push(postbackButton("← Back", "tutorial:back", "secondary"));
  contents.push(postbackButton(nextLabel, "tutorial:next", "primary"));
  return { type: "box", layout: "horizontal", margin: "md", spacing: "sm", contents };
}

async function localeStep(settings: UserSettings): Promise<FlexMessage> {
  const languages = [
    { label: "Auto", value: "auto", on: settings.language === null },
    { label: "English", value: "en", on: settings.language === "en" },
    { label: "ไทย", value: "th", on: settings.language === "th" },
  ];
  const bangkokTz = settings.timezone === "Asia/Bangkok";
  const bangkokLoc = settings.location === "Bangkok, Thailand";
  return tutorialBubble(1, 5, "🌐 Language & Location", "Pick your language. For timezone and location, choose Bangkok if you're in Thailand, or type a custom city.", [
    chipRow(
      "Reply language (Auto = match you)",
      languages.map((o) => optionButton(o.label, `tutorial:set:language:${o.value}`, o.on)),
      3,
    ),
    chipRow(
      "Timezone",
      [optionButton("Bangkok", "tutorial:set:timezone:Asia/Bangkok", bangkokTz), customButton("Custom", "timezone")],
      2,
    ),
    chipRow(
      "Location",
      [
        optionButton("Bangkok", "tutorial:set:location:Bangkok, Thailand", bangkokLoc),
        customButton("Custom", "location"),
        optionButton("Skip", "tutorial:set:location:skip", settings.location === null),
      ],
      1,
    ),
    navRow(false, "Next →"),
  ]);
}

async function briefingStep(settings: UserSettings): Promise<FlexMessage> {
  const morningOn = (t: string) => settings.morningBriefingTime === t;
  const eveningOn = (t: string) => settings.eveningSummaryEnabled && settings.eveningSummaryTime === t;
  const checkinOn = (t: string) => settings.taskCheckInEnabled && settings.taskCheckInTime === t;
  return tutorialBubble(2, 5, "📰 Daily Briefings", "I can send you a morning briefing, an evening summary, and a task check-in. Pick preset times, type a custom time, or turn them off.", [
    chipRow(
      "Morning briefing",
      [
        optionButton("07:00", "tutorial:set:morning:07:00", morningOn("07:00")),
        optionButton("08:00", "tutorial:set:morning:08:00", morningOn("08:00")),
        customButton("Custom", "morning"),
        optionButton("Off", "tutorial:set:morning:off", settings.morningBriefingTime === null),
      ],
      2,
    ),
    chipRow(
      "Evening summary",
      [
        optionButton("20:00", "tutorial:set:evening:20:00", eveningOn("20:00")),
        optionButton("21:00", "tutorial:set:evening:21:00", eveningOn("21:00")),
        customButton("Custom", "evening"),
        optionButton("Off", "tutorial:set:evening:off", !settings.eveningSummaryEnabled),
      ],
      2,
    ),
    chipRow(
      "Task check-in",
      [
        optionButton("19:00", "tutorial:set:checkin:19:00", checkinOn("19:00")),
        optionButton("20:00", "tutorial:set:checkin:20:00", checkinOn("20:00")),
        customButton("Custom", "checkin"),
        optionButton("Off", "tutorial:set:checkin:off", !settings.taskCheckInEnabled),
      ],
      2,
    ),
    navRow(true, "Next →"),
  ]);
}

type ToolPreset = { label: string; value: string; tools: Record<string, boolean> };

function matchesPreset(settings: UserSettings, preset: ToolPreset): boolean {
  return Object.entries(preset.tools).every(([k, v]) => settings.tools[k as keyof UserSettings["tools"]] === v);
}

async function toolsStep(settings: UserSettings): Promise<FlexMessage> {
  const presets: ToolPreset[] = [
    { label: "✅ All 5 tools", value: "all", tools: { todo: true, reminders: true, calendar: true, email: true, drive: true } },
    { label: "📅 Productivity (tasks, reminders, calendar)", value: "productivity", tools: { todo: true, reminders: true, calendar: true, email: false, drive: false } },
    { label: "📧 Communication (email + calendar)", value: "communication", tools: { todo: false, reminders: false, calendar: true, email: true, drive: false } },
    { label: "📝 Minimal (tasks + reminders only)", value: "minimal", tools: { todo: true, reminders: true, calendar: false, email: false, drive: false } },
    { label: "🔒 Just chat (no Google tools)", value: "chat", tools: { todo: false, reminders: false, calendar: false, email: false, drive: false } },
  ];
  return tutorialBubble(3, 5, "🛠 Tools", "Choose what I can help with. You can change this anytime by typing =settings=.", [
    {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: presets.map((p) => postbackButton(p.label, `tutorial:set:tools:${p.value}`, matchesPreset(settings, p) ? "primary" : "secondary")),
    },
    separator(),
    navRow(true, "Next →"),
  ]);
}

async function personaStep(settings: UserSettings): Promise<FlexMessage> {
  const tones = [
    { label: "🙂 Warm", value: "Warm", on: settings.personaTone === "Warm" },
    { label: "👔 Professional", value: "Professional", on: settings.personaTone === "Professional" },
    { label: "😄 Playful", value: "Playful", on: settings.personaTone === "Playful" },
  ];
  const addressing = [
    { label: "👤 First name", value: "First name", on: settings.personaAddressing === "First name" },
    { label: "🙏 Khun", value: "Khun", on: settings.personaAddressing === "Khun" },
    { label: "🎩 Sir / Madam", value: "Sir / Madam", on: settings.personaAddressing === "Sir / Madam" },
    { label: "🚫 No address", value: "No address", on: settings.personaAddressing === "No address" },
  ];
  return tutorialBubble(4, 5, "🎭 Persona", "Choose how I sound and how I address you.", [
    chipRow("Tone", tones.map((o) => optionButton(o.label, `tutorial:set:personaTone:${o.value}`, o.on)), 1),
    chipRow("Address you as", addressing.map((o) => optionButton(o.label, `tutorial:set:personaAddressing:${o.value}`, o.on)), 1),
    navRow(true, "Next →"),
  ]);
}

async function memoryStep(settings: UserSettings): Promise<FlexMessage> {
  const intervals = [
    { label: "5", value: "5", on: settings.memoryCompactAt === 5 },
    { label: "10", value: "10", on: settings.memoryCompactAt === 10 },
    { label: "20", value: "20", on: settings.memoryCompactAt === 20 },
    { label: "50", value: "50", on: settings.memoryCompactAt === 50 },
  ];
  return tutorialBubble(
    5,
    5,
    "🧠 Memory",
    "I remember facts from our chats, full documents you upload, and transcripts of voice memos. You can ask about any of them later.",
    [
      {
        type: "box",
        layout: "horizontal",
        margin: "md",
        spacing: "md",
        alignItems: "center",
        contents: [
          {
            type: "box",
            layout: "vertical",
            flex: 1,
            contents: [
              { type: "text", text: "Auto-extract facts", weight: "bold", size: "sm", color: TEXT },
              { type: "text", text: settings.memoryEnabled ? "On" : "Off", size: "xs", color: settings.memoryEnabled ? OK : MUTED },
            ],
          },
          postbackButton(settings.memoryEnabled ? "Turn off" : "Turn on", `tutorial:set:memoryEnabled:${settings.memoryEnabled ? "false" : "true"}`, "primary"),
        ],
      },
      chipRow("Tidy up memory every N messages", intervals.map((o) => optionButton(o.label, `tutorial:set:memoryCompactAt:${o.value}`, o.on)), 4),
      navRow(true, "Finish ✅"),
    ],
  );
}

export async function getTutorialStep(userId: string): Promise<number> {
  const v = await redis().get<number>(TUTORIAL_KEY(userId));
  return typeof v === "number" ? v : -1;
}

export async function setTutorialStep(userId: string, step: number): Promise<void> {
  await redis().set(TUTORIAL_KEY(userId), step, { ex: 60 * 60 * 24 });
}

export async function clearTutorialStep(userId: string): Promise<void> {
  await redis().del(TUTORIAL_KEY(userId));
}

export function isInTutorial(userId: string): Promise<boolean> {
  return getTutorialStep(userId).then((s) => s >= 0);
}

export async function getTutorialWaiting(userId: string): Promise<string | null> {
  return redis().get<string>(TUTORIAL_WAITING_KEY(userId));
}

export async function setTutorialWaiting(userId: string, field: string | null): Promise<void> {
  if (field) await redis().set(TUTORIAL_WAITING_KEY(userId), field, { ex: 60 * 60 * 24 });
  else await redis().del(TUTORIAL_WAITING_KEY(userId));
}

async function bubbleForStep(settings: UserSettings, step: number): Promise<FlexMessage | null> {
  const section = TUTORIAL_SECTIONS[step];
  if (!section) return null;
  if (section === "locale") return localeStep(settings);
  if (section === "briefing") return briefingStep(settings);
  if (section === "tools") return toolsStep(settings);
  if (section === "persona") return personaStep(settings);
  if (section === "memory") return memoryStep(settings);
  return null;
}

export async function sendTutorialStep(userId: string, replyToken: string, step: number): Promise<void> {
  await setTutorialStep(userId, step);
  const settings = await getSettings(userId);
  const bubble = await bubbleForStep(settings, step);
  if (bubble) {
    await replyOrPush(userId, replyToken, [bubble]);
  }
}

export async function startTutorial(userId: string, replyToken: string, displayName = ""): Promise<void> {
  await setTutorialStep(userId, 0);
  if (!replyToken) {
    // Initial welcome push — the user taps the button to begin.
    const welcome = `Hi${displayName ? `, ${displayName}` : ""}! Welcome to Lekha 👋\n\nLet's set up your account in 30 seconds so I can be your perfect assistant.`;
    await replyOrPush(userId, "", [
      textMsg(welcome),
      {
        type: "flex",
        altText: "Tap Start setup to configure Lekha.",
        contents: {
          type: "bubble",
          size: "mega",
          body: body([
            { type: "text", text: "Tap the button below to start.", size: "sm", color: TEXT, wrap: true },
            { type: "box", layout: "horizontal", margin: "md", spacing: "sm", contents: [postbackButton("Start setup", "tutorial:start", "primary")] },
          ]),
        },
      },
    ]);
    return;
  }
  await sendTutorialStep(userId, replyToken, 0);
}

async function finishTutorial(userId: string, replyToken: string): Promise<void> {
  await clearTutorialStep(userId);
  await setTutorialWaiting(userId, null);
  // Mark the user as onboarded so the setup tutorial doesn't run again.
  await redis().set(`user:${userId}:onboarded`, 1);
  await replyOrPush(userId, replyToken, [
    textMsg("You're all set! 🎉\n\nI'll remember your choices. Type =settings= anytime to change them, or just start chatting."),
    settingsMainFlex(await getSettings(userId)),
  ]);
}

function deriveDisabledCategories(tools: Record<string, boolean>): string[] {
  const map: Record<string, string> = {
    todo: "tasks",
    reminders: "reminders",
    calendar: "calendar",
    email: "email",
    drive: "drive",
  };
  return Object.entries(tools)
    .filter(([id, on]) => !on && map[id])
    .map(([id]) => map[id]!);
}

async function applyTutorialSetting(
  userId: string,
  key: string,
  value: string,
): Promise<Partial<UserSettings>> {
  const settings = await getSettings(userId);
  const patch: Partial<UserSettings> = {};

  if (key === "language") {
    patch.language = value === "auto" ? null : value;
  } else if (key === "timezone") {
    patch.timezone = value;
  } else if (key === "location") {
    patch.location = value === "skip" ? null : value;
  } else if (key === "morning") {
    patch.morningBriefingTime = value === "off" ? null : value;
  } else if (key === "evening") {
    if (value === "off") {
      patch.eveningSummaryEnabled = false;
    } else {
      patch.eveningSummaryEnabled = true;
      patch.eveningSummaryTime = value;
    }
  } else if (key === "checkin") {
    if (value === "off") {
      patch.taskCheckInEnabled = false;
    } else {
      patch.taskCheckInEnabled = true;
      patch.taskCheckInTime = value;
    }
  } else if (key === "tools") {
    const toolPresets: Record<string, Record<string, boolean>> = {
      all: { todo: true, reminders: true, calendar: true, email: true, drive: true },
      productivity: { todo: true, reminders: true, calendar: true, email: false, drive: false },
      communication: { todo: false, reminders: false, calendar: true, email: true, drive: false },
      minimal: { todo: true, reminders: true, calendar: false, email: false, drive: false },
      chat: { todo: false, reminders: false, calendar: false, email: false, drive: false },
    };
    if (toolPresets[value]) {
      patch.tools = toolPresets[value];
    }
    patch.disabledCategories = deriveDisabledCategories(patch.tools as Record<string, boolean>);
  } else if (key === "personaTone") {
    if (["Warm", "Professional", "Playful"].includes(value)) patch.personaTone = value as UserSettings["personaTone"];
  } else if (key === "personaAddressing") {
    if (["First name", "Khun", "Sir / Madam", "No address"].includes(value)) patch.personaAddressing = value as UserSettings["personaAddressing"];
  } else if (key === "memoryEnabled") {
    patch.memoryEnabled = value === "true";
  } else if (key === "memoryCompactAt") {
    const n = Number(value);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 1000) patch.memoryCompactAt = n;
  }

  if (Object.keys(patch).length) await updateSettings(userId, patch);
  return patch;
}

function customPrompt(field: WaitingField): string {
  switch (field) {
    case "timezone":
      return "What timezone are you in? Type a city or country in English or Thai (e.g. Tokyo, โตเกียว, London, ลอนดอน).";
    case "location":
      return "Where are you based? Type a city or country in English or Thai (e.g. New York, นิวยอร์ก).";
    case "morning":
      return "What time would you like your morning briefing? (e.g. 07:30 or 7:30 AM)";
    case "evening":
      return "What time would you like your evening summary? (e.g. 21:00 or 9 PM)";
    case "checkin":
      return "What time should I check in on your tasks? (e.g. 20:00 or 8 PM)";
  }
}

async function handleCustomInput(userId: string, replyToken: string, field: WaitingField, input: string): Promise<void> {
  let value: string | null = null;
  let error = "";

  if (field === "timezone") {
    const tz = resolveTimezone(input);
    if (tz) value = tz;
    else error = "I didn't recognize that timezone. Try a city like Bangkok, Tokyo, London, or โตเกียว.";
  } else if (field === "location") {
    const loc = input.trim();
    if (loc.length >= 2) value = loc;
    else error = "Please type a real location (at least 2 characters).";
  } else if (field === "morning" || field === "evening" || field === "checkin") {
    const time = parseCustomTime(input);
    if (time) value = time;
    else error = "I didn't catch the time. Try something like 07:30, 7:30 AM, 21:00, or 9 PM.";
  }

  if (error || !value) {
    await replyOrPush(userId, replyToken, [textMsg(error || "Couldn't understand that. Please try again.")]);
    return;
  }

  await applyTutorialSetting(userId, field, value);
  await setTutorialWaiting(userId, null);
  const step = await getTutorialStep(userId);
  if (step >= 0) await sendTutorialStep(userId, replyToken, step);
}

export async function handleTutorialText(userId: string, replyToken: string, userText: string): Promise<boolean> {
  const lower = userText.trim().toLowerCase();
  if (lower === "=tutorial") {
    await setTutorialWaiting(userId, null);
    await startTutorial(userId, replyToken);
    return true;
  }
  const step = await getTutorialStep(userId);
  if (step < 0) return false;

  const waiting = await getTutorialWaiting(userId);
  if (waiting && ["timezone", "location", "morning", "evening", "checkin"].includes(waiting)) {
    await handleCustomInput(userId, replyToken, waiting as WaitingField, userText);
    return true;
  }

  await replyOrPush(userId, replyToken, [
    textMsg("Tap the buttons above to finish setup, or type =tutorial to restart."),
  ]);
  return true;
}

export async function handleTutorialPostback(userId: string, replyToken: string, args: string[]): Promise<void> {
  const action = args[0];

  if (action === "start") {
    await sendTutorialStep(userId, replyToken, 0);
    return;
  }

  if (action === "set" && args[1] && args[2] !== undefined) {
    const key = args[1];
    const value = args.slice(2).join(":");
    await setTutorialWaiting(userId, null);
    await applyTutorialSetting(userId, key, value);
    const step = await getTutorialStep(userId);
    if (step >= 0) await sendTutorialStep(userId, replyToken, step);
    return;
  }

  if (action === "custom" && args[1]) {
    const field = args[1] as WaitingField;
    await setTutorialWaiting(userId, field);
    await replyOrPush(userId, replyToken, [textMsg(customPrompt(field))]);
    return;
  }

  let step = await getTutorialStep(userId);
  if (step < 0) step = 0;

  if (action === "back") {
    await setTutorialWaiting(userId, null);
    step = Math.max(0, step - 1);
    await sendTutorialStep(userId, replyToken, step);
    return;
  }

  if (action === "next") {
    await setTutorialWaiting(userId, null);
    step = step + 1;
    if (step >= TUTORIAL_SECTIONS.length) {
      await finishTutorial(userId, replyToken);
      return;
    }
    await sendTutorialStep(userId, replyToken, step);
    return;
  }

  // Unknown action — restart current step.
  await sendTutorialStep(userId, replyToken, step);
}
