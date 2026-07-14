import { redis } from "./redis";
import { embedText, getVectorIndex, isValidUserId } from "./embeddings";
import type { ParsedDocument, Table, Chart } from "@/lib/document-parser/types";

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;
/** Safety cap — raised to support longer parsed documents. */
const MAX_CHUNKS_PER_DOC = 100;
const MAX_DOCS_PER_USER = 100;
const DOC_CHUNKS_TTL_SEC = 60 * 60 * 24 * 365;

const docIndexKey = (userId: string) => `doc_index:${userId}`;
const docChunksKey = (userId: string, docId: string) => `doc_chunks:${userId}:${docId}`;
const parsedDocKey = (userId: string, docId: string) => `doc_parsed:${userId}:${docId}`;

export type DocumentMeta = {
  /** Stable id for the document — the LINE messageId it was uploaded as. */
  docId: string;
  fileName: string;
  ts: number;
  chunkCount: number;
};

/**
 * Splits text into overlapping chunks so a chunk boundary rarely cuts a fact in half.
 * @deprecated Prefer chunkDocument() for parsed documents.
 */
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

/** Render a table as a Markdown chunk. */
function tableToChunk(t: Table): string {
  const title = t.title ? `## ${t.title}\n` : "";
  const header = t.headers.length ? `| ${t.headers.join(" | ")} |` : "";
  const sep = t.headers.length ? `| ${t.headers.map(() => "---").join(" | ")} |` : "";
  const rows = t.rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`).join("\n");
  return `${title}${header}\n${sep}\n${rows}`.trim();
}

/** Render a chart as a textual chunk. */
function chartToChunk(c: Chart): string {
  const parts: string[] = [];
  if (c.title) parts.push(`## ${c.title}`);
  parts.push(`Chart type: ${c.type}`);
  if (c.xAxis?.label) parts.push(`X-axis: ${c.xAxis.label}`);
  if (c.xAxis?.categories) parts.push(`Categories: ${c.xAxis.categories.join(", ")}`);
  if (c.yAxis?.label) parts.push(`Y-axis: ${c.yAxis.label}`);
  for (const s of c.series) {
    parts.push(`Series "${s.name}": ${s.values.join(", ")}`);
  }
  if (c.note) parts.push(`Note: ${c.note}`);
  return parts.join("\n");
}

/** Sentence-aware chunking of page text. Never splits a table row. */
function chunkPageText(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (!text.trim()) return [];
  const sentences = text.match(/[^.!?。！？\n]+[.!?。！？\n]+|[^\n]+/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current.length + sentence.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      current = current.slice(-overlap);
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, MAX_CHUNKS_PER_DOC);
}

/**
 * Build semantic chunks from a parsed document.
 * Tables and charts become standalone chunks so they are retrieved whole.
 */
export function chunkDocument(doc: ParsedDocument, docId: string): { text: string; metadata: Record<string, unknown> }[] {
  const chunks: { text: string; metadata: Record<string, unknown> }[] = [];

  // Title + overview chunk.
  if (doc.title) {
    chunks.push({
      text: `Document: ${doc.title}\nFile: ${doc.fileName}\nPages: ${doc.pageCount}`,
      metadata: { docId, kind: "overview", pageStart: 1, pageEnd: doc.pageCount },
    });
  }

  // Section chunks.
  for (const section of doc.sections) {
    const sectionChunks = chunkPageText(section.text);
    for (let i = 0; i < sectionChunks.length; i++) {
      const prefix = i === 0 ? `Section: ${section.title}\n` : `Section: ${section.title} (continued)\n`;
      chunks.push({
        text: prefix + sectionChunks[i],
        metadata: { docId, kind: "section", section: section.title, pageStart: section.startPage, pageEnd: section.endPage },
      });
    }
  }

  // Table chunks — never split.
  for (const table of doc.tables) {
    chunks.push({
      text: tableToChunk(table),
      metadata: { docId, kind: "table", tableId: table.id, page: table.page },
    });
  }

  // Chart chunks — never split.
  for (const chart of doc.charts) {
    chunks.push({
      text: chartToChunk(chart),
      metadata: { docId, kind: "chart", chartId: chart.id, page: chart.page },
    });
  }

  return chunks.slice(0, MAX_CHUNKS_PER_DOC);
}

/**
 * Legacy text-only indexer. Keeps backward compatibility.
 * @deprecated Use indexParsedDocument for full document intelligence.
 */
export async function indexDocument(
  userId: string,
  docId: string,
  fileName: string,
  fullText: string,
  kind: "document" | "audio" = "document",
): Promise<void> {
  const chunks = chunkText(fullText);
  if (!chunks.length) return;
  await deleteDocument(userId, docId);
  await redis().set(docChunksKey(userId, docId), chunks, { ex: DOC_CHUNKS_TTL_SEC });
  await upsertChunks(userId, docId, fileName, chunks.map((text) => ({ text, metadata: { kind } })));
  await setMeta(userId, docId, fileName, chunks.length);
}

