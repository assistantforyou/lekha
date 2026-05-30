import { google } from "googleapis";
import { getGoogleClient, hasGoogleConnection } from "@/lib/tools/google-auth";
import { listTasks, type Task } from "@/lib/memory/tasks";
import { listReminders, type StoredReminder } from "@/lib/tools/reminders";
import { redis } from "@/lib/memory/redis";
import { env } from "@/lib/env";
import { fetchCachedNews, type NewsStory } from "@/lib/news-cache";

export type EveningSummaryResult = {
  text: string;
  news: { title: string; url: string; source: string }[];
};

// ─── Agenda helpers ───

type AgendaItem = {
  ts: number;
  type: "calendar" | "reminder" | "task";
  text: string;
  isAllDay: boolean;
};

function toDayKey(ts: number, tz: string): string {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: tz });
}

function formatAgendaItem(item: AgendaItem, tz: string): string {
  const icon = item.type === "calendar" ? "📅" : item.type === "reminder" ? "⏰" : "📋";
  if (item.isAllDay) {
    return `• ${icon} ${item.text}`;
  }
  const timeStr = new Date(item.ts).toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  return `• ${icon} ${timeStr} — ${item.text}`;
}

function buildAgenda(
  tasks: Task[],
  reminders: StoredReminder[],
  calendarEvents: unknown[] | null,
  tz: string,
  now: number,
): Map<string, AgendaItem[]> {
  const map = new Map<string, AgendaItem[]>();

  if (calendarEvents) {
    for (const e of calendarEvents as Array<{
      start?: { dateTime?: string; date?: string } | null;
      summary?: string | null;
    }>) {
      const startRaw = e.start?.dateTime ?? e.start?.date ?? "";
      if (!startRaw) continue;
      const ts = new Date(startRaw).getTime();
      const isAllDay = !e.start?.dateTime;
      const day = toDayKey(ts, tz);
      const items = map.get(day) ?? [];
      items.push({ ts, type: "calendar", text: e.summary ?? "(untitled)", isAllDay });
      map.set(day, items);
    }
  }

  for (const r of reminders) {
    if (r.cron) continue;
    const day = toDayKey(r.fireAt, tz);
    const items = map.get(day) ?? [];
    items.push({ ts: r.fireAt, type: "reminder", text: r.message, isAllDay: false });
    map.set(day, items);
  }

  for (const t of tasks) {
    if (!t.dueAt) continue;
    const day = toDayKey(t.dueAt, tz);
    const items = map.get(day) ?? [];
    const overdue = t.dueAt < now;
    items.push({ ts: t.dueAt, type: "task", text: overdue ? `⚠️ ${t.title}` : t.title, isAllDay: false });
    map.set(day, items);
  }

  for (const [, items] of map) {
    items.sort((a, b) => {
      if (a.isAllDay && !b.isAllDay) return -1;
      if (!a.isAllDay && b.isAllDay) return 1;
      return a.ts - b.ts;
    });
  }

  return map;
}

