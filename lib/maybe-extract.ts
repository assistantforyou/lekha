import { turnCounter, loadHistory } from "@/lib/memory/history";
import { extractAndMergeFacts } from "@/lib/llm/extract-facts";
import { getSettings } from "@/lib/memory/settings";

/** Fire background fact extraction every N user turns. Never blocks the reply.
 *
 * Reads from Redis-backed rolling history directly so extraction works even
 * though Mastra Memory is disabled in `mastra/agents/lekha-agent.ts`.
 */
export async function maybeExtractFacts(userId: string, _threadId?: string): Promise<void> {
  const settings = await getSettings(userId);
  if (settings.memoryEnabled === false) {
    return;
  }
  const interval = Number.isFinite(settings.memoryCompactAt) && settings.memoryCompactAt > 0
    ? settings.memoryCompactAt
    : 10;
  const n = await turnCounter(userId);
  if (n % interval !== 0) return;

  // Mastra Memory is disabled; extract from Redis rolling history instead.
  const recent = await loadHistory(userId);
  extractAndMergeFacts(userId, recent).catch((err) =>
    console.warn("[facts] background extract failed", err),
  );
}
