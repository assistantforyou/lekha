import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasQStash } from "@/lib/env";
import { getSettings, updateSettings } from "@/lib/memory/settings";
import { hasGoogleConnection } from "@/lib/tools/google-auth";
import { push, text as textMsg, type LineMessage } from "@/lib/line/client";
import { briefingFlex, newsFlex, gmailResultsFlex } from "@/lib/line/flex";
import { buildMorningBriefing } from "@/lib/llm/briefing";
import { buildEveningSummary } from "@/lib/llm/evening-summary";
import { sweepTaskCheckIn, isUserRecentlyActive } from "@/lib/sweep";
import { listTasks } from "@/lib/memory/tasks";
import { verifyQStashSignature, unauthorized, badRequest, notConfigured, isManualBypass } from "@/lib/qstash-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
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

  // Legacy no-type requests (from old master sweep) are now no-ops.
  if (!type) {
    return NextResponse.json({ ok: true, note: "deprecated" });
  }

  const settings = await getSettings(userId);

  switch (type) {
    case "morning_briefing": {
      try {
        if (settings.morningBriefingTime && !(await isUserRecentlyActive(userId))) {
          const briefing = await buildMorningBriefing(userId, {
            timezone: settings.timezone,
            location: settings.location,
            includeInbox: settings.inboxBriefingEnabled,
            briefingTopics: settings.briefingTopics,
            briefingTopicSources: settings.briefingTopicSources,
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
        if (settings.eveningSummaryEnabled && !(await isUserRecentlyActive(userId))) {
          const summary = await buildEveningSummary(userId, { timezone: settings.timezone });
          if (summary) {
            await push(userId, [briefingFlex("evening", summary.text)]);
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
        if (settings.taskCheckInEnabled && !(await isUserRecentlyActive(userId))) {
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
