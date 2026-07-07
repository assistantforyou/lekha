import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { getSettings, updateSettings, type UserSettings } from "@/lib/memory/settings";
import { redis } from "@/lib/memory/redis";
import { settingsMainFlex } from "@/lib/line/flex/settings";
import { loadFacts, saveFacts, _internalNewFact } from "@/lib/memory/facts";
import { TRIAL_DAILY_LIMIT } from "@/lib/trial-constants";
import type { FlexMessage } from "@/lib/line/client";
import { t } from "@/lib/i18n";

const ACCENT = "#5B6FF0";
const TEXT = "#333333";

const TUTORIAL_KEY = (userId: string) => `user:${userId}:tutorial:step`;
const TUTORIAL_WAITING_KEY = (userId: string) => `user:${userId}:tutorial:waiting`;
const TUTORIAL_DISPLAY_NAME_KEY = (userId: string) => `user:${userId}:tutorial:displayName`;
const TUTORIAL_TRIAL_KEY = (userId: string) => `user:${userId}:tutorial:isTrial`;

async function setTutorialDisplayName(userId: string, displayName: string): Promise<void> {
  await redis().set(TUTORIAL_DISPLAY_NAME_KEY(userId), displayName, { ex: 60 * 60 * 24 });
}

async function getTutorialDisplayName(userId: string): Promise<string> {
  const v = await redis().get<string>(TUTORIAL_DISPLAY_NAME_KEY(userId));
  return typeof v === "string" ? v : "";
}

export const TUTORIAL_SECTIONS = ["language", "locale", "briefing", "tools", "persona", "memory"] as const;
type TutorialSection = (typeof TUTORIAL_SECTIONS)[number];
type WaitingField = "timezone" | "location" | "morning" | "evening" | "checkin" | "preferredName";
type Lang = "en" | "th";

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

