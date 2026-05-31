import { redis } from "./redis";

const REGISTRY_KEY = "users:active";

/**
 * Track every LINE userId we've seen at least once.
 */
export async function registerUser(userId: string): Promise<void> {
  await redis().sadd(REGISTRY_KEY, userId);
}

export async function listAllUsers(): Promise<string[]> {
  return await redis().smembers(REGISTRY_KEY);
}

export async function unregisterUser(userId: string): Promise<void> {
  await redis().srem(REGISTRY_KEY, userId);
}
