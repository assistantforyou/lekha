import { google } from "googleapis";
import { getGoogleClient, hasGoogleConnection } from "@/lib/tools/google-auth";
import { listTasks, type Task } from "@/lib/memory/tasks";
import { listReminders, type StoredReminder } from "@/lib/tools/reminders";
import { env } from "@/lib/env";
import { fetchCachedNews, type NewsStory } from "@/lib/news-cache";
import { fetchWeather } from "@/lib/tools/weather-shared";
import { t, dateLocale, uiLang } from "@/lib/i18n";


type WeatherResult = {
  tempC: number | null;
  description: string;
  highC: number | null;
  lowC: number | null;
  rainChancePct: number | null;
};

export type BriefingNewsItem = {
  title: string;
  url: string;
  source: string;
};

export type BriefingInboxItem = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
};

export type BriefingResult = {
  text: string;
  news: BriefingNewsItem[];
  inbox: BriefingInboxItem[] | null;
};

function briefingLang(
  pref?: "English" | "ไทย" | "EN + ไทย" | null,
  fallback?: string | null,
): "en" | "th" {
  if (pref === "ไทย") return "th";
  if (pref === "English") return "en";
  if (pref === "EN + ไทย") return uiLang(fallback) === "th" ? "th" : "en";
  return uiLang(fallback);
}

function andWord(lang: "en" | "th"): string {
  return lang === "th" ? "และ" : "and";
}

function moreTasks(count: number, lang: "en" | "th"): string {
  return lang === "th" ? ` และอีก ${count} รายการ` : ` and ${count} more`;
}

// ─── Agenda helpers ───

type AgendaItem = {
  ts: number;
  type: "calendar" | "reminder" | "task";
  text: string;
  isAllDay: boolean;
  overdue?: boolean;
};

// Sentinel day-key for overdue tasks so they render as a group at the top of the
// agenda instead of being silently dropped (their real due-day is in the past,
// which the today+future display window never shows).
const OVERDUE_KEY = "__overdue__";

function toDayKey(ts: number, tz: string): string {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: tz });
}

