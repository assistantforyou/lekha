import { redis } from "./redis";

const REGISTRY_KEY = "users:active";

/**
 * Track every LINE userId we've seen at least once.
 */
export async function registerUser(userId: string): Promise<void> {
  await redis().sadd(REGISTRY_KEY, userId);
}

export async function listAllUsers(): Promise<string[]> {
  try {
    return await redis().smembers(REGISTRY_KEY);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("WRONGTYPE")) {
      console.error(`[registry] ${REGISTRY_KEY} is not a set — deleting and returning empty. Re-register users to rebuild.`);
      await redis().del(REGISTRY_KEY).catch(() => {});
      return [];
    }
    throw err;
  }
}

export async function unregisterUser(userId: string): Promise<void> {
  await redis().srem(REGISTRY_KEY, userId);
}
