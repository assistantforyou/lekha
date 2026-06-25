import { z } from "zod";
import { tool } from "ai";
import { generateText } from "ai";
import { extractorModel } from "@/lib/llm/provider";
import { listRecentMedia, touchRecentMedia } from "@/lib/memory/recent-media";
import { getMessageContent } from "@/lib/line/client";
import { getDocContent, setDocContent } from "@/lib/memory/doc-cache";

/**
 * Tools that use Gemini's multimodal capabilities on staged LINE files.
 * Each picks one staged item by 1-indexed position (default: most recent matching kind).
 */
export function buildMediaAiTools(userId: string) {
  return {
    ocr_image: tool({
      description:
        "Extract all readable text from an image the user sent in LINE (receipts, signs, screenshots, handwriting). Returns the verbatim text.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runMediaPrompt(userId, index, "image", "Read all text in this image and output it verbatim. Preserve line breaks. If there is no text, say 'No text detected.' If multiple columns or sections, separate them with blank lines."),
    }),

    summarize_image: tool({
      description:
        "Describe what's in an image the user sent (people, scene, objects, what they might want).",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runMediaPrompt(userId, index, "image", "Describe this image in 2-4 sentences. Note people, objects, setting, and anything actionable."),
    }),

    summarize_document: tool({
      description:
        "Summarize or answer questions about a PDF or document the user sent. Returns a pre-read extraction if available (instant), otherwise reads the file live.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runDocPrompt(userId, index, "Summarize this document in 4-8 bullets. Highlight: purpose, key facts, dates, names, action items, conclusion."),
    }),

    read_document: tool({
      description:
        "Extract full text from a PDF or document sent in LINE. Use for detail questions, specific clauses, or exact wording. Returns cached extraction if available.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runDocPrompt(
          userId,
          index,
          "Extract the full text of this document. Preserve headings, section numbers, and paragraph breaks. Do not summarize or skip anything. If the document is very long and you must truncate, say '--- truncated ---' at the end.",
          8000,
        ),
    }),

    transcribe_audio: tool({
      description:
        "Transcribe speech from a voice message or audio file the user sent in LINE. Returns the verbatim transcript.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runMediaPrompt(userId, index, "audio", "Transcribe every word spoken in this audio. Output the verbatim transcript, preserving punctuation and speaker turns if there are multiple people. If inaudible, write '[inaudible]'. If no speech is detected, say 'No speech detected.'"),
    }),

    summarize_audio: tool({
      description:
        "Summarize or answer questions about a voice message or audio file the user sent in LINE. Use this when the user asks 'what did they say?' or 'summarize this voice note'.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runMediaPrompt(userId, index, "audio", "Listen carefully and summarize what was said in 2-4 sentences. Capture the main topic, key points, and any action items or requests. If it's a question, state the question clearly."),
    }),
  };
}

/** Resolve staged item, refresh TTLs, then check cache before hitting LINE + Gemini. */
async function runDocPrompt(
  userId: string,
  index: number | undefined,
  instruction: string,
  maxChars?: number,
) {
  const item = await resolveStagedItem(userId, index, "file");
  if (!item || "error" in item) return item ?? { ok: false as const, error: "No staged document." };

  // Refresh staged media TTL on every doc access.
  touchRecentMedia(userId).catch(() => {});

  // Cache hit — instant answer.
  const cached = await getDocContent(userId, item.messageId);
  if (cached) {
    const output = maxChars && cached.summary.length > maxChars
      ? cached.summary.slice(0, maxChars) + "\n--- truncated ---"
      : cached.summary;
    return { ok: true as const, kind: item.kind, mediaType: cached.mediaType ?? item.contentType, output, cached: true };
  }

  // Cache miss — fetch from LINE, read with Gemini, cache for next time.
  let bytes: Uint8Array;
  let mediaType: string;
  try {
    const fetched = await getMessageContent(item.messageId);
    bytes = fetched.bytes;
    mediaType = normalizeMediaTypeFromBytes(fetched.bytes, fetched.contentType, item.fileName, item.kind as "audio" | "image" | "video" | "file");
  } catch (err) {
    return { ok: false as const, error: `Couldn't fetch file from LINE: ${err instanceof Error ? err.message : String(err)}` };
  }

  try {
    const r = await generateText({
      model: extractorModel(),
      messages: [{ role: "user", content: [{ type: "text", text: instruction }, { type: "file", data: bytes, mediaType }] }],
    });
    const text = r.text.trim();
    const output = maxChars && text.length > maxChars ? text.slice(0, maxChars) + "\n--- truncated ---" : text;
    // Cache so future questions are instant.
    setDocContent(userId, item.messageId, { summary: text, fileName: item.fileName, mediaType, ts: Date.now() }).catch(() => {});
    return { ok: true as const, kind: item.kind, mediaType, output };
  } catch (err) {
    return docGeminiError(err, mediaType);
  }
}

