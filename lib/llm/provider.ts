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

/** Main chat model — Gemini 2.5 Flash (paid tier). */
export function chatModel() {
  return googleClient()("gemini-2.5-flash");
}

/** Background extraction model — same as chat, cheaper per token than Pro. */
export function extractorModel() {
  return googleClient()("gemini-2.5-flash");
}
