import { z } from "zod";
import { tool } from "ai";
import { env } from "@/lib/env";
import { fetchCachedWebSearch } from "@/lib/search-cache";

export function buildWebSearchTool() {
  return {
    web_search: tool({
      description:
        "Search the web for fresh, factual information. Use for research, background context, or explanatory questions where your training data may be stale. Prefer news_search for current events, crypto_price/stock_price for finance, and weather for forecasts — but web_search is always acceptable as a fallback if those tools fail or when the query is ambiguous. Pass count when the user requests a specific number of results (e.g. 'top 10').",
      inputSchema: z.object({
        query: z.string().min(2).max(200),
        count: z.number().int().min(1).max(10).default(5).describe("Number of results to return. Default 5. Pass up to 10 when user asks for more."),
      }),
      execute: async ({ query, count }) => {
        const apiKey = env().TAVILY_API_KEY;
        if (!apiKey) return { ok: false, error: "Web search not configured" };
        const t0 = Date.now();
        const data = await fetchCachedWebSearch(query, apiKey, count);
        console.log("[web_search] tavily", { query, ms: Date.now() - t0, results: data.results.length });
        if (!data.results.length && !data.answer) {
          return { ok: false, error: "Search completed but no results were found." };
        }
        return {
          ok: true,
          answer: data.answer,
          results: data.results,
        };
      },
    }),
  };
}
