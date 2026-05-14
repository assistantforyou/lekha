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

/** Main chat model — Gemini 2.0 Flash (paid, stable, full multimodal). */
export function chatModel() {
  return googleClient()("gemini-2.0-flash");
}

/** Background extraction model — same family, handles PDFs + images natively. */
export function extractorModel() {
  return googleClient()("gemini-2.0-flash");
}
