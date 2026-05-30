import { z } from "zod";
import { tool } from "ai";
import { getSettings } from "@/lib/memory/settings";
import { buildMorningBriefing } from "@/lib/llm/briefing";

export function buildMorningBriefingTool(userId: string) {
  return {
    get_morning_briefing: tool({
      description:
        "Generate and return the user's morning briefing — tasks, upcoming calendar events, news headlines with links, and unread inbox summary. Call this whenever the user asks for their morning briefing or daily summary.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await getSettings(userId);
        const briefing = await buildMorningBriefing(userId, {
          timezone: s.timezone,
          location: s.location,
          includeInbox: s.inboxBriefingEnabled,
          briefingTopics: s.briefingTopics,
        });
        // Return structured data so buildFlexFromToolResults can render Flex carousels.
        // The model receives this as a JSON object — it should just say "here's your briefing".
        return {
          ok: true,
          briefingType: "morning" as const,
          text: briefing.text,
          news: briefing.news,
          inbox: briefing.inbox ?? [],
        };
      },
    }),
  };
}
