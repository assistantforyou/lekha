import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { getSettings } from "@/lib/memory/settings";
import { loadFacts } from "@/lib/memory/facts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = env().DEV_CHAT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "DEV_CHAT_SECRET not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("x-dev-secret");
  if (!authHeader || authHeader !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const allowedUserId = process.env.DEV_LINE_USER_ID;
  if (allowedUserId && userId !== allowedUserId) {
    return NextResponse.json({ error: "userId not permitted" }, { status: 403 });
  }

  const [settings, facts] = await Promise.all([getSettings(userId), loadFacts(userId)]);
  return NextResponse.json({ userId, settings, factsCount: facts.facts.length });
}
