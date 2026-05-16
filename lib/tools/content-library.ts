import { z } from "zod";
import { tool, generateText } from "ai";
import { put, del } from "@vercel/blob";
import { extractorModel } from "@/lib/llm/provider";
import { listRecentMedia, type MediaKind } from "@/lib/memory/recent-media";
import { getMessageContent } from "@/lib/line/client";
import {
  appendStoredFile,
  listStoredFiles,
  getStoredFile,
  touchStoredFile,
  deleteStoredFile,
  scoreFile,
  type StoredFileKind,
} from "@/lib/memory/content-library";
import { env } from "@/lib/env";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function lineKindToStoredKind(kind: MediaKind): StoredFileKind {
  if (kind === "file") return "document";
  return kind;
}

function kindInstruction(kind: StoredFileKind): string {
  if (kind === "image") return "Describe this image in 2-3 sentences.";
  if (kind === "document") return "Summarize this document in 2-3 sentences. What is it about?";
  if (kind === "audio") return "Summarize this audio recording in 2-3 sentences.";
  return "Describe the contents of this media in 2-3 sentences.";
}

async function summarizeBytes(
  bytes: Uint8Array,
  mediaType: string,
  kind: StoredFileKind,
): Promise<{ summary: string; tags: string[] }> {
  const instruction = `${kindInstruction(kind)}

Then output ONLY this JSON on its own line (no other text after it):
{"summary":"...","tags":["tag1","tag2","tag3"]}

Tags should be 5-10 single-word or short-phrase keywords that describe the content.`;

  try {
    const r = await generateText({
      model: extractorModel(),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "file", data: bytes, mediaType },
          ],
        },
      ],
    });
    const text = r.text.trim();
    const jsonMatch = text.match(/\{.*"summary".*"tags".*\}/s);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { summary?: string; tags?: string[] };
      return {
        summary: parsed.summary?.slice(0, 300) ?? text.slice(0, 300),
        tags: (parsed.tags ?? []).slice(0, 10).map((t) => String(t).slice(0, 50)),
      };
    }
    return { summary: text.slice(0, 300), tags: [] };
  } catch {
    return { summary: "Unable to generate summary.", tags: [] };
  }
}

