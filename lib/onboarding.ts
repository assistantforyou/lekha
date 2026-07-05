import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { getSettings, updateSettings, type UserSettings } from "@/lib/memory/settings";
import { redis } from "@/lib/memory/redis";
import { settingsMainFlex } from "@/lib/line/flex/settings";
import type { FlexMessage } from "@/lib/line/client";

const ACCENT = "#5B6FF0";

const header = (title: string, step: string): object => ({
  type: "box",
  layout: "vertical",
  backgroundColor: ACCENT,
  paddingAll: "14px",
  contents: [
    { type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg" },
    { type: "text", text: step, color: "rgba(255,255,255,0.75)", size: "xs" },
  ],
});

const body = (contents: object[]): object => ({
  type: "box",
  layout: "vertical",
  spacing: "sm",
  paddingAll: "16px",
  contents,
});

const hint = (text: string): object => ({ type: "text", text, size: "xs", color: "#777777", wrap: true });

const postbackButton = (label: string, data: string, style: "primary" | "secondary" = "primary"): object => ({
  type: "button",
  style,
  color: style === "primary" ? ACCENT : undefined,
  height: "sm",
  action: { type: "postback", label, data, displayText: label },
});

const separator = (): object => ({ type: "separator", margin: "md", color: "#f2f2f2" });

const chipRow = (label: string, buttons: object[]): object => ({
  type: "box",
  layout: "vertical",
  margin: "md",
  spacing: "sm",
  contents: [
    { type: "text", text: label, weight: "bold", size: "sm", color: "#333333" },
    { type: "box", layout: "horizontal", spacing: "sm", wrap: true, contents: buttons },
  ],
});

function onboardingBubble(step: number, title: string, description: string, contents: object[]): FlexMessage {
  return {
    type: "flex",
    altText: `${title} — Step ${step} of 4 of your Lekha setup.`,
    contents: {
      type: "bubble",
      size: "mega",
      header: header(title, `Step ${step} of 4`),
      body: body([hint(description), separator(), ...contents]),
    },
  };
}

export function onboardingStep0Flex(displayName: string): FlexMessage {
  return onboardingBubble(
    1,
    `👋 Hi${displayName ? `, ${displayName}` : ""}`,
    "Let’s set you up in 4 quick taps. First, what language should I reply in?",
    [
      chipRow("Language", [
        postbackButton("English", "onboard:lang:en"),
        postbackButton("ไทย", "onboard:lang:th"),
        postbackButton("Auto", "onboard:lang:auto", "secondary"),
      ]),
    ],
  );
}

export function onboardingStep1Flex(): FlexMessage {
  return onboardingBubble(
    2,
    "🌐 Where are you?",
    "Pick your timezone. I’ll use it for briefings, reminders, and meetings.",
    [
      chipRow("Timezone", [
        postbackButton("Bangkok", "onboard:tz:Asia/Bangkok"),
        postbackButton("Singapore", "onboard:tz:Asia/Singapore"),
        postbackButton("Tokyo", "onboard:tz:Asia/Tokyo"),
        postbackButton("London", "onboard:tz:Europe/London"),
        postbackButton("New York", "onboard:tz:America/New_York"),
      ]),
      chipRow("Location", [
        postbackButton("Bangkok", "onboard:loc:Bangkok, Thailand", "secondary"),
        postbackButton("Singapore", "onboard:loc:Singapore", "secondary"),
        postbackButton("Tokyo", "onboard:loc:Tokyo, Japan", "secondary"),
        postbackButton("Other", "onboard:loc:skip", "secondary"),
      ]),
    ],
  );
}

export function onboardingStep2Flex(): FlexMessage {
  return onboardingBubble(
    3,
    "📰 Daily briefings",
    "Choose a schedule. You can change this anytime by typing =settings=.",
    [
      {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          postbackButton("☀️ Morning 7 AM + 🌙 Evening 9 PM", "onboard:briefing:full"),
          postbackButton("☀️ Morning only", "onboard:briefing:morning", "secondary"),
          postbackButton("🌙 Evening only", "onboard:briefing:evening", "secondary"),
          postbackButton("⏸ Skip for now", "onboard:briefing:skip", "secondary"),
        ],
      },
    ],
  );
}

