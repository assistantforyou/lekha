import { z } from "zod";
import { tool } from "ai";
import { getSettings } from "@/lib/memory/settings";
import { buildEveningSummary } from "@/lib/llm/evening-summary";

export function buildEveningSummaryTool(userId: string) {
  return {
    get_evening_summary: tool({
      description:
        "Generate and return the user's evening summary — tasks completed today, leftover open tasks, upcoming calendar events, and today's news with links. Call this whenever the user asks for their evening summary or wrap-up.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await getSettings(userId);
        const summary = await buildEveningSummary(userId, { timezone: s.timezone });
        return summary ?? "Nothing to show in your evening summary right now.";
      },
    }),
  };
}