export function buildContentLibraryTools(userId: string) {
  return {
    store_content: tool({
      description:
        "Save one or more staged LINE files permanently to the user's content library. Generates an AI summary and tags automatically. Use when the user says 'save this', 'keep this', 'add to my library', or uploads an important document they'll want to reference later.",
      inputSchema: z.object({
        indexes: z
          .array(z.number().int().min(1))
          .optional()
          .describe("1-indexed positions of staged media to save. Omit to save all staged media."),
      }),
      execute: async ({ indexes }) => {
        let staged = await listRecentMedia(userId);
        if (!staged.length) {
          await new Promise((r) => setTimeout(r, 4000));
          staged = await listRecentMedia(userId);
        }
        if (!staged.length) {
          return { ok: false as const, error: "No staged LINE media. Send the file first." };
        }

        const items =
          indexes && indexes.length > 0
            ? indexes.map((i) => staged[i - 1]).filter(Boolean)
            : staged;

        if (!items.length) {
          return { ok: false as const, error: "No matching staged media at those indexes." };
        }

        const token = env().BLOB_READ_WRITE_TOKEN!;
        const saved: { fileName: string; kind: StoredFileKind; summary: string }[] = [];
        const errors: string[] = [];

        for (const item of items) {
          if (!item) continue;
          let bytes: Uint8Array;
          let mediaType: string;
          try {
            const fetched = await getMessageContent(item.messageId);
            bytes = fetched.bytes;
            mediaType = fetched.contentType;
          } catch (err) {
            errors.push(
              `Couldn't fetch file: ${err instanceof Error ? err.message : String(err)}`,
            );
            continue;
          }

          if (bytes.length > MAX_BYTES) {
            errors.push(`File too large (>${MAX_BYTES / 1024 / 1024}MB), skipped.`);
            continue;
          }

          const kind = lineKindToStoredKind(item.kind);
          const fileName =
            item.fileName ??
            `${item.kind}-${new Date(item.ts).toISOString().slice(0, 19).replace(/:/g, "-")}.${mediaType.split("/")[1] ?? "bin"}`;

          const { summary, tags } = await summarizeBytes(bytes, mediaType, kind);

          let blobUrl: string;
          try {
            const blob = await put(`lekha/${userId}/${crypto.randomUUID()}-${fileName}`, Buffer.from(bytes), {
              access: "public",
              token,
              contentType: mediaType,
            });
            blobUrl = blob.url;
          } catch (err) {
            errors.push(
              `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            continue;
          }

          await appendStoredFile(userId, {
            fileName,
            mimeType: mediaType,
            kind,
            sizeBytes: bytes.length,
            blobUrl,
            summary,
            tags,
          });

          saved.push({ fileName, kind, summary });
        }

        if (!saved.length) {
          return { ok: false as const, error: errors.join("; ") || "Nothing saved." };
        }

        return {
          ok: true as const,
          saved,
          ...(errors.length ? { warnings: errors } : {}),
        };
      },
    }),

    list_content_library: tool({
      description:
        "List files in the user's content library, ranked by relevance (recency × frequency of access). Returns summaries only — call read_stored_content to analyze a specific file in depth.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).default(20).optional(),
      }),
      execute: async ({ limit = 20 }) => {
        const files = await listStoredFiles(userId);
        if (!files.length) return { ok: true as const, files: [], total: 0 };
        const now = Date.now();
        const scored = files
          .map((f) => ({ ...f, score: scoreFile(f, now) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(({ blobUrl: _url, ...rest }) => rest);
        return { ok: true as const, files: scored, total: files.length };
      },
    }),

    search_content_library: tool({
      description:
        "Search the user's content library by keyword. Matches against file names, summaries, and tags. Returns scored results.",
      inputSchema: z.object({
        query: z.string().min(1).max(200),
      }),
      execute: async ({ query }) => {
        const files = await listStoredFiles(userId);
        const q = query.toLowerCase();
        const now = Date.now();
        const matched = files
          .filter(
            (f) =>
              f.fileName.toLowerCase().includes(q) ||
              f.summary.toLowerCase().includes(q) ||
              f.tags.some((t) => t.toLowerCase().includes(q)),
          )
          .map((f) => ({ ...f, score: scoreFile(f, now) }))
          .sort((a, b) => b.score - a.score)
          .map(({ blobUrl: _url, ...rest }) => rest);
        return { ok: true as const, results: matched, total: matched.length };
      },
    }),

    read_stored_content: tool({
      description:
        "Fetch and analyze a file from the content library in depth. Use when the user asks about a specific stored file's contents. Updates access statistics so relevant files surface higher in future lists.",
      inputSchema: z.object({
        fileId: z.string().min(1),
        instruction: z
          .string()
          .optional()
          .describe(
            "Custom analysis instruction. Omit for default: describe contents fully and extract all key information.",
          ),
      }),
      execute: async ({ fileId, instruction }) => {
        const file = await getStoredFile(userId, fileId);
        if (!file) return { ok: false as const, error: "File not found in library." };

        let bytes: Uint8Array;
        try {
          const res = await fetch(file.blobUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          bytes = new Uint8Array(await res.arrayBuffer());
        } catch (err) {
          return {
            ok: false as const,
            error: `Couldn't fetch stored file: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        const prompt =
          instruction ??
          "Analyze this file thoroughly. Extract all key information, important details, dates, names, numbers, and action items. Be comprehensive.";

        try {
          const r = await generateText({
            model: extractorModel(),
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: prompt },
                  { type: "file", data: bytes, mediaType: file.mimeType },
                ],
              },
            ],
          });
          const output = r.text.trim();
          await touchStoredFile(userId, fileId);
          return { ok: true as const, fileName: file.fileName, kind: file.kind, output };
        } catch (err) {
          return {
            ok: false as const,
            error: `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
    }),

    delete_stored_content: tool({
      description: "Remove a file from the content library by its fileId. Cannot be undone.",
      inputSchema: z.object({
        fileId: z.string().min(1),
      }),
      execute: async ({ fileId }) => {
        const file = await getStoredFile(userId, fileId);
        if (!file) return { ok: false as const, error: "File not found." };

        const token = env().BLOB_READ_WRITE_TOKEN!;
        try {
          await del(file.blobUrl, { token });
        } catch {
          // Non-fatal: continue to remove metadata even if blob delete fails
        }

        await deleteStoredFile(userId, fileId);
        return { ok: true as const, deleted: file.fileName };
      },
    }),
  };
}
