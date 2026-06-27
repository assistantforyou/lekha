/**
 * Simple TTL in-memory cache for short-lived deduplication within a single
 * request / agent turn. Vercel Functions are stateless, so this only saves
 * repeated reads inside the same invocation, not across requests.
 */

export type CacheEntry<T> = { value: T; ts: number };

export function createTtlCache<T>(defaultTtlMs = 5_000) {
  const map = new Map<string, CacheEntry<T>>();

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
