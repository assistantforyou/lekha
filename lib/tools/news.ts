import { z } from "zod";
import { tool } from "ai";
import { env } from "@/lib/env";
import { fetchCachedNewsSearch } from "@/lib/search-cache";

export function buildNewsTools() {
  return {
    news_search: tool({
      description:
        "Search recent news articles for a topic. ONLY call when the user explicitly asks for news/current events (e.g. 'latest news on X', 'top 10 news in finance', 'breaking news about Y'). NEVER call for greetings, casual chat, test messages, emoji requests, metaprompts, or complaints. Do NOT proactively offer news. Pass count when the user requests a specific number of results (e.g. 'top 10 news').",
      inputSchema: z.object({
        query: z.string().min(2).max(500),
        days: z.number().int().min(1).max(30).default(2).describe("How many days back to look. Default 2."),
        count: z.number().int().min(1).max(10).default(5).describe("Number of stories to return. Default 5. Pass up to 10 when user asks for more."),
      }),
      execute: async ({ query, days, count }) => {
        const apiKey = env().TAVILY_API_KEY;
        if (!apiKey) return { ok: false, error: "News search not configured (Tavily key missing)" };
        const t0 = Date.now();
        const data = await fetchCachedNewsSearch(query, apiKey, days, count);
        console.log("[news_search]", { query, ms: Date.now() - t0, stories: data.stories.length });
        return {
          ok: true,
          summary: data.summary,
          stories: data.stories,
        };
      },
    }),
  };
}
