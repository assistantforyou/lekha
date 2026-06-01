import { z } from "zod";
import { tool } from "ai";
import { getSettings } from "@/lib/memory/settings";
import { buildMorningBriefing } from "@/lib/llm/briefing";

export function buildMorningBriefingTool(userId: string) {
  return {
    get_morning_briefing: tool({
      description:
        "Generate the user's morning briefing. ONLY call this when the user EXPLICITLY says 'morning briefing', 'daily briefing', 'daily summary', or similar. NEVER call this proactively, for greetings, or for casual chat.",
      inputSchema: z.object({}),
      execute: async () => {
        const s = await getSettings(userId);
        const briefing = await buildMorningBriefing(userId, {
          timezone: s.timezone,
          location: s.location,
          includeInbox: s.inboxBriefingEnabled,
          briefingTopics: s.briefingTopics,
          briefingTopicSources: s.briefingTopicSources,
          briefingLength: s.briefingLength,
          briefingLanguage: s.briefingLanguage,
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
