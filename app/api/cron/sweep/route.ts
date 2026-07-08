import { NextResponse, type NextRequest } from "next/server";
import { hasQStash } from "@/lib/env";
import { verifyQStashSignature, unauthorized, notConfigured, isManualCronTrigger } from "@/lib/qstash-verify";
import { publishJSON } from "@/lib/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy endpoint: QStash schedules may still point here.
 * We forward to the paginated sweep endpoint so old schedules keep working
 * without loading all users into a single invocation.
 */
export async function POST(req: NextRequest) {
  if (!hasQStash()) return notConfigured();
  const raw = await req.text();
  const sig = req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature");
  const manual = isManualCronTrigger(req);
  if (!manual) {
    const ok = await verifyQStashSignature(raw, sig, "/api/cron/sweep");
    if (!ok) return unauthorized();
  }
  console.warn("[sweep] LEGACY /api/cron/sweep triggered — forwarding to /api/cron/sweep/fire. Consider updating the schedule to /api/cron/sweep/fire");

  try {
    await publishJSON("/api/cron/sweep/fire", { cursor: 0, batchSize: 20 });
  } catch (err) {
    console.error("[sweep] failed to forward legacy sweep", err);
    return NextResponse.json({ ok: false, error: "failed to forward sweep" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, forwarded: true });
}
