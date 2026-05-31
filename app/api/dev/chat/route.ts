import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { push, text as textMsg } from "@/lib/line/client";
import { env } from "@/lib/env";
import { appendTurn, loadHistory, turnCounter, historyForPrompt } from "@/lib/memory/history";
import { loadFacts } from "@/lib/memory/facts";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { extractAndMergeFacts } from "@/lib/llm/extract-facts";
import { runAgent } from "@/lib/llm/agent";
import { generateText } from "ai";
import { chatModel, extractorModel, GEMINI_PROVIDER_OPTIONS } from "@/lib/llm/provider";
import { buildSystemPrompt } from "@/lib/llm/prompts";
import { factsToPromptBlock } from "@/lib/memory/facts";
import { getSettings } from "@/lib/memory/settings";
import { appendRecentMedia, listRecentMedia } from "@/lib/memory/recent-media";
import type { ModelMessage } from "ai";
import { span } from "@/lib/timing";
import { classify, clearPending, getPending } from "@/lib/confirm";
import { executePendingAll } from "@/lib/pending-runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  text: z.string().min(1).max(4000),
  imageBase64: z.string().optional(),
  fileBase64: z.string().optional(),
  fileName: z.string().optional(),
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

  const { userId, text, imageBase64, fileBase64, fileName } = parsed.data;
  const traceId = `dev_${userId}_${Date.now().toString(36)}`;
  const endRequest = span("dev:chat", traceId);

  // ── IMAGE PATH ──────────────────────────────────────────────────────────
  if (imageBase64) {
    const endImage = span("dev:image", traceId);
    try {
      const bytes = Uint8Array.from(Buffer.from(imageBase64, "base64"));
      const endPreload = span("dev:preload", traceId);
      const [history, facts, settings] = await Promise.all([
        loadHistory(userId),
        loadFacts(userId),
        getSettings(userId),
      ]);
      endPreload({ historyTurns: history.length, facts: facts.facts.length });

      const messages: ModelMessage[] = [
        ...history.map<ModelMessage>((t) => ({ role: t.role, content: t.content })),
        {
          role: "user",
          content: [
            { type: "image" as const, image: bytes, mediaType: "image/png" },
            { type: "text", text: text || "What do you see?" },
          ],
        },
      ];

      const result = await generateText({
        model: chatModel(),
        system: buildSystemPrompt(factsToPromptBlock(facts), { displayName: "" }, settings),
        messages,
        maxRetries: 3,
        providerOptions: GEMINI_PROVIDER_OPTIONS,
      });
      const replyText = result.text?.trim() || "I couldn't read that image.";

      await appendTurn(userId, { role: "user", content: `[sent an image] ${text}`, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
      endImage({ replyLength: replyText.length });
      endRequest({ replyLength: replyText.length });
      return NextResponse.json({ reply: replyText, hints: { confirmDraft: false } });
    } catch (err) {
      endImage({ error: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ error: "Image processing failed", detail: String(err) }, { status: 500 });
    }
  }

  // ── FILE (PDF) PATH ─────────────────────────────────────────────────────
  if (fileBase64) {
    const endFile = span("dev:file", traceId);
    try {
      const bytes = Uint8Array.from(Buffer.from(fileBase64, "base64"));
      // Stage in Redis so summarize_document / read_document tools can find it
      await appendRecentMedia(userId, {
        kind: "file",
        messageId: `dev_${Date.now()}`,
        contentType: "application/pdf",
        fileName: fileName || "document.pdf",
        sizeBytes: bytes.byteLength,
        ts: Date.now(),
      });

      const endPreload = span("dev:preload", traceId);
      const [historyMsgs, facts, profile] = await Promise.all([
        historyForPrompt(userId),
        loadFacts(userId),
        getOrCreateProfile(userId),
      ]);
      endPreload({ historyTurns: historyMsgs.length, facts: facts.facts.length });

      // Stage in Redis so subsequent text messages in the same dev session can
      // reference it via summarize_document / read_document tools.
      await appendRecentMedia(userId, {
        kind: "file",
        messageId: `dev_${Date.now()}`,
        contentType: "application/pdf",
        fileName: fileName || "document.pdf",
        sizeBytes: bytes.byteLength,
        ts: Date.now(),
      });

      // Direct document read with extractorModel (dev chat bypasses LINE fetch).
      const result = await generateText({
        model: extractorModel(),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: text || "Summarize this document." },
              { type: "file", data: bytes, mediaType: "application/pdf" },
            ],
          },
        ],
      });
      const replyText = result.text?.trim() || "I couldn't read that document.";

      await appendTurn(userId, { role: "user", content: `[sent a file: ${fileName || "document.pdf"}] ${text}`, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
      endFile({ replyLength: replyText.length });
      endRequest({ replyLength: replyText.length });
      return NextResponse.json({ reply: replyText, hints: { confirmDraft: false } });
    } catch (err) {
      endFile({ error: err instanceof Error ? err.message : String(err) });
      return NextResponse.json({ error: "File processing failed", detail: String(err) }, { status: 500 });
    }
  }

  // ── TEXT PATH ───────────────────────────────────────────────────────────
  // Check pending actions first (same logic as production webhook).
  const pending = await getPending(userId);
  if (pending.length > 0) {
    const decision = classify(text);
    if (decision === "yes") {
      const result = await executePendingAll(userId, pending);
      await clearPending(userId);
      await appendTurn(userId, { role: "user", content: text, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: result, ts: Date.now() });
      push(userId, [textMsg(result)]).catch(() => {});
      endRequest({ replyLength: result.length, pendingExecuted: pending.length });
      return NextResponse.json({ reply: result, hints: { confirmDraft: false } });
    }
    if (decision === "no") {
      await clearPending(userId);
      const msg = `Cancelled ${pending.length === 1 ? "that" : `all ${pending.length}`}.`;
      await appendTurn(userId, { role: "user", content: text, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: msg, ts: Date.now() });
      push(userId, [textMsg(msg)]).catch(() => {});
      endRequest({ replyLength: msg.length, pendingCancelled: pending.length });
      return NextResponse.json({ reply: msg, hints: { confirmDraft: false } });
    }
    await clearPending(userId);
  }

  const endPreload = span("dev:preload", traceId);
  const [historyMsgs, facts, profile] = await Promise.all([
    historyForPrompt(userId),
    loadFacts(userId),
    getOrCreateProfile(userId),
  ]);
  endPreload({ historyTurns: historyMsgs.length, facts: facts.facts.length });

  const messages: ModelMessage[] = [
    ...historyMsgs,
    { role: "user", content: text },
  ];

  const { text: replyText, hints } = await runAgent(userId, profile, facts, messages, traceId);

  const endAppend = span("dev:appendTurns", traceId);
  await appendTurn(userId, { role: "user", content: text, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
  endAppend();

  push(userId, [textMsg(replyText)]).catch(() => {});

  const count = await turnCounter(userId);
  if (count % 10 === 0) {
    const freshHistory = await loadHistory(userId);
    extractAndMergeFacts(userId, freshHistory).catch(() => {});
  }

  endRequest({ replyLength: replyText.length });
  return NextResponse.json({ reply: replyText, hints });
}