export function onboardingStep3Flex(): FlexMessage {
  return onboardingBubble(
    4,
    "🛠 Tools",
    "Which tools should I start with? You can toggle individual tools later.",
    [
      {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          postbackButton("✅ Enable all 5 tools", "onboard:tools:all"),
          postbackButton("📝 Tasks + reminders only", "onboard:tools:minimal", "secondary"),
          postbackButton("⏸ Skip for now", "onboard:tools:skip", "secondary"),
        ],
      },
    ],
  );
}

const ONBOARDED_KEY = (userId: string) => `user:${userId}:onboarded`;

export async function isOnboarded(userId: string): Promise<boolean> {
  const v = await redis().get(ONBOARDED_KEY(userId));
  return v === 1 || v === "1";
}

export async function markOnboarded(userId: string): Promise<void> {
  await redis().set(ONBOARDED_KEY(userId), 1);
}

export async function clearOnboarded(userId: string): Promise<void> {
  await redis().del(ONBOARDED_KEY(userId));
}

async function sendStep(userId: string, replyToken: string, step: number, displayName = ""): Promise<void> {
  let msg: FlexMessage;
  if (step === 0) msg = onboardingStep0Flex(displayName);
  else if (step === 1) msg = onboardingStep1Flex();
  else if (step === 2) msg = onboardingStep2Flex();
  else msg = onboardingStep3Flex();
  await replyOrPush(userId, replyToken, [msg]);
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

export async function handleOnboardingPostback(userId: string, replyToken: string, args: string[]): Promise<void> {
  const step = args[0];
  const choice = args[1];
  const settings = await getSettings(userId);
  let patch: Partial<UserSettings> = {};

  if (step === "lang" && choice) {
    patch.language = choice === "auto" ? null : choice;
    await updateSettings(userId, patch);
    await sendStep(userId, replyToken, 1);
    return;
  }

  if (step === "tz" && choice) {
    patch.timezone = choice;
    await updateSettings(userId, patch);
    await sendStep(userId, replyToken, 2);
    return;
  }

  if (step === "loc" && choice) {
    if (choice !== "skip") patch.location = choice;
    await updateSettings(userId, patch);
    await sendStep(userId, replyToken, 2);
    return;
  }

  if (step === "briefing" && choice) {
    if (choice === "full") {
      patch.morningBriefingTime = "07:00";
      patch.eveningSummaryEnabled = true;
      patch.eveningSummaryTime = "21:00";
      patch.taskCheckInEnabled = true;
    } else if (choice === "morning") {
      patch.morningBriefingTime = "07:00";
      patch.eveningSummaryEnabled = false;
      patch.taskCheckInEnabled = true;
    } else if (choice === "evening") {
      patch.morningBriefingTime = null;
      patch.eveningSummaryEnabled = true;
      patch.eveningSummaryTime = "21:00";
      patch.taskCheckInEnabled = true;
    } else if (choice === "skip") {
      patch.morningBriefingTime = null;
      patch.eveningSummaryEnabled = false;
      patch.taskCheckInEnabled = false;
    }
    await updateSettings(userId, patch);
    await sendStep(userId, replyToken, 3);
    return;
  }

  if (step === "tools" && choice) {
    if (choice === "all") {
      patch.tools = { todo: true, reminders: true, calendar: true, email: true, drive: true };
    } else if (choice === "minimal") {
      patch.tools = { todo: true, reminders: true, calendar: false, email: false, drive: false };
    } else if (choice === "skip") {
      patch.tools = { todo: true, reminders: true, calendar: false, email: false, drive: false };
    }
    patch.disabledCategories = deriveDisabledCategories(patch.tools as Record<string, boolean>);
    await updateSettings(userId, patch);
    await markOnboarded(userId);

    const msgs: (FlexMessage | { type: "flex"; altText: string; contents: object })[] = [
      textMsg("You’re all set! 🎉\n\nI’ll remember your choices. Type =settings= anytime to change them, or just start chatting."),
      settingsMainFlex(await getSettings(userId)),
    ];
    await replyOrPush(userId, replyToken, msgs);
    return;
  }

  // Unknown postback — restart at step 0
  await sendStep(userId, replyToken, 0);
}

export async function startOnboarding(userId: string, replyToken: string, displayName = ""): Promise<void> {
  await sendStep(userId, replyToken, 0, displayName);
}
