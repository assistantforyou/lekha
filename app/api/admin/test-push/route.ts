import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { push, text as textMsg } from "@/lib/line/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const allowed = new Set([env().OAUTH_STATE_SECRET, env().CRON_MANUAL_SECRET].filter(Boolean));
  if (!allowed.has(bearer)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const userId = body && typeof body === "object" ? (body as Record<string, unknown>).userId : undefined;
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "missing userId" }, { status: 400 });
  }

  const ok = await push(userId, [textMsg("🔔 LINE push test — proactive briefings and check-ins use this channel.")]);
  console.warn("[admin] test-push", { userId, ok });
  return NextResponse.json({ ok, userId });
}
