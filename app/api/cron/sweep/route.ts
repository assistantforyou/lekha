import { NextResponse, type NextRequest } from "next/server";
import { hasQStash } from "@/lib/env";
import { verifyQStashSignature, unauthorized, notConfigured, isManualBypass } from "@/lib/qstash-verify";
import { runSweepForUser } from "@/lib/sweep";
import { listAllUsers } from "@/lib/memory/user-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy endpoint: QStash schedules may still point here.
 * We forward to the actual sweep logic so old schedules keep working.
 * The claimPushLock() inside runSweepForUser prevents double-pushes
 * if a newer schedule also hits /api/cron/sweep/fire.
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
  console.warn("[sweep] LEGACY /api/cron/sweep triggered — forwarding to sweep logic. Consider updating the schedule to /api/cron/sweep/fire");

  const users = await listAllUsers();
  await Promise.allSettled(
    users.map((uid) =>
      runSweepForUser(uid).catch((err) =>
        console.error("[sweep] legacy sweep failed for user", uid, err),
      ),
    ),
  );
  return NextResponse.json({ ok: true, usersChecked: users.length, note: "legacy endpoint — consider updating schedule to /api/cron/sweep/fire" });
}
