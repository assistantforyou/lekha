import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@/lib/env";

function googleClient() {
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

/** Main chat model — Gemini 2.5 Flash. Full Flash is required for reliable
 *  agentic tool use; Flash Lite caused blank/panicked replies. */
export function chatModel() {
  return chatModelForTier(hasFreeKey() ? "free" : "paid");
}

/** Background extraction / summarization model. Flash-Lite is sufficient for
 *  generateObject (structured output, no tool use) and costs ~6× less on output. */
export function extractorModel() {
  return googleClient()("gemini-2.5-flash-lite");
}

/** Embedding model — text-embedding-004, 768 dims. */
export function embeddingModel() {
  return googleClient().textEmbeddingModel("text-embedding-004");
}

/**
 * Default agent call timeout. Full Flash reasons a bit longer than Flash Lite;
 * 30s gives multi-step turns room without burning function time on real hangs.
 */
export const AGENT_TIMEOUT_MS = 30_000;

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
