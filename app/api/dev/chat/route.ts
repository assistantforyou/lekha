import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { push, text as textMsg } from "@/lib/line/client";
import { env } from "@/lib/env";
import { appendTurn, loadHistory, turnCounter, historyForPrompt } from "@/lib/memory/history";
import { loadFacts } from "@/lib/memory/facts";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { extractAndMergeFacts } from "@/lib/llm/extract-facts";
import { runAgent } from "@/lib/llm/agent";
import { classifyIntent } from "@/lib/intent";
import type { Intent } from "@/lib/intent";
import { generateText } from "ai";
import { chatModel, extractorModel, GEMINI_PROVIDER_OPTIONS } from "@/lib/llm/provider";
import { toolsForUser } from "@/lib/tools";
import { listAccounts } from "@/lib/tools/google-auth";
import { buildSystemPrompt } from "@/lib/llm/prompts";
import { factsToPromptBlock } from "@/lib/memory/facts";
import { getSettings } from "@/lib/memory/settings";
import { appendRecentMedia, listRecentMedia } from "@/lib/memory/recent-media";
import type { ModelMessage } from "ai";
import { span } from "@/lib/timing";
import { classify, clearPending, getPending } from "@/lib/confirm";
import { executePendingAll } from "@/lib/pending-runner";
import { registerUser } from "@/lib/memory/user-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  userId: z.string().min(1),
  text: z.string().min(1).max(4000),
  imageBase64: z.string().optional(),
  imageMediaType: z.string().optional(),
  fileBase64: z.string().optional(),
  fileName: z.string().optional(),
});

function detectImageMediaType(base64: string): string {
  const header = base64.slice(0, 24);
  const bytes = Buffer.from(header, "base64");
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // WEBP: RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  // HEIC/HEIF: ftyp heic / ftyp mif1
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = bytes.slice(8, 12).toString("ascii").toLowerCase();
    if (brand === "heic" || brand === "heix" || brand === "mif1") return "image/heic";
  }
  return "image/png";
}

async function convertHeicToJpeg(base64: string): Promise<Uint8Array> {
  try {
    const input = Buffer.from(base64, "base64");
    const { default: convert } = await import("heic-convert");
    const output = await convert({ buffer: input, format: "JPEG", quality: 0.9 });
    return new Uint8Array(output);
  } catch {
    throw new Error("HEIC conversion failed. Please send the image as JPEG or PNG instead.");
  }
}

