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

/** Main chat model — Gemini 2.5 Flash Lite (full Flash silently drops tool calls). */
export function chatModel() {
  return googleClient()("gemini-2.5-flash-lite");
}

/** Background extraction model — Flash for better PDF/image quality. */
export function extractorModel() {
  return googleClient()("gemini-2.5-flash");
}

/** Embedding model — text-embedding-004, 768 dims. */
export function embeddingModel() {
  return googleClient().textEmbeddingModel("text-embedding-004");
}

/**
 * Default agent call timeout. PERFORMANCE.md R3 — 20s fail-fast. Most healthy
 * requests finish in 1–3s; 20s catches real hangs without burning function time.
 */
export const AGENT_TIMEOUT_MS = 20_000;

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
