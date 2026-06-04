import { redis } from "@/lib/memory/redis";
import { push, text as textMsg, type LineMessage } from "@/lib/line/client";
import { listTasks } from "@/lib/memory/tasks";
import { taskCheckinFlex } from "@/lib/line/flex";
import { getSettings, updateSettings } from "@/lib/memory/settings";
import { isAllowed } from "@/lib/memory/allowlist";
import { briefingFlex, newsFlex, gmailResultsFlex } from "@/lib/line/flex";
import { buildMorningBriefing, shouldFireBriefingNow } from "@/lib/llm/briefing";
import { buildEveningSummary, shouldFireEveningSummaryNow } from "@/lib/llm/evening-summary";

const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // 10 min
const ACTIVE_THROTTLE_MS = 5 * 60 * 1000; // 5 min

/** Mark user as recently active (called from webhook on every inbound message).
 *  Throttled: only writes if last write was > 5 min ago to reduce Redis ops.
 */
export async function markUserActive(userId: string): Promise<void> {
  const key = `active:${userId}`;
  const existing = await redis().get<number>(key);
  if (existing && Date.now() - existing < ACTIVE_THROTTLE_MS) {
    return; // already active recently — skip write
  }
  await redis().set(key, Date.now(), { ex: Math.ceil(ACTIVE_WINDOW_MS / 1000) });
}

/** Returns true if the user messaged the bot within the last 10 minutes. */
export async function isUserRecentlyActive(userId: string): Promise<boolean> {
  const val = await redis().get(`active:${userId}`);
  if (!val) return false;
  const ts = typeof val === "number" ? val : Number(val);
  return Date.now() - ts < ACTIVE_WINDOW_MS;
}

