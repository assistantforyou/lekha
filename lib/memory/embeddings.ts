import { redis } from "./redis";
import { env, hasUpstashVector } from "@/lib/env";
import { Index } from "@upstash/vector";
import { embed } from "ai";
import { embeddingModel } from "@/lib/llm/provider";
import { createHash } from "crypto";

/**
 * Shared Gemini embedding + Upstash Vector client, used by both the archive
 * (conversation memory) and document (uploaded-file memory) recall systems.
 * Same index, discriminated by a `kind` metadata field per record.
 */

const EMBED_CACHE_TTL_SEC = 24 * 60 * 60;
export const EMBED_DIMS = 768;

function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 16);
}

function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return norm > 0 ? v.map((x) => x / norm) : v;
}

let vectorClient: Index | null = null;
export function getVectorIndex(): Index | null {
  if (!hasUpstashVector()) return null;
  if (!vectorClient) {
    vectorClient = new Index({
      url: env().UPSTASH_VECTOR_REST_URL!,
      token: env().UPSTASH_VECTOR_REST_TOKEN!,
    });
  }
  return vectorClient;
}

/** Embeds text via gemini-embedding-001, truncated to 768 dims and L2-normalized. Cached 24h by content hash. Returns null on any failure (caller degrades gracefully). */
export async function embedText(text: string): Promise<number[] | null> {
  // Keyed by model too — a future model/dimension swap must not silently mix
  // incompatible cached vectors in with the new ones (this is exactly the kind
  // of silent failure that let the old text-embedding-004 outage go unnoticed).
  const cacheKey = `embed:gemini-embedding-001:${sha1(text)}`;
  const cached = await redis().get<number[]>(cacheKey);
  if (cached) return cached;

  try {
    const { embedding } = await embed({
      model: embeddingModel(),
      value: text,
      providerOptions: {
        google: { outputDimensionality: EMBED_DIMS, taskType: "SEMANTIC_SIMILARITY" },
      },
    });
    // gemini-embedding-001 only auto-normalizes its native 3072-dim output —
    // truncated dimensions (768 here) must be normalized manually for cosine
    // similarity to behave correctly.
    const v = l2Normalize(embedding as number[]);
    await redis().set(cacheKey, v, { ex: EMBED_CACHE_TTL_SEC }).catch(() => {});
    return v;
  } catch (err) {
    console.warn("[embeddings] embed failed", err);
    return null;
  }
}

/** LINE userIds are always U[a-f0-9]{32}; guards against injection into vector filter strings. */
export function isValidUserId(userId: string): boolean {
  return /^U[a-f0-9]{32}$/i.test(userId);
}