/**
 * Index a parsed document: store structured output in Redis and vector-index
 * page/section/table/chart chunks.
 */
export async function indexParsedDocument(
  userId: string,
  docId: string,
  fileName: string,
  doc: ParsedDocument,
): Promise<void> {
  const chunks = chunkDocument(doc, docId);
  if (!chunks.length) return;

  await deleteDocument(userId, docId);
  await redis().set(parsedDocKey(userId, docId), doc, { ex: DOC_CHUNKS_TTL_SEC });
  await redis().set(docChunksKey(userId, docId), chunks.map((c) => c.text), { ex: DOC_CHUNKS_TTL_SEC });
  await upsertChunks(userId, docId, fileName, chunks);
  await setMeta(userId, docId, fileName, chunks.length);
}

async function upsertChunks(
  userId: string,
  docId: string,
  fileName: string,
  chunks: { text: string; metadata: Record<string, unknown> }[],
): Promise<void> {
  const vec = getVectorIndex();
  if (!vec) return;

  const vectors: { id: string; vector: number[]; metadata: Record<string, unknown> }[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const { text, metadata } = chunks[i]!;
    const v = await embedText(text);
    if (!v) continue;
    vectors.push({
      id: `doc:${userId}:${docId}:${i}`,
      vector: v,
      metadata: { userId, docId, fileName, text, chunkIndex: i, ...metadata },
    });
  }
  if (vectors.length) {
    try {
      await vec.upsert(vectors);
    } catch (err) {
      console.warn("[documents] vector upsert failed", err);
    }
  }
}

async function setMeta(userId: string, docId: string, fileName: string, chunkCount: number): Promise<void> {
  const meta: DocumentMeta = { docId, fileName, ts: Date.now(), chunkCount };
  await redis().hset(docIndexKey(userId), { [docId]: JSON.stringify(meta) });

  const all = await listDocuments(userId);
  if (all.length > MAX_DOCS_PER_USER) {
    const excess = [...all].sort((a, b) => a.ts - b.ts).slice(0, all.length - MAX_DOCS_PER_USER);
    for (const d of excess) await deleteDocument(userId, d.docId);
  }
}

export async function getParsedDocument(userId: string, docId: string): Promise<ParsedDocument | null> {
  return redis().get<ParsedDocument>(parsedDocKey(userId, docId));
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
  await redis().del(docChunksKey(userId, docId));
  await redis().del(parsedDocKey(userId, docId));
}

export type DocChunkHit = {
  fileName: string;
  docId: string;
  text: string;
  chunkIndex: number;
  kind?: string;
  page?: number;
  section?: string;
};

/** Semantic search across a user's previously-indexed documents, optionally scoped to one docId. */
export async function searchDocuments(userId: string, query: string, docId?: string): Promise<DocChunkHit[]> {
  if (!isValidUserId(userId)) return [];

  const vec = getVectorIndex();
  const queryVector = vec ? await embedText(query) : undefined;
  if (vec && queryVector) {
    const filter = docId
      ? `userId = '${userId}' and docId = '${docId}'`
      : `userId = '${userId}'`;
    try {
      const hits = await vec.query({ vector: queryVector, topK: 12, includeMetadata: true, filter });
      const out: DocChunkHit[] = [];
      for (const h of hits ?? []) {
        const md = (h.metadata ?? {}) as {
          fileName?: string;
          docId?: string;
          text?: string;
          chunkIndex?: number;
          kind?: string;
          page?: number;
          section?: string;
        };
        if (md.docId && md.text) {
          out.push({
            fileName: md.fileName ?? "document",
            docId: md.docId,
            text: md.text,
            chunkIndex: md.chunkIndex ?? 0,
            kind: md.kind,
            page: md.page,
            section: md.section,
          });
        }
      }
      if (out.length) return out;
    } catch (err) {
      console.warn("[documents] vector query failed; falling back to substring", err);
    }
  }

  return searchDocumentsFallback(userId, query, docId);
}

async function searchDocumentsFallback(
  userId: string,
  query: string,
  docId?: string,
): Promise<DocChunkHit[]> {
  const docs = await listDocuments(userId);
  const target = docId ? docs.filter((d) => d.docId === docId) : docs;
  const q = query.toLowerCase();
  const out: DocChunkHit[] = [];
  for (const d of target) {
    const chunks = await redis().get<string[]>(docChunksKey(userId, d.docId));
    if (!chunks) continue;
    for (let i = 0; i < chunks.length; i++) {
      const text = chunks[i];
      if (text === undefined) continue;
      if (text.toLowerCase().includes(q)) {
        out.push({ fileName: d.fileName, docId: d.docId, text, chunkIndex: i });
        if (out.length >= 12) return out;
      }
    }
  }
  return out;
}
