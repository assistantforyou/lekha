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

/** Main chat model — Gemini 2.5 Flash Lite. */
export function chatModel() {
  return googleClient()("gemini-2.5-flash-lite");
}

/** Background extraction model — same, handles PDFs + images natively. */
export function extractorModel() {
  return googleClient()("gemini-2.5-flash-lite");
}