function dayLabel(dayKey: string, tz: string, todayDateStr: string): string {
  if (dayKey === todayDateStr) return "Today";
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toLocaleDateString("en-CA", { timeZone: tz });
  if (dayKey === tomorrowKey) return "Tomorrow";
  const d = new Date(dayKey + "T12:00:00");
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday}, ${monthDay}`;
}

function buildEveningRecommendations(
  agenda: Map<string, AgendaItem[]>,
  openTasks: Task[],
  tz: string,
  doneTodayCount: number,
): string[] {
  const recs: string[] = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toLocaleDateString("en-CA", { timeZone: tz });
  const tomorrowItems = agenda.get(tomorrowKey) ?? [];
  const overdue = openTasks.filter((t) => t.dueAt && t.dueAt < Date.now());

  if (doneTodayCount === 0 && openTasks.length > 0) {
    recs.push("No tasks completed today. Start tomorrow with your highest-priority item.");
  }

  if (overdue.length > 0) {
    recs.push(`You still have ${overdue.length} overdue task${overdue.length > 1 ? "s" : ""}. Address them first thing tomorrow.`);
  }

  if (tomorrowItems.length > 5) {
    recs.push("Tomorrow looks busy. Prep tonight so you start ahead.");
  } else if (tomorrowItems.length === 0 && openTasks.length > 0) {
    recs.push("Tomorrow looks light. Use the morning to clear your open tasks.");
  }

  if (openTasks.length > 5) {
    recs.push(`${openTasks.length} tasks still open. Review which ones actually matter this week.`);
  }

  if (tomorrowItems.filter((i) => i.type === "calendar").length > 3 && openTasks.filter((t) => t.dueAt && toDayKey(t.dueAt, tz) === tomorrowKey).length === 0) {
    recs.push("Lots of meetings tomorrow but no tasks due. Add any prep or follow-ups.");
  }

  return recs;
}

// ─── Main builder ───

/**
 * Build a 9 PM evening summary for a single user. Pulls leftover tasks, the next
 * calendar events (from tomorrow), reminders, and today's geopolitics + economics news.
 * Returns a bullet-point push-ready string.
 */
export async function buildEveningSummary(
  userId: string,
  opts: { timezone: string },
): Promise<EveningSummaryResult | null> {
  // Atomic dedup lock — prevents concurrent cron sweeps from double-sending.
  const todayDateStr = new Date().toLocaleDateString("en-CA", { timeZone: opts.timezone });
  const lockKey = `evening:${userId}:${todayDateStr}`;
  const locked = await redis().set(lockKey, 1, { nx: true, ex: 60 * 60 });
  if (!locked) return null;

  const now = Date.now();
  const apiKey = env().TAVILY_API_KEY;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const [tasksResult, doneResult, calendarResult, remindersResult, geoResult, econResult, polyResult] =
    await Promise.allSettled([
      listTasks(userId, "open"),
      listTasks(userId, "done"),

      hasGoogleConnection(userId).then(async (has) => {
        if (!has) return null;
        const { client } = await getGoogleClient(userId, undefined, [
          "https://www.googleapis.com/auth/calendar.readonly",
        ]);
        const cal = google.calendar({ version: "v3", auth: client });
        const r = await cal.events.list({
          calendarId: "primary",
          timeMin: tomorrow.toISOString(),
          maxResults: 20,
          singleEvents: true,
          orderBy: "startTime",
        });
        return r.data.items ?? [];
      }),

      listReminders(userId),

      apiKey
        ? fetchCachedNews("geopolitics world news today major outlets", apiKey)
        : Promise.resolve([] as NewsStory[]),

      apiKey
        ? fetchCachedNews("global economics finance markets today", apiKey)
        : Promise.resolve([] as NewsStory[]),

      apiKey
        ? fetchCachedNews("polymarket prediction markets today", apiKey)
        : Promise.resolve([] as NewsStory[]),
    ]);

  const sections: string[] = [];

  // 1. Completed today
  const allDone = doneResult.status === "fulfilled" ? doneResult.value : [];
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const doneToday = allDone.filter((t) => t.doneAt && t.doneAt >= startOfToday.getTime());
  if (doneToday.length) {
    const lines = doneToday.map((t) => `• ✓ ${t.title}`);
    sections.push(`✅ Done today\n${lines.join("\n")}`);
  } else {
    sections.push("✅ Done today\n• Nothing completed today.");
  }

  // 2. Leftover open tasks
  const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  const overdue = tasks
    .filter((t) => t.dueAt && t.dueAt < now)
    .slice(0, 5)
    .map((t) => `• [overdue] ${t.title}`);
  const remaining = tasks
    .filter((t) => !t.dueAt || t.dueAt >= now)
    .slice(0, 5)
    .map((t) => {
      if (t.dueAt) {
        const when = new Date(t.dueAt).toLocaleDateString("en-US", {
          timeZone: opts.timezone,
          month: "short",
          day: "numeric",
        });
        return `• ${t.title} (due ${when})`;
      }
      return `• ${t.title}`;
    });
  const taskLines = [...overdue, ...remaining];
  sections.push(
    taskLines.length
      ? `📋 Still open\n${taskLines.join("\n")}`
      : "📋 Still open\n• All clear — nothing left.",
  );

  // 3. Tomorrow & ahead — unified agenda
  const allReminders = remindersResult.status === "fulfilled" ? remindersResult.value : [];
  const upcomingReminders = allReminders.filter((r) => !r.cron && r.fireAt > now);
  const calEvents = calendarResult.status === "fulfilled" ? calendarResult.value : null;

  const agenda = buildAgenda(tasks, upcomingReminders, calEvents, opts.timezone, now);
  const sortedDays = Array.from(agenda.keys()).sort();

  const daysToShow: string[] = [];
  for (const day of sortedDays) {
    if (day > todayDateStr && daysToShow.length < 3) {
      daysToShow.push(day);
    }
  }

  if (daysToShow.length > 0) {
    const agendaLines: string[] = [];
    for (const day of daysToShow) {
      const items = agenda.get(day) ?? [];
      agendaLines.push(`${dayLabel(day, opts.timezone, todayDateStr)} (${items.length})`);
      for (const item of items) {
        agendaLines.push(formatAgendaItem(item, opts.timezone));
      }
    }
    sections.push(`🗓 Tomorrow & ahead\n${agendaLines.join("\n")}`);
  }

  // 4. Recommendations
  const recs = buildEveningRecommendations(agenda, tasks, opts.timezone, doneToday.length);
  if (recs.length > 0) {
    sections.push(`💡 Recommendations\n${recs.map((r) => `• ${r}`).join("\n")}`);
  }

  // 5. News
  const geo = geoResult.status === "fulfilled" ? geoResult.value : [];
  const econ = econResult.status === "fulfilled" ? econResult.value : [];
  const poly = polyResult.status === "fulfilled" ? polyResult.value : [];

  const newsLines: string[] = [];
  if (geo.length) {
    newsLines.push("🌍 Geopolitics");
    geo.slice(0, 3).forEach((s) => newsLines.push(`\n• ${s.title}\n${s.url}`));
  }
  if (econ.length) {
    if (newsLines.length) newsLines.push("");
    newsLines.push("📈 Economics");
    econ.slice(0, 3).forEach((s) => newsLines.push(`\n• ${s.title}\n${s.url}`));
  }
  if (poly.length) {
    if (newsLines.length) newsLines.push("");
    newsLines.push("🎲 Polymarket");
    poly.slice(0, 2).forEach((s) => newsLines.push(`\n• ${s.title}\n${s.url}`));
  }
  if (newsLines.length) {
    sections.push(`📰 Today's news\n${newsLines.join("\n")}`);
  }

  // Build structured news items for Flex carousel rendering
  const news: { title: string; url: string; source: string }[] = [
    ...geo.slice(0, 3).map((s) => ({ title: s.title, url: s.url, source: "World" })),
    ...econ.slice(0, 2).map((s) => ({ title: s.title, url: s.url, source: "Markets" })),
    ...poly.slice(0, 2).map((s) => ({ title: s.title, url: s.url, source: "Polymarket" })),
  ];

  const text = `Good evening. Here's your wrap-up:\n\n${sections.join("\n\n")}`;
  return { text, news };
}

/** Returns true if we're inside the 9 PM 15-min window and haven't fired today. */
export function shouldFireEveningSummaryNow(
  lastFiredTs: number | null,
  timezone: string,
  windowMinutes = 15,
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const localHour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const localMin = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const nowMin = localHour * 60 + localMin;
  const targetMin = 21 * 60; // 9 PM
  if (nowMin < targetMin || nowMin - targetMin >= windowMinutes) return false;
  if (lastFiredTs && Date.now() - lastFiredTs < 12 * 60 * 60 * 1000) return false;
  return true;
}
