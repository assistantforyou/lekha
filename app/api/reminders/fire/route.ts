import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasQStash } from "@/lib/env";
import { push, text as textMsg } from "@/lib/line/client";
import { redis } from "@/lib/memory/redis";
import { isAllowed } from "@/lib/memory/allowlist";
import { consumeReminder, reminderKey, type StoredReminder } from "@/lib/tools/reminders";
import { verifyQStashSignature, unauthorized, badRequest, notConfigured } from "@/lib/qstash-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(["warning_3h", "warning_1h", "final"]).optional(),
  recurring: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!hasQStash()) return notConfigured();

  const raw = await req.text();
  const sig = req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature");
  const ok = await verifyQStashSignature(raw, sig, "/api/reminders/fire");
  if (!ok) return unauthorized();

  let body;
  try {
    body = Body.parse(JSON.parse(raw));
  } catch {
    return badRequest();
  }

  const { userId, id, message, type = "final", recurring = false } = body;

  if (!(await isAllowed(userId))) return NextResponse.json({ ok: true });

  // Recurring reminders are driven by a QStash *schedule* that fires every day.
  // The stored record must persist (so the reminder keeps recurring and stays
  // cancellable), so we must NOT consume it. Idempotency is per-day: a lock keyed
  // on id + date ensures duplicate deliveries / retries / piled-up schedules can't
  // fan out into a flood of identical pushes within the same day.
  if (recurring) {
    const lockKey = `fired:${id}:${new Date().toISOString().slice(0, 10)}`;
    const locked = await redis().set(lockKey, 1, { ex: 36 * 3600, nx: true });
    if (!locked) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    // If the record is gone, the reminder was cancelled — don't push a zombie.
    const live = await redis().get<StoredReminder>(reminderKey(userId, id));
    if (!live) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const pushed = await push(userId, [textMsg(`⏰ Reminder: ${message}`)]);
    if (!pushed) {
      console.error("[reminder] recurring push failed", userId, id);
      // Release per-day lock so QStash retry can re-deliver.
      await redis().del(lockKey);
      return new NextResponse("push failed", { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Pre-warnings push a heads-up but do NOT consume the reminder — the final fire will.
  if (type === "warning_3h" || type === "warning_1h") {
    const lockKey = `fired:${id}:${type}`;
    const locked = await redis().set(lockKey, 1, { ex: 3600, nx: true });
    if (!locked) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const label = type === "warning_3h" ? "3 hours" : "1 hour";
    const pushed = await push(userId, [textMsg(`⏰ Heads up — in ${label}: ${message}`)]);
    if (!pushed) {
      console.error("[reminder] warning push failed", userId, id, type);
      // Release lock so QStash retry can re-deliver.
      await redis().del(lockKey);
      return new NextResponse("push failed", { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // Final fire: consume first (idempotency gate), then push.
  // push() never throws — it returns false on LINE API failure. Check the
  // return value and restore the reminder key so QStash can retry on failure.
  const reminder = await consumeReminder(userId, id);
  if (!reminder) {
    // Already fired or cancelled — return 200 so QStash doesn't retry.
    return NextResponse.json({ ok: true, skipped: true });
  }

  const pushed = await push(userId, [textMsg(`⏰ Reminder: ${message}`)]);
  if (!pushed) {
    console.error("[reminder] push failed, restoring for retry", userId, id);
    // Restore the reminder so the next QStash retry attempt can consume it again.
    await redis().set(reminderKey(userId, id), reminder, { ex: 300 });
    return new NextResponse("push failed", { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
