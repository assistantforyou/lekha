import { z } from "zod";
import { tool, generateText } from "ai";
import { extractorModel, chatModel } from "@/lib/llm/provider";
import { listRecentMedia, touchRecentMedia } from "@/lib/memory/recent-media";
import { getMessageContent } from "@/lib/line/client";
import { env } from "@/lib/env";
import { fetchCachedWebSearch } from "@/lib/search-cache";
import { getDocContent, setDocContent } from "@/lib/memory/doc-cache";
import { indexDocument } from "@/lib/memory/documents";
import { appendFact } from "@/lib/memory/facts";
import { extractStructuredDocument } from "@/lib/document-intelligence";
import { createHash } from "crypto";

// Lazy-load heavy conversion/parser modules so cold starts without media don't pay.
let heicConvert: typeof import("heic-convert") | null = null;
async function getHeicConvert() {
  if (!heicConvert) heicConvert = await import("heic-convert");
  return heicConvert;
}

let pdfParse: typeof import("pdf-parse") | null = null;
async function getPdfParse() {
  if (!pdfParse) pdfParse = await import("pdf-parse");
  return pdfParse;
}

/**
 * Tools that use Gemini's multimodal capabilities on staged LINE files.
 * Each picks one staged item by 1-indexed position (default: most recent matching kind).
 */
