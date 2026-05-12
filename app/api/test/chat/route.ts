import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { loadFacts } from "@/lib/memory/facts";
import { appendTurn, loadHistory } from "@/lib/memory/history";
import { runAgent } from "@/lib/agent";
import type { ModelMessage } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  text: z.string().min(1),
});

/**
 * Developer-only chat test endpoint. Runs the full agent pipeline for any
 * userId without going through LINE.
 *
 * Auth: Authorization: Bearer <TEST_API_SECRET>
 * Body: { userId: string, text: string }
 * Response: { reply: string }
 *
 * Usage:
 *   curl -X POST https://<host>/api/test/chat \
 *     -H "Authorization: Bearer <TEST_API_SECRET>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"userId":"Uabc123","text":"hello"}'
 */
export async function POST(req: NextRequest) {
  const secret = env().TEST_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "TEST_API_SECRET not configured" }, { status: 403 });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "invalid body — expected { userId, text }" }, { status: 400 });
  }

  const { userId, text } = body;

  const [profile, history, facts] = await Promise.all([
    getOrCreateProfile(userId),
    loadHistory(userId),
    loadFacts(userId),
  ]);

  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: text },
  ];

  const reply = await runAgent(userId, profile, facts, messages);

  await appendTurn(userId, { role: "user", content: text, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: reply, ts: Date.now() });

  return NextResponse.json({ reply });
}
