import { NextResponse, type NextRequest } from "next/server";
import { Receiver } from "@upstash/qstash";
import { z } from "zod";
import { env, hasQStash } from "@/lib/env";
import { push, text as textMsg } from "@/lib/line/client";
import { consumeReminder } from "@/lib/tools/reminders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(["warning_3h", "warning_1h", "final"]).optional(),
});

export async function POST(req: NextRequest) {
  if (!hasQStash()) {
    return new NextResponse("not configured", { status: 503 });
  }

  const raw = await req.text();
  const sig =
    req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature");
  if (!sig) return new NextResponse("missing signature", { status: 401 });

  const receiver = new Receiver({
    currentSigningKey: env().QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: env().QSTASH_NEXT_SIGNING_KEY ?? env().QSTASH_CURRENT_SIGNING_KEY!,
  });
  try {
    const ok = await receiver.verify({
      signature: sig,
      body: raw,
      url: `${env().APP_BASE_URL}/api/reminders/fire`,
    });
    if (!ok) return new NextResponse("invalid signature", { status: 401 });
  } catch {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let body;
  try {
    body = Body.parse(JSON.parse(raw));
  } catch {
    return new NextResponse("bad body", { status: 400 });
  }

  const { userId, id, message, type = "final" } = body;

  // Pre-warnings push a heads-up but do NOT consume the reminder — the final fire will.
  if (type === "warning_3h" || type === "warning_1h") {
    const label = type === "warning_3h" ? "3 hours" : "1 hour";
    await push(userId, [textMsg(`⏰ Heads up — in ${label}: ${message}`)]);
    return NextResponse.json({ ok: true });
  }

  // Final fire: consume (idempotency gate) then push.
  const reminder = await consumeReminder(userId, id);
  if (!reminder) {
    // Already fired or cancelled — return 200 so QStash doesn't retry.
    return NextResponse.json({ ok: true, skipped: true });
  }

  await push(userId, [textMsg(`⏰ Reminder: ${message}`)]);
  return NextResponse.json({ ok: true });
}
