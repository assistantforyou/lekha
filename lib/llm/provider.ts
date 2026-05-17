import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { env } from "@/lib/env";

function googleClient() {
  const e = env();
  const apiKey = e.GEMINI_API_KEY ?? e.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY for LLM provider");
  }
  return createGoogleGenerativeAI({ apiKey });
}

function groqClient() {
  const key = env().GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY for Groq fallback");
  return createGroq({ apiKey: key });
}

/** Main chat model — Gemini 2.5 Flash. */
export function chatModel() {
  return googleClient()("gemini-2.5-flash");
}

/** Background extraction model — same, handles PDFs + images natively. */
export function extractorModel() {
  return googleClient()("gemini-2.5-flash");
}

/** Groq fallback model — used when Gemini is down or overloaded. */
export function groqChatModel() {
  return groqClient()("llama-3.3-70b-versatile");
}
