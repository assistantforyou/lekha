import { redis } from "@/lib/memory/redis";

const KEY = "github_notify:recipients";

export async function addRecipient(userId: string): Promise<void> {
  await redis().sadd(KEY, userId);
}

export async function removeRecipient(userId: string): Promise<void> {
  await redis().srem(KEY, userId);
}

export async function getRecipients(): Promise<string[]> {
  return redis().smembers(KEY);
}
