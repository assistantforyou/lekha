import { redis } from "./redis";
import { createHash } from "crypto";
import { embedText, getVectorIndex, isValidUserId } from "./embeddings";

const SEARCH_CACHE_TTL_SEC = 10 * 60;
const MAX_CACHE_KEYS = 100;

function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

function cacheIndexKey(userId: string) {
  return `archive:search:keys:${userId}`;
}

async function writeSearchCache(userId: string, cacheKey: string, value: ArchivedSummary[]): Promise<void> {
  const indexKey = cacheIndexKey(userId);
  const tx = redis().multi();
  tx.set(cacheKey, value, { ex: SEARCH_CACHE_TTL_SEC });
  tx.lpush(indexKey, cacheKey);
  tx.ltrim(indexKey, 0, MAX_CACHE_KEYS - 1);
  tx.expire(indexKey, SEARCH_CACHE_TTL_SEC);
  await tx.exec();
}

export type ArchivedSummary = {
  id: string;
  /** Inclusive UNIX-ms range covered by this summary chunk. */
  fromTs: number;
  toTs: number;
  /** Compact LLM-generated summary of the conversation in that window. */
  summary: string;
  createdAt: number;
};

const key = (userId: string) => `user:${userId}:archive`;
const MAX = 200;

export async function appendArchive(
  userId: string,
  entry: Omit<ArchivedSummary, "id" | "createdAt">,
): Promise<void> {
  const e: ArchivedSummary = { id: crypto.randomUUID(), createdAt: Date.now(), ...entry };
  const k = key(userId);
  const tx = redis().multi();
  tx.rpush(k, JSON.stringify(e));
  tx.ltrim(k, -MAX, -1);
  await tx.exec();

  // Best-effort vector upsert. Failures don't block the user.
  const vec = getVectorIndex();
  if (vec) {
    const v = await embedText(e.summary);
    if (v) {
      try {
        await vec.upsert({
          id: `${userId}:${e.id}`,
          vector: v,
          metadata: { userId, archiveId: e.id, ts: e.createdAt, summary: e.summary, kind: "archive" },
        });
      } catch (err) {
        console.warn("[archive] vector upsert failed", err);
      }
    }
  }
}

export async function listArchive(userId: string): Promise<ArchivedSummary[]> {
  const raw = await redis().lrange<string | ArchivedSummary>(key(userId), 0, -1);
  return raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as ArchivedSummary) : r));
}

/**
 * Search this user's archive.
 *
 * - If Upstash Vector is configured: embed the query and do a top-K
 *   similarity search filtered by userId. The vector metadata already contains
 *   the summary, so we return reconstructed ArchivedSummary objects directly
 *   without loading the full Redis list.
 *   On any failure or zero results, falls through to substring.
 * - Otherwise: substring match against all summaries (loads from Redis).
 */
export async function searchArchive(userId: string, query: string): Promise<ArchivedSummary[]> {
  const normalized = query.trim().toLowerCase();
  const cacheKey = `archive:search:${userId}:${sha1(normalized)}`;
  const cached = await redis().get<ArchivedSummary[]>(cacheKey);
  if (cached) return cached;

  const vec = getVectorIndex();
  if (vec) {
    if (!isValidUserId(userId)) {
      console.warn("[archive] invalid userId format, skipping vector search", userId);
      return searchArchiveFallback(userId, query);
    }
    const qv = await embedText(query);
    if (qv) {
      try {
        // Filtered by userId only, not kind='archive' — entries upserted before
        // that field existed have no kind at all, and an over-strict filter
        // would silently exclude them. md.archiveId presence below (only ever
        // set on archive entries) already excludes document chunks correctly.
        const hits = await vec.query({
          vector: qv,
          topK: 10,
          includeMetadata: true,
          filter: `userId = '${userId}'`,
        });
        if (hits && hits.length) {
          // Reconstruct from vector metadata — avoids loading all 200 Redis entries.
          const out: ArchivedSummary[] = [];
          for (const h of hits) {
            const md = (h.metadata ?? {}) as {
              archiveId?: string;
              ts?: number;
              summary?: string;
            };
            if (md.archiveId && md.summary) {
              out.push({
                id: md.archiveId,
                fromTs: md.ts ?? 0,
                toTs: md.ts ?? 0,
                summary: md.summary,
                createdAt: md.ts ?? 0,
              });
            }
          }
          if (out.length) {
            await writeSearchCache(userId, cacheKey, out).catch(() => {});
            return out;
          }
        }
      } catch (err) {
        console.warn("[archive] vector query failed; falling back to substring", err);
      }
    }
  }
  const fallback = await searchArchiveFallback(userId, query);
  await writeSearchCache(userId, cacheKey, fallback).catch(() => {});
  return fallback;
}

async function searchArchiveFallback(userId: string, query: string): Promise<ArchivedSummary[]> {
  const all = await listArchive(userId);
  const q = query.toLowerCase();
  return all.filter((a) => a.summary.toLowerCase().includes(q));
}
