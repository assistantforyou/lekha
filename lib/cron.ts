import { Client as QStash } from "@upstash/qstash";
import { env, hasQStash } from "@/lib/env";

function qstash() {
  if (!hasQStash()) throw new Error("QStash not configured");
  return new QStash({ token: env().QSTASH_TOKEN! });
}

/**
 * Schedule a recurring HTTP POST at a given cron expression.
 * Returns the QStash schedule id (store in Redis if you need to cancel later).
 *
 * NOTE: QStash crons are evaluated in UTC. Convert from user-local TZ before passing.
 *
 * DEAD CODE for briefings/summaries: The proactive layer uses a single master sweep
 * (lib/sweep.ts runSweepForUser) iterated by a QStash schedule every 15 min.
 * This function is only used by the `set_recurring_reminder` tool in lib/tools/reminders.ts.
 */
export async function scheduleRecurring(
  pathFromBase: string,
  body: Record<string, unknown>,
  cronUtc: string,
): Promise<string> {
  const url = `${env().APP_BASE_URL}${pathFromBase}`;
  const r = await qstash().schedules.create({
    destination: url,
    cron: cronUtc,
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  return r.scheduleId;
}

/**
 * DEAD CODE for briefings/summaries: see scheduleRecurring comment above.
 * Cancellation in the codebase uses qstash().messages.delete directly.
 */
export async function cancelSchedule(scheduleId: string): Promise<void> {
  try {
    await qstash().schedules.delete(scheduleId);
  } catch {
    // already gone
  }
}

export async function scheduleOneShot(
  pathFromBase: string,
  body: Record<string, unknown>,
  delaySec: number,
): Promise<string> {
  const url = `${env().APP_BASE_URL}${pathFromBase}`;
  const r = await qstash().publishJSON({
    url,
    body,
    delay: delaySec,
  });
  return r.messageId;
}

/**
 * Convert HH:mm in a given IANA timezone to a UTC cron "min hour * * *" expression.
 * Uses Intl.DateTimeFormat to handle half-hour offsets (e.g. Asia/Kolkata +5:30,
 * Asia/Tehran +3:30) correctly. DST transitions can still cause the briefing to
 * land an hour off twice a year — acceptable for v1.
 */
export function localTimeToUtcCron(hhmm: string, timezone: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const targetH = parseInt(m[1]!, 10);
  const targetMin = parseInt(m[2]!, 10);
  if (targetH < 0 || targetH > 23 || targetMin < 0 || targetMin > 59) return null;

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });

  let candidate = new Date();
  for (let i = 0; i < 5; i++) {
    const parts = dtf.formatToParts(candidate);
    const getPart = (type: string) => {
      const p = parts.find((x) => x.type === type);
      return p ? parseInt(p.value, 10) : NaN;
    };
    const h = getPart("hour");
    const min = getPart("minute");
    const sec = getPart("second");
    const diffSec = (targetH - h) * 3600 + (targetMin - min) * 60 - sec;
    if (diffSec === 0) break;
    candidate = new Date(candidate.getTime() + diffSec * 1000);
  }

  return `${candidate.getUTCMinutes()} ${candidate.getUTCHours()} * * *`;
}
