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
 * Start the interactive setup tutorial. The first message is sent as a push so
 * it feels like a one-time onboarding prompt; every step after that is a reply.
 */
export async function startOnboarding(userId: string, _replyToken: string, displayName = ""): Promise<void> {
  await startTutorial(userId, "", displayName);
}