export function buildMediaAiTools(userId: string) {
  return {
    ocr_image: tool({
      description:
        "Extract all readable text from an image the user sent in LINE (receipts, signs, screenshots, handwriting). Returns the verbatim text. Uses a fast model; for complex visual reasoning use summarize_image.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runMediaPrompt(userId, index, "image", "Read all text in this image and output it verbatim. Preserve line breaks. If there is no text, say 'No text detected.' If multiple columns or sections, separate them with blank lines.", { model: "extractor" }),
    }),

    summarize_image: tool({
      description:
        "Describe or interpret an image the user sent (people, scene, objects, charts, diagrams, UI screenshots, what they might want). Uses the strong vision model for complex reasoning.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runMediaPrompt(userId, index, "image", "Describe this image in 2-4 sentences. Note people, objects, setting, text, charts, and anything actionable.", { model: "chat" }),
    }),

    summarize_video: tool({
      description:
        "Describe or summarize a video the user sent in LINE. Note the main topic, key scenes, people, objects, spoken content, and any action items.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runMediaPrompt(userId, index, "video", "Watch this video and summarize what happens in 2-4 sentences. Capture the main topic, key scenes, people, objects, spoken content, and any action items.", { model: "chat" }),
    }),

    summarize_document: tool({
      description:
        "Summarize or answer a SPECIFIC question about a PDF or document the user sent (e.g. 'how many shares do I have per this doc', 'what's the deadline'). Pass `question` whenever the user asked something specific — omitting it only gives a generic summary, not an answer to their actual question. Uses the strong model for charts, tables, and dense documents.",
      inputSchema: z.object({
        index: z.number().int().min(1).optional(),
        question: z.string().max(500).optional().describe("The user's specific question about the document. Omit only for a generic 'summarize this' request."),
      }),
      execute: async ({ index, question }) =>
        runDocPrompt(
          userId,
          index,
          question
            ? `Answer this question about the document directly, using specific facts, figures, and quotes from it: "${question}". Start with the answer immediately — do not write "Here is the answer" or any meta-introduction. Avoid markdown (*, **, #, -, __, \`). If the document doesn't contain the answer, say so plainly.`
            : "Summarize this document directly and naturally. Start with the content immediately — do not write \"Here is a summary\", \"This document is about\", \"in X bullets\", or any meta-introduction. Cover the main purpose, key facts, dates, names, action items, and conclusion. Prefer short paragraphs. Only use • bullets if the document is a list or bullets make the answer significantly clearer. Avoid markdown (*, **, #, -, __, \`).",
          { model: "chat", skipCache: !!question },
        ),
    }),

    read_document: tool({
      description:
        "Extract full text from a PDF or document sent in LINE. Use for detail questions, specific clauses, or exact wording. Returns cached extraction if available. Falls back to server-side text extraction if Gemini rejects the file.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runDocPrompt(
          userId,
          index,
          "Extract the full text of this document. Preserve headings, section numbers, and paragraph breaks. Reproduce every table as a simple list — one row per source row, columns separated by ' | ', header row intact — do not paraphrase, merge, or drop cells. Do not use markdown (*, **, #, -, __). Do not summarize or skip anything. If the document is very long and you must truncate, say '--- truncated ---' at the end.",
          { maxChars: 8000, model: "chat" },
        ),
    }),

    extract_document_data: tool({
      description:
        "Extract structured data (tables, price lists, catalogs, forms) from a PDF or document as JSON. Use when the user asks about specific fields, prices, products, rows, or comparisons. Much more token-efficient than re-reading the whole file each time. The extracted data is cached and searchable.",
      inputSchema: z.object({
        index: z.number().int().min(1).optional(),
        hint: z
          .string()
          .max(300)
          .optional()
          .describe("Optional hint about what to extract, e.g. 'product catalog with price and dimensions'."),
      }),
      execute: async ({ index, hint }) => {
        const item = await resolveStagedItem(userId, index, "file");
        if (!item || "error" in item) return item ?? { ok: false as const, error: "No staged document." };

        touchRecentMedia(userId).catch(() => {});

        try {
          const fetched = await getMessageContent(item.messageId);
          const doc = await extractStructuredDocument(
            userId,
            item.messageId,
            item.fileName ?? "document",
            fetched.bytes,
            hint,
          );
          return {
            ok: true as const,
            title: doc.title,
            count: doc.items.length,
            items: doc.items,
          };
        } catch (err) {
          console.error("[media-ai] extract_document_data failed", err);
          return { ok: false as const, error: "Couldn't extract structured data from this document. Try read_document instead." };
        }
      },
    }),

    research_document_item: tool({
      description:
        "Research a product or item from a staged PDF/document against the web. Extracts the item's specs from the document, searches online for current prices/specs/reviews, and returns a comparison report. Use when the user asks to compare a PDF product to online listings, verify market prices, or 'what's online for X'.",
      inputSchema: z.object({
        index: z.number().int().min(1).optional(),
        item: z.string().min(1).max(100).describe("The product model, name, or keyword to look up from the document, e.g. 'KX-340GB'."),
        focus: z.enum(["price", "specs", "reviews", "all"]).default("all").describe("What to compare: price, specs, reviews, or everything."),
      }),
      execute: async ({ index, item, focus }) => {
        const stagedItem = await resolveStagedItem(userId, index, "file");
        if (!stagedItem || "error" in stagedItem) return stagedItem ?? { ok: false as const, error: "No staged document." };

        touchRecentMedia(userId).catch(() => {});

        try {
          const fetched = await getMessageContent(stagedItem.messageId);
          const doc = await extractStructuredDocument(
            userId,
            stagedItem.messageId,
            stagedItem.fileName ?? "document",
            fetched.bytes,
          );
          if (!doc.items.length) {
            return { ok: false as const, error: "Couldn't extract any structured data from this document." };
          }

          const needle = item.trim().toLowerCase();
          const matches = doc.items.filter((it) => Object.values(it).some((v) => v.toLowerCase().includes(needle)));
          if (!matches.length) {
            return { ok: false as const, error: `No item matching "${item}" found in the document.` };
          }
          const target = matches[0]!;

          const apiKey = env().TAVILY_API_KEY;
          if (!apiKey) {
            return { ok: false as const, error: "Web search is not configured." };
          }

          const queries = [
            `${target.model ?? item} ${target.name ?? ""} ${target.category ?? ""}`.trim(),
            `${target.model ?? item} ราคา สเปค`,
          ];
          const webResults: { query: string; answer: string | null; results: { title: string; url: string; snippet: string }[] }[] = [];
          for (const q of queries) {
            const r = await fetchCachedWebSearch(q, apiKey, 5);
            webResults.push({ query: q, answer: r.answer, results: r.results });
          }

          const report = await generateComparisonReport(target, focus, webResults);
          return { ok: true as const, item: target, report };
        } catch (err) {
          console.error("[media-ai] research_document_item failed", err);
          return { ok: false as const, error: "Couldn't research that item online. Try again later." };
        }
      },
    }),

    transcribe_audio: tool({
      description:
        "Transcribe speech from a voice message or audio file the user sent in LINE. Returns the verbatim transcript.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runMediaPrompt(userId, index, "audio", "Transcribe every word spoken in this audio. Output the verbatim transcript, preserving punctuation and speaker turns if there are multiple people. If inaudible, write '[inaudible]'. If no speech is detected, say 'No speech detected.'", { model: "extractor" }),
    }),

    summarize_audio: tool({
      description:
        "Summarize or answer questions about a voice message or audio file the user sent in LINE. Use this when the user asks 'what did they say?' or 'summarize this voice note'.",
      inputSchema: z.object({ index: z.number().int().min(1).optional() }),
      execute: async ({ index }) =>
        runMediaPrompt(userId, index, "audio", "Listen carefully and summarize what was said in 2-4 sentences. Capture the main topic, key points, and any action items or requests. If it's a question, state the question clearly.", { model: "chat" }),
    }),
  };
}

