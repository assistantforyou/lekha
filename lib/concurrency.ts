/**
 * Run an async function over a list with a bounded number of concurrent workers.
 * Prevents unbounded Promise.allSettled() from exhausting handles, memory, or
 * upstream rate limits (e.g. sweeping all users in a cron job).
 */

export async function runWithConcurrency<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  if (items.length === 0) return;
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const item = queue.shift();
      if (item === undefined) return;
      await fn(item);
    }
  });
  await Promise.all(workers);
}
