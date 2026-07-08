import { redis } from "./redis";

export const REGISTRY_KEY = "users:active:window";
const LEGACY_KEY = "users:active";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function touchUser(userId: string): Promise<void> {
  const now = Date.now();
  await redis().zadd(REGISTRY_KEY, { score: now, member: userId });
  await redis().zremrangebyscore(REGISTRY_KEY, 0, now - THIRTY_DAYS_MS);
}

/**
 * Track every LINE userId we've seen at least once.
 */
export async function registerUser(userId: string): Promise<void> {
  await touchUser(userId);
}

async function migrateLegacyRegistry(): Promise<void> {
  try {
    const legacy = await redis().smembers(LEGACY_KEY);
    if (!legacy.length) {
      await redis().del(LEGACY_KEY).catch(() => {});
      return;
    }
    const now = Date.now();
    const tx = redis().multi();
    for (const userId of legacy) {
      tx.zadd(REGISTRY_KEY, { score: now, member: userId });
    }
    tx.del(LEGACY_KEY);
    await tx.exec();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("WRONGTYPE")) {
      await redis().del(LEGACY_KEY).catch(() => {});
    } else {
      console.error("[registry] legacy migration failed", err);
    }
  }
}

export async function countActiveUsers(
  windowMs = THIRTY_DAYS_MS,
): Promise<number> {
  const cutoff = Date.now() - windowMs;
  return redis().zcount(REGISTRY_KEY, cutoff, "+inf");
}

export async function listActiveUsersSlice(
  cursor: number,
  batchSize: number,
  windowMs = THIRTY_DAYS_MS,
): Promise<string[]> {
  const cutoff = Date.now() - windowMs;
  const all = await redis().zrange<string[]>(REGISTRY_KEY, cutoff, "+inf", {
    byScore: true,
    rev: true,
  });
  return all.slice(cursor, cursor + batchSize);
}

export async function listActiveUsers(
  windowMs = THIRTY_DAYS_MS,
): Promise<string[]> {
  const count = await redis().zcard(REGISTRY_KEY);
  if (count === 0) {
    await migrateLegacyRegistry();
  }
  const cutoff = Date.now() - windowMs;
  return redis().zrange<string[]>(REGISTRY_KEY, cutoff, "+inf", {
    byScore: true,
  });
}

export async function listAllUsers(): Promise<string[]> {
  return listActiveUsers();
}

export async function unregisterUser(userId: string): Promise<void> {
  await redis().zrem(REGISTRY_KEY, userId);
}
