import { redis } from "./redis";
import { env, hasUpstashVector } from "@/lib/env";
import { Index } from "@upstash/vector";
import { embed } from "ai";
import { embeddingModel } from "@/lib/llm/provider";

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

let vectorClient: Index | null = null;
function vector(): Index | null {
  if (!hasUpstashVector()) return null;
  if (!vectorClient) {
    vectorClient = new Index({
      url: env().UPSTASH_VECTOR_REST_URL!,
      token: env().UPSTASH_VECTOR_REST_TOKEN!,
    });
  }
  return vectorClient;
}

async function embedText(text: string): Promise<number[] | null> {
  try {
    const { embedding } = await embed({ model: embeddingModel(), value: text });
    return embedding as number[];
  } catch (err) {
    console.warn("[archive] embed failed", err);
    return null;
  }
}

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
  const vec = vector();
  if (vec) {
    const v = await embedText(e.summary);
    if (v) {
      try {
        await vec.upsert({
          id: `${userId}:${e.id}`,
          vector: v,
          metadata: { userId, archiveId: e.id, ts: e.createdAt, summary: e.summary },
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
  const vec = vector();
  if (vec) {
    // Validate userId format before interpolating into the filter string.
    // LINE userIds are always U[a-f0-9]{32}; anything else is a bug or injection attempt.
    if (!/^U[a-f0-9]{32}$/i.test(userId)) {
      console.warn("[archive] invalid userId format, skipping vector search", userId);
      return searchArchiveFallback(userId, query);
    }
    const qv = await embedText(query);
    if (qv) {
      try {
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
          if (out.length) return out;
        }
      } catch (err) {
        console.warn("[archive] vector query failed; falling back to substring", err);
      }
    }
  }
  return searchArchiveFallback(userId, query);
}

async function searchArchiveFallback(userId: string, query: string): Promise<ArchivedSummary[]> {
  const all = await listArchive(userId);
  const q = query.toLowerCase();
  return all.filter((a) => a.summary.toLowerCase().includes(q));
}
