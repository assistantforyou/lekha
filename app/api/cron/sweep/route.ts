import { NextResponse, type NextRequest } from "next/server";
import { Receiver, Client } from "@upstash/qstash";
import { env, hasQStash } from "@/lib/env";
import { listAllUsers } from "@/lib/memory/user-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proactive cron sweep scheduler. QStash hits this on a fixed schedule (every 15 min recommended).
 * Instead of processing all users inline, we publish one QStash job per user to
 * /api/cron/sweep/fire so each user is handled independently.
 */
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
        url: `${env().APP_BASE_URL}/api/cron/sweep`,
      });
      if (!ok) return new NextResponse("invalid signature", { status: 401 });
    } catch {
      return new NextResponse("invalid signature", { status: 401 });
    }
  }

  const users = await listAllUsers();
  let jobsPublished = 0;
  let errors = 0;

  const client = new Client({ token: env().QSTASH_TOKEN! });

  for (let i = 0; i < users.length; i++) {
    const userId = users[i];
    if (!userId) continue;
    try {
      await client.publishJSON({
        url: `${env().APP_BASE_URL}/api/cron/sweep/fire`,
        body: { userId },
      });
      jobsPublished++;
    } catch (err) {
      errors++;
      console.error("[sweep] failed to publish job for", userId, err);
    }
    if ((i + 1) % 10 === 0) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return NextResponse.json({ ok: true, stats: { users: users.length, jobsPublished, errors } });
}
