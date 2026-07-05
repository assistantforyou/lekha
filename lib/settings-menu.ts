import { replyOrPush, text as textMsg, showLoading } from "@/lib/line/client";
import { getSettings, updateSettings, type UserSettings } from "@/lib/memory/settings";
import { loadFacts, appendFact, saveFacts } from "@/lib/memory/facts";
import { redis } from "@/lib/memory/redis";
import {
  settingsMainFlex,
  settingsBriefingFlex,
  settingsToolsFlex,
  settingsPersonaFlex,
  settingsMemoryFlex,
  settingsFactsFlex,
  settingsLocaleFlex,
} from "@/lib/line/flex/settings";

const VALID_SECTIONS = new Set([
  "briefing",
  "tools",
  "persona",
  "memory",
  "facts",
  "locale",
]);

type Section = "main" | "briefing" | "tools" | "persona" | "memory" | "facts" | "locale";

const PROMPT_KEY = (userId: string) => `settings:prompt:${userId}`;

async function getPendingPrompt(userId: string): Promise<string | null> {
  return (await redis().get<string>(PROMPT_KEY(userId))) ?? null;
}

function setPendingPrompt(userId: string, key: string): Promise<string | null> {
  return redis().set(PROMPT_KEY(userId), key, { ex: 60 * 5 });
}

function clearPendingPrompt(userId: string): Promise<number> {
  return redis().del(PROMPT_KEY(userId));
}

