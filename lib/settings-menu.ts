import { replyOrPush, text as textMsg, showLoading, withQuickReplies } from "@/lib/line/client";
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
import { t, uiLang } from "@/lib/i18n";
import { parseTimeInput, resolveTimezone } from "@/lib/time-utils";

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
const EXPANDED_TOOL_KEY = (userId: string) => `settings:expanded_tool:${userId}`;

async function getPendingPrompt(userId: string): Promise<string | null> {
  return (await redis().get<string>(PROMPT_KEY(userId))) ?? null;
}

function setPendingPrompt(userId: string, key: string): Promise<string | null> {
  return redis().set(PROMPT_KEY(userId), key, { ex: 60 * 5 });
}

function clearPendingPrompt(userId: string): Promise<number> {
  return redis().del(PROMPT_KEY(userId));
}

async function getExpandedTool(userId: string): Promise<string | null> {
  return (await redis().get<string>(EXPANDED_TOOL_KEY(userId))) ?? null;
}

async function setExpandedTool(userId: string, toolId: string | null): Promise<void> {
  if (toolId) await redis().set(EXPANDED_TOOL_KEY(userId), toolId, { ex: 60 * 60 });
  else await redis().del(EXPANDED_TOOL_KEY(userId));
}

async function sendMenu(userId: string, replyToken: string, section: Section): Promise<void> {
  clearPendingPrompt(userId).catch(() => {});

  console.warn("[settings] sendMenu", { userId, section, hasReplyToken: !!replyToken });
  const settings = await getSettings(userId);
  let messages = [settingsMainFlex(settings)];
  if (section === "briefing") messages = [settingsBriefingFlex(settings)];
  if (section === "tools") {
    const expandedTool = await getExpandedTool(userId);
    messages = [settingsToolsFlex(settings, expandedTool ?? undefined)];
  }
  if (section === "persona") messages = [settingsPersonaFlex(settings)];
  if (section === "memory") messages = [settingsMemoryFlex(settings)];
  if (section === "facts") {
    const facts = await loadFacts(userId);
    messages = [settingsFactsFlex(facts.facts, settings.language)];
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

function normalizeTimeValue(s: string): string | null {
  return parseTimeInput(s);
}

function parseCompact(s: string): number | null {
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 1000) return null;
  return n;
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
  } else if (key === "personaPreferredName" && value) {
    patch.personaPreferredName = value.trim() || null;
  } else if (key === "memoryEnabled" && value) {
    const b = parseBool(value);
    if (b !== null) patch.memoryEnabled = b;
  } else if (key === "memoryCompactAt" && value) {
    const n = parseCompact(value);
    if (n === null) {
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "compactError"))]);
      return;
    }
    patch.memoryCompactAt = n;
  } else if (key === "language" && value) {
    patch.language = normalizeLanguage(value);
  } else if (key === "timezone" && value) {
    const tz = resolveTimezone(value);
    if (!tz) {
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "unknownSetting", { key: "timezone" }))]);
      return;
    }
    patch.timezone = tz;
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
  } else if (key === "preMeetingLead" && value && args[4]) {
    const lead = Number(value);
    if (Number.isFinite(lead) && Number.isInteger(lead) && lead > 0 && lead <= 525600) {
      const b = parseBool(args[4]);
      if (b === true) {
        patch.preMeetingLeads = Array.from(new Set([...settings.preMeetingLeads, lead])).sort((a, b) => a - b);
      } else if (b === false) {
        patch.preMeetingLeads = settings.preMeetingLeads.filter((l) => l !== lead);
      }
    }
  } else if (key === "tool" && value && args[4]) {
    const toolId = value;
    const b = parseBool(args[4]);
    if (b !== null) {
      const nextTools = { ...settings.tools, [toolId]: b };
      patch.tools = nextTools;
      patch.disabledCategories = deriveDisabledCategories(nextTools);
      // Collapse options when a tool is turned off.
      if (!b) await setExpandedTool(userId, null);
    }
  } else if (key && value && args[4] && ["todo", "reminders", "calendar", "email", "drive"].includes(key)) {
    const toolId = key as keyof UserSettings["tools"];
    const field = value;
    const rawValue = args[4];
    const current = settings.toolSettings[toolId] ?? {};
    let nextToolSettings: Record<string, Record<string, unknown>> = { ...settings.toolSettings };

    if (field === "followup" || field === "prebrief") {
      const b = parseBool(rawValue);
      if (b !== null) {
        nextToolSettings = { ...nextToolSettings, [toolId]: { ...current, [field]: b } };
      }
    } else if (field === "preempt") {
      const n = Number(rawValue);
      if (Number.isFinite(n) && Number.isInteger(n) && n >= 0 && n <= 525600) {
        nextToolSettings = { ...nextToolSettings, [toolId]: { ...current, [field]: n } };
        // Mirror reminders preempt into preMeetingLeads, keeping 1d and 1h.
        const base: number[] = settings.preMeetingLeads.filter((l) => l === 1440 || l === 60);
        if (n > 0) base.push(n);
        patch.preMeetingLeads = Array.from(new Set(base)).sort((a, b) => a - b);
      }
    } else if (field === "tone") {
      if (["Warm", "Professional", "Playful"].includes(rawValue)) {
        nextToolSettings = { ...nextToolSettings, [toolId]: { ...current, [field]: rawValue } };
      }
    } else if (field === "autosend") {
      if (["Always confirm", "Confirm first time only", "Always send"].includes(rawValue)) {
        nextToolSettings = { ...nextToolSettings, [toolId]: { ...current, [field]: rawValue } };
      }
    }

    if (nextToolSettings[toolId] && JSON.stringify(nextToolSettings) !== JSON.stringify(settings.toolSettings)) {
      patch.toolSettings = nextToolSettings;
    }
  } else if (key === "morningTime" && value) {
    const timeStr = normalizeTimeValue(args.slice(3).join(":"));
    if (!timeStr) {
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "timeFormatError"))]);
      return;
    }
    patch.morningBriefingTime = timeStr;
  } else if (key === "eveningTime" && value) {
    const timeStr = normalizeTimeValue(args.slice(3).join(":"));
    if (!timeStr) {
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "timeFormatError"))]);
      return;
    }
    patch.eveningSummaryEnabled = true;
    patch.eveningSummaryTime = timeStr;
  } else if (key === "checkinTime" && value) {
    const timeStr = normalizeTimeValue(args.slice(3).join(":"));
    if (!timeStr) {
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "timeFormatError"))]);
      return;
    }
    patch.taskCheckInEnabled = true;
    patch.taskCheckInTime = timeStr;
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
  const settings = await getSettings(userId);
  const id = args[2];
  if (id) {
    const facts = await loadFacts(userId);
    const next = facts.facts.filter((f) => f.id !== id);
    if (next.length !== facts.facts.length) {
      await saveFacts(userId, { facts: next, updatedAt: Date.now() });
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "deletedFact"))]);
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
    const settings = await getSettings(userId);
    if (first === "noop") {
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "settingsClosed"))]);
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
    const settings = await getSettings(userId);
    const lang = uiLang(settings.language);
    await setPendingPrompt(userId, key);
    const textPrompts: Record<string, string> = {
      timezone: t(settings.language, "timezonePrompt"),
      location: t(settings.language, "locationPrompt"),
      fact: t(settings.language, "factPrompt"),
      preferredName: t(settings.language, "preferredNamePrompt"),
    };
    const timeSlots: Record<string, string[]> = {
      morning: ["05:00", "05:30", "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00"],
      evening: ["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"],
      checkin: ["15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"],
    };
    const cancelButton = { label: t(settings.language, "cancelled") === "ยกเลิกแล้ว" ? "ยกเลิก" : "Cancel", text: "cancel" };
    if (timeSlots[key]) {
      await replyOrPush(
        userId,
        replyToken,
        [withQuickReplies(t(settings.language, "pickTimePrompt"), [...timeSlots[key]!.map((time) => ({ label: time, text: time })), cancelButton])],
      );
    } else {
      await replyOrPush(
        userId,
        replyToken,
        [withQuickReplies(textPrompts[key] ?? t(settings.language, "customPromptFallback"), [cancelButton])],
      );
    }
    return;
  }

  if (first === "facts") {
    await handleFactsAction(userId, replyToken, args);
    return;
  }

  if (first === "tools" && (args[1] === "expand" || args[1] === "collapse")) {
    const toolId = args[1] === "expand" && args[2] ? args[2] : null;
    await setExpandedTool(userId, toolId);
    await sendMenu(userId, replyToken, "tools");
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
  if (["morningBriefingTime", "eveningSummaryEnabled", "eveningSummaryTime", "taskCheckInEnabled", "taskCheckInTime", "inboxBriefingEnabled", "briefingTopics", "briefingLength", "briefingLanguage", "briefingChannels", "preMeetingLeads"].includes(key)) return "briefing";
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
    const tz = resolveTimezone(value);
    if (!tz) {
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "unknownSetting", { key: "timezone" }))]);
      return;
    }
    patch.timezone = tz;
    returnSection = "locale";
  } else if (key === "location" || key === "loc") {
    patch.location = value;
    returnSection = "locale";
  } else if (key === "language" || key === "lang") {
    patch.language = normalizeLanguage(value);
    returnSection = "locale";
  } else if (key === "morning") {
    if (value.toLowerCase() === "off") {
      patch.morningBriefingTime = null;
    } else {
      const timeStr = normalizeTimeValue(value);
      if (!timeStr) {
        await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "timeFormatError"))]);
        return;
      }
      patch.morningBriefingTime = timeStr;
    }
    returnSection = "briefing";
  } else if (key === "evening") {
    if (value.toLowerCase() === "off") {
      patch.eveningSummaryEnabled = false;
    } else {
      const timeStr = normalizeTimeValue(value);
      if (!timeStr) {
        await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "timeFormatError"))]);
        return;
      }
      patch.eveningSummaryEnabled = true;
      patch.eveningSummaryTime = timeStr;
    }
    returnSection = "briefing";
  } else if (key === "checkin") {
    if (value.toLowerCase() === "off") {
      patch.taskCheckInEnabled = false;
    } else {
      const timeStr = normalizeTimeValue(value);
      if (!timeStr) {
        await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "timeFormatError"))]);
        return;
      }
      patch.taskCheckInEnabled = true;
      patch.taskCheckInTime = timeStr;
    }
    returnSection = "briefing";
  } else if (key === "compact" || key === "compactat" || key === "memorycompactat") {
    const n = parseCompact(value);
    if (n === null) {
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "compactError"))]);
      return;
    }
    patch.memoryCompactAt = n;
    returnSection = "memory";
  } else if (key === "preferredname" || key === "personapreferredname") {
    patch.personaPreferredName = value || null;
    returnSection = "persona";
  } else {
    await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "unknownSetting", { key: rawKey }))]);
    return;
  }

  await applyPatchAndReply(userId, replyToken, patch, returnSection);
}

