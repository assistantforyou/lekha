import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "@/lib/env";

/** Parse comma-separated GEMINI_API_KEY into an array of individual keys. */
export function getGeminiApiKeys(): string[] {
  const e = env();
  const raw = e.GEMINI_API_KEY ?? e.AI_GATEWAY_API_KEY ?? "";
  return raw.split(",").map((k) => k.trim()).filter(Boolean);
}

/** Create a Gemini model bound to a specific API key. */
export function geminiWithKey(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey })("gemini-flash-lite-latest");
}

/**
 * Back-compat: first available Gemini model (uses first key).
 * Prefer getGeminiApiKeys() + geminiWithKey() for multi-key rotation.
 */
export function chatModel() {
  const keys = getGeminiApiKeys();
  const key = keys[0];
  if (!key) throw new Error("Missing GEMINI_API_KEY (or AI_GATEWAY_API_KEY) for LLM provider");
  return geminiWithKey(key);
}

function groqClient() {
  const e = env();
  if (!e.GROQ_API_KEY) return null;
  return createGroq({ apiKey: e.GROQ_API_KEY });
}

function openRouterClient() {
  const e = env();
  if (!e.OPENROUTER_API_KEY) return null;
  return createOpenAI({
    apiKey: e.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
  });
}

/**
 * Groq fallback models — ordered by TPM headroom.
 *   1. llama-4-maverick: 60K TPM, strong tool use, best headroom
 *   2. llama-4-scout:    30K TPM, smaller/faster
 *   3. gpt-oss-120b:     8K TPM, last resort
 */
export function fallbackChatModels() {
  const g = groqClient();
  if (!g) return [];
  return [
    g("meta-llama/llama-4-maverick-17b-128e-instruct"),
    g("meta-llama/llama-4-scout-17b-16e-instruct"),
    g("openai/gpt-oss-120b"),
  ];
}

/** Back-compat: first available Groq model. */
export function fallbackChatModel() {
  return fallbackChatModels()[0] ?? null;
}

/**
 * OpenRouter free-tier models — used as final fallback after all Groq models
 * are exhausted. Independent rate-limit pool, text-only.
 *
 * Order: best free models first (tool-use capable, high context).
 */
export function openRouterFallbackModels() {
  const g = openRouterClient();
  if (!g) return [];
  return [
    g("google/gemini-2.0-flash-exp:free"),
    g("meta-llama/llama-4-maverick:free"),
    g("google/gemini-flash-1.5-8b:free"),
  ];
}

/** Cheap model for background fact extraction + chunk summarization. */
export function extractorModel() {
  return chatModel();
}