const T = {
  en: {
    welcome: "Welcome! Let's set up Lekha in 30 seconds.",
    welcomeStart: "Start setup",
    tapToStart: "Tap the button below to start.",
    languageTitle: "🌐 Language",
    languageDescription: "Choose the language I'll use for setup and replies. You can change this later.",
    english: "English",
    thai: "ไทย",
    localeTitle: "🌐 Location",
    localeDescription: "Choose your timezone and location. Pick Bangkok if you're in Thailand, or type a custom city.",
    replyLanguage: "Reply language",
    auto: "Auto",
    timezone: "Timezone",
    location: "Location",
    bangkok: "Bangkok",
    custom: "Custom",
    skip: "Skip",
    briefingTitle: "📰 Daily Briefings",
    briefingDescription: "Pick times for your morning briefing, evening summary, and task check-in. Or turn them off.",
    morningBriefing: "Morning briefing",
    eveningSummary: "Evening summary",
    taskCheckIn: "Task check-in",
    off: "Off",
    toolsTitle: "🛠 Tools",
    toolsDescription: "Choose what I can help you with. You can change this anytime in settings.",
    toolsAll: "✅ All 5 tools",
    toolsProductivity: "📅 Productivity",
    toolsCommunication: "📧 Communication",
    toolsMinimal: "📝 Minimal",
    toolsChat: "🔒 Just chat",
    personaTitle: "🎭 Persona",
    personaDescription: "Choose how I sound and how I address you.",
    tone: "Tone",
    addressYouAs: "Address you as",
    warm: "Warm",
    professional: "Professional",
    playful: "Playful",
    firstName: "First name",
    khun: "Khun",
    sirMadam: "Sir / Madam",
    noAddress: "No address",
    preferredName: "Preferred name",
    setPreferredName: "Set name",
    changePreferredName: "Change",
    currentName: "Current",
    preferredNamePrompt: "What should I call you?",
    memoryTitle: "🧠 Memory",
    memoryDescription: "Tell me one thing I should remember about you.",
    memoryFactHint: "Anything — a preference, a person, a deadline, a habit.",
    finishGreeting: "Hi {name}! You're all set. I've remembered: {fact}",
    emptyFactGreeting: "Hi {name}! You're all set. Just start chatting, or type /settings anytime.",
    finish: "Finish",
    back: "← Back",
    next: "Next →",
    allSet: "You're all set! I'll remember your choices. Type /settings anytime to change them, or just start chatting.",
    customTimezonePrompt: "What timezone are you in? Type a city or country (e.g. Tokyo, London).",
    customLocationPrompt: "Where are you based? Type a city or country (e.g. New York).",
    customMorningPrompt: "What time for your morning briefing? (e.g. 07:30 or 7:30 AM)",
    customEveningPrompt: "What time for your evening summary? (e.g. 21:00 or 9 PM)",
    customCheckinPrompt: "What time for your task check-in? (e.g. 20:00 or 8 PM)",
    timezoneError: "I didn't recognize that timezone. Try a city like Bangkok, Tokyo, or London.",
    locationError: "Please type a real location (at least 2 characters).",
    timeError: "I didn't catch the time. Try something like 07:30, 7:30 AM, 21:00, or 9 PM.",
    tryAgain: "Please try again.",
    tapButtonsOrRestart: "Tap the buttons above to finish setup, or type /tutorial to restart.",
    step: "Setup step {step} of {total}",
  },

  th: {
    welcome: "ยินดีต้อนรับ! มาตั้งค่า Lekha ใน 30 วินาทีกัน",
    welcomeStart: "เริ่มตั้งค่า",
    tapToStart: "แตะปุ่มด้านล่างเพื่อเริ่ม",
    languageTitle: "🌐 ภาษา",
    languageDescription: "เลือกภาษาที่ฉันจะใช้ตั้งค่าและตอบกลับ คุณสามารถเปลี่ยนได้ภายหลัง",
    english: "English",
    thai: "ไทย",
    localeTitle: "🌐 ตำแหน่งที่ตั้ง",
    localeDescription: "เลือกเขตเวลาและสถานที่ของคุณ เลือกกรุงเทพหากคุณอยู่ไทย หรือพิมพ์ชื่อเมืองอื่น",
    replyLanguage: "ภาษาตอบกลับ",
    auto: "อัตโนมัติ",
    timezone: "เขตเวลา",
    location: "สถานที่",
    bangkok: "กรุงเทพ",
    custom: "กำหนดเอง",
    skip: "ข้าม",
    briefingTitle: "📰 สรุปประจำวัน",
    briefingDescription: "เลือกเวลารับสรุปตอนเช้า สรุปตอนเย็น และการเช็คงาน หรือปิดก็ได้",
    morningBriefing: "สรุปตอนเช้า",
    eveningSummary: "สรุปตอนเย็น",
    taskCheckIn: "เช็คงาน",
    off: "ปิด",
    toolsTitle: "🛠 เครื่องมือ",
    toolsDescription: "เลือกสิ่งที่ฉันช่วยคุณได้ คุณสามารถเปลี่ยนได้ทุกเมื่อในการตั้งค่า",
    toolsAll: "✅ 5 เครื่องมือทั้งหมด",
    toolsProductivity: "📅 งานประจำวัน",
    toolsCommunication: "📧 ติดต่อสื่อสาร",
    toolsMinimal: "📝 พื้นฐาน",
    toolsChat: "🔒 แชทอย่างเดียว",
    personaTitle: "🎭 บุคลิก",
    personaDescription: "เลือกลักษณะการพูดและวิธีเรียกคุณ",
    tone: "โทน",
    addressYouAs: "วิธีเรียกคุณ",
    warm: "เป็นกันเอง",
    professional: "ทางการ",
    playful: "สนุกสนาน",
    firstName: "ชื่อจริง",
    khun: "คุณ",
    sirMadam: "ท่าน",
    noAddress: "ไม่เรียก",
    preferredName: "ชื่อที่ใช้เรียก",
    setPreferredName: "ตั้งชื่อ",
    changePreferredName: "เปลี่ยน",
    currentName: "ปัจจุบัน",
    preferredNamePrompt: "ฉันควรเรียกคุณว่าอะไร?",
    memoryTitle: "🧠 ความจำ",
    memoryDescription: "บอกฉันสักเรื่องที่ควรจำเกี่ยวกับคุณ",
    memoryFactHint: "อะไรก็ได้ — ความชอบ คนรู้จัก กำหนดเวลา หรือนิสัย",
    finishGreeting: "สวัสดี {name}! ตั้งค่าเสร็จแล้ว ฉันจำไว้แล้ว: {fact}",
    emptyFactGreeting: "สวัสดี {name}! ตั้งค่าเสร็จแล้ว เริ่มแชทได้เลย หรือพิมพ์ /settings เพื่อเปลี่ยนการตั้งค่า",
    finish: "เสร็จสิ้น",
    back: "← กลับ",
    next: "ต่อไป →",
    allSet: "ตั้งค่าเสร็จแล้ว! ฉันจะจำการตั้งค่าของคุณ พิมพ์ /settings เพื่อเปลี่ยน หรือเริ่มแชทได้เลย",
    customTimezonePrompt: "คุณอยู่ในเขตเวลาใด? พิมพ์ชื่อเมืองหรือประเทศ (เช่น โตเกียว ลอนดอน)",
    customLocationPrompt: "คุณอยู่ที่ไหน? พิมพ์ชื่อเมืองหรือประเทศ (เช่น นิวยอร์ก)",
    customMorningPrompt: "สรุปตอนเช้ากี่โมง? (เช่น 07:30 หรือ 7:30 AM)",
    customEveningPrompt: "สรุปตอนเย็นกี่โมง? (เช่น 21:00 หรือ 9 PM)",
    customCheckinPrompt: "เช็คงานกี่โมง? (เช่น 20:00 หรือ 8 PM)",
    timezoneError: "ฉันไม่รู้จักเขตเวลานั้น ลองชื่อเมืองเช่น กรุงเทพ โตเกียว หรือ ลอนดอน",
    locationError: "กรุณาพิมพ์สถานที่จริง (อย่างน้อย 2 ตัวอักษร)",
    timeError: "ฉันไม่เข้าใจเวลา ลองเช่น 07:30, 7:30 AM, 21:00 หรือ 9 PM",
    tryAgain: "กรุณาลองอีกครั้ง",
    tapButtonsOrRestart: "แตะปุ่มด้านบนเพื่อตั้งค่าต่อ หรือพิมพ์ /tutorial เพื่อเริ่มใหม่",
    step: "ขั้นตอนที่ {step} จาก {total}",
  },
};

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

