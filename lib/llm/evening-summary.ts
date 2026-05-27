import { google } from "googleapis";
import { getGoogleClient, hasGoogleConnection } from "@/lib/tools/google-auth";
import { listTasks } from "@/lib/memory/tasks";
import { redis } from "@/lib/memory/redis";
import { env } from "@/lib/env";

type NewsStory = { title: string; url: string };

async function fetchNews(query: string, apiKey: string): Promise<NewsStory[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: 4,
        search_depth: "basic",
        topic: "news",
        days: 1,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) return [];
    const data = (await r.json()) as { results?: Array<{ title: string; url: string }> };
    return (data.results ?? []).map((s) => ({ title: s.title, url: s.url }));
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}

/**
 * Build a 9 PM evening summary for a single user. Pulls leftover tasks, the next
 * 5 calendar events (from tomorrow), and today's geopolitics + economics news in
 * parallel. Returns a bullet-point push-ready string.
 */
export async function buildEveningSummary(
  userId: string,
  opts: { timezone: string },
): Promise<string | null> {
  // Atomic dedup lock — prevents concurrent cron sweeps from double-sending.
  const todayDateStr = new Date().toLocaleDateString("en-CA", { timeZone: opts.timezone });
  const lockKey = `evening:${userId}:${todayDateStr}`;
  const locked = await redis().set(lockKey, 1, { nx: true, ex: 60 * 60 });
  if (!locked) return null;

  const now = Date.now();
  const apiKey = env().TAVILY_API_KEY;

  // Pre-fetch everything in parallel — news fires alongside tasks + calendar.
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const [tasksResult, doneResult, calendarResult, geoResult, econResult, polyResult] =
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
          maxResults: 5,
          singleEvents: true,
          orderBy: "startTime",
        });
        return r.data.items ?? [];
      }),

      apiKey
        ? fetchNews("geopolitics world news today major outlets", apiKey)
        : Promise.resolve([] as NewsStory[]),

      apiKey
        ? fetchNews("global economics finance markets today", apiKey)
        : Promise.resolve([] as NewsStory[]),

      apiKey
        ? fetchNews("polymarket prediction markets today", apiKey)
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

  // 3. Upcoming schedule (next 5 events from now)
  const calEvents =
    calendarResult.status === "fulfilled" ? calendarResult.value : null;
  if (calEvents && calEvents.length > 0) {
    const lines = calEvents.map((e) => {
      const startRaw = e.start?.dateTime ?? e.start?.date ?? "";
      const dateStr = startRaw
        ? new Date(startRaw).toLocaleDateString("en-US", {
            timeZone: opts.timezone,
            weekday: "short",
            month: "short",
            day: "numeric",
          })
        : "?";
      const timeStr = e.start?.dateTime
        ? new Date(startRaw).toLocaleTimeString("en-US", {
            timeZone: opts.timezone,
            hour: "numeric",
            minute: "2-digit",
          })
        : "all day";
      return `• ${dateStr}, ${timeStr} — ${e.summary ?? "(untitled)"}`;
    });
    sections.push(`📅 Coming up\n${lines.join("\n")}`);
  }

  // 4. News — geopolitics + economics + polymarket (if any results)
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

  return `Good evening. Here's your wrap-up:\n\n${sections.join("\n\n")}`;
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