async function extractPptxText(base64: string): Promise<string> {
  try {
    const JSZip = (await import("jszip")).default;
    const data = Buffer.from(base64, "base64");
    const zip = await JSZip.loadAsync(data);
    const promises: Promise<{ name: string; texts: string[] }>[] = [];
    zip.forEach((name: string, file: { async: (type: "string") => Promise<string> }) => {
      if (name.startsWith("ppt/slides/slide") && name.endsWith(".xml")) {
        promises.push(
          file.async("string").then((txt) => {
            const matches = txt.match(/<a:t>([^<]*)<\/a:t>/g);
            const texts = matches ? matches.map((m) => m.replace(/<\/?a:t>/g, "")).filter((t) => t.trim()) : [];
            return { name, texts };
          }),
        );
      }
    });
    const results = await Promise.all(promises);
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results.map((s) => s.texts.join("\n")).filter(Boolean).join("\n\n---SLIDE---\n\n");
  } catch (err) {
    throw new Error(`Could not extract text from PPTX: ${err instanceof Error ? err.message : String(err)}`);
  }
}

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

  const { userId, text, imageBase64, imageMediaType, fileBase64, fileName } = parsed.data;
  registerUser(userId).catch(() => {});
  const traceId = `dev_${userId}_${Date.now().toString(36)}`;
  const endRequest = span("dev:chat", traceId);

  // ── IMAGE PATH ──────────────────────────────────────────────────────────
  if (imageBase64) {
    const endImage = span("dev:image", traceId);
    try {
      const bytes = Uint8Array.from(Buffer.from(imageBase64, "base64"));
      const endPreload = span("dev:preload", traceId);
      const [historyMsgs, facts, settings] = await Promise.all([
        historyForPrompt(userId),
        loadFacts(userId),
        getSettings(userId),
      ]);
      endPreload({ historyTurns: historyMsgs.length, facts: facts.facts.length });

      const mediaType = imageMediaType || detectImageMediaType(imageBase64);
      let imageBytes: Uint8Array = bytes;
      if (mediaType === "image/heic") {
        try {
          imageBytes = await convertHeicToJpeg(imageBase64);
        } catch (err) {
          endImage({ error: err instanceof Error ? err.message : String(err) });
          return NextResponse.json({ error: "HEIC not supported", detail: err instanceof Error ? err.message : String(err) }, { status: 400 });
        }
      }

      const messages: ModelMessage[] = [
        ...historyMsgs,
        {
          role: "user",
          content: [
            { type: "image" as const, image: imageBytes, mediaType: mediaType === "image/heic" ? "image/jpeg" : mediaType },
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

  // ── FILE (PDF / PPTX / DOCX) PATH ───────────────────────────────────────
  if (fileBase64) {
    const endFile = span("dev:file", traceId);
    try {
      const bytes = Uint8Array.from(Buffer.from(fileBase64, "base64"));
      const lowerName = (fileName || "document.pdf").toLowerCase();
      const isPptx = lowerName.endsWith(".pptx");
      const contentType = isPptx
        ? "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        : lowerName.endsWith(".docx")
          ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          : lowerName.endsWith(".xlsx")
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : "application/pdf";

      // Stage in Redis so summarize_document / read_document tools can find it
      await appendRecentMedia(userId, {
        kind: "file",
        messageId: `dev_${Date.now()}`,
        contentType,
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

      let resultText: string;
      if (isPptx) {
        // Gemini doesn't accept PPTX directly — extract text server-side.
        const extracted = await extractPptxText(fileBase64);
        const prompt = `${text || "Summarize this presentation."}\n\n--- Extracted slide text ---\n\n${extracted}`;
        const result = await generateText({
          model: extractorModel(),
          messages: [{ role: "user", content: prompt }],
        });
        resultText = result.text.trim();
      } else {
        const result = await generateText({
          model: extractorModel(),
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: text || "Summarize this document." },
                { type: "file", data: bytes, mediaType: contentType },
              ],
            },
          ],
        });
        resultText = result.text.trim();
      }
      const replyText = resultText || "I couldn't read that document.";

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
      const msgs: import("@/lib/line/client").LineMessage[] = [textMsg(result)];
      push(userId, msgs).catch(() => {});
      endRequest({ replyLength: result.length, pendingExecuted: pending.length });
      return NextResponse.json({ reply: result, hints: { confirmDraft: false } });
    }
    if (decision === "no") {
      await clearPending(userId);
      const msg = `Cancelled ${pending.length === 1 ? "that" : `all ${pending.length}`}.`;
      await appendTurn(userId, { role: "user", content: text, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: msg, ts: Date.now() });
      const msgs: import("@/lib/line/client").LineMessage[] = [textMsg(msg)];
      push(userId, msgs).catch(() => {});
      endRequest({ replyLength: msg.length, pendingCancelled: pending.length });
      return NextResponse.json({ reply: msg, hints: { confirmDraft: false } });
    }
    await clearPending(userId);
  }

  const endPreload = span("dev:preload", traceId);
  const [historyMsgs, facts, profile, settings] = await Promise.all([
    historyForPrompt(userId),
    loadFacts(userId),
    getOrCreateProfile(userId),
    getSettings(userId),
  ]);
  endPreload({ historyTurns: historyMsgs.length, facts: facts.facts.length });

  const messages: ModelMessage[] = [
    ...historyMsgs,
    { role: "user", content: text },
  ];

  const staged = await listRecentMedia(userId);
  const hasStagedMedia = staged.length > 0;
  const hasFile = staged.some((m) => m.kind === "file");
  const intentResult = await classifyIntent(text, { hasStagedMedia, hasFile });
  const accounts = await listAccounts(userId);
  const userHasGoogle = accounts.accounts.length > 0;
  const intent: Intent | undefined =
    intentResult.isMulti || intentResult.confidence === "low" ? undefined : intentResult.primary;
  const tools = await toolsForUser(userId, {
    userHasGoogle,
    disabledCategories: settings.disabledCategories,
    intent,
    hasStagedMedia,
  });
  const result = await runAgent(userId, profile, facts, messages, traceId, { tools, intent, hasStagedMedia });
  const replyText = result.text;
  const hints = result.hints;

  const endAppend = span("dev:appendTurns", traceId);
  await appendTurn(userId, { role: "user", content: text, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
  endAppend();

  const msgs: import("@/lib/line/client").LineMessage[] = [];
  if (replyText.trim()) msgs.push(textMsg(replyText));
  if (hints.flexMessages?.length) msgs.push(...hints.flexMessages);
  if (msgs.length) push(userId, msgs).catch(() => {});

  const count = await turnCounter(userId);
  if (count % 10 === 0) {
    const freshHistory = await loadHistory(userId);
    extractAndMergeFacts(userId, freshHistory).catch(() => {});
  }

  endRequest({ replyLength: replyText.length, toolCalls: result.toolCalls?.length ?? 0 });
  return NextResponse.json({ reply: replyText, hints, toolCalls: result.toolCalls ?? [] });
}
