import { NextResponse, type NextRequest } from "next/server";
import { hasQStash } from "@/lib/env";
import { verifyQStashSignature, unauthorized, notConfigured, isManualBypass } from "@/lib/qstash-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEPRECATED: The master cron sweep has been replaced by per-user QStash
 * schedules. Please cancel the old QStash schedule pointing at /api/cron/sweep
 * in your QStash dashboard.
 */
export async function POST(req: NextRequest) {
  if (!hasQStash()) return notConfigured();
  const raw = await req.text();
  const sig = req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature");
  const auth = req.headers.get("authorization");
  if (!isManualBypass(auth)) {
    const ok = await verifyQStashSignature(raw, sig, "/api/cron/sweep");
    if (!ok) return unauthorized();
  }
  console.warn("[sweep] master cron sweep is deprecated — cancel the QStash schedule in dashboard");
  return NextResponse.json({ ok: true, deprecated: true, note: "Per-user schedules are now used. Cancel this schedule in QStash dashboard." });
}