async function generateComparisonReport(
  item: Record<string, string>,
  focus: "price" | "specs" | "reviews" | "all",
  webResults: { query: string; answer: string | null; results: { title: string; url: string; snippet: string }[] }[],
): Promise<string> {
  const itemText = Object.entries(item)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const webText = webResults
    .map(
      (s) =>
        `Query: ${s.query}\nAnswer: ${s.answer ?? "n/a"}\n` +
        s.results.map((r) => `- ${r.title} (${r.url})\n  ${r.snippet}`).join("\n"),
    )
    .join("\n\n");

  const focusText =
    focus === "price"
      ? "Focus on price comparison: document dealer price vs online prices. Note whether online prices include VAT."
      : focus === "specs"
        ? "Focus on specs comparison: confirm dimensions, capacity, and features against online sources."
        : focus === "reviews"
          ? "Focus on reviews, ratings, and common pros/cons from online sources."
          : "Compare price, specs, and any reviews/mentions.";

  const r = await generateText({
    model: chatModel(),
    messages: [
      {
        role: "user",
        content: `You are writing a concise product comparison report for a LINE chat. Do not use markdown. Use short paragraphs and • bullets only if they improve clarity.\n\nDocument item:\n${itemText}\n\nOnline search results:\n${webText}\n\n${focusText}\n\nWrite a short report: (1) what the document says, (2) what online sources say, (3) key differences or confirmations, (4) source URLs. Keep it under 250 words. Reply in the same language as the document (Thai).`,
      },
    ],
  });
  return r.text.trim();
}

/**
 * Auto-process a standalone voice memo: transcribe, index the FULL verbatim transcript
 * for long-term search, and store a lightweight priority fact so the content is easy
 * to recall. We do NOT extract key facts or summaries here — the full transcript is
 * preserved and searchable via search_documents.
 */
export async function autoProcessAudio(
  userId: string,
  messageId: string,
  fileName?: string,
): Promise<{ transcript: string }> {
  const transcriptResult = await runMediaPromptById(
    userId,
    messageId,
    "audio",
    "Transcribe every word spoken in this audio. Output the verbatim transcript, preserving punctuation and speaker turns if there are multiple people. If inaudible, write '[inaudible]'. If no speech is detected, say 'No speech detected.'",
    { model: "extractor" },
  );
  const transcript =
    transcriptResult && typeof transcriptResult === "object" && "ok" in transcriptResult && transcriptResult.ok === true &&
    "output" in transcriptResult && typeof transcriptResult.output === "string"
      ? transcriptResult.output
      : "";

  // Store the full transcript as a searchable document so the user can ask about it later.
  if (transcript && transcript.length > 20 && transcript !== "No speech detected.") {
    const docName = fileName && fileName !== "undefined" ? fileName : `Voice memo ${new Date().toISOString().slice(0, 10)}`;
    indexDocument(userId, messageId, docName, transcript, "audio").catch((err) =>
      console.warn("[media-ai] index audio transcript failed", err),
    );
    // Lightweight priority fact so the model knows a voice memo exists.
    appendFact(userId, `Voice memo uploaded: ${docName}`, { category: "context", priority: 1 }).catch((err) =>
      console.warn("[media-ai] append audio fact failed", err),
    );
  }

  return { transcript };
}

const mediaResultCache = new Map<string, { output: string; ts: number }>();
const MEDIA_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

function cacheKey(userId: string, messageId: string, prompt: string): string {
  const promptHash = createHash("sha1").update(prompt).digest("hex").slice(0, 16);
  return `${userId}:${messageId}:${promptHash}`;
}

function getCached(userId: string, messageId: string, prompt: string): string | undefined {
  const k = cacheKey(userId, messageId, prompt);
  const cached = mediaResultCache.get(k);
  if (cached && Date.now() - cached.ts < MEDIA_CACHE_TTL_MS) return cached.output;
  mediaResultCache.delete(k);
  return undefined;
}

function setCached(userId: string, messageId: string, prompt: string, output: string) {
  mediaResultCache.set(cacheKey(userId, messageId, prompt), { output, ts: Date.now() });
}

