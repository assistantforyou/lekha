import { google } from "googleapis";
import { getGoogleClient, hasGoogleConnection } from "@/lib/tools/google-auth";
import { listTasks, type Task } from "@/lib/memory/tasks";
import { listReminders, type StoredReminder } from "@/lib/tools/reminders";
import { redis } from "@/lib/memory/redis";
import { env } from "@/lib/env";
import { fetchCachedNews, type NewsStory } from "@/lib/news-cache";
import { t, dateLocale, uiLang } from "@/lib/i18n";

export type EveningSummaryResult = {
  text: string;
  news: { title: string; url: string; source: string }[];
};

function eveningLang(
  pref?: "English" | "ไทย" | "EN + ไทย" | null,
  fallback?: string | null,
): "en" | "th" {
  if (pref === "ไทย") return "th";
  if (pref === "English") return "en";
  if (pref === "EN + ไทย") return uiLang(fallback) === "th" ? "th" : "en";
  return uiLang(fallback);
}

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

function formatAgendaItem(item: AgendaItem, tz: string, lang: "en" | "th"): string {
  const icon = item.type === "calendar" ? "📅" : item.type === "reminder" ? "⏰" : "📋";
  if (item.isAllDay) {
    return `• ${icon} ${item.text}`;
  }
  const locale = dateLocale(lang);
  const timeStr = new Date(item.ts).toLocaleTimeString(locale, {
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

function dayLabel(dayKey: string, tz: string, todayDateStr: string, lang: "en" | "th"): string {
  if (dayKey === todayDateStr) return t(lang, "today");
  const locale = dateLocale(lang);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toLocaleDateString("en-CA", { timeZone: tz });
  if (dayKey === tomorrowKey) return t(lang, "tomorrow");
  const d = new Date(dayKey + "T12:00:00");
  const weekday = d.toLocaleDateString(locale, { weekday: "long" });
  const monthDay = d.toLocaleDateString(locale, { month: "short", day: "numeric" });
  return `${weekday}, ${monthDay}`;
}

function buildEveningRecommendations(
  agenda: Map<string, AgendaItem[]>,
  openTasks: Task[],
  tz: string,
  doneTodayCount: number,
  lang: "en" | "th",
): string[] {
  const recs: string[] = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toLocaleDateString("en-CA", { timeZone: tz });
  const tomorrowItems = agenda.get(tomorrowKey) ?? [];
  const overdue = openTasks.filter((t) => t.dueAt && t.dueAt < Date.now());

  if (doneTodayCount === 0 && openTasks.length > 0) {
    recs.push(t(lang, "evRecNoDone"));
  }

  if (overdue.length > 0) {
    recs.push(t(lang, "evRecOverdue", { count: String(overdue.length) }));
  }

  if (tomorrowItems.length > 5) {
    recs.push(t(lang, "evRecBusy"));
  } else if (tomorrowItems.length === 0 && openTasks.length > 0) {
    recs.push(t(lang, "evRecLight"));
  }

  if (openTasks.length > 5) {
    recs.push(t(lang, "evRecManyOpen", { count: String(openTasks.length) }));
  }

  if (tomorrowItems.filter((i) => i.type === "calendar").length > 3 && openTasks.filter((t) => t.dueAt && toDayKey(t.dueAt, tz) === tomorrowKey).length === 0) {
    recs.push(t(lang, "evRecMeetingsNoTasks"));
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
  opts: {
    timezone: string;
    briefingLanguage?: "English" | "ไทย" | "EN + ไทย";
    language?: string | null;
  },
): Promise<EveningSummaryResult | null> {
  const lang = eveningLang(opts.briefingLanguage, opts.language);
  const locale = dateLocale(lang);
  const todayDateStr = new Date().toLocaleDateString("en-CA", { timeZone: opts.timezone });
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
    sections.push(`${t(lang, "doneTodayTitle")}\n${lines.join("\n")}`);
  } else {
    sections.push(`${t(lang, "doneTodayTitle")}\n${t(lang, "doneTodayEmpty")}`);
  }

  // 2. Leftover open tasks
  const tasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  const overdue = tasks
    .filter((t) => t.dueAt && t.dueAt < now)
    .slice(0, 5)
    .map((task) => `• ${t(lang, "overdueItemLabel")} ${task.title}`);
  const remaining = tasks
    .filter((t) => !t.dueAt || t.dueAt >= now)
    .slice(0, 5)
    .map((task) => {
      if (task.dueAt) {
        const when = new Date(task.dueAt).toLocaleDateString(locale, {
          timeZone: opts.timezone,
          month: "short",
          day: "numeric",
        });
        return `• ${task.title} (${t(lang, "duePrefix", { when })})`;
      }
      return `• ${task.title}`;
    });
  const taskLines = [...overdue, ...remaining];
  sections.push(
    taskLines.length
      ? `${t(lang, "stillOpenTitle")}\n${taskLines.join("\n")}`
      : `${t(lang, "stillOpenTitle")}\n${t(lang, "stillOpenEmpty")}`,
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
      agendaLines.push(`${dayLabel(day, opts.timezone, todayDateStr, lang)} (${items.length})`);
      for (const item of items) {
        agendaLines.push(formatAgendaItem(item, opts.timezone, lang));
      }
    }
    sections.push(`${t(lang, "aheadTitle")}\n${agendaLines.join("\n")}`);
  }

  // 4. Recommendations
  const recs = buildEveningRecommendations(agenda, tasks, opts.timezone, doneToday.length, lang);
  if (recs.length > 0) {
    sections.push(`${t(lang, "recommendationsTitle")}\n${recs.map((r) => `• ${r}`).join("\n")}`);
  }

  // 5. News (returned separately for Flex carousel — no URLs in text)
  const geo = geoResult.status === "fulfilled" ? geoResult.value : [];
  const econ = econResult.status === "fulfilled" ? econResult.value : [];
  const poly = polyResult.status === "fulfilled" ? polyResult.value : [];

  const news: { title: string; url: string; source: string }[] = [
    ...geo.slice(0, 3).map((s) => ({ title: s.title, url: s.url, source: "World" })),
    ...econ.slice(0, 2).map((s) => ({ title: s.title, url: s.url, source: "Markets" })),
    ...poly.slice(0, 2).map((s) => ({ title: s.title, url: s.url, source: "Polymarket" })),
  ];

  const dateHeader = new Date().toLocaleDateString(locale, {
    timeZone: opts.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const text = `${t(lang, "eveningGreeting", { date: dateHeader })}\n\n${sections.join("\n\n")}`;
  return { text, news };
}

/** Returns true if we're inside the configured evening time 15-min window and haven't fired today. */
export function shouldFireEveningSummaryNow(
  lastFiredTs: number | null,
  timezone: string,
  eveningTime?: string | null,
  windowMinutes = 30,
): boolean {
  const timeStr = eveningTime ?? "21:00";
  const m = /^(\d{1,2}):(\d{2})$/.exec(timeStr);
  const targetHour = m ? parseInt(m[1]!, 10) : 21;
  const targetMinute = m ? parseInt(m[2]!, 10) : 0;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const localHour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const localMin = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const nowMin = localHour * 60 + localMin;
  const targetMin = targetHour * 60 + targetMinute;
  if (nowMin < targetMin || nowMin - targetMin >= windowMinutes) return false;
  if (lastFiredTs && Date.now() - lastFiredTs < 12 * 60 * 60 * 1000) return false;
  return true;
}
