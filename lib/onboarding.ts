import { redis } from "@/lib/memory/redis";
import { startTutorial } from "@/lib/tutorial";

const ONBOARDED_KEY = (userId: string) => `user:${userId}:onboarded`;

export async function isOnboarded(userId: string): Promise<boolean> {
  const v = await redis().get(ONBOARDED_KEY(userId));
  return v === 1 || v === "1";
}

export async function markOnboarded(userId: string): Promise<void> {
  await redis().set(ONBOARDED_KEY(userId), 1);
}

export async function clearOnboarded(userId: string): Promise<void> {
  await redis().del(ONBOARDED_KEY(userId));
}

/**
 * Start the interactive setup tutorial. When triggered from a user message
 * (replyToken present), the first step is sent as a reply in the same thread.
 * When triggered without a replyToken (e.g. admin approval), it falls back to
 * a push.
 */
export async function startOnboarding(userId: string, replyToken: string, displayName = ""): Promise<void> {
  await startTutorial(userId, replyToken, displayName);
}

