import { performance } from "perf_hooks";

export class AgentTimeoutError extends Error {
  constructor(public readonly seconds: number) {
    super(`Agent call exceeded ${seconds}s`);
    this.name = "AgentTimeoutError";
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new AgentTimeoutError(Math.round(ms / 1000))), ms),
    ),
  ]);
}

/**
 * Lightweight structured timing logger. Zero overhead when DEBUG_TIMING is unset:
 * module checks the env once at load and exports no-op functions.
 *
 * Usage:
 *   const end = span("agent:generateText", traceId);
 *   const result = await generateText(...);
 *   end({ steps: result.steps.length });
 *
 * Or wrap a function:
 *   const result = await timed("redis:loadHistory", traceId, () => loadHistory(userId));
 */

const ENABLED = process.env.DEBUG_TIMING === "1";

let _counter = 0;
function genTraceId(): string {
  return `${Date.now().toString(36)}_${(++_counter).toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

export type TimingMeta = Record<string, unknown>;

/** Start a timed span. Returns `end(meta?)` to close it. */
export function span(label: string, traceId?: string): (meta?: TimingMeta) => void {
  if (!ENABLED) return () => {};
  const start = performance.now();
  const id = traceId ?? genTraceId();
  return (meta) => {
    const ms = Math.round(performance.now() - start);
    const out: Record<string, unknown> = { _timing: true, traceId: id, label, ms };
    if (meta) Object.assign(out, meta);
    console.log(JSON.stringify(out));
  };
}

/** Wrap a promise-returning function with a timed span. */
export function timed<T>(
  label: string,
  traceId: string | undefined,
  fn: () => Promise<T>,
  meta?: TimingMeta,
): Promise<T> {
  if (!ENABLED) return fn();
  const end = span(label, traceId);
  return fn()
    .then((v) => {
      end(meta);
      return v;
    })
    .catch((err) => {
      end({ ...meta, error: err instanceof Error ? err.message : String(err) });
      throw err;
    });
}

/** Fire a one-shot timing log (no span needed). */
export function tick(label: string, traceId: string | undefined, meta?: TimingMeta): void {
  if (!ENABLED) return;
  const out: Record<string, unknown> = { _timing: true, traceId: traceId ?? genTraceId(), label };
  if (meta) Object.assign(out, meta);
  console.log(JSON.stringify(out));
}
