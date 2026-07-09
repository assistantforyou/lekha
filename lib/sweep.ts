import { redis } from "@/lib/memory/redis";
import { push, text as textMsg, type LineMessage } from "@/lib/line/client";
import { listTasks } from "@/lib/memory/tasks";
import { taskCheckinFlex } from "@/lib/line/flex";
import { getSettings, updateSettings } from "@/lib/memory/settings";
import { isAllowed } from "@/lib/memory/allowlist";
import { buildGate } from "@/lib/gate";
import { briefingFlex, newsFlex, gmailResultsFlex } from "@/lib/line/flex";
import { buildMorningBriefing, shouldFireBriefingNow } from "@/lib/llm/briefing";
import { buildEveningSummary, shouldFireEveningSummaryNow } from "@/lib/llm/evening-summary";
import { deriveCheckInTime } from "@/lib/time-utils";
import { registerUser, REGISTRY_KEY } from "@/lib/memory/user-registry";
import { sendEmail } from "@/lib/tools/email";
import { listAccounts } from "@/lib/tools/google-auth";
import { logSent } from "@/lib/memory/sent-log";

const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // 10 min


/** Mark user as recently active (called from webhook on every inbound message). */
export async function markUserActive(userId: string): Promise<void> {
  await registerUser(userId);
}

/** Returns true if the user messaged the bot within the last 10 minutes. */
export async function isUserRecentlyActive(userId: string): Promise<boolean> {
  const score = await redis().zscore(REGISTRY_KEY, userId);
  if (score === null) return false;
  return Date.now() - score < ACTIVE_WINDOW_MS;
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
    const settings = await getSettings(userId);
    const rows = open.slice(0, 10).map((t) => ({ id: t.id, title: t.title }));
    await push(userId, [taskCheckinFlex(rows, { language: settings.language })]);
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

function localTimeStr(timezone: string): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function localDateStr(timezone: string): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export async function sendBriefingEmail(
  userId: string,
  briefing: { text: string; news?: Array<{ title: string; url?: string }> },
  opts: { subject?: string; timezone: string },
): Promise<{ from: string } | null> {
  const accounts = await listAccounts(userId);
  const to = accounts.activeEmail;
  if (!to) {
    console.log(`[sweep] ${userId.slice(0, 12)}… skipping briefing email — no Gmail connected`);
    return null;
  }

  let body = briefing.text;
  if (briefing.news && briefing.news.length > 0) {
    body += "\n\n📰 Top stories\n" + briefing.news.map((n) => `• ${n.title}${n.url ? ` — ${n.url}` : ""}`).join("\n");
  }

  try {
    const result = await sendEmail(userId, {
      kind: "send_email",
      to: [to],
      subject: opts.subject ?? `Morning briefing — ${localDateStr(opts.timezone)}`,
      body,
    });
    await logSent(userId, {
      kind: "email",
      summary: `[briefing] ${opts.subject ?? "Morning briefing"} → ${to}`,
      detail: { to: [to], subject: opts.subject },
    });
    return result;
  } catch (err) {
    console.error(`[sweep] ${userId.slice(0, 12)}… briefing email failed`, err);
    return null;
  }
}

/** Master sweep for a single user — morning briefing, evening summary, task check-in. */
/** True if the user should receive proactive pushes: admins always, others only if allowlisted. */
export async function isAllowedForProactive(userId: string): Promise<boolean> {
  const gate = buildGate();
  return gate.isAdmin(userId) || (await isAllowed(userId));
}

export async function runSweepForUser(userId: string): Promise<void> {
  if (!(await isAllowedForProactive(userId))) {
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
  const morningLockOk = morningTimeOk && morningChannelOk && morningWindowOk && morningActiveOk
    ? await claimPushLock(userId, "morning_briefing")
    : false;
  const morningShouldFire = morningTimeOk && morningChannelOk && morningWindowOk && morningActiveOk && morningLockOk;
  console.log(
    `[sweep] ${userId.slice(0, 12)}… morning=` +
      `${morningShouldFire ? "FIRE" : "skip"} ` +
      `(time=${morningTimeOk} channel=${morningChannelOk} window=${morningWindowOk} active=${morningActiveOk} lock=${morningLockOk} ` +
      `local=${localTimeStr(settings.timezone)} target=${settings.morningBriefingTime})`,
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
        language: settings.language,
      });
      const msgs: LineMessage[] = [briefingFlex("morning", briefing.text, { language: settings.language })];
      if (briefing.news.length > 0) msgs.push(newsFlex(briefing.news, "📰 Today's news"));
      if (briefing.inbox && briefing.inbox.length > 0) {
        msgs.push(gmailResultsFlex(briefing.inbox.map((m) => ({ ...m, unread: true }))));
      }
      const ok = await push(userId, msgs);
      if (ok) {
        await updateSettings(userId, { lastMorningBriefingTs: Date.now() });
        if (settings.briefingChannels?.email) {
          await sendBriefingEmail(userId, briefing, { timezone: settings.timezone });
        }
      } else console.warn("[sweep] morning briefing push failed", userId);
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
  const eveningLockOk = eveningTimeOk && eveningChannelOk && eveningWindowOk && eveningActiveOk
    ? await claimPushLock(userId, "evening_summary")
    : false;
  const eveningShouldFire = eveningTimeOk && eveningChannelOk && eveningWindowOk && eveningActiveOk && eveningLockOk;
  console.log(
    `[sweep] ${userId.slice(0, 12)}… evening=` +
      `${eveningShouldFire ? "FIRE" : "skip"} ` +
      `(enabled=${eveningTimeOk} channel=${eveningChannelOk} window=${eveningWindowOk} active=${eveningActiveOk} lock=${eveningLockOk} ` +
      `local=${localTimeStr(settings.timezone)} target=${settings.eveningSummaryTime})`,
  );
  if (eveningShouldFire) {
    try {
      const summary = await buildEveningSummary(userId, {
        timezone: settings.timezone,
        briefingLanguage: settings.briefingLanguage,
        language: settings.language,
      });
      if (summary) {
        const msgs: LineMessage[] = [briefingFlex("evening", summary.text, { language: settings.language })];
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
  const checkinLockOk = checkinEnabledOk && checkinChannelOk && checkinWindowOk && checkinActiveOk
    ? await claimPushLock(userId, "task_check_in")
    : false;
  const checkinShouldFire = checkinEnabledOk && checkinChannelOk && checkinWindowOk && checkinActiveOk && checkinLockOk;
  console.log(
    `[sweep] ${userId.slice(0, 12)}… checkin=` +
      `${checkinShouldFire ? "FIRE" : "skip"} ` +
      `(enabled=${checkinEnabledOk} channel=${checkinChannelOk} window=${checkinWindowOk} active=${checkinActiveOk} lock=${checkinLockOk} ` +
      `local=${localTimeStr(settings.timezone)} target=${checkInTime})`,
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
