import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/dashboard-auth";
import { getSettings, updateSettings, type UserSettings } from "@/lib/memory/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const IANA_TZ = /^[A-Za-z_]+(?:\/[A-Za-z_]+(?:_[A-Za-z]+)*)?$/;

const DashboardPatch = z.object({
  // Dashboard convenience keys
  morningOn: z.boolean().optional(),
  morningTime: z.string().regex(HH_MM).optional(),
  eveningOn: z.boolean().optional(),
  eveningTime: z.string().regex(HH_MM).optional(),
  checkinOn: z.boolean().optional(),
  checkinTime: z.string().regex(HH_MM).optional(),

  // Briefing topics / format / channels
  topics: z.record(z.string(), z.boolean()).optional(),
  briefLength: z.enum(["Headlines", "Bullets", "Full"]).optional(),
  briefLang: z.enum(["English", "ไทย", "EN + ไทย"]).optional(),
  briefChannels: z.object({
    line: z.boolean(),
    email: z.boolean(),
    push: z.boolean(),
  }).optional(),
  briefingTopicSources: z.record(z.string(), z.array(z.string().max(200))).optional(),

  // Tools
  tools: z.record(z.string(), z.boolean()).optional(),
  toolSettings: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),

  // Memory
  compactAt: z.number().int().min(1).max(1000).optional(),
  memoryEnabled: z.boolean().optional(),

  // Persona
  personaTone: z.enum(["Warm", "Professional", "Playful"]).optional(),
  personaAddressing: z.enum(["First name", "Khun", "Sir / Madam", "No address"]).optional(),
  personaPrimaryLang: z.enum(["English", "Thai"]).optional(),
  personaVoiceMatch: z.boolean().optional(),
  personaPreferredName: z.string().max(100).nullable().optional(),

  // Direct UserSettings keys (strictly typed)
  timezone: z.string().regex(IANA_TZ).optional(),
  language: z.string().max(10).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  morningBriefingTime: z.string().regex(HH_MM).nullable().optional(),
  preMeetingLeads: z.array(z.number().int().min(0).max(525600)).optional(),
  inboxBriefingEnabled: z.boolean().optional(),
  disabledCategories: z.array(z.enum(["tasks", "reminders", "calendar", "email", "drive"])).optional(),
  eveningSummaryEnabled: z.boolean().optional(),
  eveningSummaryTime: z.string().regex(HH_MM).optional(),
  taskCheckInEnabled: z.boolean().optional(),
  taskCheckInTime: z.string().regex(HH_MM).nullable().optional(),
  briefingTopics: z.record(z.string(), z.boolean()).optional(),
  briefingLength: z.enum(["Headlines", "Bullets", "Full"]).optional(),
  briefingLanguage: z.enum(["English", "ไทย", "EN + ไทย"]).optional(),
  briefingChannels: z.object({
    line: z.boolean(),
    email: z.boolean(),
    push: z.boolean(),
  }).optional(),
}).strict();

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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = DashboardPatch.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const rawBody = parsed.data;
  const patch: Partial<UserSettings> = {};

  // Derive morningBriefingTime from dashboard's morningOn + morningTime
  if (rawBody.morningOn !== undefined && rawBody.morningTime !== undefined) {
    patch.morningBriefingTime = rawBody.morningOn ? rawBody.morningTime : null;
  } else if (rawBody.morningBriefingTime !== undefined) {
    patch.morningBriefingTime = rawBody.morningBriefingTime;
  }

  // Derive eveningSummaryEnabled + eveningSummaryTime
  if (rawBody.eveningOn !== undefined && rawBody.eveningTime !== undefined) {
    patch.eveningSummaryEnabled = rawBody.eveningOn;
    patch.eveningSummaryTime = rawBody.eveningTime;
  }

  // Derive taskCheckInEnabled + taskCheckInTime
  if (rawBody.checkinOn !== undefined && rawBody.checkinTime !== undefined) {
    patch.taskCheckInEnabled = rawBody.checkinOn;
    patch.taskCheckInTime = rawBody.checkinOn ? rawBody.checkinTime : null;
  }

  // Briefing topics
  if (rawBody.topics !== undefined) patch.briefingTopics = rawBody.topics as Record<string, boolean>;
  if (rawBody.briefingTopics !== undefined) patch.briefingTopics = rawBody.briefingTopics as Record<string, boolean>;

  // Briefing format
  if (rawBody.briefLength !== undefined) patch.briefingLength = rawBody.briefLength;
  if (rawBody.briefingLength !== undefined) patch.briefingLength = rawBody.briefingLength;
  if (rawBody.briefLang !== undefined) patch.briefingLanguage = rawBody.briefLang;
  if (rawBody.briefingLanguage !== undefined) patch.briefingLanguage = rawBody.briefingLanguage;
  if (rawBody.briefChannels !== undefined) patch.briefingChannels = rawBody.briefChannels;
  if (rawBody.briefingChannels !== undefined) patch.briefingChannels = rawBody.briefingChannels;
  if (rawBody.briefingTopicSources !== undefined) patch.briefingTopicSources = rawBody.briefingTopicSources as Record<string, string[]>;

  // Tools → disabledCategories
  if (rawBody.tools !== undefined) {
    patch.tools = rawBody.tools as Record<string, boolean>;
    const categoryMap: Record<string, string> = {
      todo: "tasks",
      reminders: "reminders",
      calendar: "calendar",
      email: "email",
      drive: "drive",
    };
    const disabled = Object.entries(rawBody.tools as Record<string, boolean>)
      .filter(([id, on]) => !on && categoryMap[id])
      .map(([id]) => categoryMap[id]!);
    patch.disabledCategories = disabled;
  }

  // Tool settings
  if (rawBody.toolSettings !== undefined) {
    patch.toolSettings = rawBody.toolSettings as Record<string, Record<string, unknown>>;
    const ts = rawBody.toolSettings as Record<string, Record<string, unknown>>;
    if (ts.reminders && typeof ts.reminders.preempt === "number") {
      const preempt = ts.reminders.preempt;
      patch.preMeetingLeads = [1440, 60, preempt];
    }
  }

  // Memory
  if (rawBody.compactAt !== undefined) patch.memoryCompactAt = rawBody.compactAt;
  if (rawBody.memoryEnabled !== undefined) patch.memoryEnabled = rawBody.memoryEnabled;

  // Persona
  if (rawBody.personaTone !== undefined) patch.personaTone = rawBody.personaTone;
  if (rawBody.personaAddressing !== undefined) patch.personaAddressing = rawBody.personaAddressing;
  if (rawBody.personaPrimaryLang !== undefined) patch.personaPrimaryLang = rawBody.personaPrimaryLang;
  if (rawBody.personaVoiceMatch !== undefined) patch.personaVoiceMatch = rawBody.personaVoiceMatch;
  if (rawBody.personaPreferredName !== undefined) patch.personaPreferredName = rawBody.personaPreferredName;

  // Direct keys
  if (rawBody.timezone !== undefined) patch.timezone = rawBody.timezone;
  if (rawBody.language !== undefined) patch.language = rawBody.language;
  if (rawBody.location !== undefined) patch.location = rawBody.location;
  if (rawBody.preMeetingLeads !== undefined) patch.preMeetingLeads = rawBody.preMeetingLeads;
  if (rawBody.inboxBriefingEnabled !== undefined) patch.inboxBriefingEnabled = rawBody.inboxBriefingEnabled;
  if (rawBody.disabledCategories !== undefined) patch.disabledCategories = rawBody.disabledCategories;
  if (rawBody.eveningSummaryEnabled !== undefined) patch.eveningSummaryEnabled = rawBody.eveningSummaryEnabled;
  if (rawBody.eveningSummaryTime !== undefined) patch.eveningSummaryTime = rawBody.eveningSummaryTime;
  if (rawBody.taskCheckInEnabled !== undefined) patch.taskCheckInEnabled = rawBody.taskCheckInEnabled;
  if (rawBody.taskCheckInTime !== undefined) patch.taskCheckInTime = rawBody.taskCheckInTime;

  const next = await updateSettings(session.userId, patch);
  return NextResponse.json({ settings: next });
}
