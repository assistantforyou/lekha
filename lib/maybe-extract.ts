import { loadHistory, turnCounter } from "@/lib/memory/history";
import { extractAndMergeFacts } from "@/lib/llm/extract-facts";

/** Fire background fact extraction every 10 turns. Never blocks the reply. */
export async function maybeExtractFacts(userId: string): Promise<void> {
  const n = await turnCounter(userId);
  if (n % 10 !== 0) return;
  const history = await loadHistory(userId);
  extractAndMergeFacts(userId, history).catch((err) =>
    console.warn("[facts] background extract failed", err),
  );
}
