import { google } from "googleapis";
import { getGoogleClient, hasGoogleConnection } from "@/lib/tools/google-auth";
import { listTasks, type Task } from "@/lib/memory/tasks";
import { listReminders, type StoredReminder } from "@/lib/tools/reminders";
import { env } from "@/lib/env";
import { fetchCachedNews, type NewsStory } from "@/lib/news-cache";

type WeatherResult = {
  tempC: number | null;
  description: string;
  highC: number | null;
  lowC: number | null;
  rainChancePct: number | null;
};

async function fetchWeather(location: string): Promise<WeatherResult | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 4000);
  try {
    const data = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}?format=j1`,
      { signal: ctrl.signal, headers: { "user-agent": "lekha-bot" } },
    ).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{
        current_condition?: Array<{ temp_C?: string; weatherDesc?: Array<{ value?: string }> }>;
        weather?: Array<{
          maxtempC?: string; mintempC?: string;
          hourly?: Array<{ chanceofrain?: string }>;
        }>;
      }>;
    });
    const cur = data.current_condition?.[0];
    const today = data.weather?.[0];
    return {
      tempC: cur?.temp_C ? Number(cur.temp_C) : null,
      description: cur?.weatherDesc?.[0]?.value ?? "",
      highC: today?.maxtempC ? Number(today.maxtempC) : null,
      lowC: today?.mintempC ? Number(today.mintempC) : null,
      rainChancePct: today?.hourly?.[4]?.chanceofrain ? Number(today.hourly[4]!.chanceofrain) : null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

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

function buildRecommendations(
  agenda: Map<string, AgendaItem[]>,
  openTasks: Task[],
  todayDateStr: string,
  now: number,
  endOfToday: number,
): string[] {
  const recs: string[] = [];
  const todayItems = agenda.get(todayDateStr) ?? [];
  const todayCount = todayItems.length;
  const overdue = openTasks.filter((t) => t.dueAt && t.dueAt < now).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const dueToday = openTasks.filter((t) => t.dueAt && t.dueAt >= now && t.dueAt <= endOfToday);
  const noDueDate = openTasks.filter((t) => !t.dueAt);
  const calToday = todayItems.filter((i) => i.type === "calendar").length;
  const remindersToday = todayItems.filter((i) => i.type === "reminder").length;
  const tasksToday = todayItems.filter((i) => i.type === "task").length;

  if (overdue.length > 0) {
    const first = overdue[0]!;
    recs.push(`Tackle your oldest overdue task first: "${first.title}".`);
  }

  if (todayCount > 6) {
    recs.push("Busy day ahead. Consider blocking 15 min between back-to-back items.");
  } else if (todayCount === 0 && openTasks.length > 0) {
    recs.push("Nothing on your agenda today. Knock out a backlogged task.");
  }

  if (tasksToday >= 3 && calToday >= 2) {
    recs.push("Mix of tasks and meetings today. Batch tasks around your calendar blocks.");
  }

  if (remindersToday >= 3) {
    recs.push("Several reminders today. Bundle them into a single focused block.");
  }

  if (dueToday.length > 3) {
    recs.push(`${dueToday.length} tasks due today. Start with the hardest one.`);
  }

  if (calToday > 0 && tasksToday === 0 && overdue.length === 0) {
    recs.push("Your schedule is full but you have no tasks listed. Add any prep or follow-up items?");
  }

  if (todayCount < 3 && noDueDate.length > 0) {
    recs.push(`You have ${noDueDate.length} task${noDueDate.length > 1 ? "s" : ""} without a due date. Consider scheduling them.`);
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
export async function buildMorningBriefing(
  userId: string,
  opts: { timezone: string; location: string | null; includeInbox: boolean },
): Promise<BriefingResult> {
  const sections: string[] = [];
  const now = Date.now();
  const apiKey = env().TAVILY_API_KEY;

  const todayDateStr = new Date().toLocaleDateString("en-CA", { timeZone: opts.timezone });
  const endOfToday = new Date(`${todayDateStr}T23:59:59`).getTime();

  const [weatherResult, tasksResult, remindersResult, calendarResult, geoResult, econResult, inboxResult] =
    await Promise.allSettled([
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

      apiKey
        ? fetchCachedNews("geopolitics world news today major outlets", apiKey)
        : Promise.resolve([] as NewsStory[]),

      apiKey
        ? fetchCachedNews("global economics finance markets today", apiKey)
        : Promise.resolve([] as NewsStory[]),

      opts.includeInbox
        ? hasGoogleConnection(userId).then(async (has) => {
            if (!has) return null;
            const { client } = await getGoogleClient(userId, undefined, [
              "https://www.googleapis.com/auth/gmail.readonly",
            ]);
            const gmail = google.gmail({ version: "v1", auth: client });
            const list = await gmail.users.messages.list({
              userId: "me",
              q: "newer_than:1d is:unread -category:promotions -category:social",
              maxResults: 50,
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

  // Weather
  const wx = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  if (wx && wx.tempC !== null) {
    const desc = wx.description ? `, ${wx.description.toLowerCase()}` : "";
    let line = `${wx.tempC}°C${desc}`;
    const extras: string[] = [];
    if (wx.highC !== null && wx.lowC !== null) extras.push(`${wx.highC}° / ${wx.lowC}°`);
    if (wx.rainChancePct !== null && wx.rainChancePct > 0) extras.push(`${wx.rainChancePct}% rain`);
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
  if (agenda.has(todayDateStr)) daysToShow.push(todayDateStr);
  for (const day of sortedDays) {
    if (day > todayDateStr && daysToShow.length < 4) {
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
    sections.push(`🗓 Your agenda\n${agendaLines.join("\n")}`);
  } else {
    sections.push("🗓 Your agenda\n• Nothing scheduled for today or tomorrow.");
  }

  // Quick tasks — no due date
  const noDueDate = openTasks.filter((t) => !t.dueAt);
  if (noDueDate.length > 0) {
    const lines = noDueDate.slice(0, 5).map((t) => `• ${t.title}`);
    sections.push(`📋 Other tasks (${noDueDate.length})\n${lines.join("\n")}`);
  } else {
    sections.push("📋 Other tasks\n• No open tasks without a due date.");
  }

  // Recommendations
  const recs = buildRecommendations(agenda, openTasks, todayDateStr, now, endOfToday);
  if (recs.length > 0) {
    sections.push(`💡 Recommendations\n${recs.map((r) => `• ${r}`).join("\n")}`);
  }

  // Build structured news items (rendered as a separate Flex carousel)
  const geo = geoResult.status === "fulfilled" ? geoResult.value : [];
  const econ = econResult.status === "fulfilled" ? econResult.value : [];
  const news: BriefingNewsItem[] = [
    ...geo.slice(0, 3).map((s) => ({ title: s.title, url: s.url, source: "World" })),
    ...econ.slice(0, 2).map((s) => ({ title: s.title, url: s.url, source: "Markets" })),
  ];

  // Build structured inbox items (rendered as a separate Flex carousel)
  const inboxRaw = inboxResult.status === "fulfilled" ? inboxResult.value : null;
  const inbox = inboxRaw && inboxRaw.length > 0 ? (inboxRaw as BriefingInboxItem[]) : null;

  // Date header in user's timezone
  const dateHeader = new Date().toLocaleDateString("en-US", {
    timeZone: opts.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const text = `Good morning! ☀️ ${dateHeader}\n\n${sections.join("\n\n")}`;

  return { text, news, inbox };
}

/** Used by the cron sweep to know if we should push the briefing now. */
export function shouldFireBriefingNow(
  briefingTime: string | null,
  lastFiredTs: number | null,
  timezone: string,
  windowMinutes = 15,
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
