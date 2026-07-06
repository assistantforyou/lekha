import { redis } from "./redis";
import { embedText, getVectorIndex, isValidUserId } from "./embeddings";

/**
 * Long-term recall for uploaded documents (PDFs, docs, etc.) — separate from
 * doc-cache.ts's 2h raw-text cache. Chunks + embeds the full extracted text
 * once, so a question about a file uploaded days ago can be answered by
 * searching a handful of relevant chunks instead of re-sending the whole
 * document (which costs tokens every time and stops working once the LINE
 * staged-media window expires).
 */

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;
/** Safety cap — ~70k chars of source text indexed per document. */
const MAX_CHUNKS_PER_DOC = 40;
const MAX_DOCS_PER_USER = 100;

const docIndexKey = (userId: string) => `doc_index:${userId}`;

export type DocumentMeta = {
  /** Stable id for the document — the LINE messageId it was uploaded as. */
  docId: string;
  fileName: string;
  ts: number;
  chunkCount: number;
};

/** Splits text into overlapping chunks so a chunk boundary rarely cuts a fact in half. */
export function chunkText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length && chunks.length < MAX_CHUNKS_PER_DOC) {
    const end = Math.min(start + chunkSize, clean.length);
    chunks.push(clean.slice(start, end));
    if (end >= clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

/**
 * Chunk, embed, and upsert a document's full text for later recall. Best-effort —
 * if Upstash Vector isn't configured or embedding fails, the document simply
 * won't be searchable later (the caller's immediate read/summary still works
 * fine; this only affects long-term recall).
 */
export async function indexDocument(
  userId: string,
  docId: string,
  fileName: string,
  fullText: string,
): Promise<void> {
  const vec = getVectorIndex();
  if (!vec) return;
  const chunks = chunkText(fullText);
  if (!chunks.length) return;

  // Re-indexing (e.g. re-read after truncation the first time) replaces, not appends.
  await deleteDocument(userId, docId);

  const vectors: { id: string; vector: number[]; metadata: Record<string, unknown> }[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const v = await embedText(chunks[i]!);
    if (!v) continue;
    vectors.push({
      id: `doc:${userId}:${docId}:${i}`,
      vector: v,
      metadata: { userId, docId, fileName, chunkIndex: i, text: chunks[i], kind: "document", ts: Date.now() },
    });
  }
  if (!vectors.length) return;

  try {
    await vec.upsert(vectors);
  } catch (err) {
    console.warn("[documents] vector upsert failed", err);
    return;
  }

  const meta: DocumentMeta = { docId, fileName, ts: Date.now(), chunkCount: vectors.length };
  await redis().hset(docIndexKey(userId), { [docId]: JSON.stringify(meta) });

  // Cap tracked documents — drop the oldest if this pushed us over the limit.
  const all = await listDocuments(userId);
  if (all.length > MAX_DOCS_PER_USER) {
    const excess = [...all].sort((a, b) => a.ts - b.ts).slice(0, all.length - MAX_DOCS_PER_USER);
    for (const d of excess) await deleteDocument(userId, d.docId);
  }
}

export async function listDocuments(userId: string): Promise<DocumentMeta[]> {
  const raw = await redis().hgetall<Record<string, string>>(docIndexKey(userId));
  if (!raw) return [];
  return Object.values(raw)
    .map((v) => (typeof v === "string" ? (JSON.parse(v) as DocumentMeta) : (v as unknown as DocumentMeta)))
    .sort((a, b) => b.ts - a.ts);
}

export async function deleteDocument(userId: string, docId: string): Promise<void> {
  const vec = getVectorIndex();
  if (vec) {
    try {
      await vec.delete({ prefix: `doc:${userId}:${docId}:` });
    } catch (err) {
      console.warn("[documents] vector delete failed", err);
    }
  }
  await redis().hdel(docIndexKey(userId), docId);
}

export type DocChunkHit = { fileName: string; docId: string; text: string; chunkIndex: number };

/** Semantic search across a user's previously-indexed documents, optionally scoped to one docId. */
export async function searchDocuments(userId: string, query: string, docId?: string): Promise<DocChunkHit[]> {
  const vec = getVectorIndex();
  if (!vec || !isValidUserId(userId)) return [];
  const qv = await embedText(query);
  if (!qv) return [];
  const filter = docId
    ? `userId = '${userId}' and kind = 'document' and docId = '${docId}'`
    : `userId = '${userId}' and kind = 'document'`;
  try {
    const hits = await vec.query({ vector: qv, topK: 8, includeMetadata: true, filter });
    const out: DocChunkHit[] = [];
    for (const h of hits ?? []) {
      const md = (h.metadata ?? {}) as { fileName?: string; docId?: string; text?: string; chunkIndex?: number };
      if (md.docId && md.text) {
        out.push({ fileName: md.fileName ?? "document", docId: md.docId, text: md.text, chunkIndex: md.chunkIndex ?? 0 });
      }
    }
    return out;
  } catch (err) {
    console.warn("[documents] vector query failed", err);
    return [];
  }
}
