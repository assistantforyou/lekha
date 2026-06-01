import { NextResponse } from "next/server";
import { redis } from "@/lib/memory/redis";
import { env, hasQStash } from "@/lib/env";
import { generateText } from "ai";
import { chatModel } from "@/lib/llm/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECK_TIMEOUT = 8000; // ms per check

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const timer = new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms));
  try {
    return await Promise.race([promise, timer]);
  } catch {
    return fallback;
  }
}

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string; ms?: number; detail?: string }> = {};

  // Redis
  const redisStart = Date.now();
  try {
    await withTimeout(redis().ping(), CHECK_TIMEOUT, undefined);
    checks.redis = { ok: true, ms: Date.now() - redisStart };
  } catch (e) {
    checks.redis = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // QStash
  if (hasQStash()) {
    const qstashStart = Date.now();
    try {
      const { Client } = await import("@upstash/qstash");
      const client = new Client({ token: env().QSTASH_TOKEN! });
      const schedules = await withTimeout(client.schedules.list(), CHECK_TIMEOUT, []);
      checks.qstash = {
        ok: true,
        ms: Date.now() - qstashStart,
        detail: `${schedules.length} schedule(s)`,
      };
    } catch (e) {
      checks.qstash = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    checks.qstash = { ok: true, error: "not configured" };
  }

  // Gemini API — lightweight ping with short timeout
  const geminiStart = Date.now();
  try {
    await withTimeout(
      generateText({
        model: chatModel(),
        messages: [{ role: "user", content: "ping" }],
      }),
      CHECK_TIMEOUT,
      undefined as unknown as Awaited<ReturnType<typeof generateText>>,
    );
    checks.gemini = { ok: true, ms: Date.now() - geminiStart };
  } catch (e) {
    checks.gemini = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Tavily — no public health endpoint; verify via lightweight search
  const tavilyStart = Date.now();
  try {
    const key = env().TAVILY_API_KEY;
    if (!key) throw new Error("not configured");
    const res = await withTimeout(
      fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key, query: "ping", max_results: 1 }),
      }),
      CHECK_TIMEOUT,
      new Response("timeout", { status: 504 }),
    );
    checks.tavily = { ok: res.ok, ms: Date.now() - tavilyStart, detail: res.ok ? "API reachable" : `HTTP ${res.status}` };
  } catch (e) {
    checks.tavily = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // LINE API
  const lineStart = Date.now();
  try {
    const res = await withTimeout(
      fetch("https://api.line.me/v2/bot/info", {
        headers: { Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}` },
      }),
      CHECK_TIMEOUT,
      new Response("timeout", { status: 504 }),
    );
    checks.line = {
      ok: res.ok,
      ms: Date.now() - lineStart,
      detail: res.ok ? "token valid" : `HTTP ${res.status}`,
    };
  } catch (e) {
    checks.line = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Upstash Vector
  const vectorStart = Date.now();
  try {
    const { Index } = await import("@upstash/vector");
    const index = new Index({
      url: env().UPSTASH_VECTOR_REST_URL!,
      token: env().UPSTASH_VECTOR_REST_TOKEN!,
    });
    const info = await withTimeout(index.info(), CHECK_TIMEOUT, { vectorCount: 0, pendingVectorCount: 0, indexSize: 0, dimension: 768, similarityFunction: "COSINE", namespaces: {} } as const);
    checks.vector = {
      ok: true,
      ms: Date.now() - vectorStart,
      detail: `${info.vectorCount} vectors`,
    };
  } catch (e) {
    checks.vector = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok: allOk, checks, ts: Date.now() },
    { status: allOk ? 200 : 503 },
  );
}
