import { NextResponse } from "next/server";
import { redis } from "@/lib/memory/redis";
import { env, hasQStash } from "@/lib/env";
import { chatModel, hasFreeKey, hasPaidKey } from "@/lib/llm/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; error?: string; ms?: number }> = {};

  // Redis
  const redisStart = Date.now();
  try {
    await redis().ping();
    checks.redis = { ok: true, ms: Date.now() - redisStart };
  } catch (e) {
    checks.redis = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // QStash
  if (hasQStash()) {
    const qstashStart = Date.now();
    try {
      const { Client } = await import("@upstash/qstash");
      const baseUrl = env().QSTASH_URL;
      const client = new Client({ token: env().QSTASH_TOKEN!, ...(baseUrl ? { baseUrl } : {}) });
      await client.schedules.list(); // lightweight check
      checks.qstash = { ok: true, ms: Date.now() - qstashStart };
    } catch (e) {
      checks.qstash = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    checks.qstash = { ok: true, error: "not configured" };
  }

  // Gemini API (config + instantiation check only — don't burn quota on health pings)
  const geminiStart = Date.now();
  try {
    if (!hasPaidKey() && !hasFreeKey()) {
      throw new Error("no Gemini API key configured");
    }
    chatModel(); // instantiation is local; no network call
    checks.gemini = { ok: true, ms: Date.now() - geminiStart };
  } catch (e) {
    checks.gemini = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const allOk = Object.values(checks).every((c) => c.ok);
  return NextResponse.json(
    { ok: allOk, checks, ts: Date.now() },
    { status: allOk ? 200 : 503 },
  );
}
