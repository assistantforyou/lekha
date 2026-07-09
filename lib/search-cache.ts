import { redis } from "@/lib/memory/redis";

const WEB_CACHE_TTL_SECS = 30 * 60;
const NEWS_CACHE_TTL_SECS = 10 * 60;

function cacheKey(prefix: string, query: string, sig?: string): string {
  const raw = sig ? `${query}:${sig}` : query;
  const hash = Buffer.from(raw).toString("base64url").slice(0, 40);
  return `search:shared:${prefix}:${hash}`;
}

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchResponse = {
  answer: string | null;
  results: WebSearchResult[];
};

export async function fetchCachedWebSearch(
  query: string,
  apiKey: string,
  count: number,
): Promise<WebSearchResponse> {
  const key = cacheKey("web", query);
  const cached = await redis().get<WebSearchResponse>(key);
  if (cached && "results" in cached) return cached;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: count,
        include_answer: "advanced",
        search_depth: "advanced",
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) return { answer: null, results: [] };
    const data = (await r.json()) as { answer?: string; results?: Array<{ title: string; url: string; content: string }> };
    const result: WebSearchResponse = {
      answer: data.answer ?? null,
      results: (data.results ?? []).map((res) => ({
        title: res.title,
        url: res.url,
        snippet: res.content.slice(0, 400),
      })),
    };
    await redis().set(key, result, { ex: WEB_CACHE_TTL_SECS });
    return result;
  } catch {
    return { answer: null, results: [] };
  } finally {
    clearTimeout(t);
  }
}

export type NewsStory = {
  title: string;
  url: string;
  snippet: string;
  published: string | null;
};

export type NewsSearchResponse = {
  summary: string | null;
  stories: NewsStory[];
};

export async function fetchCachedNewsSearch(
  query: string,
  apiKey: string,
  days: number,
  count: number,
): Promise<NewsSearchResponse> {
  const key = cacheKey("news", query, `d${days}`);
  const cached = await redis().get<NewsSearchResponse>(key);
  if (cached && "stories" in cached) return cached;

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: count,
        include_answer: "advanced",
        search_depth: "advanced",
        topic: "news",
        days,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) return { summary: null, stories: [] };
    const data = (await r.json()) as {
      answer?: string;
      results?: Array<{ title: string; url: string; content: string; published_date?: string }>;
    };
    const result: NewsSearchResponse = {
      summary: data.answer ?? null,
      stories: (data.results ?? []).map((s) => ({
        title: s.title,
        url: s.url,
        snippet: s.content.slice(0, 300),
        published: s.published_date ?? null,
      })),
    };
    await redis().set(key, result, { ex: NEWS_CACHE_TTL_SECS });
    return result;
  } catch {
    return { summary: null, stories: [] };
  } finally {
    clearTimeout(t);
  }
}
