import { createHmac } from "crypto";
import { env } from "@/lib/env";

const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days

export function mediaProxyUrl(
  messageId: string,
  userId: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = createHmac("sha256", env().OAUTH_STATE_SECRET)
    .update(`${exp}:${messageId}:${userId}`)
    .digest("hex");
  const base = env().APP_BASE_URL.replace(/\/$/, "");
  return `${base}/api/line/media-proxy?messageId=${encodeURIComponent(
    messageId,
  )}&userId=${encodeURIComponent(userId)}&exp=${exp}&sig=${sig}`;
}

export function verifyMediaProxySignature(
  messageId: string,
  userId: string,
  exp: string,
  sig: string,
): boolean {
  const expected = createHmac("sha256", env().OAUTH_STATE_SECRET)
    .update(`${exp}:${messageId}:${userId}`)
    .digest("hex");
  return expected === sig;
}
