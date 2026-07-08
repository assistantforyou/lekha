import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/lib/env";

export function googleClient() {
  const e = env();
  const apiKey = e.GEMINI_API_KEY ?? e.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY for LLM provider");
  }
  return createGoogleGenerativeAI({ apiKey });
}

export function hasFreeKey(): boolean {
  return Boolean(env().GEMINI_API_KEY_FREE);
}

export function hasPaidKey(): boolean {
  const e = env();
  return Boolean(e.GEMINI_API_KEY ?? e.AI_GATEWAY_API_KEY);
}

export function chatModelForTier(tier: "free" | "paid") {
  const e = env();
  const apiKey = tier === "free"
    ? e.GEMINI_API_KEY_FREE
    : (e.GEMINI_API_KEY ?? e.AI_GATEWAY_API_KEY);
  if (!apiKey) throw new Error(`No ${tier} Gemini API key configured`);
  return createGoogleGenerativeAI({ apiKey })("gemini-2.5-flash");
}

/**
 * Agentic model with tiered key selection.
 * The agent path uses the free key first and falls back to the paid key on
 * quota/rate-limit errors (see runMastraAgent retry logic). Non-agent callers
 * should use chatModel() / chatModelForTier() directly.
 */
export function agentModel(tier: "free" | "paid" = "free") {
  const e = env();
  if (tier === "free") {
    const key = e.GEMINI_API_KEY_FREE ?? e.GEMINI_API_KEY ?? e.AI_GATEWAY_API_KEY;
    if (!key) throw new Error("No Gemini API key configured");
    return createGoogleGenerativeAI({ apiKey: key })("gemini-2.5-flash");
  }
  const key = e.GEMINI_API_KEY ?? e.AI_GATEWAY_API_KEY;
  if (!key) throw new Error("No paid Gemini API key configured");
  return createGoogleGenerativeAI({ apiKey: key })("gemini-2.5-flash");
}

/**
 * Main chat model — Gemini 2.5 Flash. Full Flash is required for reliable
 * agentic tool use; Flash Lite caused blank/panicked replies.
 *
 * Prefers paid over free — unlike the agentic path in agent.ts, callers of
 * this function (image analysis, media-ai, preread-doc, health check) make a
 * single generateText call with no tier fallback, so a free-tier quota
 * failure here is a hard user-facing failure, not just added latency. Free
 * tier RPM is too low for this workload (see CLAUDE.md gotchas).
 */
export function chatModel() {
  return chatModelForTier(hasPaidKey() ? "paid" : "free");
}

/** Background extraction / summarization model. Flash-Lite is sufficient for
 *  generateObject (structured output, no tool use) and costs ~6× less on output.
 *  Prefers the free key so background tasks don't burn paid quota. */
export function extractorModel() {
  const e = env();
  const freeKey = e.GEMINI_API_KEY_FREE;
  const client = freeKey ? createGoogleGenerativeAI({ apiKey: freeKey }) : googleClient();
  return client("gemini-2.5-flash-lite");
}

/**
 * Embedding model. text-embedding-004 was retired — Gemini now serves embeddings
 * via gemini-embedding-001, which defaults to 3072 dims. Truncated to 768 (via
 * outputDimensionality in the embed() call in lib/memory/archive.ts) to match
 * the existing Upstash Vector index (dim 768, cosine).
 */
export function embeddingModel() {
  return googleClient().textEmbeddingModel("gemini-embedding-001");
}

/**
 * Default agent call timeout. Multi-step tool turns (search + update + confirm,
 * chained Drive/Gmail/Calendar calls) routinely take 30-45s end to end — 30s was
 * cutting those off mid-flight and reporting a false "timed out" even though the
 * call kept running server-side and completed moments later. 55s matches the
 * value already used for image-bundled turns below.
 */
export const AGENT_TIMEOUT_MS = 55_000;

/**
 * Shared Gemini provider options. Safety thresholds use BLOCK_NONE (not OFF —
 * see CLAUDE.md gotchas). CIVIC_INTEGRITY omitted; rejected on some variants.
 */
export const GEMINI_PROVIDER_OPTIONS = {
  google: {
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  },
};
