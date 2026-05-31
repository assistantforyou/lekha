import { redis } from "@/lib/memory/redis";

export type NewsStory = { title: string; url: string };

const CACHE_TTL_SECS = 30 * 60;

/**
 * Fetch news from Tavily, caching the result in Redis for 30 minutes.
 * All users with the same query + domains share a single cached result per sweep window,
 * so N users getting morning briefings = 1 Tavily call instead of N.
 */
export async function fetchCachedNews(
  query: string,
  apiKey: string,
  includeDomains?: string[],
): Promise<NewsStory[]> {
  const domainSig = includeDomains?.length ? `:${includeDomains.sort().join(",")}` : "";
  const key = `news:shared:${Buffer.from(query + domainSig).toString("base64url").slice(0, 40)}`;
  const cached = await redis().get<NewsStory[]>(key);
  if (cached && Array.isArray(cached)) return cached;

  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    max_results: 4,
    search_depth: "basic",
    topic: "news",
    days: 1,
  };
  if (includeDomains && includeDomains.length > 0) {
    body.include_domains = includeDomains;
  }

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!r.ok) return [];
    const data = (await r.json()) as { results?: Array<{ title: string; url: string }> };
    const results = (data.results ?? []).map((s) => ({ title: s.title, url: s.url }));
    await redis().set(key, results, { ex: CACHE_TTL_SECS });
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(t);
  }
}
