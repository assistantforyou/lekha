import { redis } from "./redis";

// Compliance audit trail: one entry per agent turn, per user. Verbose by design —
// full message text and full tool call args/results, not just metadata — so an
// issue like "Drive upload silently unavailable" is traceable from the log alone
// without needing to reproduce it. 1-year retention to match the receipts store;
// capped list size protects Redis memory from a single hyperactive user.
const MAX_ENTRIES = 5000;
const RETENTION_SECONDS = 60 * 60 * 24 * 365;

export type AuditToolCall = {
  toolName: string;
  input: unknown;
  output: unknown;
  ok: boolean;
};

export type AuditEntry = {
  id: string;
  ts: number;
  traceId?: string;
  /** fastClassify intent hint active for this turn, if any — narrows which tools were even registered. */
  hint?: string;
  userMessage: string;
  reply: string;
  toolCalls: AuditToolCall[];
  /** Set when the agent turn threw (Gemini error, timeout, quota, etc). */
  error?: string;
  durationMs?: number;
};

const key = (userId: string) => `audit:${userId}`;

export async function appendAuditEntry(
  userId: string,
  entry: Omit<AuditEntry, "id" | "ts">,
): Promise<void> {
  const e: AuditEntry = { id: crypto.randomUUID(), ts: Date.now(), ...entry };
  const k = key(userId);
  const tx = redis().multi();
  tx.rpush(k, JSON.stringify(e));
  tx.ltrim(k, -MAX_ENTRIES, -1);
  tx.expire(k, RETENTION_SECONDS);
  await tx.exec();
}

export async function listAuditLog(
  userId: string,
  opts?: { limit?: number; sinceTs?: number },
): Promise<AuditEntry[]> {
  const raw = await redis().lrange<string | AuditEntry>(key(userId), 0, -1);
  let items = raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as AuditEntry) : r));
  items.reverse(); // newest first
  if (opts?.sinceTs) items = items.filter((e) => e.ts >= opts.sinceTs!);
  if (opts?.limit) items = items.slice(0, opts.limit);
  return items;
}
