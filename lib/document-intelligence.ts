import { generateText } from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/llm/provider";
import { redis } from "@/lib/memory/redis";
import { indexDocument } from "@/lib/memory/documents";

const STRUCTURED_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

const key = (userId: string, messageId: string) => `doc_structured:${userId}:${messageId}`;

export const StructuredDocSchema = z.object({
  title: z.string().optional().describe("Document title if clearly shown at the top"),
  items: z
    .array(z.record(z.string(), z.string()))
    .describe("Every row, record, product, or line item in the document as key-value pairs. Infer keys from headers/columns."),
});

export type StructuredDoc = z.infer<typeof StructuredDocSchema>;

function buildPrompt(hint?: string): string {
  const base = `Extract every structured row or item from this document as a single JSON object.
- Top-level field "title": the document title only if clearly visible.
- Top-level field "items": an array of objects, one per row/record/product/line item.
- Infer field names from the document's own headers/columns (preserve Thai or English names).
- Preserve prices, dimensions, model numbers, dates, and Thai text exactly as shown.
- If a value is missing, use an empty string.
Output ONLY raw JSON. No markdown, no code fences, no explanations.`;
  return hint ? `${base}\n- Focus on: ${hint}` : base;
}

function extractJsonBlock(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced && fenced[1]) return fenced[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) return text.slice(firstBrace, lastBrace + 1);
  return text.trim();
}

/**
 * Extract structured data from a PDF once, cache it for 30 days, and index the
 * rows for semantic search. Subsequent questions can use the cached JSON or
 * search_documents instead of resending the whole PDF.
 */
export async function extractStructuredDocument(
  userId: string,
  messageId: string,
  fileName: string,
  bytes: Uint8Array,
  hint?: string,
): Promise<StructuredDoc> {
  const cached = await getStructuredDocument(userId, messageId);
  if (cached) return cached;

  const r = await generateText({
    model: chatModel(),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: buildPrompt(hint) },
          { type: "file", data: bytes, mediaType: "application/pdf" },
        ],
      },
    ],
  });

  const text = r.text.trim();
  const jsonText = extractJsonBlock(text);
  let doc: StructuredDoc;
  let parseFailed = false;
  try {
    const parsed = JSON.parse(jsonText);
    doc = StructuredDocSchema.parse(parsed);
  } catch (err) {
    console.error("[doc-intel] structured parse failed", err, "raw:", text.slice(0, 500));
    // Graceful degradation: return empty result, but don't cache it for 30 days.
    // A transient model failure should be retryable on the next ask.
    parseFailed = true;
    doc = { items: [] };
  }

  if (!parseFailed) {
    await setStructuredDocument(userId, messageId, doc);
  } else {
    // Cache failures for only 1 hour so a bad model response isn't locked in.
    await redis().set(key(userId, messageId), JSON.stringify(doc), { ex: 60 * 60 });
  }

  // Index rows for semantic search so the user can ask about them later.
  const rowsText = doc.items
    .map((it, i) => `Row ${i + 1}:\n${Object.entries(it)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n")}`)
    .join("\n\n");
  if (rowsText.trim()) {
    const indexText = `${doc.title ?? fileName}\n\n${rowsText}`;
    indexDocument(userId, messageId, fileName, indexText, "document").catch((err) =>
      console.warn("[doc-intel] indexDocument failed", err),
    );
  }

  return doc;
}

export async function getStructuredDocument(userId: string, messageId: string): Promise<StructuredDoc | null> {
  const raw = await redis().get<string | StructuredDoc>(key(userId, messageId));
  if (!raw) return null;
  try {
    const parsed = typeof raw === "string" ? (JSON.parse(raw) as StructuredDoc) : raw;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setStructuredDocument(userId: string, messageId: string, doc: StructuredDoc): Promise<void> {
  await redis().set(key(userId, messageId), JSON.stringify(doc), { ex: STRUCTURED_TTL_SEC });
}
