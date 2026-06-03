import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasQStash } from "@/lib/env";
import { getSettings, updateSettings } from "@/lib/memory/settings";
import { hasGoogleConnection } from "@/lib/tools/google-auth";
import { isAllowed } from "@/lib/memory/allowlist";
import { push, text as textMsg, type LineMessage } from "@/lib/line/client";
import { briefingFlex, newsFlex, gmailResultsFlex } from "@/lib/line/flex";
import { buildMorningBriefing, shouldFireBriefingNow } from "@/lib/llm/briefing";
import { buildEveningSummary, shouldFireEveningSummaryNow } from "@/lib/llm/evening-summary";
import { sweepTaskCheckIn, isUserRecentlyActive } from "@/lib/sweep";
import { listTasks } from "@/lib/memory/tasks";
import { listAllUsers } from "@/lib/memory/user-registry";
import { redis } from "@/lib/memory/redis";
import { verifyQStashSignature, unauthorized, badRequest, notConfigured, isManualBypass } from "@/lib/qstash-verify";

/** Atomically claim a dedup lock for a proactive push. Returns true if we won the race. */
async function claimPushLock(userId: string, type: string, ttlSec = 300): Promise<boolean> {
  const key = `pushlock:${userId}:${type}:${new Date().toISOString().slice(0, 10)}`;
  const r = await redis().set(key, 1, { ex: ttlSec, nx: true });
  return r !== null;
}

/** Derive task check-in time from evening summary time (30 min before). */
function deriveCheckInTime(eveningTime: string): string {
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1).optional(),
  type: z.enum([
    "morning_briefing",
    "evening_summary",
    "task_check_in",
    "task_deadline",
    "pre_meeting",
  ]).optional(),
  // task_deadline
  taskId: z.string().optional(),
  title: z.string().optional(),
  // pre_meeting
  eventId: z.string().optional(),
  lead: z.number().optional(),
  eventStartISO: z.string().optional(),
});