function tutorialLang(settings: UserSettings): Lang {
  return settings.language === "th" ? "th" : "en";
}

function resolveTimezone(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (TIMEZONE_ALIASES[key]) return TIMEZONE_ALIASES[key];
  const normalized = key.replace(/_/g, "/").replace(/-/g, "/");
  if (normalized.includes("/") && !normalized.startsWith("/")) return normalized;
  return null;
}

function parseCustomTime(input: string): string | null {
  const t = input.trim().toLowerCase();
  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const amp = m[3]?.toLowerCase();
  if (Number.isNaN(h) || h < 1 || h > 12) return null;
  if (Number.isNaN(min) || min < 0 || min > 59) return null;
  if (amp === "pm" && h !== 12) h += 12;
  if (amp === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function tutorialBubble(lang: Lang, step: number, total: number, title: string, description: string, contents: object[]): FlexMessage {
  const stepText = T[lang].step.replace("{step}", String(step)).replace("{total}", String(total));
  return {
    type: "flex",
    altText: `${title} — ${stepText}.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(title, stepText),
      body: body([hint(description), separator(), ...contents]),
    },
  };
}

function navRow(lang: Lang, back: boolean): object {
  const t = T[lang];
  const contents: object[] = [];
  if (back) contents.push(postbackButton(t.back, "tutorial:back", "secondary"));
  contents.push(postbackButton(t.next, "tutorial:next", "primary"));
  return { type: "box", layout: "horizontal", margin: "md", spacing: "sm", contents };
}

function finishNavRow(lang: Lang): object {
  const t = T[lang];
  return { type: "box", layout: "horizontal", margin: "md", spacing: "sm", contents: [postbackButton(t.back, "tutorial:back", "secondary"), postbackButton(t.finish, "tutorial:next", "primary")] };
}

async function languageStep(settings: UserSettings): Promise<FlexMessage> {
  // The language step is intentionally bilingual so it's understandable before a choice is made.
  const lang = tutorialLang(settings);
  const stepText = T[lang].step.replace("{step}", "1").replace("{total}", "6");
  return {
    type: "flex",
    altText: "Choose your language / เลือกภาษา",
    contents: {
      type: "bubble",
      size: "mega",
      header: header("🌐 Language / ภาษา", stepText),
      body: body([
        hint("Choose the language for setup and replies. / เลือกภาษาสำหรับการตั้งค่าและการตอบกลับ"),
        separator(),
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          contents: [
            optionButton("English", "tutorial:set:language:en", settings.language === "en"),
            optionButton("ไทย", "tutorial:set:language:th", settings.language === "th"),
          ],
        },
      ]),
    },
  };
}

async function localeStep(settings: UserSettings): Promise<FlexMessage> {
  const lang = tutorialLang(settings);
  const t = T[lang];
  const languages = [
    { label: t.auto, value: "auto", on: settings.language === null },
    { label: "English", value: "en", on: settings.language === "en" },
    { label: "ไทย", value: "th", on: settings.language === "th" },
  ];
  const bangkokTz = settings.timezone === "Asia/Bangkok";
  const bangkokLoc = settings.location === "Bangkok, Thailand";
  return tutorialBubble(lang, 2, 6, t.localeTitle, t.localeDescription, [
    chipRow(
      t.replyLanguage,
      languages.map((o) => optionButton(o.label, `tutorial:set:language:${o.value}`, o.on)),
      2,
    ),
    chipRow(
      t.timezone,
      [optionButton(t.bangkok, "tutorial:set:timezone:Asia/Bangkok", bangkokTz), customButton(t.custom, "timezone")],
      2,
    ),
    chipRow(
      t.location,
      [
        optionButton(t.bangkok, "tutorial:set:location:Bangkok, Thailand", bangkokLoc),
        customButton(t.custom, "location"),
        optionButton(t.skip, "tutorial:set:location:skip", settings.location === null),
      ],
      1,
    ),
    navRow(lang, false),
  ]);
}

async function briefingStep(settings: UserSettings): Promise<FlexMessage> {
  const lang = tutorialLang(settings);
  const t = T[lang];
  const morningOn = (time: string) => settings.morningBriefingTime === time;
  const eveningOn = (time: string) => settings.eveningSummaryEnabled && settings.eveningSummaryTime === time;
  const checkinOn = (time: string) => settings.taskCheckInEnabled && settings.taskCheckInTime === time;
  return tutorialBubble(lang, 3, 6, t.briefingTitle, t.briefingDescription, [
    chipRow(
      t.morningBriefing,
      [
        optionButton("07:00", "tutorial:set:morning:07:00", morningOn("07:00")),
        optionButton("08:00", "tutorial:set:morning:08:00", morningOn("08:00")),
        customButton(t.custom, "morning"),
        optionButton(t.off, "tutorial:set:morning:off", settings.morningBriefingTime === null),
      ],
      2,
    ),
    chipRow(
      t.eveningSummary,
      [
        optionButton("20:00", "tutorial:set:evening:20:00", eveningOn("20:00")),
        optionButton("21:00", "tutorial:set:evening:21:00", eveningOn("21:00")),
        customButton(t.custom, "evening"),
        optionButton(t.off, "tutorial:set:evening:off", !settings.eveningSummaryEnabled),
      ],
      2,
    ),
    chipRow(
      t.taskCheckIn,
      [
        optionButton("19:00", "tutorial:set:checkin:19:00", checkinOn("19:00")),
        optionButton("20:00", "tutorial:set:checkin:20:00", checkinOn("20:00")),
        customButton(t.custom, "checkin"),
        optionButton(t.off, "tutorial:set:checkin:off", !settings.taskCheckInEnabled),
      ],
      2,
    ),
    navRow(lang, true),
  ]);
}

type ToolPreset = { labelKey: keyof (typeof T)["en"]; value: string; tools: Record<string, boolean> };

function matchesPreset(settings: UserSettings, preset: ToolPreset): boolean {
  return Object.entries(preset.tools).every(([k, v]) => settings.tools[k as keyof UserSettings["tools"]] === v);
}

async function toolsStep(settings: UserSettings): Promise<FlexMessage> {
  const lang = tutorialLang(settings);
  const t = T[lang];
  const presets: ToolPreset[] = [
    { labelKey: "toolsAll", value: "all", tools: { todo: true, reminders: true, calendar: true, email: true, drive: true } },
    { labelKey: "toolsProductivity", value: "productivity", tools: { todo: true, reminders: true, calendar: true, email: false, drive: false } },
    { labelKey: "toolsCommunication", value: "communication", tools: { todo: false, reminders: false, calendar: true, email: true, drive: false } },
    { labelKey: "toolsMinimal", value: "minimal", tools: { todo: true, reminders: true, calendar: false, email: false, drive: false } },
    { labelKey: "toolsChat", value: "chat", tools: { todo: false, reminders: false, calendar: false, email: false, drive: false } },
  ];
  return tutorialBubble(lang, 4, 6, t.toolsTitle, t.toolsDescription, [
    {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: presets.map((p) => postbackButton(t[p.labelKey], `tutorial:set:tools:${p.value}`, matchesPreset(settings, p) ? "primary" : "secondary")),
    },
    separator(),
    navRow(lang, true),
  ]);
}

function preferredNameRow(settings: UserSettings, displayName: string, lang: Lang): object {
  const t = T[lang];
  const current = settings.personaPreferredName?.trim() || displayName || (lang === "th" ? "ยังไม่ตั้ง" : "Not set");
  const buttonLabel = settings.personaPreferredName?.trim() ? t.changePreferredName : t.setPreferredName;
  return {
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
          { type: "text", text: t.preferredName, weight: "bold", size: "sm", color: TEXT, wrap: true },
          { type: "text", text: `${t.currentName}: ${current}`, size: "xs", color: "#777777", wrap: true },
        ],
      },
      postbackButton(buttonLabel, "tutorial:custom:preferredName", "secondary"),
    ],
  };
}

async function personaStep(settings: UserSettings, userId: string): Promise<FlexMessage> {
  const lang = tutorialLang(settings);
  const t = T[lang];
  const displayName = await getTutorialDisplayName(userId);
  const tones = [
    { label: t.warm, value: "Warm", on: settings.personaTone === "Warm" },
    { label: t.professional, value: "Professional", on: settings.personaTone === "Professional" },
    { label: t.playful, value: "Playful", on: settings.personaTone === "Playful" },
  ];
  const addressing = [
    { label: t.firstName, value: "First name", on: settings.personaAddressing === "First name" },
    { label: t.khun, value: "Khun", on: settings.personaAddressing === "Khun" },
    { label: t.sirMadam, value: "Sir / Madam", on: settings.personaAddressing === "Sir / Madam" },
    { label: t.noAddress, value: "No address", on: settings.personaAddressing === "No address" },
  ];
  return tutorialBubble(lang, 5, 6, t.personaTitle, t.personaDescription, [
    preferredNameRow(settings, displayName, lang),
    chipRow(t.tone, tones.map((o) => optionButton(o.label, `tutorial:set:personaTone:${o.value}`, o.on)), 1),
    chipRow(t.addressYouAs, addressing.map((o) => optionButton(o.label, `tutorial:set:personaAddressing:${o.value}`, o.on)), 1),
    navRow(lang, true),
  ]);
}

async function memoryStep(settings: UserSettings): Promise<FlexMessage> {
  const lang = tutorialLang(settings);
  const t = T[lang];
  return tutorialBubble(lang, 6, 6, t.memoryTitle, t.memoryDescription, [
    hint(t.memoryFactHint),
    {
      type: "box",
      layout: "horizontal",
      margin: "md",
      spacing: "sm",
      contents: [postbackButton(t.skip, "tutorial:skipFact", "secondary")],
    },
  ]);
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

async function bubbleForStep(userId: string, settings: UserSettings, step: number): Promise<FlexMessage | null> {
  const section = TUTORIAL_SECTIONS[step];
  if (!section) return null;
  if (section === "language") return languageStep(settings);
  if (section === "locale") return localeStep(settings);
  if (section === "briefing") return briefingStep(settings);
  if (section === "tools") return toolsStep(settings);
  if (section === "persona") return personaStep(settings, userId);
  if (section === "memory") return memoryStep(settings);
  return null;
}

export async function sendTutorialStep(userId: string, replyToken: string, step: number): Promise<void> {
  await setTutorialStep(userId, step);
  const settings = await getSettings(userId);
  const bubble = await bubbleForStep(userId, settings, step);
  if (bubble) {
    await replyOrPush(userId, replyToken, [bubble]);
  }
  // On the memory step, expect the user to type one fact as their next message.
  const section = TUTORIAL_SECTIONS[step];
  if (section === "memory") await setTutorialWaiting(userId, "memoryFact");
}

export async function startTutorial(
  userId: string,
  replyToken: string,
  displayName = "",
  isTrial = false,
): Promise<void> {
  await setTutorialStep(userId, 0);
  await setTutorialDisplayName(userId, displayName);
  if (isTrial) {
    await redis().set(TUTORIAL_TRIAL_KEY(userId), 1, { ex: 60 * 60 * 24 });
  } else {
    await redis().del(TUTORIAL_TRIAL_KEY(userId));
  }
  if (!replyToken) {
    const welcome = displayName
      ? `Hi ${displayName}! Welcome to Lekha 👋\n\nLet's set up your account in 30 seconds.\n\nสวัสดี ${displayName}! ยินดีต้อนรับสู่ Lekha 👋\n\nมาตั้งค่าบัญชีของคุณใน 30 วินาทีกัน`
      : "Welcome to Lekha 👋\n\nLet's set up your account in 30 seconds.\n\nยินดีต้อนรับสู่ Lekha 👋\n\nมาตั้งค่าบัญชีของคุณใน 30 วินาทีกัน";
    await replyOrPush(userId, "", [
      textMsg(welcome),
      {
        type: "flex",
        altText: "Tap Start setup to configure Lekha.",
        contents: {
          type: "bubble",
          size: "mega",
          body: body([
            { type: "text", text: "Tap the button below to start. / แตะปุ่มด้านล่างเพื่อเริ่ม", size: "sm", color: TEXT, wrap: true },
            { type: "box", layout: "horizontal", margin: "md", spacing: "sm", contents: [postbackButton("Start setup / เริ่มตั้งค่า", "tutorial:start", "primary")] },
          ]),
        },
      },
    ]);
    return;
  }
  await sendTutorialStep(userId, replyToken, 0);
}

async function finishTutorial(userId: string, replyToken: string, seedFact?: string): Promise<void> {
  await clearTutorialStep(userId);
  await setTutorialWaiting(userId, null);
  await redis().set(`user:${userId}:onboarded`, 1);
  const settings = await getSettings(userId);
  const lang = tutorialLang(settings);
  const t = T[lang];
  const displayName = await getTutorialDisplayName(userId);
  const name = settings.personaPreferredName?.trim() || displayName || (lang === "th" ? "คุณ" : "there");
  const greeting = seedFact?.trim()
    ? t.finishGreeting.replace("{name}", name).replace("{fact}", seedFact.trim())
    : t.emptyFactGreeting.replace("{name}", name);
  const isTrial = (await redis().get(TUTORIAL_TRIAL_KEY(userId))) === 1;
  await redis().del(TUTORIAL_TRIAL_KEY(userId));
  const messages: Array<ReturnType<typeof textMsg> | FlexMessage> = [
    textMsg(greeting),
    settingsMainFlex(settings),
  ];
  if (isTrial) {
    messages.push(
      textMsg(
        lang === "th"
          ? `ทดลองใช้ฟรีใช้งานอยู่ — ส่งได้ ${TRIAL_DAILY_LIMIT} ข้อความต่อวัน อัปเกรดได้ตลอดเวลาเพื่อใช้งานไม่จำกัด`
          : `Free trial active — you can send ${TRIAL_DAILY_LIMIT} messages per day. Upgrade anytime for unlimited messages.`,
      ),
    );
  }
  await replyOrPush(userId, replyToken, messages);
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
  } else if (key === "personaPreferredName") {
    patch.personaPreferredName = value.trim();
  } else if (key === "memoryEnabled") {
    patch.memoryEnabled = value === "true";
  } else if (key === "memoryCompactAt") {
    const n = Number(value);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 1000) patch.memoryCompactAt = n;
  }

  if (Object.keys(patch).length) await updateSettings(userId, patch);
  return patch;
}

