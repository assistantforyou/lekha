import { google } from "googleapis";
import { generateText } from "ai";
import { extractorModel } from "./provider";
import { getGoogleClient, hasGoogleConnection } from "@/lib/tools/google-auth";
import { listTasks } from "@/lib/memory/tasks";
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
 * Build a daily morning briefing for a single user. Pulls all open tasks,
 * the next 5 upcoming calendar events, optional unread Gmail, and today's news.
 * Returns a single push-ready string.
 */
export async function buildMorningBriefing(
  userId: string,
  opts: { timezone: string; location: string | null; includeInbox: boolean },
): Promise<string | null> {
  const sections: string[] = [];
  const now = Date.now();
  const apiKey = env().TAVILY_API_KEY;

  // Fetch everything in parallel
  const [tasksResult, calendarResult, geoResult, econResult, inboxResult] =
    await Promise.allSettled([
      listTasks(userId, "open"),

      hasGoogleConnection(userId).then(async (has) => {
        if (!has) return null;
        const { client } = await getGoogleClient(userId, undefined, [
          "https://www.googleapis.com/auth/calendar.readonly",
        ]);
        const calendar = google.calendar({ version: "v3", auth: client });
        const r = await calendar.events.list({
          calendarId: "primary",
          timeMin: new Date(now).toISOString(),
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
            return fetched.map((r) => {
              const headers = r.data.payload?.headers ?? [];
              const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
              const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value ?? "";
              return `• ${subject} — ${from.split("<")[0]?.trim() || from}`;
            });
          })
        : Promise.resolve(null),
    ]);

  // 1. All open tasks — overdue first, then by due date, then undated
  const openTasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
  if (openTasks.length) {
    const overdue = openTasks
      .filter((t) => t.dueAt && t.dueAt < now)
      .sort((a, b) => a.dueAt! - b.dueAt!)
      .map((t) => {
        const when = new Date(t.dueAt!).toLocaleDateString("en-US", {
          timeZone: opts.timezone,
          month: "short",
          day: "numeric",
        });
        return `• [OVERDUE ${when}] ${t.title}`;
      });
    const upcoming = openTasks
      .filter((t) => !t.dueAt || t.dueAt >= now)
      .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
      .slice(0, 10)
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
    const taskLines = [...overdue, ...upcoming].slice(0, 10);
    sections.push(`📋 Tasks (${openTasks.length} open)\n${taskLines.join("\n")}`);
  } else {
    sections.push("📋 Tasks\n• All clear — nothing open.");
  }

  // 2. Next 5 upcoming calendar events (from now, across any day)
  const calEvents = calendarResult.status === "fulfilled" ? calendarResult.value : null;
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
    sections.push(`📅 Upcoming\n${lines.join("\n")}`);
  } else if (calEvents !== null) {
    sections.push("📅 Upcoming\n• Nothing on your calendar.");
  }

  // 3. News — geopolitics + economics
  const geo = geoResult.status === "fulfilled" ? geoResult.value : [];
  const econ = econResult.status === "fulfilled" ? econResult.value : [];
  const newsLines: string[] = [];
  if (geo.length) {
    newsLines.push("🌍 World");
    geo.slice(0, 3).forEach((s) => newsLines.push(`\n• ${s.title}\n${s.url}`));
  }
  if (econ.length) {
    if (newsLines.length) newsLines.push("");
    newsLines.push("📈 Markets");
    econ.slice(0, 2).forEach((s) => newsLines.push(`\n• ${s.title}\n${s.url}`));
  }
  if (newsLines.length) {
    sections.push(`📰 News\n${newsLines.join("\n")}`);
  }

  // 4. Inbox (optional)
  const inboxItems = inboxResult.status === "fulfilled" ? inboxResult.value : null;
  if (inboxItems && inboxItems.length > 0) {
    sections.push(`📧 Unread (last 24h)\n${inboxItems.join("\n")}`);
  }

  if (!sections.length) return null;

  // Let the LLM add a warm one-line intro, but keep all sections verbatim.
  try {
    const prelude = `Good morning! Here's your day:\n\n${sections.join("\n\n")}`;
    const r = await generateText({
      model: extractorModel(),
      system:
        "You are Lekha, a personal assistant. Take this briefing skeleton and add a single warm one-line intro. Output the briefing in full — keep all sections verbatim. No emoji headers should be removed. Total under 1600 chars.",
      prompt: prelude,
    });
    const polished = r.text.trim();
    return polished.length > 50 ? polished : prelude;
  } catch {
    return `Good morning. Here's your day:\n\n${sections.join("\n\n")}`;
  }
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
