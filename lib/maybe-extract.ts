import { loadHistory, turnCounter } from "@/lib/memory/history";
import { extractAndMergeFacts } from "@/lib/llm/extract-facts";
import { getSettings } from "@/lib/memory/settings";

/** Fire background fact extraction every 5 turns. Never blocks the reply. */
export async function maybeExtractFacts(userId: string): Promise<void> {
  const settings = await getSettings(userId);
  if (settings.memoryEnabled === false) {
    return;
  }
  const n = await turnCounter(userId);
  if (n % 5 !== 0) return;
  const history = await loadHistory(userId);
  extractAndMergeFacts(userId, history).catch((err) =>
    console.warn("[facts] background extract failed", err),
  );
}
