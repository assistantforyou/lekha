import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasQStash } from "@/lib/env";
import { redis } from "@/lib/memory/redis";
import { reminderKey, type StoredReminder } from "@/lib/tools/reminders";
import { verifyQStashSignature, unauthorized, badRequest, notConfigured } from "@/lib/qstash-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
  message: z.string().min(1),
  fireAt: z.number().int(),
});

/** Max delay QStash free tier allows (seconds). Keep a small safety margin. */
const QSTASH_MAX_DELAY_SEC = 60 * 60 * 24 * 7 - 300; // 6d 23h 55m

export async function POST(req: NextRequest) {
  if (!hasQStash()) return notConfigured();

  const raw = await req.text();
  const sig = req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature");
  const ok = await verifyQStashSignature(raw, sig, "/api/reminders/relay");
  if (!ok) return unauthorized();

  let body;
  try {
    body = Body.parse(JSON.parse(raw));
  } catch {
    return badRequest();
  }

  const { userId, id, message, fireAt } = body;

  const reminder = await redis().get<StoredReminder>(reminderKey(userId, id));
  if (!reminder) {
    // Cancelled or already fired — return 200 so QStash doesn't retry.
    return NextResponse.json({ ok: true, skipped: true, reason: "cancelled" });
  }

  const remainingSec = Math.floor((fireAt - Date.now()) / 1000);
  if (remainingSec < 1) {
    // Already past due — fire immediately via the fire route by pushing directly.
    const { push, text: textMsg } = await import("@/lib/line/client");
    await push(userId, [textMsg(`⏰ Reminder: ${message}`)]);
    await redis().del(reminderKey(userId, id));
    await redis().srem(`reminder:${userId}:_list`, id);
    return NextResponse.json({ ok: true, fired: true });
  }

  const { Client } = await import("@upstash/qstash");
  const { env } = await import("@/lib/env");
  const qstash = new Client({ token: env().QSTASH_TOKEN! });
  const callbackUrl = `${env().APP_BASE_URL}/api/reminders/fire`;
  const relayUrl = `${env().APP_BASE_URL}/api/reminders/relay`;

  if (remainingSec <= QSTASH_MAX_DELAY_SEC) {
    // Last hop — schedule final reminder + warnings.
    const warningIds: string[] = [];

    const delay3h = remainingSec - 3 * 3600;
    if (delay3h > 0) {
      const r3 = await qstash.publishJSON({
        url: callbackUrl,
        body: { userId, id, message, type: "warning_3h" },
        delay: delay3h,
      });
      warningIds.push(r3.messageId);
    }

    const delay1h = remainingSec - 3600;
    if (delay1h > 0) {
      const r1 = await qstash.publishJSON({
        url: callbackUrl,
        body: { userId, id, message, type: "warning_1h" },
        delay: delay1h,
      });
      warningIds.push(r1.messageId);
    }

    const res = await qstash.publishJSON({
      url: callbackUrl,
      body: { userId, id, message, type: "final" },
      delay: remainingSec,
    });

    const updated: StoredReminder = {
      ...reminder,
      qstashId: res.messageId,
      ...(warningIds.length > 0 ? { warningIds } : {}),
      relayIds: undefined,
    };
    await redis().set(reminderKey(userId, id), updated, { ex: remainingSec + 60 });
    return NextResponse.json({ ok: true, hop: "final", warnings: warningIds.length });
  }

  // Another relay hop needed.
  const relayRes = await qstash.publishJSON({
    url: relayUrl,
    body: { userId, id, message, fireAt },
    delay: QSTASH_MAX_DELAY_SEC,
  });

  const updated: StoredReminder = {
    ...reminder,
    relayIds: [...(reminder.relayIds ?? []), relayRes.messageId],
  };
  await redis().set(reminderKey(userId, id), updated, { ex: remainingSec + 60 });
  return NextResponse.json({ ok: true, hop: "relay" });
}
