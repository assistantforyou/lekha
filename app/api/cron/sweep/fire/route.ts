import { NextResponse, type NextRequest } from "next/server";
import { Receiver } from "@upstash/qstash";
import { z } from "zod";
import { env, hasQStash } from "@/lib/env";
import { getSettings, updateSettings } from "@/lib/memory/settings";
import { hasGoogleConnection } from "@/lib/tools/google-auth";
import { push, type LineMessage } from "@/lib/line/client";
import { briefingFlex, newsFlex, gmailResultsFlex } from "@/lib/line/flex";
import { buildMorningBriefing, shouldFireBriefingNow } from "@/lib/llm/briefing";
import { buildEveningSummary, shouldFireEveningSummaryNow } from "@/lib/llm/evening-summary";
import { sweepPreMeetingPushes, sweepTaskDeadlines, sweepTaskCheckIn } from "@/lib/sweep";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ userId: z.string().min(1) });

export async function POST(req: NextRequest) {
  if (!hasQStash()) return new NextResponse("not configured", { status: 503 });
  const raw = await req.text();
  const sig = req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature");
  const auth = req.headers.get("authorization");
  const manualSecret = env().CRON_MANUAL_SECRET;
  const allowManual = !!manualSecret && auth === `Bearer ${manualSecret}`;

  if (!allowManual) {
    if (!sig) return new NextResponse("missing signature", { status: 401 });
    const receiver = new Receiver({
      currentSigningKey: env().QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: env().QSTASH_NEXT_SIGNING_KEY ?? env().QSTASH_CURRENT_SIGNING_KEY!,
    });
    try {
      const ok = await receiver.verify({
        signature: sig,
        body: raw,
        url: `${env().APP_BASE_URL}/api/cron/sweep/fire`,
      });
      if (!ok) return new NextResponse("invalid signature", { status: 401 });
    } catch {
      return new NextResponse("invalid signature", { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse("invalid json", { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return new NextResponse("invalid body", { status: 400 });
  }

  const { userId } = parsed.data;

  const settings = await getSettings(userId);

  // Morning briefing
  try {
    if (
      settings.morningBriefingTime &&
      shouldFireBriefingNow(
        settings.morningBriefingTime,
        settings.lastMorningBriefingTs,
        settings.timezone,
      )
    ) {
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

  // Evening summary — 9 PM wrap-up (tasks + calendar + news).
  try {
    if (
      settings.eveningSummaryEnabled &&
      shouldFireEveningSummaryNow(settings.lastEveningSummaryTs, settings.timezone, settings.eveningSummaryTime)
    ) {
      const summary = await buildEveningSummary(userId, { timezone: settings.timezone });
      if (summary) {
        await push(userId, [briefingFlex("evening", summary.text)]);
        await updateSettings(userId, { lastEveningSummaryTs: Date.now() });
      }
    }
  } catch (err) {
    console.error("[sweep] evening summary failed", userId, err);
  }

  // Pre-meeting reminders — fire at EACH configured lead time.
  try {
    if (
      settings.preMeetingLeads.length > 0 &&
      (await hasGoogleConnection(userId))
    ) {
      await sweepPreMeetingPushes(userId, settings.preMeetingLeads, settings.timezone, { preMeetingPushes: 0 });
    }
  } catch (err) {
    console.error("[sweep] pre-meeting pushes failed", userId, err);
  }

  // Task deadline warnings — push once when a task is due within 24h.
  try {
    await sweepTaskDeadlines(userId, settings.timezone, { taskWarnings: 0 });
  } catch (err) {
    console.error("[sweep] task deadlines failed", userId, err);
  }

  // Daily task check-in — ask "did you finish these?" at configured time.
  try {
    if (
      settings.taskCheckInEnabled &&
      shouldFireBriefingNow(settings.taskCheckInTime, settings.lastTaskCheckInTs, settings.timezone)
    ) {
      await sweepTaskCheckIn(userId, settings.timezone, { taskCheckIns: 0 });
      await updateSettings(userId, { lastTaskCheckInTs: Date.now() });
    }
  } catch (err) {
    console.error("[sweep] task check-in failed", userId, err);
  }

  return NextResponse.json({ ok: true });
}
