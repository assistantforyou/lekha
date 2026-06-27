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
        "Save a durable fact about the user. Use proactively and aggressively — call this whenever the user shares preferences, relationships, routines, deadlines, context, health info, work details, or anything worth recalling later. They do NOT need to say 'remember that'. Provide a category — pick the best fit. Preserve the user's language — if they wrote in Thai, store the fact in Thai. Do not translate.",
      inputSchema: z.object({
        fact: z.string().min(3).max(1000),
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
      description: "Replace a stored fact by 1-indexed position OR by matching text. If match_text is provided, finds the first fact containing that text (case-insensitive) and updates it.",
      inputSchema: z.object({
        index: z.number().int().min(1).optional(),
        match_text: z.string().optional().describe("Text to search for in existing facts. Finds first match (case-insensitive)."),
        new_fact: z.string().min(3).max(1000),
      }),
      execute: async ({ index, match_text, new_fact }) => {
        let targetIndex = index;
        if (targetIndex === undefined && match_text) {
          const f = await loadFacts(userId);
          const ordered = displayOrder(f.facts);
          const lower = match_text.toLowerCase();
          targetIndex = ordered.findIndex((fact) => fact.content.toLowerCase().includes(lower)) + 1;
        }
        if (!targetIndex || targetIndex < 1) {
          return { ok: false, error: match_text ? `No memory matching "${match_text}".` : "Index or match_text required." };
        }
        const ok = await updateFact(userId, targetIndex, new_fact);
        return ok ? { ok: true } : { ok: false, error: "Index out of range" };
      },
    }),

    forget_memory: tool({
      description: "Delete a stored fact by 1-indexed position OR by matching text. If match_text is provided, finds the first fact containing that text (case-insensitive) and removes it.",
      inputSchema: z.object({
        index: z.number().int().min(1).optional(),
        match_text: z.string().optional().describe("Text to search for in existing facts. Finds first match (case-insensitive)."),
      }),
      execute: async ({ index, match_text }) => {
        let targetIndex = index;
        if (targetIndex === undefined && match_text) {
          const f = await loadFacts(userId);
          const ordered = displayOrder(f.facts);
          const lower = match_text.toLowerCase();
          targetIndex = ordered.findIndex((fact) => fact.content.toLowerCase().includes(lower)) + 1;
        }
        if (!targetIndex || targetIndex < 1) {
          return { ok: false, error: match_text ? `No memory matching "${match_text}".` : "Index or match_text required." };
        }
        const ok = await removeFact(userId, targetIndex);
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
      inputSchema: z.object({ query: z.string().min(2).max(500) }),
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
