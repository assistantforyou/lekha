/**
 * Shared fetch helper with AbortController timeout.
 */
export async function fetchJSON<T>(
  url: string,
  opts?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? 12000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: opts?.headers,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(t);
  }
}