function formatAgendaItem(item: AgendaItem, tz: string, lang: "en" | "th"): string {
  const icon = item.type === "calendar" ? "📅" : item.type === "reminder" ? "⏰" : "📋";
  const locale = dateLocale(lang);
  if (item.overdue) {
    const dateStr = new Date(item.ts).toLocaleDateString(locale, {
      timeZone: tz,
      month: "short",
      day: "numeric",
    });
    return `• ${icon} ⚠️ ${item.text} (${t(lang, "duePrefix", { when: dateStr })})`;
  }
  if (item.isAllDay) {
    return `• ${icon} ${item.text}`;
  }
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
    const overdue = t.dueAt < now;
    // Overdue tasks bucket under OVERDUE_KEY so they surface at the top of the
    // agenda rather than under a past day that never gets displayed.
    const day = overdue ? OVERDUE_KEY : toDayKey(t.dueAt, tz);
    const items = map.get(day) ?? [];
    items.push({ ts: t.dueAt, type: "task", text: t.title, isAllDay: false, overdue });
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
  if (dayKey === OVERDUE_KEY) return t(lang, "overdueTitle");
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

function buildRecommendations(
  agenda: Map<string, AgendaItem[]>,
  openTasks: Task[],
  todayDateStr: string,
  now: number,
  endOfToday: number,
  lang: "en" | "th",
): string[] {
  const recs: string[] = [];
  const todayItems = agenda.get(todayDateStr) ?? [];
  const todayCount = todayItems.length;
  const overdue = openTasks.filter((t) => t.dueAt && t.dueAt < now).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const dueToday = openTasks.filter((t) => t.dueAt && t.dueAt >= now && t.dueAt <= endOfToday);
  const noDueDate = openTasks.filter((t) => !t.dueAt);
  const calToday = todayItems.filter((i) => i.type === "calendar");
  const remindersToday = todayItems.filter((i) => i.type === "reminder");
  const tasksToday = todayItems.filter((i) => i.type === "task");

  const joinNames = (items: { title?: string; text?: string }[], limit: number, sep: string) =>
    items.slice(0, limit).map((i) => `"${i.title ?? i.text ?? ""}"`).join(sep);

  // ── Overdue ──────────────────────────────────────────────────────────
  if (overdue.length === 1) {
    recs.push(t(lang, "recOverdueOne", { title: overdue[0]!.title }));
  } else if (overdue.length > 1) {
    const names = joinNames(overdue, 3, ", ");
    const more = overdue.length > 3 ? moreTasks(overdue.length - 3, lang) : "";
    recs.push(t(lang, "recOverdueMany", { names, more }));
  }

  // ── Due today ────────────────────────────────────────────────────────
  if (dueToday.length === 1) {
    recs.push(t(lang, "recDueTodayOne", { title: dueToday[0]!.title }));
  } else if (dueToday.length === 2) {
    recs.push(t(lang, "recDueTodayTwo", { title0: dueToday[0]!.title, title1: dueToday[1]!.title }));
  } else if (dueToday.length >= 3) {
    const names = joinNames(dueToday, 3, ", ");
    const more = dueToday.length > 3 ? ` (+${dueToday.length - 3})` : "";
    recs.push(t(lang, "recDueTodayMany", { count: String(dueToday.length), names, more }));
  }

  // ── Calendar events ──────────────────────────────────────────────────
  if (calToday.length === 1) {
    recs.push(t(lang, "recCalendarOne", { title: calToday[0]!.text }));
  } else if (calToday.length >= 2) {
    const names = joinNames(calToday, 2, ` ${andWord(lang)} `);
    const more = calToday.length > 2 ? ` (+${calToday.length - 2})` : "";
    recs.push(t(lang, "recCalendarMany", { names, more }));
  }

  // ── Reminders ────────────────────────────────────────────────────────
  if (remindersToday.length === 1) {
    recs.push(t(lang, "recReminderOne", { title: remindersToday[0]!.text }));
  } else if (remindersToday.length >= 2) {
    const names = joinNames(remindersToday, 2, ` ${andWord(lang)} `);
    const more = remindersToday.length > 2 ? ` (+${remindersToday.length - 2})` : "";
    recs.push(t(lang, "recReminderMany", { names, more }));
  }

  // ── No-due-date tasks ────────────────────────────────────────────────
  if (todayCount === 0 && noDueDate.length === 1) {
    recs.push(t(lang, "recClearOne", { title: noDueDate[0]!.title }));
  } else if (todayCount === 0 && noDueDate.length >= 2) {
    recs.push(t(lang, "recClearMany", { title: noDueDate[0]!.title }));
  } else if (todayCount > 0 && noDueDate.length >= 1 && tasksToday.length === 0) {
    recs.push(t(lang, "recFiller", { title: noDueDate[0]!.title }));
  }

  // ── Density-based ────────────────────────────────────────────────────
  if (todayCount >= 6) {
    recs.push(t(lang, "recPacked"));
  }

  return recs;
}

// ─── Main builder ───

/**
 * Build a daily morning briefing for a single user. Pulls weather, open tasks,
 * reminders, calendar events, optional unread Gmail, and today's news.
 * Returns structured data: main text (for the Flex bubble) + news + inbox
 * so each section can be rendered as its own rich Flex message.
 */
const TOPIC_QUERIES: Record<string, string> = {
  stocks: "stock market finance investing earnings today",
  wellness: "health wellness nutrition sleep fitness today",
  politics: "politics policy government legislation today",
  crime: "breaking news crime safety alerts today",
  sports: "sports news scores highlights today",
  business: "business economy M&A corporate news today",
  entertain: "entertainment celebrity film music releases today",
};

export async function buildMorningBriefing(
  userId: string,
  opts: {
    timezone: string;
    location: string | null;
    includeInbox: boolean;
    briefingTopics?: Record<string, boolean>;
    briefingTopicSources?: Record<string, string[]>;
    briefingLength?: "Headlines" | "Bullets" | "Full";
    briefingLanguage?: "English" | "ไทย" | "EN + ไทย";
    language?: string | null;
  },
): Promise<BriefingResult> {
  const sections: string[] = [];
  const now = Date.now();
  const apiKey = env().TAVILY_API_KEY;
  const length = opts.briefingLength ?? "Bullets";
  const lang = briefingLang(opts.briefingLanguage, opts.language);
  const locale = dateLocale(lang);

  const todayDateStr = new Date().toLocaleDateString("en-CA", { timeZone: opts.timezone });
  const endOfToday = new Date(`${todayDateStr}T23:59:59`).getTime();

  // Build dynamic news fetches based on user's briefing topic preferences
  const enabledTopics = opts.briefingTopics
    ? Object.entries(opts.briefingTopics).filter(([, on]) => on).map(([id]) => id)
    : ["business", "politics"];
  const maxTopics = length === "Headlines" ? 1 : length === "Full" ? 5 : 3;
  const topicQueries = enabledTopics
    .map(id => TOPIC_QUERIES[id])
    .filter((q): q is string => !!q)
    .slice(0, maxTopics);
  const newsFetches = apiKey
    ? topicQueries.map(q => {
        const topicId = Object.entries(TOPIC_QUERIES).find(([, query]) => query === q)?.[0];
        const customSources = topicId
          ? opts.briefingTopicSources?.[topicId]
          : undefined;
        return fetchCachedNews(q, apiKey, Array.isArray(customSources) ? customSources : undefined);
      })
    : [];
  // Always include a general world news fallback if no topics are enabled
  if (apiKey && topicQueries.length === 0) {
    newsFetches.push(fetchCachedNews("world news today major outlets", apiKey));
  }

  const baseResults = await Promise.allSettled([
    opts.location ? fetchWeather(opts.location) : Promise.resolve(null),
    listTasks(userId, "open"),
    listReminders(userId),
    hasGoogleConnection(userId).then(async (has) => {
      if (!has) return null;
      const { client } = await getGoogleClient(userId, undefined, [
        "https://www.googleapis.com/auth/calendar.readonly",
      ]);
      const calendar = google.calendar({ version: "v3", auth: client });
      const r = await calendar.events.list({
        calendarId: "primary",
        timeMin: new Date(now).toISOString(),
        maxResults: 20,
        singleEvents: true,
        orderBy: "startTime",
      });
      return r.data.items ?? [];
    }),
    opts.includeInbox
      ? hasGoogleConnection(userId).then(async (has) => {
          if (!has) return null;
          const { client } = await getGoogleClient(userId, undefined, [
            "https://www.googleapis.com/auth/gmail.readonly",
          ]);
          const gmail = google.gmail({ version: "v1", auth: client });

          // Surface every inbox message since yesterday midnight in the user's timezone,
          // not just unread ones. Capped at 25 to keep API calls and the card readable.
          const yesterday = new Date(
            new Date().toLocaleDateString("en-US", { timeZone: opts.timezone }),
          );
          yesterday.setDate(yesterday.getDate() - 1);
          const after = yesterday.toISOString().slice(0, 10).replace(/-/g, "/");

          const list = await gmail.users.messages.list({
            userId: "me",
            q: `after:${after} in:inbox -category:promotions`,
            labelIds: ["INBOX"],
            maxResults: 25,
          });
          const ids = (list.data.messages ?? []).map((m) => m.id ?? "").filter(Boolean);
          if (!ids.length) return [];
          const fetched = await Promise.all(
            ids.map((id) =>
              gmail.users.messages.get({
                userId: "me",
                id,
                format: "metadata",
                metadataHeaders: ["From", "Subject"],
              }),
            ),
          );
          return fetched
            .map((r) => {
              const headers = r.data.payload?.headers ?? [];
              const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
              const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
              return {
                id: r.data.id ?? "",
                from: from.split("<")[0]?.trim() || from,
                subject,
                snippet: r.data.snippet ?? "",
              };
            })
            .filter((m) => m.id);
        })
      : Promise.resolve(null),
  ]);

  const newsResults = await Promise.allSettled(newsFetches);

  // Unpack base results
  const [weatherResult, tasksResult, remindersResult, calendarResult, inboxResult] = baseResults;

  // Weather
  const wx = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const cur = wx?.current;
  const todayForecast = wx?.forecast?.[0];
  if (cur && cur.tempC !== null) {
    const desc = cur.description ? `, ${cur.description.toLowerCase()}` : "";
    let line = `${cur.tempC}°C${desc}`;
    const extras: string[] = [];
    if (todayForecast && todayForecast.highC !== null && todayForecast.lowC !== null) {
      extras.push(`${todayForecast.highC}° / ${todayForecast.lowC}°`);
    }
    if (todayForecast && todayForecast.rainChancePct !== null && todayForecast.rainChancePct > 0) {
      extras.push(`${todayForecast.rainChancePct}% rain`);
    }
    if (extras.length) line += ` · ${extras.join(" · ")}`;
    const loc = opts.location ? `${opts.location} · ` : "";
    sections.push(`🌤 ${loc}${line}`);
  }

  // Unified agenda
  const openTasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  const allReminders = remindersResult.status === "fulfilled" ? remindersResult.value : [];
  const upcomingReminders = allReminders.filter((r) => !r.cron && r.fireAt > now);
  const calEvents = calendarResult.status === "fulfilled" ? calendarResult.value : null;

  const agenda = buildAgenda(openTasks, upcomingReminders, calEvents, opts.timezone, now);
  const sortedDays = Array.from(agenda.keys()).sort();

  const daysToShow: string[] = [];
  if (agenda.has(OVERDUE_KEY)) daysToShow.push(OVERDUE_KEY);
  if (agenda.has(todayDateStr)) daysToShow.push(todayDateStr);
  const maxDays = length === "Headlines" ? 1 : length === "Full" ? 7 : 4;
  for (const day of sortedDays) {
    if (day === OVERDUE_KEY) continue;
    if (day > todayDateStr && daysToShow.length < maxDays) {
      daysToShow.push(day);
    }
  }

  if (daysToShow.length > 0) {
    const agendaLines: string[] = [];
    for (const day of daysToShow) {
      const items = agenda.get(day) ?? [];
      agendaLines.push(`${dayLabel(day, opts.timezone, todayDateStr, lang)} (${items.length})`);
      if (length !== "Headlines") {
        for (const item of items) {
          agendaLines.push(formatAgendaItem(item, opts.timezone, lang));
        }
      }
    }
    sections.push(`${t(lang, "agendaTitle")}\n${agendaLines.join("\n")}`);
  } else {
    sections.push(`${t(lang, "agendaTitle")}\n${t(lang, "agendaEmpty")}`);
  }

  // Quick tasks — no due date
  const noDueDate = openTasks.filter((t) => !t.dueAt);
  if (noDueDate.length > 0) {
    const taskLimit = length === "Headlines" ? 0 : length === "Full" ? noDueDate.length : 5;
    const lines = taskLimit > 0 ? noDueDate.slice(0, taskLimit).map((t) => `• ${t.title}`) : [];
    sections.push(`${t(lang, "otherTasksTitle", { count: String(noDueDate.length) })}${lines.length ? "\n" + lines.join("\n") : ""}`);
  } else {
    sections.push(`${t(lang, "otherTasksTitle", { count: "0" })}\n${t(lang, "otherTasksEmpty")}`);
  }

  // Recommendations
  const recs = buildRecommendations(agenda, openTasks, todayDateStr, now, endOfToday, lang);
  const recLimit = length === "Headlines" ? 1 : length === "Full" ? recs.length : recs.length;
  if (recs.length > 0) {
    sections.push(`💡 Recommendations\n${recs.slice(0, recLimit).map((r) => `• ${r}`).join("\n")}`);
  }

  // Build structured news items (rendered as a separate Flex carousel)
  const allNewsStories: NewsStory[] = [];
  for (const r of newsResults) {
    if (r.status === "fulfilled") allNewsStories.push(...(r.value as NewsStory[]));
  }
  const news: BriefingNewsItem[] = allNewsStories
    .slice(0, 5)
    .map((s) => {
      let source = "News";
      try {
        const host = new URL(s.url).hostname.replace(/^www\./, "");
        source = host.split(".")[0] ?? "News";
        source = source.charAt(0).toUpperCase() + source.slice(1);
      } catch { /* ignore parse errors */ }
      return { title: s.title, url: s.url, source };
    });

  // Build structured inbox items (rendered as a separate Flex carousel)
  const inboxRaw = inboxResult.status === "fulfilled" ? inboxResult.value : null;
  const inbox = inboxRaw && inboxRaw.length > 0 ? (inboxRaw as BriefingInboxItem[]) : null;

  // Date header in user's timezone
  const dateHeader = new Date().toLocaleDateString(locale, {
    timeZone: opts.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const text = `${t(lang, "morningGreeting", { date: dateHeader })}\n\n${sections.join("\n\n")}`;

  return { text, news, inbox };
}

/** Used by the cron sweep to know if we should push the briefing now. */
export function shouldFireBriefingNow(
  briefingTime: string | null,
  lastFiredTs: number | null,
  timezone: string,
  windowMinutes = 30,
): boolean {
  if (!briefingTime) return false;
  const m = /^(\d{1,2}):(\d{2})$/.exec(briefingTime);
  if (!m) return false;
  const hh = parseInt(m[1]!, 10);
  const mm = parseInt(m[2]!, 10);
  const nowLocalParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const localHour = parseInt(nowLocalParts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const localMin = parseInt(nowLocalParts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const nowMinOfDay = localHour * 60 + localMin;
  const targetMinOfDay = hh * 60 + mm;
  const within = nowMinOfDay >= targetMinOfDay && nowMinOfDay - targetMinOfDay < windowMinutes;
  if (!within) return false;
  // Don't fire twice in the same day.
  if (lastFiredTs && Date.now() - lastFiredTs < 12 * 60 * 60 * 1000) return false;
  return true;
}

// Marker import to keep `env` reachable for tree-shaking checks.
void env;
