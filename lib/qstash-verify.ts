import { NextResponse, type NextRequest } from "next/server";
import { Receiver } from "@upstash/qstash";
import { env, hasQStash } from "@/lib/env";

/** Allow manual sweep triggers with the OAuth state secret or a dedicated cron secret. */
export function isManualCronTrigger(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const allowed = new Set([env().OAUTH_STATE_SECRET, env().CRON_MANUAL_SECRET].filter(Boolean));
  return allowed.has(bearer);
}

export const unauthorized = (msg = "invalid signature") =>
  new NextResponse(msg, { status: 401 });
export const badRequest = (msg = "bad body") =>
  new NextResponse(msg, { status: 400 });
export const notConfigured = () =>
  new NextResponse("not configured", { status: 503 });
export const okJson = (extra?: Record<string, unknown>) =>
  NextResponse.json({ ok: true, ...extra });

/**
 * Verify a QStash signature on a raw request body.
 * Returns true if valid. Returns false if signature is missing or invalid.
 * Callers should check hasQStash() before invoking this and return 503 if not configured.
 */
export async function verifyQStashSignature(
  rawBody: string,
  signature: string | null,
  urlPath: string,
): Promise<boolean> {
  if (!signature) return false;
  const receiver = new Receiver({
    currentSigningKey: env().QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: env().QSTASH_NEXT_SIGNING_KEY ?? env().QSTASH_CURRENT_SIGNING_KEY!,
  });
  try {
    return await receiver.verify({
      signature,
      body: rawBody,
      url: `${env().APP_BASE_URL}${urlPath}`,
    });
  } catch {
    return false;
  }
}

