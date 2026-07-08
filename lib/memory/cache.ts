/**
 * Simple TTL in-memory cache for short-lived deduplication within a single
 * request / agent turn. Vercel Functions are stateless, so this only saves
 * repeated reads inside the same invocation, not across requests.
 */

export type CacheEntry<T> = { value: T; ts: number };

import { createHash } from "crypto";
import { LruMap } from "@/lib/lru-cache";
import { redis } from "@/lib/memory/redis";

export function createTtlCache<T>(defaultTtlMs = 5_000, maxSize = 1000) {
  const map = new LruMap<string, CacheEntry<T>>(maxSize);

  function key(userId: string, ...parts: string[]) {
    return [userId, ...parts].join(":");
  }

  function get(userId: string, ...parts: string[]): T | undefined {
    const k = key(userId, ...parts);
    const entry = map.get(k);
    if (entry && Date.now() - entry.ts < defaultTtlMs) return entry.value;
    map.delete(k);
    return undefined;
  }

  function set(userId: string, value: T, ...parts: string[]) {
    map.set(key(userId, ...parts), { value, ts: Date.now() });
  }

  function invalidate(userId: string, ...partPrefix: string[]) {
    const prefix = partPrefix.length ? key(userId, ...partPrefix) : userId;
    for (const k of map.keys()) {
      if (k.startsWith(prefix)) map.delete(k);
    }
  }

  function clear() {
    map.clear();
  }

  return { get, set, invalidate, clear };
}

/**
 * Redis-backed JSON cache for Google API read calls.
 * Keyed by service + user + resolved account + hashed args so repeated identical
 * read calls within the TTL window don't hit Google twice.
 */
export async function withGoogleCache<T>(
  userId: string,
  email: string | null | undefined,
  service: string,
  args: Record<string, unknown>,
  ttlSec: number,
  fetch: () => Promise<T>,
): Promise<T> {
  const argsHash = createHash("sha256").update(JSON.stringify(args)).digest("hex");
  const key = `gcache:${service}:${userId}:${email ?? "none"}:${argsHash}`;
  const cached = await redis().get<T>(key);
  if (cached !== null && cached !== undefined) return cached;
  const result = await fetch();
  if (result !== null && result !== undefined) {
    await redis().set(key, result, { ex: ttlSec });
  }
  return result;
}