async function sendMenu(userId: string, replyToken: string, section: Section): Promise<void> {
  clearPendingPrompt(userId).catch(() => {});

  console.warn("[settings] sendMenu", { userId, section, hasReplyToken: !!replyToken });
  const settings = await getSettings(userId);
  let messages = [settingsMainFlex(settings)];
  if (section === "briefing") messages = [settingsBriefingFlex(settings)];
  if (section === "tools") messages = [settingsToolsFlex(settings)];
  if (section === "persona") messages = [settingsPersonaFlex(settings)];
  if (section === "memory") messages = [settingsMemoryFlex(settings)];
  if (section === "facts") {
    const facts = await loadFacts(userId);
    messages = [settingsFactsFlex(facts.facts)];
  }
  if (section === "locale") messages = [settingsLocaleFlex(settings)];
  try {
    await replyOrPush(userId, replyToken, messages);
  } catch (err) {
    console.error("[settings] sendMenu replyOrPush failed", { userId, section, replyToken, error: err });
    throw err;
  }
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

function parseBool(s: string | undefined): boolean | null {
  if (s === "true") return true;
  if (s === "false") return false;
  return null;
}

function normalizeLanguage(s: string): string | null {
  const lower = s.toLowerCase();
  if (lower === "auto") return null;
  if (lower.startsWith("en")) return "en";
  if (lower.startsWith("th")) return "th";
  return s;
}

async function applyPatchAndReply(
  userId: string,
  replyToken: string,
  patch: Partial<UserSettings>,
  returnSection: Section,
): Promise<void> {
  await updateSettings(userId, patch);
  await sendMenu(userId, replyToken, returnSection);
}

async function handleSet(userId: string, replyToken: string, args: string[]): Promise<void> {
  // args = [section, "set", key, value?]
  const section = args[0];
  const key = args[2];
  const value = args[3];
  const settings = await getSettings(userId);
  let patch: Partial<UserSettings> = {};
  let returnSection: Section = section && VALID_SECTIONS.has(section) ? (section as Section) : "main";

  if (key === "personaTone" && value) {
    if (["Warm", "Professional", "Playful"].includes(value)) patch.personaTone = value as UserSettings["personaTone"];
  } else if (key === "personaAddressing" && value) {
    if (["First name", "Khun", "Sir / Madam", "No address"].includes(value)) patch.personaAddressing = value as UserSettings["personaAddressing"];
  } else if (key === "personaPrimaryLang" && value) {
    if (["English", "Thai"].includes(value)) patch.personaPrimaryLang = value as UserSettings["personaPrimaryLang"];
  } else if (key === "personaVoiceMatch" && value) {
    const b = parseBool(value);
    if (b !== null) patch.personaVoiceMatch = b;
  } else if (key === "memoryEnabled" && value) {
    const b = parseBool(value);
    if (b !== null) patch.memoryEnabled = b;
  } else if (key === "memoryCompactAt" && value) {
    const n = Number(value);
    if (Number.isFinite(n)) patch.memoryCompactAt = n;
  } else if (key === "language" && value) {
    patch.language = normalizeLanguage(value);
  } else if (key === "timezone" && value) {
    patch.timezone = value;
  } else if (key === "location" && value) {
    patch.location = value;
  } else if (key === "briefingLength" && value) {
    if (["Headlines", "Bullets", "Full"].includes(value)) patch.briefingLength = value as UserSettings["briefingLength"];
  } else if (key === "briefingLanguage" && value) {
    if (["English", "ไทย", "EN + ไทย"].includes(value)) patch.briefingLanguage = value as UserSettings["briefingLanguage"];
  } else if (key === "inboxBriefingEnabled" && value) {
    const b = parseBool(value);
    if (b !== null) patch.inboxBriefingEnabled = b;
  } else if (key === "briefingTopic" && value && args[4]) {
    const topicId = value;
    const b = parseBool(args[4]);
    if (b !== null) {
      patch.briefingTopics = { ...settings.briefingTopics, [topicId]: b };
    }
  } else if (key === "briefingChannel" && value && args[4]) {
    const ch = value as keyof UserSettings["briefingChannels"];
    const b = parseBool(args[4]);
    if (b !== null) {
      patch.briefingChannels = { ...settings.briefingChannels, [ch]: b };
    }
  } else if (key === "tool" && value && args[4]) {
    const toolId = value;
    const b = parseBool(args[4]);
    if (b !== null) {
      const nextTools = { ...settings.tools, [toolId]: b };
      patch.tools = nextTools;
      patch.disabledCategories = deriveDisabledCategories(nextTools);
    }
  } else if (key === "morningTime" && value) {
    patch.morningBriefingTime = value;
  } else if (key === "eveningTime" && value) {
    patch.eveningSummaryEnabled = true;
    patch.eveningSummaryTime = value;
  } else if (key === "checkinTime" && value) {
    patch.taskCheckInEnabled = true;
    patch.taskCheckInTime = value;
  }

  await applyPatchAndReply(userId, replyToken, patch, returnSection);
}

async function handleToggle(userId: string, replyToken: string, args: string[]): Promise<void> {
  // args = ["toggle", target, "off"]
  const target = args[1];
  const settings = await getSettings(userId);
  let patch: Partial<UserSettings> = {};
  let returnSection: Section = "briefing";

  if (target === "morning") {
    patch.morningBriefingTime = null;
  } else if (target === "evening") {
    patch.eveningSummaryEnabled = false;
  } else if (target === "checkin") {
    patch.taskCheckInEnabled = false;
  }

  await applyPatchAndReply(userId, replyToken, patch, returnSection);
}

async function handleFactsAction(userId: string, replyToken: string, args: string[]): Promise<void> {
  // args = ["facts", "del", id]
  const id = args[2];
  if (id) {
    const facts = await loadFacts(userId);
    const next = facts.facts.filter((f) => f.id !== id);
    if (next.length !== facts.facts.length) {
      await saveFacts(userId, { facts: next, updatedAt: Date.now() });
      await replyOrPush(userId, replyToken, [textMsg("Deleted that fact.")]);
    }
  }
  await sendMenu(userId, replyToken, "facts");
}

export async function handleSettingsPostback(userId: string, replyToken: string, args: string[]): Promise<void> {
  console.warn("[settings] postback", { userId, args: args.join(":"), hasReplyToken: !!replyToken });
  if (args.length === 0) {
    await sendMenu(userId, replyToken, "main");
    return;
  }
  const first = args[0];

  if (first === "main" || first === "noop") {
    if (first === "noop") {
      await replyOrPush(userId, replyToken, [textMsg("Settings closed. Type =settings= anytime.")]);
    } else {
      await sendMenu(userId, replyToken, "main");
    }
    return;
  }

  if (first === "section" && args[1] && VALID_SECTIONS.has(args[1])) {
    await sendMenu(userId, replyToken, args[1] as Section);
    return;
  }

  if (first === "prompt" && args[1]) {
    const key = args[1];
    await setPendingPrompt(userId, key);
    const prompts: Record<string, string> = {
      timezone: "What timezone should I use? (e.g. Asia/Bangkok)",
      location: "What location should I use? (e.g. Bangkok, Thailand)",
      morning: "What time should I send your morning briefing? (e.g. 07:00)",
      evening: "What time should I send your evening summary? (e.g. 21:00)",
      checkin: "What time should I check in on your tasks? (e.g. 20:30)",
      fact: "What fact should I remember?",
    };
    await replyOrPush(userId, replyToken, [textMsg(prompts[key] ?? "What value?")]);
    return;
  }

  if (first === "facts") {
    await handleFactsAction(userId, replyToken, args);
    return;
  }

  if (first === "toggle") {
    await handleToggle(userId, replyToken, args);
    return;
  }

  const action = args[1];
  if (action === "set") {
    await handleSet(userId, replyToken, args);
    return;
  }

  await sendMenu(userId, replyToken, "main");
}

function sectionForKey(key: string): Section {
  if (["morningBriefingTime", "eveningSummaryEnabled", "eveningSummaryTime", "taskCheckInEnabled", "taskCheckInTime", "inboxBriefingEnabled", "briefingTopics", "briefingLength", "briefingLanguage", "briefingChannels"].includes(key)) return "briefing";
  if (["tools", "disabledCategories"].includes(key)) return "tools";
  if (["personaTone", "personaAddressing", "personaPrimaryLang", "personaVoiceMatch"].includes(key)) return "persona";
  if (["memoryEnabled", "memoryCompactAt"].includes(key)) return "memory";
  if (["language"].includes(key)) return "locale";
  if (["timezone", "location"].includes(key)) return "locale";
  return "main";
}

async function applyTypedSet(userId: string, replyToken: string, rawKey: string, rawValue: string): Promise<void> {
  const key = rawKey.toLowerCase().trim();
  const value = rawValue.trim();
  const settings = await getSettings(userId);
  let patch: Partial<UserSettings> = {};
  let returnSection: Section = "main";

  if (key === "timezone" || key === "tz") {
    patch.timezone = value;
    returnSection = "locale";
  } else if (key === "location" || key === "loc") {
    patch.location = value;
    returnSection = "locale";
  } else if (key === "language" || key === "lang") {
    patch.language = normalizeLanguage(value);
    returnSection = "locale";
  } else if (key === "morning") {
    patch.morningBriefingTime = value.toLowerCase() === "off" ? null : value;
    returnSection = "briefing";
  } else if (key === "evening") {
    if (value.toLowerCase() === "off") {
      patch.eveningSummaryEnabled = false;
    } else {
      patch.eveningSummaryEnabled = true;
      patch.eveningSummaryTime = value;
    }
    returnSection = "briefing";
  } else if (key === "checkin") {
    if (value.toLowerCase() === "off") {
      patch.taskCheckInEnabled = false;
    } else {
      patch.taskCheckInEnabled = true;
      patch.taskCheckInTime = value;
    }
    returnSection = "briefing";
  } else if (key === "compact" || key === "compactat" || key === "memorycompactat") {
    patch.memoryCompactAt = Number(value);
    returnSection = "memory";
  } else {
    await replyOrPush(userId, replyToken, [textMsg(`Unknown setting key "${rawKey}". Type =settings= to see the menu.`)]);
    return;
  }

  await applyPatchAndReply(userId, replyToken, patch, returnSection);
}

export async function handleSettingsCommand(userId: string, replyToken: string, userText: string): Promise<boolean> {
  const text = userText.trim();
  const lower = text.toLowerCase();

  const pending = await getPendingPrompt(userId);
  if (pending) {
    if (lower === "cancel") {
      await clearPendingPrompt(userId);
      await replyOrPush(userId, replyToken, [textMsg("Cancelled.")]);
      return true;
    }
    if (!text.startsWith("=")) {
      await clearPendingPrompt(userId);
      if (pending === "fact") {
        if (text) {
          await appendFact(userId, text, { category: "other" });
          await replyOrPush(userId, replyToken, [textMsg("Got it — I’ll remember that.")]);
          await sendMenu(userId, replyToken, "facts");
        } else {
          await replyOrPush(userId, replyToken, [textMsg("What should I remember? Type your fact.")]);
          await setPendingPrompt(userId, "fact");
        }
      } else {
        await applyTypedSet(userId, replyToken, pending, text);
      }
      return true;
    }
    await clearPendingPrompt(userId);
    // fall through to process the = command normally
  }

  if (lower === "=settings=") {
    showLoading(userId, 5).catch(() => {});
    await sendMenu(userId, replyToken, "main");
    return true;
  }

  const sectionMatch = text.match(/^=settings:section:(\w+)$/i);
  if (sectionMatch) {
    const section = sectionMatch[1];
    if (section && VALID_SECTIONS.has(section)) {
      await sendMenu(userId, replyToken, section as Section);
      return true;
    }
  }

  // Allow any postback-style settings command to be typed directly, e.g.
  // =settings:persona:set:personaTone:Professional
  const settingsCmdMatch = text.match(/^=settings:(.+)$/i);
  if (settingsCmdMatch) {
    const inner = settingsCmdMatch[1];
    if (inner) {
      const args = inner.split(":");
      await handleSettingsPostback(userId, replyToken, args);
      return true;
    }
  }

  const setMatch = text.match(/^=set\s+(\S+)\s+(.+)$/i);
  if (setMatch) {
    await applyTypedSet(userId, replyToken, setMatch[1]!, setMatch[2]!);
    return true;
  }

  const rememberMatch = text.match(/^=remember\s+(.+)$/i);
  if (rememberMatch) {
    const fact = rememberMatch[1]!.trim();
    if (fact) {
      await appendFact(userId, fact, { category: "other" });
      await replyOrPush(userId, replyToken, [textMsg("Got it — I’ll remember that.")]);
      await sendMenu(userId, replyToken, "facts");
    } else {
      await replyOrPush(userId, replyToken, [textMsg("What should I remember? Type =remember <fact>.")]);
    }
    return true;
  }

  return false;
}

export { getPendingPrompt as getPendingSettingsPrompt };
