import { scheduleRecurring, cancelSchedule, scheduleOneShot, localTimeToUtcCron } from "./cron";
import { getSettings, updateSettings } from "./memory/settings";
import { hasQStash } from "./env";
import { redis } from "./memory/redis";

const LOCK_KEY = (userId: string) => `lock:schedules:${userId}`;
const LOCK_TTL_SEC = 60;

/**
 * Sync per-user QStash schedules for all proactive fixed-time events.
 * Called when settings change or on first contact after a migration.
 * Uses a Redis lock to prevent duplicate schedules from concurrent calls.
 */
export async function syncAllProactiveSchedules(userId: string): Promise<void> {
  if (!hasQStash()) return;
  const locked = await redis().set(LOCK_KEY(userId), "1", { nx: true, ex: LOCK_TTL_SEC });
  if (!locked) return; // another process is already syncing
  try {
    await Promise.all([
      syncMorningBriefingSchedule(userId),
      syncEveningSummarySchedule(userId),
      syncTaskCheckInSchedule(userId),
    ]);
  } finally {
    await redis().del(LOCK_KEY(userId));
  }
}

// ─── Morning briefing ──────────────────────────────────────────────────────

export async function syncMorningBriefingSchedule(userId: string): Promise<void> {
  if (!hasQStash()) return;
  const settings = await getSettings(userId);
  // Cancel existing schedule if any.
  if (settings.morningBriefingScheduleId) {
    await cancelSchedule(settings.morningBriefingScheduleId);
  }
  if (settings.morningBriefingTime) {
    const cron = localTimeToUtcCron(settings.morningBriefingTime, settings.timezone);
    if (cron) {
      const id = await scheduleRecurring(
        "/api/cron/sweep/fire",
        { userId, type: "morning_briefing" },
        cron,
      );
      await updateSettings(userId, { morningBriefingScheduleId: id });
      return;
    }
  }
  await updateSettings(userId, { morningBriefingScheduleId: null });
}

// ─── Evening summary ───────────────────────────────────────────────────────

export async function syncEveningSummarySchedule(userId: string): Promise<void> {
  if (!hasQStash()) return;
  const settings = await getSettings(userId);
  if (settings.eveningSummaryScheduleId) {
    await cancelSchedule(settings.eveningSummaryScheduleId);
  }
  if (settings.eveningSummaryEnabled && settings.eveningSummaryTime) {
    const cron = localTimeToUtcCron(settings.eveningSummaryTime, settings.timezone);
    if (cron) {
      const id = await scheduleRecurring(
        "/api/cron/sweep/fire",
        { userId, type: "evening_summary" },
        cron,
      );
      await updateSettings(userId, { eveningSummaryScheduleId: id });
      return;
    }
  }
  await updateSettings(userId, { eveningSummaryScheduleId: null });
}

// ─── Task check-in ─────────────────────────────────────────────────────────

export async function syncTaskCheckInSchedule(userId: string): Promise<void> {
  if (!hasQStash()) return;
  const settings = await getSettings(userId);
  if (settings.taskCheckInScheduleId) {
    await cancelSchedule(settings.taskCheckInScheduleId);
  }
  if (settings.taskCheckInEnabled && settings.taskCheckInTime) {
    const cron = localTimeToUtcCron(settings.taskCheckInTime, settings.timezone);
    if (cron) {
      const id = await scheduleRecurring(
        "/api/cron/sweep/fire",
        { userId, type: "task_check_in" },
        cron,
      );
      await updateSettings(userId, { taskCheckInScheduleId: id });
      return;
    }
  }
  await updateSettings(userId, { taskCheckInScheduleId: null });
}

// ─── Task deadline warning ─────────────────────────────────────────────────

const TASK_DEADLINE_LEAD_MS = 24 * 60 * 60 * 1000;

/**
 * Schedule a one-shot QStash message for a task deadline warning.
 * Returns the QStash message id so the caller can store it on the task.
 */
export async function scheduleTaskDeadlineWarning(
  userId: string,
  taskId: string,
  title: string,
  dueAt: number,
): Promise<string | null> {
  if (!hasQStash()) return null;
  const now = Date.now();
  const fireAt = dueAt - TASK_DEADLINE_LEAD_MS;
  const delaySec = Math.max(1, Math.floor((fireAt - now) / 1000));
  // Don't schedule if already past due.
  if (delaySec < 1 && dueAt <= now) return null;
  // For tasks due within the lead window, fire after a small delay so the
  // user isn't bombarded immediately after creation.
  const effectiveDelay = Math.max(60, delaySec);
  return await scheduleOneShot(
    "/api/cron/sweep/fire",
    { userId, type: "task_deadline", taskId, title },
    effectiveDelay,
  );
}

export async function cancelTaskDeadlineWarning(messageId: string | null | undefined): Promise<void> {
  if (!messageId || !hasQStash()) return;
  try {
    const { Client } = await import("@upstash/qstash");
    const { env } = await import("./env");
    await new Client({ token: env().QSTASH_TOKEN! }).messages.delete(messageId);
  } catch {
    // already delivered or gone
  }
}

// ─── Pre-meeting alerts ────────────────────────────────────────────────────

const PRE_MEETING_ALERT_KEY = (userId: string, eventId: string) =>
  `proactive:premeet:${userId}:${eventId}`;

/**
 * Schedule one-shot QStash messages for each configured lead time before a
 * calendar event. Stores message ids in Redis so they can be cancelled later.
 */
export async function schedulePreMeetingAlerts(
  userId: string,
  eventId: string,
  eventStartISO: string,
  leads: number[],
): Promise<void> {
  if (!hasQStash() || leads.length === 0) return;
  const startTs = new Date(eventStartISO).getTime();
  const now = Date.now();
  const ids: string[] = [];
  for (const lead of leads) {
    const fireAt = startTs - lead * 60_000;
    const delaySec = Math.floor((fireAt - now) / 1000);
    if (delaySec < 1) continue;
    const id = await scheduleOneShot(
      "/api/cron/sweep/fire",
      { userId, type: "pre_meeting", eventId, lead, eventStartISO },
      delaySec,
    );
    ids.push(id);
  }
  if (ids.length > 0) {
    const { redis } = await import("./memory/redis");
    await redis().set(PRE_MEETING_ALERT_KEY(userId, eventId), JSON.stringify(ids), {
      ex: 60 * 60 * 48, // 48h TTL
    });
  }
}

export async function cancelPreMeetingAlerts(userId: string, eventId: string): Promise<void> {
  if (!hasQStash()) return;
  const { redis } = await import("./memory/redis");
  const key = PRE_MEETING_ALERT_KEY(userId, eventId);
  const raw = await redis().get<string>(key);
  if (!raw) return;
  await redis().del(key);
  let ids: string[] = [];
  try {
    ids = JSON.parse(raw);
  } catch { /* ignore */ }
  for (const id of ids) {
    try {
      const { Client } = await import("@upstash/qstash");
      const { env } = await import("./env");
      await new Client({ token: env().QSTASH_TOKEN! }).messages.delete(id);
    } catch {
      // already delivered or gone
    }
  }
}
