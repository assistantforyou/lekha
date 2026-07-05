import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard-auth";
import { getSettings, updateSettings, type UserSettings } from "@/lib/memory/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getSettings(session.userId);
  return NextResponse.json({ settings });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const patch: Partial<UserSettings> = {};

  // Derive morningBriefingTime from dashboard's morningOn + morningTime
  if (typeof raw.morningOn === "boolean" && typeof raw.morningTime === "string") {
    patch.morningBriefingTime = raw.morningOn ? raw.morningTime : null;
  }

  // Derive eveningSummaryEnabled + eveningSummaryTime from dashboard's eveningOn + eveningTime
  if (typeof raw.eveningOn === "boolean" && typeof raw.eveningTime === "string") {
    patch.eveningSummaryEnabled = raw.eveningOn;
    patch.eveningSummaryTime = raw.eveningTime;
  }

  // Derive taskCheckInEnabled + taskCheckInTime from dashboard's checkinOn + checkinTime
  if (typeof raw.checkinOn === "boolean" && typeof raw.checkinTime === "string") {
    patch.taskCheckInEnabled = raw.checkinOn;
    patch.taskCheckInTime = raw.checkinOn ? raw.checkinTime : null;
  }

  // Briefing topics
  if (raw.topics && typeof raw.topics === "object") {
    patch.briefingTopics = raw.topics as Record<string, boolean>;
  }

  // Briefing format
  if (typeof raw.briefLength === "string") {
    patch.briefingLength = raw.briefLength as UserSettings["briefingLength"];
  }
  if (typeof raw.briefLang === "string") {
    patch.briefingLanguage = raw.briefLang as UserSettings["briefingLanguage"];
  }
  if (raw.briefChannels && typeof raw.briefChannels === "object") {
    patch.briefingChannels = raw.briefChannels as UserSettings["briefingChannels"];
  }
  if (raw.briefingTopicSources && typeof raw.briefingTopicSources === "object") {
    patch.briefingTopicSources = raw.briefingTopicSources as Record<string, string[]>;
  }

  // Tools → disabledCategories
  if (raw.tools && typeof raw.tools === "object") {
    const tools = raw.tools as Record<string, boolean>;
    patch.tools = tools;
    const categoryMap: Record<string, string> = {
      todo: "tasks",
      reminders: "reminders",
      calendar: "calendar",
      email: "email",
      drive: "drive",
    };
    const disabled = Object.entries(tools)
      .filter(([id, on]) => !on && categoryMap[id])
      .map(([id]) => categoryMap[id]!);
    patch.disabledCategories = disabled;
  }

  // Tool settings
  if (raw.toolSettings && typeof raw.toolSettings === "object") {
    patch.toolSettings = raw.toolSettings as Record<string, Record<string, unknown>>;

    // Sync canonical settings that the bot reads independently of toolSettings
    const ts = raw.toolSettings as Record<string, Record<string, unknown>>;
    if (ts.reminders && typeof ts.reminders.preempt === "number") {
      // Dashboard slider is a single value (5-60 min). Map to preMeetingLeads array.
      const preempt = ts.reminders.preempt as number;
      patch.preMeetingLeads = [preempt];
    }
  }

  // Memory
  if (typeof raw.compactAt === "number") {
    patch.memoryCompactAt = raw.compactAt;
  }
  if (typeof raw.memoryEnabled === "boolean") {
    patch.memoryEnabled = raw.memoryEnabled;
  }

  // Persona
  if (typeof raw.personaTone === "string") {
    patch.personaTone = raw.personaTone as UserSettings["personaTone"];
  }
  if (typeof raw.personaAddressing === "string") {
    patch.personaAddressing = raw.personaAddressing as UserSettings["personaAddressing"];
  }
  if (typeof raw.personaPrimaryLang === "string") {
    patch.personaPrimaryLang = raw.personaPrimaryLang as UserSettings["personaPrimaryLang"];
  }
  if (typeof raw.personaVoiceMatch === "boolean") {
    patch.personaVoiceMatch = raw.personaVoiceMatch;
  }

  // Also accept direct UserSettings keys for flexibility
  const directKeys: Array<keyof UserSettings> = [
    "timezone", "language", "location", "morningBriefingTime",
    "preMeetingLeads", "inboxBriefingEnabled", "disabledCategories",
    "eveningSummaryEnabled", "eveningSummaryTime", "taskCheckInEnabled",
    "taskCheckInTime", "briefingTopics", "briefingLength", "briefingLanguage",
    "briefingChannels", "tools", "toolSettings", "memoryCompactAt",
    "memoryEnabled", "personaTone", "personaAddressing", "personaPrimaryLang",
    "personaVoiceMatch",
  ];
  for (const key of directKeys) {
    if (key in raw && !(key in patch)) {
      (patch as Record<string, unknown>)[key] = raw[key];
    }
  }

  const next = await updateSettings(session.userId, patch);
  return NextResponse.json({ settings: next });
}
