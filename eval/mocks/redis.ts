type StoredString = { value: string; expiresAt?: number };

type Store = {
  strings: Map<string, StoredString>;
  lists: Map<string, string[]>;
  sets: Map<string, Set<string>>;
  hashes: Map<string, Map<string, string>>;
};

const store: Store = {
  strings: new Map(),
  lists: new Map(),
  sets: new Map(),
  hashes: new Map(),
};

export function resetRedisMock() {
  store.strings.clear();
  store.lists.clear();
  store.sets.clear();
  store.hashes.clear();
}

function isExpired(s: StoredString): boolean {
  return s.expiresAt !== undefined && s.expiresAt <= Date.now();
}

function serialize(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function deserialize<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

function getStringStore(): Map<string, StoredString> {
  return store.strings;
}

function getListStore(): Map<string, string[]> {
  return store.lists;
}

function getSetStore(): Map<string, Set<string>> {
  return store.sets;
}

function getHashStore(): Map<string, Map<string, string>> {
  return store.hashes;
}

class Multi {
  private ops: Array<() => unknown> = [];

  private enqueue(fn: () => unknown) {
    this.ops.push(fn);
    return this;
  }

  del(key: string) {
    return this.enqueue(() => redisMethod.del(key));
  }

  lpush(key: string, value: unknown) {
    return this.enqueue(() => redisMethod.lpush(key, value));
  }

  rpush(key: string, ...values: unknown[]) {
    return this.enqueue(() => redisMethod.rpush(key, ...values));
  }

  ltrim(key: string, start: number, end: number) {
    return this.enqueue(() => redisMethod.ltrim(key, start, end));
  }

  llen(key: string) {
    return this.enqueue(() => redisMethod.llen(key));
  }

  sadd(key: string, ...members: string[]) {
    return this.enqueue(() => redisMethod.sadd(key, ...members));
  }

  srem(key: string, ...members: string[]) {
    return this.enqueue(() => redisMethod.srem(key, ...members));
  }

  set(key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) {
    return this.enqueue(() => redisMethod.set(key, value, opts));
  }

  exec() {
    return Promise.resolve(this.ops.map((op) => op()));
  }
}

const redisMethod = {
  async get<T>(key: string): Promise<T | null> {
    const s = getStringStore().get(key);
    if (!s || isExpired(s)) return null;
    return deserialize<T>(s.value);
  },

  async getdel<T>(key: string): Promise<T | null> {
    const s = getStringStore().get(key);
    if (!s || isExpired(s)) return null;
    getStringStore().delete(key);
    return deserialize<T>(s.value);
  },

  async set(
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean; px?: number },
  ): Promise<"OK" | null> {
    const now = Date.now();
    const existing = getStringStore().get(key);
    const live = existing && !isExpired(existing);
    if (opts?.nx && live) return null;
    const ttlMs = opts?.ex ? opts.ex * 1000 : opts?.px;
    getStringStore().set(key, {
      value: serialize(value),
      expiresAt: ttlMs ? now + ttlMs : undefined,
    });
    return "OK";
  },

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const key of keys) {
      if (getStringStore().delete(key)) n++;
      if (getListStore().delete(key)) n++;
      if (getSetStore().delete(key)) n++;
      if (getHashStore().delete(key)) n++;
    }
    return n;
  },

  async exists(...keys: string[]): Promise<number> {
    let n = 0;
    for (const key of keys) {
      const s = getStringStore().get(key);
      if (s && !isExpired(s)) {
        n++;
        continue;
      }
      if (getListStore().has(key)) {
        n++;
        continue;
      }
      if (getSetStore().has(key)) {
        n++;
        continue;
      }
      if (getHashStore().has(key)) n++;
    }
    return n;
  },

  async expire(key: string, seconds: number): Promise<number> {
    const s = getStringStore().get(key);
    if (!s) return 0;
    s.expiresAt = Date.now() + seconds * 1000;
    return 1;
  },

  async incr(key: string): Promise<number> {
    const s = getStringStore().get(key);
    const current = s && !isExpired(s) ? Number.parseInt(s.value, 10) : 0;
    const next = Number.isNaN(current) ? 1 : current + 1;
    getStringStore().set(key, { value: String(next), expiresAt: s?.expiresAt });
    return next;
  },

  async lpush(key: string, ...values: unknown[]): Promise<number> {
    const list = getListStore().get(key) ?? [];
    const serialized = values.map((v) => serialize(v));
    const next = [...serialized, ...list];
    getListStore().set(key, next);
    return next.length;
  },

  async rpush(key: string, ...values: unknown[]): Promise<number> {
    const list = getListStore().get(key) ?? [];
    const serialized = values.map((v) => serialize(v));
    const next = [...list, ...serialized];
    getListStore().set(key, next);
    return next.length;
  },

  async lrange<T>(key: string, start: number, end: number): Promise<T[]> {
    const list = getListStore().get(key) ?? [];
    const slice = end === -1 ? list.slice(start) : list.slice(start, end + 1);
    return slice.map((raw) => deserialize<T>(raw));
  },

  async ltrim(key: string, start: number, end: number): Promise<"OK"> {
    const list = getListStore().get(key) ?? [];
    const trimmed = end === -1 ? list.slice(start) : list.slice(start, end + 1);
    getListStore().set(key, trimmed);
    return "OK";
  },

  async llen(key: string): Promise<number> {
    return getListStore().get(key)?.length ?? 0;
  },

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = getSetStore().get(key) ?? new Set<string>();
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    getSetStore().set(key, set);
    return added;
  },

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = getSetStore().get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) {
      if (set.has(m)) {
        set.delete(m);
        removed++;
      }
    }
    return removed;
  },

  async smembers(key: string): Promise<string[]> {
    const set = getSetStore().get(key);
    return set ? [...set] : [];
  },

  async sismember(key: string, member: string): Promise<number> {
    const set = getSetStore().get(key);
    return set?.has(member) ? 1 : 0;
  },

  async hset(key: string, arg1: Record<string, unknown> | string, arg2?: unknown): Promise<number> {
    const hash = getHashStore().get(key) ?? new Map<string, string>();
    let added = 0;
    if (typeof arg1 === "string") {
      hash.set(arg1, serialize(arg2));
      added = 1;
    } else {
      for (const [field, value] of Object.entries(arg1)) {
        if (!hash.has(field)) added++;
        hash.set(field, serialize(value));
      }
    }
    getHashStore().set(key, hash);
    return added;
  },

  async hgetall<T extends Record<string, string>>(key: string): Promise<T | null> {
    const hash = getHashStore().get(key);
    if (!hash || hash.size === 0) return null;
    const out: Record<string, string> = {};
    for (const [field, value] of hash) {
      out[field] = value;
    }
    return out as T;
  },

  async hget<T extends string>(key: string, field: string): Promise<T | null> {
    const hash = getHashStore().get(key);
    if (!hash) return null;
    const value = hash.get(field);
    return value !== undefined ? (value as T) : null;
  },

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = getHashStore().get(key);
    if (!hash) return 0;
    let removed = 0;
    for (const f of fields) {
      if (hash.delete(f)) removed++;
    }
    return removed;
  },

  multi() {
    return new Multi();
  },
};

export function createRedisMock() {
  return redisMethod;
}

export function getRedisStoreForTest(): Store {
  return store;
}