export async function POST(req: NextRequest) {
  if (!hasQStash()) return notConfigured();
  const raw = await req.text();
  const sig = req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature");
  const auth = req.headers.get("authorization");
  if (!isManualBypass(auth)) {
    const ok = await verifyQStashSignature(raw, sig, "/api/cron/sweep/fire");
    if (!ok) return unauthorized();
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return badRequest("invalid json");
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return badRequest("invalid body");
  }

  const { userId, type } = parsed.data;

  // ─── Master sweep (no type = iterate all users) ──────────────────────────
  if (!type) {
    let users: string[] = [];
    try {
      users = await listAllUsers();
    } catch (err) {
      console.error("[sweep] failed to list users", err);
      return NextResponse.json({ ok: false, error: "failed to list users" }, { status: 500 });
    }
    for (const uid of users) {
      try {
        await runSweepForUser(uid);
      } catch (err) {
        console.error("[sweep] master sweep failed for user", uid, err);
      }
    }
    return NextResponse.json({ ok: true, usersChecked: users.length });
  }

  // ─── Typed one-shot (reminder, task deadline, pre-meeting alert) ─────────
  if (!userId) return badRequest("missing userId");
  const settings = await getSettings(userId);

  switch (type) {
    case "morning_briefing": {
      try {
        if (
          settings.morningBriefingTime &&
          settings.briefingChannels?.line !== false &&
          !(await isUserRecentlyActive(userId)) &&
          (await claimPushLock(userId, "morning_briefing"))
        ) {
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
          await push(userId, msgs);
          await updateSettings(userId, { lastMorningBriefingTs: Date.now() });
        }
      } catch (err) {
        console.error("[sweep] morning briefing failed", userId, err);
      }
      break;
    }

    case "evening_summary": {
      try {
        if (
          settings.eveningSummaryEnabled &&
          settings.briefingChannels?.line !== false &&
          !(await isUserRecentlyActive(userId)) &&
          (await claimPushLock(userId, "evening_summary"))
        ) {
          const summary = await buildEveningSummary(userId, { timezone: settings.timezone });
          if (summary) {
            const msgs: LineMessage[] = [briefingFlex("evening", summary.text)];
            if (summary.news.length > 0) msgs.push(newsFlex(summary.news, "📰 Evening news"));
            await push(userId, msgs);
            await updateSettings(userId, { lastEveningSummaryTs: Date.now() });
          }
        }
      } catch (err) {
        console.error("[sweep] evening summary failed", userId, err);
      }
      break;
    }

    case "task_check_in": {
      try {
        if (
          settings.taskCheckInEnabled &&
          settings.briefingChannels?.line !== false &&
          !(await isUserRecentlyActive(userId)) &&
          (await claimPushLock(userId, "task_check_in"))
        ) {
          await sweepTaskCheckIn(userId, settings.timezone, { taskCheckIns: 0 });
          await updateSettings(userId, { lastTaskCheckInTs: Date.now() });
        }
      } catch (err) {
        console.error("[sweep] task check-in failed", userId, err);
      }
      break;
    }

    case "task_deadline": {
      try {
        const taskId = parsed.data.taskId;
        const title = parsed.data.title;
        if (!taskId || !title) break;
        // Skip if user disabled LINE proactive pushes.
        if (settings.briefingChannels?.line === false) break;
        const tasks = await listTasks(userId, "open");
        const task = tasks.find((t) => t.id === taskId);
        if (!task) break; // completed or deleted
        const local = task.dueAt
          ? new Date(task.dueAt).toLocaleTimeString("en-US", {
              timeZone: settings.timezone,
              hour: "numeric",
              minute: "2-digit",
            })
          : "";
        const isToday =
          task.dueAt && task.dueAt < Date.now() + 16 * 60 * 60 * 1000;
        const when = isToday ? `today at ${local}` : "tomorrow";
        await push(userId, [textMsg(`⏰ Heads up: "${title}" is due ${when}.`)]);
      } catch (err) {
        console.error("[sweep] task deadline failed", userId, err);
      }
      break;
    }

    case "pre_meeting": {
      try {
        const eventId = parsed.data.eventId;
        const lead = parsed.data.lead;
        const eventStartISO = parsed.data.eventStartISO;
        if (!eventId || lead === undefined || !eventStartISO) break;
        // Skip if user no longer has Google connected.
        if (!(await hasGoogleConnection(userId))) break;
        // Skip if user disabled LINE proactive pushes.
        if (settings.briefingChannels?.line === false) break;
        const startTs = new Date(eventStartISO).getTime();
        const local = new Date(startTs).toLocaleTimeString("en-US", {
          timeZone: settings.timezone,
          hour: "numeric",
          minute: "2-digit",
        });
        const leadLabel =
          lead >= 1440 && lead % 1440 === 0
            ? `${lead / 1440}d`
            : lead >= 60 && lead % 60 === 0
              ? `${lead / 60}h`
              : `${lead}m`;
        await push(userId, [
          textMsg(`🔔 In ~${leadLabel}: upcoming event at ${local}.`),
        ]);
      } catch (err) {
        console.error("[sweep] pre-meeting alert failed", userId, err);
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

// ─── Master sweep logic ────────────────────────────────────────────────────

async function runSweepForUser(userId: string): Promise<void> {
  if (!(await isAllowed(userId))) return;
  const settings = await getSettings(userId);

  // Morning briefing
  if (
    settings.morningBriefingTime &&
    settings.briefingChannels?.line !== false &&
    shouldFireBriefingNow(
      settings.morningBriefingTime,
      settings.lastMorningBriefingTs,
      settings.timezone,
    ) &&
    !(await isUserRecentlyActive(userId)) &&
    (await claimPushLock(userId, "morning_briefing"))
  ) {
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
      await push(userId, msgs);
      await updateSettings(userId, { lastMorningBriefingTs: Date.now() });
    } catch (err) {
      console.error("[sweep] morning briefing failed", userId, err);
    }
  }

  // Evening summary
  if (
    settings.eveningSummaryEnabled &&
    settings.briefingChannels?.line !== false &&
    shouldFireEveningSummaryNow(
      settings.lastEveningSummaryTs,
      settings.timezone,
      settings.eveningSummaryTime,
    ) &&
    !(await isUserRecentlyActive(userId)) &&
    (await claimPushLock(userId, "evening_summary"))
  ) {
    try {
      const summary = await buildEveningSummary(userId, { timezone: settings.timezone });
      if (summary) {
        const msgs: LineMessage[] = [briefingFlex("evening", summary.text)];
        if (summary.news.length > 0) msgs.push(newsFlex(summary.news, "📰 Evening news"));
        await push(userId, msgs);
        await updateSettings(userId, { lastEveningSummaryTs: Date.now() });
      }
    } catch (err) {
      console.error("[sweep] evening summary failed", userId, err);
    }
  }

  // Task check-in — fires 30 min before evening summary (or at explicit override).
  const checkInTime = settings.taskCheckInTime ?? deriveCheckInTime(settings.eveningSummaryTime ?? "21:00");
  if (
    settings.taskCheckInEnabled &&
    settings.briefingChannels?.line !== false &&
    shouldFireBriefingNow(
      checkInTime,
      settings.lastTaskCheckInTs,
      settings.timezone,
    ) &&
    !(await isUserRecentlyActive(userId)) &&
    (await claimPushLock(userId, "task_check_in"))
  ) {
    try {
      await sweepTaskCheckIn(userId, settings.timezone, { taskCheckIns: 0 });
      await updateSettings(userId, { lastTaskCheckInTs: Date.now() });
    } catch (err) {
      console.error("[sweep] task check-in failed", userId, err);
    }
  }
}
