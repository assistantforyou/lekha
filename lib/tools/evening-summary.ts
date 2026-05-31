import { z } from "zod";
import { tool } from "ai";
import { getSettings } from "@/lib/memory/settings";
import { buildEveningSummary } from "@/lib/llm/evening-summary";

export function buildEveningSummaryTool(userId: string) {
  return {
    get_evening_summary: tool({
      description:
        "Generate the user's evening summary. ONLY call this when the user EXPLICITLY says 'evening summary', 'wrap-up', or similar. NEVER call this proactively, for greetings, or for casual chat.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await getSettings(userId);
        const summary = await buildEveningSummary(userId, { timezone: s.timezone });
        if (!summary) return { ok: true, briefingType: "evening" as const, empty: true };
        return {
          ok: true,
          briefingType: "evening" as const,
          text: summary.text,
          news: summary.news,
        };
      },
    }),
  };
}
