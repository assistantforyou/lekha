import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasQStash } from "@/lib/env";
import { push, text as textMsg } from "@/lib/line/client";
import { redis } from "@/lib/memory/redis";
import { consumeReminder, reminderKey, type StoredReminder } from "@/lib/tools/reminders";
import { verifyQStashSignature, unauthorized, badRequest, notConfigured } from "@/lib/qstash-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(["warning_3h", "warning_1h", "final"]).optional(),
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

  const { userId, id, message, type = "final" } = body;

  // Pre-warnings push a heads-up but do NOT consume the reminder — the final fire will.
  if (type === "warning_3h" || type === "warning_1h") {
    const label = type === "warning_3h" ? "3 hours" : "1 hour";
    await push(userId, [textMsg(`⏰ Heads up — in ${label}: ${message}`)]);
    return NextResponse.json({ ok: true });
  }

  // Final fire: push first, then consume. If push fails, QStash will retry.
  const reminder = await redis().get<StoredReminder>(reminderKey(userId, id));
  if (!reminder) {
    // Already fired or cancelled — return 200 so QStash doesn't retry.
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    await push(userId, [textMsg(`⏰ Reminder: ${message}`)]);
  } catch (err) {
    console.error("[reminder] push failed", userId, err);
    return new NextResponse("push failed", { status: 500 });
  }

  await consumeReminder(userId, id);
  return NextResponse.json({ ok: true });
}
