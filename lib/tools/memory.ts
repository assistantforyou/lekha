import { z } from "zod";
import { tool } from "ai";
import {
  appendFact,
  loadFacts,
  updateFact,
  removeFact,
  clearFacts,
  displayOrder,
  formatFactLine,
  FACT_CATEGORIES,
  type FactCategory,
} from "@/lib/memory/facts";
import { searchArchive, listArchive } from "@/lib/memory/archive";

export function buildMemoryTools(userId: string) {
  return {
    remember: tool({
      description:
        "Save a durable fact about the user that you should recall in future conversations. Use when the user explicitly says 'remember that I…', or when they share something clearly worth retaining (preferences, important relationships, recurring events). Provide a category — pick the best fit.",
      inputSchema: z.object({
        fact: z.string().min(3).max(240),
        category: z
          .enum(FACT_CATEGORIES as [FactCategory, ...FactCategory[]])
          .optional()
          .describe("preferences | people | habits | deadlines | context | health | work | other"),
      }),
      execute: async ({ fact, category }) => {
        await appendFact(userId, fact, { category });
        return { ok: true };
      },
    }),

    list_memories: tool({
      description: "List the durable facts you currently remember about the user. 1-indexed, newest-updated first, grouped by category.",
      inputSchema: z.object({}),
      execute: async () => {
        const f = await loadFacts(userId);
        const ordered = displayOrder(f.facts);
        const now = Date.now();
        return {
          facts: ordered.map((fact, i) => ({
            index: i + 1,
            category: fact.category,
            text: fact.content,
            updatedAt: fact.updatedAt,
            display: formatFactLine(fact, i + 1, now),
          })),
        };
      },
    }),

    update_memory: tool({
      description: "Replace a stored fact at a 1-indexed position (display order — same as list_memories).",
      inputSchema: z.object({
        index: z.number().int().min(1),
        new_fact: z.string().min(3).max(240),
      }),
      execute: async ({ index, new_fact }) => {
        const ok = await updateFact(userId, index, new_fact);
        return ok ? { ok: true } : { ok: false, error: "Index out of range" };
      },
    }),

    forget_memory: tool({
      description: "Delete a stored fact at a 1-indexed position (display order).",
      inputSchema: z.object({ index: z.number().int().min(1) }),
      execute: async ({ index }) => {
        const ok = await removeFact(userId, index);
        return ok ? { ok: true } : { ok: false, error: "Index out of range" };
      },
    }),

    clear_all_memories: tool({
      description:
        "Wipe all stored facts about the user. Destructive — only use when the user explicitly asks for a clean slate.",
      inputSchema: z.object({}),
      execute: async () => ({ cleared: await clearFacts(userId) }),
    }),

    search_archived_memory: tool({
      description:
        "Search older conversations beyond the rolling 20-message history. Returns archived chunk summaries (semantic search when Upstash Vector is configured, otherwise substring match). Use when the user references something from days/weeks ago.",
      inputSchema: z.object({ query: z.string().min(2).max(200) }),
      execute: async ({ query }) => {
        const hits = await searchArchive(userId, query);
        return { results: hits };
      },
    }),

    list_archived_memory: tool({
      description: "List all archived conversation summaries (chronological).",
      inputSchema: z.object({}),
      execute: async () => ({ chunks: await listArchive(userId) }),
    }),
  };
}