async function runMediaPrompt(
  userId: string,
  index: number | undefined,
  expectedKind: "audio" | "image" | "video" | "file",
  instruction: string,
  maxChars?: number,
) {
  const item = await resolveStagedItem(userId, index, expectedKind);
  if (!item || "error" in item) return item ?? { ok: false as const, error: "No staged media." };

  let bytes: Uint8Array;
  let mediaType: string;
  try {
    const fetched = await getMessageContent(item.messageId);
    bytes = fetched.bytes;
    mediaType = normalizeMediaTypeFromBytes(fetched.bytes, fetched.contentType, item.fileName, item.kind as "audio" | "image" | "video" | "file");
  } catch (err) {
    return { ok: false as const, error: `Couldn't fetch file from LINE: ${err instanceof Error ? err.message : String(err)}` };
  }

  try {
    const r = await generateText({
      model: extractorModel(),
      messages: [{ role: "user", content: [{ type: "text", text: instruction }, { type: "file", data: bytes, mediaType }] }],
    });
    const text = r.text.trim();
    const output = maxChars && text.length > maxChars ? text.slice(0, maxChars) + "\n--- truncated ---" : text;
    return { ok: true as const, kind: item.kind, mediaType, output };
  } catch (err) {
    return docGeminiError(err, mediaType);
  }
}

async function resolveStagedItem(
  userId: string,
  index: number | undefined,
  expectedKind: "audio" | "image" | "video" | "file",
): Promise<{ messageId: string; kind: string; contentType: string; fileName?: string } | { error: string } | null> {
  let staged = await listRecentMedia(userId);
  // Retry once — file and text webhooks can arrive near-simultaneously.
  if (!staged.length) {
    await new Promise((r) => setTimeout(r, 2000));
    staged = await listRecentMedia(userId);
  }
  if (!staged.length) return { error: "No staged LINE media. Send the file first." };

  if (index !== undefined) {
    if (index < 1 || index > staged.length) return { error: "Index out of range" };
    return staged[index - 1] ?? null;
  }
  for (let i = staged.length - 1; i >= 0; i--) {
    if (staged[i]!.kind === expectedKind) return staged[i]!;
  }
  return staged[staged.length - 1] ?? null;
}

function docGeminiError(err: unknown, mediaType: string) {
  const raw = err instanceof Error ? err.message : String(err);
  if (/too large|payload|413/i.test(raw))
    return { ok: false as const, error: "That file is too large for me to process in one go. Try splitting it or sending key pages as images." };
  if (/unsupported|invalid.*mime|invalid.*media/i.test(raw))
    return { ok: false as const, error: `Gemini doesn't accept this file type (${mediaType}). Try exporting it as PDF and resending.` };
  return { ok: false as const, error: `Couldn't read that file: ${raw.slice(0, 200)}` };
}

/** Exported for use in preread-doc.ts */
export function normalizeMediaTypeFromBytes(
  bytes: Uint8Array,
  upstream: string,
  fileName: string | undefined,
  kind: "audio" | "image" | "video" | "file",
): string {
  // PDF magic: %PDF-
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf";
  }
  if (upstream && !/^application\/octet-stream$/i.test(upstream)) return upstream;
  const lower = (fileName ?? "").toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (kind === "audio") return "audio/m4a";
  if (kind === "image") return "image/jpeg";
  if (kind === "video") return "video/mp4";
  return upstream || "application/octet-stream";
}
