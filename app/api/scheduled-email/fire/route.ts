import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasQStash } from "@/lib/env";
import { push, text as textMsg } from "@/lib/line/client";
import { consumeScheduledEmail } from "@/lib/tools/scheduled-email";
import { sendEmail } from "@/lib/tools/email";
import { logSent } from "@/lib/memory/sent-log";
import { verifyQStashSignature, unauthorized, badRequest, notConfigured } from "@/lib/qstash-verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  if (!hasQStash()) return notConfigured();
  const raw = await req.text();
  const sig = req.headers.get("upstash-signature") ?? req.headers.get("Upstash-Signature");
  const ok = await verifyQStashSignature(raw, sig, "/api/scheduled-email/fire");
  if (!ok) return unauthorized();

  let body;
  try {
    body = Body.parse(JSON.parse(raw));
  } catch {
    return badRequest();
  }

  const sched = await consumeScheduledEmail(body.userId, body.id);
  if (!sched) return NextResponse.json({ ok: true, skipped: true });

  let sendResult: { from: string } | null = null;
  try {
    sendResult = await sendEmail(body.userId, {
      kind: "send_email",
      to: sched.draft.to,
      cc: sched.draft.cc,
      bcc: sched.draft.bcc,
      subject: sched.draft.subject,
      body: sched.draft.body,
      fromEmail: sched.draft.fromEmail,
    });
    await push(body.userId, [
      textMsg(`📤 Scheduled email sent: "${sched.draft.subject}" → ${sched.draft.to.join(", ")} (from ${sendResult.from}).`),
    ]);
  } catch (err) {
    console.error("[scheduled-email] send failed", err);
    await push(body.userId, [
      textMsg(`⚠️ Scheduled email failed: "${sched.draft.subject}". ${err instanceof Error ? err.message : ""}`),
    ]);
  }

  // Log independently so a Redis failure doesn't mask a successful send.
  try {
    if (sendResult) {
      await logSent(body.userId, {
        kind: "email",
        summary: `[scheduled] ${sched.draft.subject} → ${sched.draft.to.join(", ")}`,
        detail: {
          to: sched.draft.to,
          cc: sched.draft.cc,
          subject: sched.draft.subject,
          from: sendResult.from,
          scheduledAt: new Date(sched.scheduledForTs).toISOString(),
        },
      });
    }
  } catch (err) {
    console.error("[scheduled-email] logSent failed", err);
  }

  return NextResponse.json({ ok: true });
}