function customPrompt(field: WaitingField, lang: Lang): string {
  const t = T[lang];
  switch (field) {
    case "timezone":
      return t.customTimezonePrompt;
    case "location":
      return t.customLocationPrompt;
    case "morning":
      return t.customMorningPrompt;
    case "evening":
      return t.customEveningPrompt;
    case "checkin":
      return t.customCheckinPrompt;
    case "preferredName":
      return t.preferredNamePrompt;
  }
}

async function handleMemoryFactInput(userId: string, replyToken: string, input: string): Promise<void> {
  const factText = input.trim();
  if (factText.length < 2) {
    const settings = await getSettings(userId);
    const t = T[tutorialLang(settings)];
    await replyOrPush(userId, replyToken, [textMsg(`${t.tryAgain}`)]);
    return;
  }
  const existing = await loadFacts(userId);
  const fact = _internalNewFact(factText, "other", { priority: 10 });
  await saveFacts(userId, { facts: [...existing.facts, fact], updatedAt: Date.now() });
  await finishTutorial(userId, replyToken, factText);
}

async function handleCustomInput(userId: string, replyToken: string, field: WaitingField, input: string): Promise<void> {
  const settings = await getSettings(userId);
  const lang = tutorialLang(settings);
  const t = T[lang];
  let value: string | null = null;
  let error = "";

  if (field === "timezone") {
    const tz = resolveTimezone(input);
    if (tz) value = tz;
    else error = t.timezoneError;
  } else if (field === "location") {
    const loc = input.trim();
    if (loc.length >= 2) value = loc;
    else error = t.locationError;
  } else if (field === "morning" || field === "evening" || field === "checkin") {
    const time = parseCustomTime(input);
    if (time) value = time;
    else error = t.timeError;
  } else if (field === "preferredName") {
    const name = input.trim();
    if (name.length >= 1 && name.length <= 100) value = name;
    else error = lang === "th" ? "กรุณาพิมพ์ชื่อ" : "Please type a name.";
  }

  if (error || !value) {
    await replyOrPush(userId, replyToken, [textMsg(`${error} ${t.tryAgain}`)]);
    return;
  }

  if (field === "preferredName") {
    await applyTutorialSetting(userId, "personaPreferredName", value);
  } else {
    await applyTutorialSetting(userId, field, value);
  }
  await setTutorialWaiting(userId, null);
  const step = await getTutorialStep(userId);
  if (step >= 0) await sendTutorialStep(userId, replyToken, step);
}

