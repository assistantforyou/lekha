import { google } from "googleapis";
import { hasGoogleConnection, getGoogleClient } from "@/lib/tools/google-auth";
import { redis } from "@/lib/memory/redis";
import { push, text as textMsg } from "@/lib/line/client";
import { listTasks } from "@/lib/memory/tasks";
import { taskCheckinFlex } from "@/lib/line/flex";

export async function sweepTaskDeadlines(
  userId: string,
  timezone: string,
  stats: { taskWarnings: number },
): Promise<void> {
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;
  try {
    const open = await listTasks(userId, "open");
    for (const task of open) {
      if (!task.dueAt || task.dueAt < now || task.dueAt > in24h) continue;
      // One warning per task per day.
      const seenKey = `taskwarn:${userId}:${task.id}`;
      const set = await redis().set(seenKey, 1, { ex: 60 * 60 * 24, nx: true });
      if (set === null) continue;
      const local = new Date(task.dueAt).toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
      });
      const isToday = task.dueAt < now + 16 * 60 * 60 * 1000; // rough "today"
      const when = isToday ? `today at ${local}` : "tomorrow";
      await push(userId, [textMsg(`⏰ Heads up: "${task.title}" is due ${when}.`)]);
      stats.taskWarnings++;
    }
  } catch (err) {
    console.warn("[sweep] task deadline check failed", userId, err);
  }
}

export async function sweepTaskCheckIn(
  userId: string,
  _timezone: string,
  stats: { taskCheckIns: number },
): Promise<void> {
  try {
    const open = await listTasks(userId, "open");
    if (open.length === 0) return;
    const rows = open.slice(0, 10).map((t) => ({ id: t.id, title: t.title }));
    await push(userId, [taskCheckinFlex(rows)]);
    stats.taskCheckIns++;
  } catch (err) {
    console.warn("[sweep] task check-in failed", userId, err);
  }
}

export async function sweepPreMeetingPushes(
  userId: string,
  leads: number[],
  timezone: string,
  stats: { preMeetingPushes: number },
): Promise<void> {
  const { client } = await getGoogleClient(userId, undefined, [
    "https://www.googleapis.com/auth/calendar.readonly",
  ]);
  const calendar = google.calendar({ version: "v3", auth: client });
  const now = Date.now();
  // Look ahead by the longest lead + sweep slack; we'll bucket each event by lead.
  const longest = Math.max(...leads);
  const r = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date(now).toISOString(),
    timeMax: new Date(now + longest * 60_000 + 16 * 60_000).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 25,
  });
  for (const e of r.data.items ?? []) {
    const startISO = e.start?.dateTime ?? e.start?.date;
    if (!startISO || !e.id) continue;
    const startTs = new Date(startISO).getTime();
    const minutesUntil = Math.round((startTs - now) / 60_000);
    // For each configured lead, check if we're within its 16-min sweep window.
    for (const lead of leads) {
      if (minutesUntil > lead || minutesUntil < lead - 16) continue;
      // Idempotency keyed by (event, lead) — so 1d/1h/30m alerts each fire once.
      const seenKey = `premeet:${userId}:${e.id}:${lead}`;
      const set = await redis().set(seenKey, 1, { ex: 60 * 60 * 24 * 2, nx: true });
      if (set === null) continue;
      const local = new Date(startTs).toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "numeric",
        minute: "2-digit",
      });
      const where = e.location ? ` @ ${e.location}` : "";
      const leadLabel =
        lead >= 1440 && lead % 1440 === 0
          ? `${lead / 1440}d`
          : lead >= 60 && lead % 60 === 0
          ? `${lead / 60}h`
          : `${lead}m`;
      await push(userId, [
        textMsg(`🔔 In ~${leadLabel}: ${e.summary ?? "(untitled)"} at ${local}${where}.`),
      ]);
      stats.preMeetingPushes++;
    }
  }
}
