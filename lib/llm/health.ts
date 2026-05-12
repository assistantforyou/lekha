import { redis } from "@/lib/memory/redis";

const keyDownKey = (index: number) => `llm:gemini:key:${index}:down_until`;

/**
 * Mark a specific Gemini API key as down (quota / timeout).
 * Subsequent requests skip that key for `forSec` seconds.
 */
export async function markKeyDown(keyIndex: number, forSec = 60): Promise<void> {
  const until = Date.now() + forSec * 1000;
  await redis().set(keyDownKey(keyIndex), until, { ex: forSec });
}

/** Returns true if this specific key is currently in its cooldown window. */
export async function isKeyDown(keyIndex: number): Promise<boolean> {
  const until = await redis().get<number>(keyDownKey(keyIndex));
  if (!until) return false;
  return Date.now() < until;
}

// ── Legacy global mark (kept for backward compat with any external callers) ──

const GEMINI_DOWN_KEY = "llm:gemini:down_until";

export async function markGeminiDown(forSec = 60): Promise<void> {
  const until = Date.now() + forSec * 1000;
  await redis().set(GEMINI_DOWN_KEY, until, { ex: forSec });
}

export async function isGeminiDown(): Promise<boolean> {
  const until = await redis().get<number>(GEMINI_DOWN_KEY);
  if (!until) return false;
  return Date.now() < until;
}
