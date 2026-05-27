import { NextResponse } from "next/server";
import { redis } from "@/lib/memory/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await redis().ping();
  } catch {
    return NextResponse.json({ ok: false, error: "redis unreachable" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ts: Date.now() });
}