/** Resolve staged item, refresh TTLs, then check cache before hitting LINE + Gemini. */
async function runDocPrompt(
  userId: string,
  index: number | undefined,
  instruction: string,
  opts: { maxChars?: number; model?: "chat" | "extractor"; skipCache?: boolean } = {},
) {
  const item = await resolveStagedItem(userId, index, "file");
  if (!item || "error" in item) return item ?? { ok: false as const, error: "No staged document." };

  // Refresh staged media TTL on every doc access.
  touchRecentMedia(userId).catch(() => {});

  // A specific question needs a live, targeted answer — the doc-cache holds one
  // canonical generic extraction per file, which would either miss the question
  // entirely (if built for a different ask) or get overwritten with an answer
  // too narrow to serve as "comprehensive extraction" for whatever's asked next.
  const cached = opts.skipCache ? null : await getDocContent(userId, item.messageId);
  if (cached) {
    const cachedOutput = opts.maxChars && cached.summary.length > opts.maxChars
      ? cached.summary.slice(0, opts.maxChars) + "\n--- truncated ---"
      : cached.summary;
    return { ok: true as const, kind: item.kind, mediaType: cached.mediaType ?? item.contentType, output: cachedOutput, cached: true };
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

  // HEIC images come through as files or images; convert to JPEG for Gemini.
  if (mediaType === "image/heic" || mediaType === "image/heif") {
    try {
      const conv = await getHeicConvert();
      bytes = await conv.default({ buffer: bytes, format: "JPEG" });
      mediaType = "image/jpeg";
    } catch (err) {
      console.warn("[media-ai] HEIC conversion failed", err);
      return { ok: false as const, error: "Couldn't convert this HEIC image. Try sending it as JPEG." };
    }
  }

  const model = opts.model === "chat" ? chatModel() : extractorModel();
  try {
    const r = await generateText({
      model,
      messages: [{ role: "user", content: [{ type: "text", text: instruction }, { type: "file", data: bytes, mediaType }] }],
    });
    const text = r.text.trim();
    const output = opts.maxChars && text.length > opts.maxChars ? text.slice(0, opts.maxChars) + "\n--- truncated ---" : text;
    // Cache so future generic questions are instant — but a targeted question's
    // answer isn't a "comprehensive extraction" and shouldn't overwrite that slot.
    if (!opts.skipCache) {
      setDocContent(userId, item.messageId, { summary: text, fileName: item.fileName, mediaType, ts: Date.now() }).catch(() => {});
      // Index the FULL untruncated text (not `output`, which may be capped for display)
      // for long-term recall — best-effort, doesn't block the reply.
      indexDocument(userId, item.messageId, item.fileName ?? "document", text, "document").catch((err) =>
        console.warn("[media-ai] indexDocument failed", err),
      );
      // Priority fact so uploaded documents are prominent in memory without
      // evicting general conversation facts (same prompt budget, sorted to top).
      const docFact = item.fileName ? `Uploaded document: ${item.fileName}` : "Uploaded document";
      appendFact(userId, docFact, { category: "context", priority: 1 }).catch((err) =>
        console.warn("[media-ai] append document fact failed", err),
      );
    }
    setCached(userId, item.messageId, instruction, output);
    return { ok: true as const, kind: item.kind, mediaType, output };
  } catch (err) {
    // If Gemini rejects a PDF, try server-side text extraction as a fallback.
    if (mediaType === "application/pdf") {
      const fallback = await tryPdfParse(bytes);
      if (fallback) {
        const output = opts.maxChars && fallback.length > opts.maxChars ? fallback.slice(0, opts.maxChars) + "\n--- truncated ---" : fallback;
        setDocContent(userId, item.messageId, { summary: fallback, fileName: item.fileName, mediaType, ts: Date.now() }).catch(() => {});
        if (!opts.skipCache) {
          indexDocument(userId, item.messageId, item.fileName ?? "document", fallback).catch((err) =>
            console.warn("[media-ai] indexDocument failed", err),
          );
        }
        setCached(userId, item.messageId, instruction, output);
        return { ok: true as const, kind: item.kind, mediaType, output, fallback: true };
      }
    }
    return docGeminiError(err, mediaType);
  }
}

/** Run a media prompt against a specific LINE messageId instead of resolving from the staged list. */
async function runMediaPromptById(
  userId: string,
  messageId: string,
  expectedKind: "audio" | "image" | "video" | "file",
  instruction: string,
  opts: { maxChars?: number; model?: "chat" | "extractor" } = {},
) {
  const cached = getCached(userId, messageId, instruction);
  if (cached) return { ok: true as const, kind: expectedKind, mediaType: "audio/m4a", output: cached, cached: true };

  let bytes: Uint8Array;
  let mediaType: string;
  try {
    const fetched = await getMessageContent(messageId);
    bytes = fetched.bytes;
    mediaType = normalizeMediaTypeFromBytes(fetched.bytes, fetched.contentType, undefined, expectedKind);
  } catch (err) {
    return { ok: false as const, error: `Couldn't fetch file from LINE: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (mediaType === "image/heic" || mediaType === "image/heif") {
    try {
      const conv = await getHeicConvert();
      bytes = await conv.default({ buffer: bytes, format: "JPEG" });
      mediaType = "image/jpeg";
    } catch (err) {
      console.warn("[media-ai] HEIC conversion failed", err);
      return { ok: false as const, error: "Couldn't convert this HEIC image. Try sending it as JPEG." };
    }
  }

  const model = opts.model === "chat" ? chatModel() : extractorModel();
  try {
    const r = await generateText({
      model,
      messages: [{ role: "user", content: [{ type: "text", text: instruction }, { type: "file", data: bytes, mediaType }] }],
    });
    const text = r.text.trim();
    const output = opts.maxChars && text.length > opts.maxChars ? text.slice(0, opts.maxChars) + "\n--- truncated ---" : text;
    setCached(userId, messageId, instruction, output);
    return { ok: true as const, kind: expectedKind, mediaType, output };
  } catch (err) {
    return docGeminiError(err, mediaType);
  }
}

async function runMediaPrompt(
  userId: string,
  index: number | undefined,
  expectedKind: "audio" | "image" | "video" | "file",
  instruction: string,
  opts: { maxChars?: number; model?: "chat" | "extractor" } = {},
) {
  const item = await resolveStagedItem(userId, index, expectedKind);
  if (!item || "error" in item) return item ?? { ok: false as const, error: "No staged media." };

  const cached = getCached(userId, item.messageId, instruction);
  if (cached) return { ok: true as const, kind: item.kind, mediaType: item.contentType, output: cached, cached: true };

  let bytes: Uint8Array;
  let mediaType: string;
  try {
    const fetched = await getMessageContent(item.messageId);
    bytes = fetched.bytes;
    mediaType = normalizeMediaTypeFromBytes(fetched.bytes, fetched.contentType, item.fileName, item.kind as "audio" | "image" | "video" | "file");
  } catch (err) {
    return { ok: false as const, error: `Couldn't fetch file from LINE: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Convert HEIC/HEIF images to JPEG for Gemini.
  if (mediaType === "image/heic" || mediaType === "image/heif") {
    try {
      const conv = await getHeicConvert();
      bytes = await conv.default({ buffer: bytes, format: "JPEG" });
      mediaType = "image/jpeg";
    } catch (err) {
      console.warn("[media-ai] HEIC conversion failed", err);
      return { ok: false as const, error: "Couldn't convert this HEIC image. Try sending it as JPEG." };
    }
  }

  const model = opts.model === "chat" ? chatModel() : extractorModel();
  try {
    const r = await generateText({
      model,
      messages: [{ role: "user", content: [{ type: "text", text: instruction }, { type: "file", data: bytes, mediaType }] }],
    });
    const text = r.text.trim();
    const output = opts.maxChars && text.length > opts.maxChars ? text.slice(0, opts.maxChars) + "\n--- truncated ---" : text;
    setCached(userId, item.messageId, instruction, output);
    return { ok: true as const, kind: item.kind, mediaType, output };
  } catch (err) {
    return docGeminiError(err, mediaType);
  }
}

async function tryPdfParse(bytes: Uint8Array): Promise<string | null> {
  try {
    const parse = await getPdfParse();
    const data = await (parse as unknown as (buf: Buffer) => Promise<{ text?: string }>)(Buffer.from(bytes));
    return data.text?.trim() || null;
  } catch (err) {
    console.warn("[media-ai] pdf-parse fallback failed", err);
    return null;
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
  // HEIC magic: ftypheic, ftypmif1 (HEIF)
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (brand === "heic" || brand === "heix" || brand === "mif1") return "image/heic";
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
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  if (kind === "audio") return "audio/m4a";
  if (kind === "image") return "image/jpeg";
  if (kind === "video") return "video/mp4";
  return upstream || "application/octet-stream";
}
