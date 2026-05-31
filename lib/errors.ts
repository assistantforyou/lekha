export class GoogleAuthRequired extends Error {
  readonly code = "GOOGLE_AUTH_REQUIRED";
  constructor(public readonly scopes: string[]) {
    super("Google authorization required");
  }
}

export class RateLimited extends Error {
  readonly code = "RATE_LIMITED";
  constructor(public readonly retryAfterSec: number) {
    super(`Rate limited, retry in ${retryAfterSec}s`);
  }
}

export class NeedsConfirmation extends Error {
  readonly code = "NEEDS_CONFIRMATION";
  constructor(public readonly summary: string) {
    super(summary);
  }
}

/** Walk the cause / originalError chain and return the first error matching the predicate. */
export function unwrapCause<T>(
  err: unknown,
  predicate: (v: unknown) => v is T,
): T | undefined {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    if (predicate(cur)) return cur;
    const next =
      (cur as { cause?: unknown; originalError?: unknown }).cause ??
      (cur as { originalError?: unknown }).originalError;
    if (!next) break;
    cur = next;
  }
  return undefined;
}

export function unwrapAuthRequired(err: unknown): GoogleAuthRequired | undefined {
  return unwrapCause(err, (v): v is GoogleAuthRequired => v instanceof GoogleAuthRequired);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.slice(0, 300);
  return String(err).slice(0, 300);
}
