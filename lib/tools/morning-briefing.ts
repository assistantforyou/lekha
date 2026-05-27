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
        });
        if (!briefing) return "Nothing to show in your briefing right now.";
        const parts: string[] = [briefing.text];
        if (briefing.news.length > 0) {
          parts.push(
            "News:\n" +
              briefing.news.map((n) => `[${n.source}] ${n.title} — ${n.url}`).join("\n"),
          );
        }
        if (briefing.inbox && briefing.inbox.length > 0) {
          parts.push(
            `Inbox (${briefing.inbox.length} unread):\n` +
              briefing.inbox
                .map((m) => `• ${m.subject} — ${m.from}`)
                .join("\n"),
          );
        }
        return parts.join("\n\n");
      },
    }),
  };
}