export async function handleTutorialText(userId: string, replyToken: string, userText: string): Promise<boolean> {
  const lower = userText.trim().toLowerCase();
  if (lower === "/tutorial") {
    await setTutorialWaiting(userId, null);
    await startTutorial(userId, replyToken);
    return true;
  }
  const step = await getTutorialStep(userId);
  if (step < 0) return false;

  const waiting = await getTutorialWaiting(userId);
  if (waiting && ["timezone", "location", "morning", "evening", "checkin", "preferredName"].includes(waiting)) {
    await handleCustomInput(userId, replyToken, waiting as WaitingField, userText);
    return true;
  }
  if (waiting === "memoryFact") {
    await handleMemoryFactInput(userId, replyToken, userText);
    return true;
  }

  const settings = await getSettings(userId);
  const t = T[tutorialLang(settings)];
  await replyOrPush(userId, replyToken, [textMsg(t.tapButtonsOrRestart)]);
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
    let step = await getTutorialStep(userId);
    if (step < 0) return;
    // Selecting a language on the first (language) step immediately advances so
    // the rest of the setup is shown in the chosen language. On later steps it
    // only updates the setting and re-renders the current step.
    if (key === "language" && step === 0) {
      step = step + 1;
      if (step >= TUTORIAL_SECTIONS.length) {
        await finishTutorial(userId, replyToken);
        return;
      }
    }
    await sendTutorialStep(userId, replyToken, step);
    return;
  }

  if (action === "custom" && args[1]) {
    const field = args[1] as WaitingField;
    const settings = await getSettings(userId);
    const lang = tutorialLang(settings);
    await setTutorialWaiting(userId, field);
    await replyOrPush(userId, replyToken, [textMsg(customPrompt(field, lang))]);
    return;
  }

  if (action === "skipFact") {
    await setTutorialWaiting(userId, null);
    await finishTutorial(userId, replyToken);
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
