import { NextResponse, type NextRequest } from "next/server";
import { Receiver } from "@upstash/qstash";
import { z } from "zod";
import { env, hasQStash } from "@/lib/env";
import { getSettings, updateSettings } from "@/lib/memory/settings";
import { buildMorningBriefing } from "@/lib/llm/briefing";
import { push, text as textMsg } from "@/lib/line/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  /** Set to true to return the briefing text without pushing (for manual testing). */
  _dryRun: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!hasQStash()) return new NextResponse("not configured", { status: 503 });

  const raw = await req.text();
  const sig = req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature");
  const auth = req.headers.get("authorization");
  const allowManual = auth === `Bearer ${env().OAUTH_STATE_SECRET}`;

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
        url: `${env().APP_BASE_URL}/api/briefing/morning/fire`,
      });
      if (!ok) return new NextResponse("invalid signature", { status: 401 });
    } catch {
      return new NextResponse("invalid signature", { status: 401 });
    }
  }

  const parsed = Body.safeParse(JSON.parse(raw));
  if (!parsed.success) return new NextResponse("bad body", { status: 400 });
  const { userId, _dryRun } = parsed.data;

  const settings = await getSettings(userId);
  const briefing = await buildMorningBriefing(userId, {
    timezone: settings.timezone,
    location: settings.location,
    includeInbox: settings.inboxBriefingEnabled,
  });

  if (!briefing) {
    console.log("[briefing/morning] nothing to send", { userId });
    return NextResponse.json({ ok: true, sent: false });
  }

  if (_dryRun) {
    return NextResponse.json({ ok: true, sent: false, dryRun: true, briefing });
  }

  await push(userId, [textMsg(briefing)]);
  await updateSettings(userId, { lastMorningBriefingTs: Date.now() });
  console.log("[briefing/morning] sent", { userId, timezone: settings.timezone });
  return NextResponse.json({ ok: true, sent: true });
}