export async function handleSettingsCommand(userId: string, replyToken: string, userText: string): Promise<boolean> {
  const text = userText.trim();
  const lower = text.toLowerCase();

  const pending = await getPendingPrompt(userId);
  if (pending) {
    const settings = await getSettings(userId);
    if (lower === "cancel") {
      await clearPendingPrompt(userId);
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "cancelled"))]);
      return true;
    }
    if (!text.startsWith("/")) {
      await clearPendingPrompt(userId);
      if (pending === "fact") {
        if (text) {
          await appendFact(userId, text, { category: "other" });
          await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "gotItRemember"))]);
          await sendMenu(userId, replyToken, "facts");
        } else {
          await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "whatShouldIRemember"))]);
          await setPendingPrompt(userId, "fact");
        }
      } else if (pending === "preferredName") {
        await updateSettings(userId, { personaPreferredName: text.trim() || null });
        await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "gotItCallYou"))]);
        await sendMenu(userId, replyToken, "persona");
      } else {
        await applyTypedSet(userId, replyToken, pending, text);
      }
      return true;
    }
    await clearPendingPrompt(userId);
    // fall through to process the = command normally
  }

  if (lower === "/settings") {
    showLoading(userId, 5).catch(() => {});
    await sendMenu(userId, replyToken, "main");
    return true;
  }

  const sectionMatch = text.match(/^\/settings\s+(\w+)$/i);
  if (sectionMatch) {
    const section = sectionMatch[1];
    if (section && VALID_SECTIONS.has(section)) {
      await sendMenu(userId, replyToken, section as Section);
      return true;
    }
  }

  // Allow any postback-style settings command to be typed directly, e.g.
  // /settings:persona:set:personaTone:Professional
  const settingsCmdMatch = text.match(/^\/settings:(.+)$/i);
  if (settingsCmdMatch) {
    const inner = settingsCmdMatch[1];
    if (inner) {
      const args = inner.split(":");
      await handleSettingsPostback(userId, replyToken, args);
      return true;
    }
  }

  const setMatch = text.match(/^\/set\s+(\S+)\s+(.+)$/i);
  if (setMatch) {
    await applyTypedSet(userId, replyToken, setMatch[1]!, setMatch[2]!);
    return true;
  }

  const rememberMatch = text.match(/^\/remember\s+(.+)$/i);
  if (rememberMatch) {
    const settings = await getSettings(userId);
    const fact = rememberMatch[1]!.trim();
    if (fact) {
      await appendFact(userId, fact, { category: "other" });
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "gotItRemember"))]);
      await sendMenu(userId, replyToken, "facts");
    } else {
      await replyOrPush(userId, replyToken, [textMsg(t(settings.language, "rememberUsage"))]);
    }
    return true;
  }

  return false;
}

export { getPendingPrompt as getPendingSettingsPrompt };
