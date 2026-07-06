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

export const TUTORIAL_SECTIONS = ["locale", "briefing", "tools", "persona", "memory"] as const;
type TutorialSection = (typeof TUTORIAL_SECTIONS)[number];

function header(title: string, step: string): object {
  return {
    type: "box",
    layout: "vertical",
    backgroundColor: ACCENT,
    paddingAll: "14px",
    contents: [
      { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg" },
      { type: "text", text: step, color: "rgba(255,255,255,0.75)", size: "xs" },
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

function chipRow(label: string, buttons: object[]): object {
  return {
    type: "box",
    layout: "vertical",
    margin: "md",
    spacing: "sm",
    contents: [
      { type: "text", text: label, weight: "bold", size: "sm", color: TEXT },
      { type: "box", layout: "horizontal", spacing: "sm", wrap: true, contents: buttons },
    ],
  };
}

function optionButton(label: string, data: string, on: boolean): object {
  return postbackButton(label, data, on ? "primary" : "secondary");
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
  const timezones = [
    { label: "Bangkok", value: "Asia/Bangkok", on: settings.timezone === "Asia/Bangkok" },
    { label: "Singapore", value: "Asia/Singapore", on: settings.timezone === "Asia/Singapore" },
    { label: "Tokyo", value: "Asia/Tokyo", on: settings.timezone === "Asia/Tokyo" },
    { label: "London", value: "Europe/London", on: settings.timezone === "Europe/London" },
    { label: "New York", value: "America/New_York", on: settings.timezone === "America/New_York" },
  ];
  const locations = [
    { label: "Bangkok", value: "Bangkok, Thailand", on: settings.location === "Bangkok, Thailand" },
    { label: "Singapore", value: "Singapore", on: settings.location === "Singapore" },
    { label: "Tokyo", value: "Tokyo, Japan", on: settings.location === "Tokyo, Japan" },
    { label: "London", value: "London, UK", on: settings.location === "London, UK" },
    { label: "New York", value: "New York, USA", on: settings.location === "New York, USA" },
    { label: "Skip", value: "", on: settings.location === null },
  ];
  return tutorialBubble(1, 5, "🌐 Language & Location", "This tells me how to reply and what timezone to use for briefings, reminders, and meetings.", [
    chipRow(
      "Reply language (Auto = match you)",
      languages.map((o) => optionButton(o.label, `tutorial:set:language:${o.value}`, o.on)),
    ),
    chipRow(
      "Timezone",
      timezones.map((o) => optionButton(o.label, `tutorial:set:timezone:${o.value}`, o.on)),
    ),
    chipRow(
      "Location",
      locations.map((o) => optionButton(o.label, `tutorial:set:location:${o.value || "skip"}`, o.on)),
    ),
    navRow(false, "Next →"),
  ]);
}

async function briefingStep(settings: UserSettings): Promise<FlexMessage> {
  const morningOpts = [
    { label: "07:00", value: "07:00", on: settings.morningBriefingTime === "07:00" },
    { label: "08:00", value: "08:00", on: settings.morningBriefingTime === "08:00" },
    { label: "Off", value: "off", on: settings.morningBriefingTime === null },
  ];
  const eveningOpts = [
    { label: "20:00", value: "20:00", on: settings.eveningSummaryEnabled && settings.eveningSummaryTime === "20:00" },
    { label: "21:00", value: "21:00", on: settings.eveningSummaryEnabled && settings.eveningSummaryTime === "21:00" },
    { label: "Off", value: "off", on: !settings.eveningSummaryEnabled },
  ];
  const checkinOpts = [
    { label: "19:00", value: "19:00", on: settings.taskCheckInEnabled && settings.taskCheckInTime === "19:00" },
    { label: "20:30", value: "20:30", on: settings.taskCheckInEnabled && settings.taskCheckInTime === "20:30" },
    { label: "Off", value: "off", on: !settings.taskCheckInEnabled },
  ];
  return tutorialBubble(2, 5, "📰 Daily Briefings", "I can send you a morning briefing, an evening summary, and a task check-in. Pick times that fit your day.", [
    chipRow("Morning briefing", morningOpts.map((o) => optionButton(o.label, `tutorial:set:morning:${o.value}`, o.on))),
    chipRow("Evening summary", eveningOpts.map((o) => optionButton(o.label, `tutorial:set:evening:${o.value}`, o.on))),
    chipRow("Task check-in", checkinOpts.map((o) => optionButton(o.label, `tutorial:set:checkin:${o.value}`, o.on))),
    navRow(true, "Next →"),
  ]);
}

async function toolsStep(settings: UserSettings): Promise<FlexMessage> {
  const allOn = Object.values(settings.tools).every(Boolean);
  const minimal = settings.tools.todo && settings.tools.reminders && !settings.tools.calendar && !settings.tools.email && !settings.tools.drive;
  return tutorialBubble(3, 5, "🛠 Tools", "Choose which tools I can use. You can always enable more later by typing =settings=.", [
    {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: [
        postbackButton("✅ Enable all 5 tools", "tutorial:set:tools:all", allOn ? "primary" : "secondary"),
        postbackButton("📝 Tasks + reminders only", "tutorial:set:tools:minimal", minimal ? "primary" : "secondary"),
      ],
    },
    separator(),
    navRow(true, "Next →"),
  ]);
}

async function personaStep(settings: UserSettings): Promise<FlexMessage> {
  const tones = [
    { label: "Warm", value: "Warm", on: settings.personaTone === "Warm" },
    { label: "Professional", value: "Professional", on: settings.personaTone === "Professional" },
    { label: "Playful", value: "Playful", on: settings.personaTone === "Playful" },
  ];
  const addressing = [
    { label: "First name", value: "First name", on: settings.personaAddressing === "First name" },
    { label: "Khun", value: "Khun", on: settings.personaAddressing === "Khun" },
    { label: "Sir / Madam", value: "Sir / Madam", on: settings.personaAddressing === "Sir / Madam" },
    { label: "No address", value: "No address", on: settings.personaAddressing === "No address" },
  ];
  return tutorialBubble(4, 5, "🎭 Persona", "Choose how I sound when I message you.", [
    chipRow("Tone", tones.map((o) => optionButton(o.label, `tutorial:set:personaTone:${o.value}`, o.on))),
    chipRow("Address you as", addressing.map((o) => optionButton(o.label, `tutorial:set:personaAddressing:${o.value}`, o.on))),
    navRow(true, "Next →"),
  ]);
}

async function memoryStep(settings: UserSettings): Promise<FlexMessage> {
  const intervals = [
    { label: "5", value: "5", on: settings.memoryCompactAt === 5 },
    { label: "10", value: "10", on: settings.memoryCompactAt === 10 },
    { label: "20", value: "20", on: settings.memoryCompactAt === 20 },
  ];
  return tutorialBubble(5, 5, "🧠 Memory", "I can remember facts from our chats and use them later. How often should I compact my memory?", [
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
    chipRow("Compact every N msgs", intervals.map((o) => optionButton(o.label, `tutorial:set:memoryCompactAt:${o.value}`, o.on))),
    navRow(true, "Finish ✅"),
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
    if (value === "all") {
      patch.tools = { todo: true, reminders: true, calendar: true, email: true, drive: true };
    } else if (value === "minimal") {
      patch.tools = { todo: true, reminders: true, calendar: false, email: false, drive: false };
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

export async function handleTutorialText(userId: string, replyToken: string, userText: string): Promise<boolean> {
  const lower = userText.trim().toLowerCase();
  if (lower === "=tutorial") {
    await startTutorial(userId, replyToken);
    return true;
  }
  const step = await getTutorialStep(userId);
  if (step < 0) return false;
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
    await applyTutorialSetting(userId, key, value);
    const step = await getTutorialStep(userId);
    if (step >= 0) await sendTutorialStep(userId, replyToken, step);
    return;
  }

  let step = await getTutorialStep(userId);
  if (step < 0) step = 0;

  if (action === "back") {
    step = Math.max(0, step - 1);
    await sendTutorialStep(userId, replyToken, step);
    return;
  }

  if (action === "next") {
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
