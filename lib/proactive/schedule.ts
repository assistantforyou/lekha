import { Client as QStash } from "@upstash/qstash";
import { redis } from "@/lib/memory/redis";
import { env, hasQStash } from "@/lib/env";
import { localTimeToUtcCron } from "@/lib/cron";

function qstash() {
  if (!hasQStash()) throw new Error("QStash not configured");
  return new QStash({ token: env().QSTASH_TOKEN! });
}

type ScheduleRecord = { scheduleId: string; cronUtc: string };

const morningKey = (uid: string) => `proactive:morning:schedule:${uid}`;
const eveningKey = (uid: string) => `proactive:evening:schedule:${uid}`;

async function upsertSchedule(
  redisKey: string,
  path: string,
  userId: string,
  cronUtc: string,
): Promise<void> {
  const existing = await redis().get<ScheduleRecord>(redisKey);
  if (existing?.cronUtc === cronUtc) return; // already correct, nothing to do
  if (existing?.scheduleId) {
    await qstash().schedules.delete(existing.scheduleId).catch(() => {});
  }
  const sched = await qstash().schedules.create({
    destination: `${env().APP_BASE_URL}${path}`,
    cron: cronUtc,
    body: JSON.stringify({ userId }),
    headers: { "Content-Type": "application/json" },
  });
  await redis().set(redisKey, { scheduleId: sched.scheduleId, cronUtc } satisfies ScheduleRecord);
  console.log("[schedule] upserted", { userId, path, cronUtc, scheduleId: sched.scheduleId });
}

async function deleteSchedule(redisKey: string): Promise<void> {
  const existing = await redis().get<ScheduleRecord>(redisKey);
  if (!existing?.scheduleId) return;
  await qstash().schedules.delete(existing.scheduleId).catch(() => {});
  await redis().del(redisKey);
}

/** Ensure a daily morning briefing QStash schedule exists for this user.
 *  Idempotent — only replaces if the cron expression changed (time or TZ shift). */
export async function ensureMorningSchedule(
  userId: string,
  time: string,
  timezone: string,
): Promise<void> {
  const cronUtc = localTimeToUtcCron(time, timezone);
  if (!cronUtc) return;
  await upsertSchedule(morningKey(userId), "/api/briefing/morning/fire", userId, cronUtc);
}

/** Ensure a daily 9 PM evening summary schedule exists for this user. */
export async function ensureEveningSchedule(userId: string, timezone: string): Promise<void> {
  const cronUtc = localTimeToUtcCron("21:00", timezone);
  if (!cronUtc) return;
  await upsertSchedule(eveningKey(userId), "/api/briefing/evening/fire", userId, cronUtc);
}

export async function cancelMorningSchedule(userId: string): Promise<void> {
  await deleteSchedule(morningKey(userId));
}

export async function cancelEveningSchedule(userId: string): Promise<void> {
  await deleteSchedule(eveningKey(userId));
}

/**
 * Bootstrap all proactive schedules for a user. Safe to call repeatedly —
 * skips users already fully scheduled. Called by the cron sweep on every
 * tick so new users and timezone changes are picked up automatically.
 */
export async function ensureUserSchedules(
  userId: string,
  settings: { morningBriefingTime: string | null; eveningSummaryEnabled: boolean; timezone: string },
): Promise<void> {
  await Promise.allSettled([
    settings.morningBriefingTime
      ? ensureMorningSchedule(userId, settings.morningBriefingTime, settings.timezone)
      : cancelMorningSchedule(userId),
    settings.eveningSummaryEnabled
      ? ensureEveningSchedule(userId, settings.timezone)
      : cancelEveningSchedule(userId),
  ]);
}
