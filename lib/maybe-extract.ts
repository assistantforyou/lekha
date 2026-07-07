import { turnCounter } from "@/lib/memory/history";
import { extractAndMergeFactsFromMastra } from "@/lib/llm/extract-facts";
import { getSettings } from "@/lib/memory/settings";

/** Fire background fact extraction every N user turns. Never blocks the reply. */
export async function maybeExtractFacts(userId: string, threadId?: string): Promise<void> {
  const settings = await getSettings(userId);
  if (settings.memoryEnabled === false) {
    return;
  }
  const interval = Number.isFinite(settings.memoryCompactAt) && settings.memoryCompactAt > 0
    ? settings.memoryCompactAt
    : 10;
  const n = await turnCounter(userId);
  if (n % interval !== 0) return;
  extractAndMergeFactsFromMastra(userId, threadId).catch((err) =>
    console.warn("[facts] background extract failed", err),
  );
}
