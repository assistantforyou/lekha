/**
 * Drop-in LRU replacement for Map. Keeps the most-recently-used entries and
 * evicts the oldest when the cap is exceeded. Vercel Functions are stateless,
 * but during long-running tasks (cron sweep, dev chat, big group turns) an
 * unbounded Map can grow without limit and hold onto heavy values (file bytes,
 * tool registries, fact blobs).
 */

export class LruMap<K, V> extends Map<K, V> {
  private maxSize: number;

  constructor(maxSize: number, entries?: Iterable<[K, V]>) {
    super(entries);
    this.maxSize = Math.max(1, maxSize);
  }

  set(key: K, value: V): this {
    // Evict oldest entry only when inserting a new key at capacity.
    if (this.size >= this.maxSize && !this.has(key)) {
      const oldest = this.keys().next().value as K | undefined;
      if (oldest !== undefined) this.delete(oldest);
    }
    // Move existing entries to newest on re-insert.
    super.delete(key);
    super.set(key, value);
    return this;
  }

  get(key: K): V | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      super.delete(key);
      super.set(key, value);
    }
    return value;
  }
}