async function pushText(userId: string, text: string) {
  await push(userId, [textMsg(text)]);
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

/** Atomically claim a dedup lock for a proactive push. Returns true if we won the race. */
export async function claimPushLock(userId: string, type: string, ttlSec = 300): Promise<boolean> {
  const key = `pushlock:${userId}:${type}:${new Date().toISOString().slice(0, 10)}`;
  const r = await redis().set(key, 1, { ex: ttlSec, nx: true });
  return r !== null;
}

/** Derive task check-in time from evening summary time (30 min before). */
export function deriveCheckInTime(eveningTime: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(eveningTime);
  if (!m) return "20:30";
  let hh = parseInt(m[1]!, 10);
  let mm = parseInt(m[2]!, 10);
  mm -= 30;
  if (mm < 0) {
    mm += 60;
    hh -= 1;
  }
  if (hh < 0) hh += 24;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Master sweep for a single user — morning briefing, evening summary, task check-in. */
export async function runSweepForUser(userId: string): Promise<void> {
  if (!(await isAllowed(userId))) {
    console.log(`[sweep] ${userId.slice(0, 12)}… skipped — not allowed`);
    return;
  }
  const settings = await getSettings(userId);

  // Morning briefing
  const morningTimeOk = !!settings.morningBriefingTime;
  const morningChannelOk = settings.briefingChannels?.line !== false;
  const morningWindowOk = shouldFireBriefingNow(
    settings.morningBriefingTime,
    settings.lastMorningBriefingTs,
    settings.timezone,
  );
  const morningActiveOk = !(await isUserRecentlyActive(userId));
  const morningLockOk = await claimPushLock(userId, "morning_briefing");
  const morningShouldFire = morningTimeOk && morningChannelOk && morningWindowOk && morningActiveOk && morningLockOk;
  console.log(
    `[sweep] ${userId.slice(0, 12)}… morning=` +
      `${morningShouldFire ? "FIRE" : "skip"} ` +
      `(time=${morningTimeOk} channel=${morningChannelOk} window=${morningWindowOk} active=${morningActiveOk} lock=${morningLockOk})`,
  );
  if (morningShouldFire) {
    try {
      const briefing = await buildMorningBriefing(userId, {
        timezone: settings.timezone,
        location: settings.location,
        includeInbox: settings.inboxBriefingEnabled,
        briefingTopics: settings.briefingTopics,
        briefingTopicSources: settings.briefingTopicSources,
        briefingLength: settings.briefingLength,
        briefingLanguage: settings.briefingLanguage,
      });
      const msgs: LineMessage[] = [briefingFlex("morning", briefing.text)];
      if (briefing.news.length > 0) msgs.push(newsFlex(briefing.news, "📰 Today's news"));
      if (briefing.inbox && briefing.inbox.length > 0) {
        msgs.push(gmailResultsFlex(briefing.inbox.map((m) => ({ ...m, unread: true }))));
      }
      const ok = await push(userId, msgs);
      if (ok) await updateSettings(userId, { lastMorningBriefingTs: Date.now() });
      else console.warn("[sweep] morning briefing push failed", userId);
    } catch (err) {
      console.error("[sweep] morning briefing failed", userId, err);
    }
  }

  // Evening summary
  const eveningTimeOk = !!settings.eveningSummaryEnabled;
  const eveningChannelOk = settings.briefingChannels?.line !== false;
  const eveningWindowOk = shouldFireEveningSummaryNow(
    settings.lastEveningSummaryTs,
    settings.timezone,
    settings.eveningSummaryTime,
  );
  const eveningActiveOk = !(await isUserRecentlyActive(userId));
  const eveningLockOk = await claimPushLock(userId, "evening_summary");
  const eveningShouldFire = eveningTimeOk && eveningChannelOk && eveningWindowOk && eveningActiveOk && eveningLockOk;
  console.log(
    `[sweep] ${userId.slice(0, 12)}… evening=` +
      `${eveningShouldFire ? "FIRE" : "skip"} ` +
      `(enabled=${eveningTimeOk} channel=${eveningChannelOk} window=${eveningWindowOk} active=${eveningActiveOk} lock=${eveningLockOk})`,
  );
  if (eveningShouldFire) {
    try {
      const summary = await buildEveningSummary(userId, { timezone: settings.timezone });
      if (summary) {
        const msgs: LineMessage[] = [briefingFlex("evening", summary.text)];
        if (summary.news.length > 0) msgs.push(newsFlex(summary.news, "📰 Evening news"));
        const ok = await push(userId, msgs);
        if (ok) await updateSettings(userId, { lastEveningSummaryTs: Date.now() });
        else console.warn("[sweep] evening summary push failed", userId);
      }
    } catch (err) {
      console.error("[sweep] evening summary failed", userId, err);
    }
  }

  // Task check-in — fires 30 min before evening summary (or at explicit override).
  const checkInTime = settings.taskCheckInTime ?? deriveCheckInTime(settings.eveningSummaryTime ?? "21:00");
  const checkinEnabledOk = !!settings.taskCheckInEnabled;
  const checkinChannelOk = settings.briefingChannels?.line !== false;
  const checkinWindowOk = shouldFireBriefingNow(
    checkInTime,
    settings.lastTaskCheckInTs,
    settings.timezone,
  );
  const checkinActiveOk = !(await isUserRecentlyActive(userId));
  const checkinLockOk = await claimPushLock(userId, "task_check_in");
  const checkinShouldFire = checkinEnabledOk && checkinChannelOk && checkinWindowOk && checkinActiveOk && checkinLockOk;
  console.log(
    `[sweep] ${userId.slice(0, 12)}… checkin=` +
      `${checkinShouldFire ? "FIRE" : "skip"} ` +
      `(enabled=${checkinEnabledOk} channel=${checkinChannelOk} window=${checkinWindowOk} active=${checkinActiveOk} lock=${checkinLockOk})`,
  );
  if (checkinShouldFire) {
    try {
      await sweepTaskCheckIn(userId, settings.timezone, { taskCheckIns: 0 });
      await updateSettings(userId, { lastTaskCheckInTs: Date.now() });
    } catch (err) {
      console.error("[sweep] task check-in failed", userId, err);
    }
  }
}
