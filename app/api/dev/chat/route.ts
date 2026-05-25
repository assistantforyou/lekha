import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { push, text as textMsg } from "@/lib/line/client";
import { env } from "@/lib/env";
import { appendTurn, loadHistory, turnCounter, historyForPrompt } from "@/lib/memory/history";
import { loadFacts } from "@/lib/memory/facts";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { extractAndMergeFacts } from "@/lib/llm/extract-facts";
import { runAgent } from "@/lib/llm/agent";
import type { ModelMessage } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  text: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest) {
  const secret = env().DEV_CHAT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "DEV_CHAT_SECRET not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("x-dev-secret");
  if (!authHeader || authHeader !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues }, { status: 400 });
  }

  const { userId, text } = parsed.data;

  const [historyMsgs, facts, profile] = await Promise.all([
    historyForPrompt(userId),
    loadFacts(userId),
    getOrCreateProfile(userId),
  ]);

  const messages: ModelMessage[] = [
    ...historyMsgs,
    { role: "user", content: text },
  ];

  const { text: replyText } = await runAgent(userId, profile, facts, messages);

  await appendTurn(userId, { role: "user", content: text, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });

  // Push to LINE so the user sees it too.
  push(userId, [textMsg(replyText)]).catch(() => {});

  // Fact extraction every 10 turns (same cadence as webhook).
  const count = await turnCounter(userId);
  if (count % 10 === 0) {
    const freshHistory = await loadHistory(userId);
    extractAndMergeFacts(userId, freshHistory).catch(() => {});
  }

  return NextResponse.json({ reply: replyText });
}
