import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/dashboard-auth";
import { push, text as textMsg } from "@/lib/line/client";
import { getSettings } from "@/lib/memory/settings";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { loadFacts } from "@/lib/memory/facts";
import { listAccounts } from "@/lib/tools/google-auth";
import { listTasks } from "@/lib/memory/tasks";
import { listReminders } from "@/lib/tools/reminders";
import { isAllowed } from "@/lib/memory/allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}

export async function POST(_req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  const [settings, profile, facts, accounts, allowed, tasks, reminders] = await Promise.all([
    getSettings(userId),
    getOrCreateProfile(userId),
    loadFacts(userId),
    listAccounts(userId),
    isAllowed(userId),
    listTasks(userId, "open"),
    listReminders(userId),
  ]);

  const activeTopics = Object.entries(settings.briefingTopics ?? {})
    .filter(([, on]) => on)
    .map(([id]) => id);

  const disabledTools = settings.disabledCategories ?? [];
  const allToolIds = ["tasks", "reminders", "calendar", "email", "drive"];
  const enabledTools = allToolIds.filter((t) => !disabledTools.includes(t));

  const lines: string[] = [];

  lines.push(`🎛 Lekha Dashboard — your current setup`);
  lines.push(`"""`);

  // Profile & plan
  lines.push(`👤 Profile`);
  lines.push(`• Name: ${profile.displayName}`);
  lines.push(`• Subscription: ${allowed ? "Active ✓" : "Inactive"}`);
  lines.push(`• Joined: ${profile.joinedAt ? new Date(profile.joinedAt).toLocaleDateString("en-GB") : "—"}`);
  lines.push("");

  // Briefing schedule
  lines.push(`📰 Daily Briefings`);
  lines.push(`• Morning: ${settings.morningBriefingTime ?? "Off"}`);
  lines.push(`• Evening: ${settings.eveningSummaryEnabled ? (settings.eveningSummaryTime ?? "21:00") : "Off"}`);
  lines.push(`• Check-in: ${settings.taskCheckInEnabled ? (settings.taskCheckInTime ?? "30 min before evening") : "Off"}`);
  lines.push(`• Channels: ${Object.entries(settings.briefingChannels ?? {}).filter(([, on]) => on).map(([k]) => k).join(", ") || "none"}`);
  lines.push("");

  // Topics
  lines.push(`📊 Briefing Topics (${activeTopics.length}/7)`);
  if (activeTopics.length === 0) {
    lines.push(`• None enabled`);
  } else {
    for (const id of activeTopics) {
      const customSources = settings.briefingTopicSources?.[id];
      const srcNote = customSources?.length ? ` (custom: ${customSources.join(", ")})` : "";
      lines.push(`• ${id}${srcNote}`);
    }
  }
  lines.push(`• Format: ${settings.briefingLength ?? "Headlines"} · Language: ${settings.briefingLanguage ?? "EN + ไทย"}`);
  lines.push("");

  // Tools
  lines.push(`🛠 Tools (${enabledTools.length}/${allToolIds.length})`);
  for (const t of allToolIds) {
    const on = enabledTools.includes(t);
    lines.push(`• ${t}: ${on ? "On ✓" : "Off"}`);
  }
  lines.push("");

  // Tool settings
  const ts = settings.toolSettings ?? {};
  lines.push(`⚙️ Tool Preferences`);
  if (ts.reminders) {
    const r = ts.reminders as Record<string, unknown>;
    lines.push(`• Reminders — quiet: ${r.quietStart ?? "22:00"}–${r.quietEnd ?? "06:30"}, preempt: ${r.preempt ?? 15} min, skip holidays: ${r.skipHolidays ?? true}`);
  }
  if (ts.calendar) {
    const c = ts.calendar as Record<string, unknown>;
    const noMeet = Array.isArray(c.noMeet) ? c.noMeet.join(", ") : "—";
    lines.push(`• Calendar — deep work: ${c.deepStart ?? "09:00"}–${c.deepEnd ?? "11:00"}, no-meet: ${noMeet}, prebrief: ${c.prebrief ?? true}`);
  }
  if (ts.email) {
    const e = ts.email as Record<string, unknown>;
    lines.push(`• Email — tone: ${e.tone ?? "Warm"}, signoff: ${e.signoff ?? "Best,"}, send: ${e.autosend ?? "Always confirm"}`);
  }
  if (ts.drive) {
    const d = ts.drive as Record<string, unknown>;
    lines.push(`• Drive — scope: ${d.scope ?? "My Drive"}, summary: ${d.fmt ?? "Bullets"}, autosort: ${d.autosort ?? true}`);
  }
  if (ts.todo) {
    const t = ts.todo as Record<string, unknown>;
    lines.push(`• Tasks — sort: ${t.prio ?? "Deadline"}, nudge: ${["Off","Once daily","Twice daily","Hourly","Every 30 min"][(t.nudge as number) ?? 2] ?? "Twice daily"}, follow-ups: ${t.followup ?? true}`);
  }
  lines.push("");

  // Persona
  lines.push(`🎭 Persona`);
  lines.push(`• Tone: ${settings.personaTone ?? "Warm"}`);
  lines.push(`• Address: ${settings.personaAddressing ?? "First name"}`);
  lines.push(`• Primary language: ${settings.personaPrimaryLang ?? "English"}`);
  lines.push(`• Voice match: ${settings.personaVoiceMatch ?? true}`);
  lines.push("");

  // Memory
  lines.push(`🧠 Memory`);
  lines.push(`• Enabled: ${settings.memoryEnabled ?? true}`);
  lines.push(`• Auto-compact: ${settings.memoryCompactAt ?? 10} messages`);
  lines.push(`• Stored facts: ${facts.facts.length}`);
  if (facts.facts.length > 0) {
    for (const f of facts.facts.slice(0, 5)) {
      lines.push(`  – [${f.category}] ${f.content.slice(0, 80)}${f.content.length > 80 ? "…" : ""}`);
    }
    if (facts.facts.length > 5) {
      lines.push(`  – … and ${facts.facts.length - 5} more`);
    }
  }
  lines.push("");

  // Connections
  lines.push(`🔗 Connections`);
  lines.push(`• LINE: connected ✓`);
  if (accounts.accounts.length > 0) {
    for (const acc of accounts.accounts) {
      const isActive = acc.email === accounts.activeEmail ? " · active" : "";
      lines.push(`• Google: ${acc.email}${isActive}`);
    }
  } else {
    lines.push(`• Google: not connected`);
  }
  lines.push("");

  // Live data
  lines.push(`📋 Current State`);
  lines.push(`• Open tasks: ${tasks.length}`);
  if (tasks.length > 0) {
    const overdue = tasks.filter((t) => t.dueAt && t.dueAt < Date.now());
    if (overdue.length > 0) lines.push(`  – ${overdue.length} overdue`);
    for (const t of tasks.slice(0, 5)) {
      const due = t.dueAt ? fmtTime(t.dueAt) : "no due date";
      lines.push(`  – ${t.title} (${due})`);
    }
    if (tasks.length > 5) lines.push(`  – … and ${tasks.length - 5} more`);
  }
  const upcomingReminders = reminders.filter((r) => !r.cron && r.fireAt > Date.now());
  lines.push(`• Upcoming reminders: ${upcomingReminders.length}`);
  for (const r of upcomingReminders.slice(0, 5)) {
    lines.push(`  – ${r.message} (${fmtTime(r.fireAt)})`);
  }
  lines.push("");

  lines.push(`Everything above is live — change it anytime in your dashboard and hit "Test in LINE" again.`);

  const text = lines.join("\n");

  try {
    await push(userId, [textMsg(text)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[dashboard] test-line push failed", userId, err);
    return NextResponse.json({ error: "push_failed" }, { status: 502 });
  }
}
