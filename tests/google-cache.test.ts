import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, { value: unknown; opts?: { ex?: number } }>();

vi.mock("@/lib/memory/redis", () => ({
  redis: () => ({
    get: async <T,>(key: string): Promise<T | null> => {
      const entry = store.get(key);
      return entry ? (entry.value as T) : null;
    },
    set: async (key: string, value: unknown, opts?: { ex?: number }) => {
      store.set(key, { value, opts });
      return "OK";
    },
  }),
}));

import { withGoogleCache } from "@/lib/memory/cache";

describe("withGoogleCache", () => {
  beforeEach(() => {
    store.clear();
  });

  it("calls fetch and caches the result", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, data: [1, 2, 3] });
    const result = await withGoogleCache("U1", "a@example.com", "calendar:search", { q: "x" }, 60, fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, data: [1, 2, 3] });

    const cachedKey = Array.from(store.keys()).find((k) => k.startsWith("gcache:calendar:search:U1:a@example.com:"));
    expect(cachedKey).toBeDefined();
    expect(store.get(cachedKey!)?.value).toEqual(result);
    expect(store.get(cachedKey!)?.opts).toEqual({ ex: 60 });

    const second = await withGoogleCache("U1", "a@example.com", "calendar:search", { q: "x" }, 60, fetch);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(second).toEqual(result);
  });

  it("uses 'none' in the key when email is missing", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    await withGoogleCache("U2", undefined, "gmail:summarize_recent", { hours: 24 }, 60, fetch);
    const cachedKey = Array.from(store.keys())[0];
    expect(cachedKey).toContain(":U2:none:");
  });

  it("does not cache null or undefined", async () => {
    const fetchNull = vi.fn().mockResolvedValue(null);
    await withGoogleCache("U3", null, "svc", { x: 1 }, 60, fetchNull);
    expect(store.size).toBe(0);

    const fetchUndefined = vi.fn().mockResolvedValue(undefined);
    await withGoogleCache("U3", null, "svc", { x: 2 }, 60, fetchUndefined);
    expect(store.size).toBe(0);
  });
});
