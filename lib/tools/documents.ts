import { z } from "zod";
import { tool } from "ai";
import { listDocuments, searchDocuments, deleteDocument } from "@/lib/memory/documents";

export function buildDocumentMemoryTools(userId: string) {
  return {
    list_documents: tool({
      description:
        "List documents/PDFs the assistant has previously read in full and can still recall — this persists long after the ~30 min staged-media window closes. Use when the user asks 'what documents do you remember' or references an older upload by name you don't recognize from the current conversation.",
      inputSchema: z.object({}),
      execute: async () => {
        const docs = await listDocuments(userId);
        return {
          ok: true as const,
          documents: docs.map((d) => ({
            fileName: d.fileName,
            date: new Date(d.ts).toISOString().slice(0, 10),
          })),
        };
      },
    }),

    search_documents: tool({
      description:
        "Search the full text of previously-uploaded documents by meaning — use this to answer a question about a PDF/document sent earlier (even days ago) WITHOUT needing the user to resend it or re-reading the whole file. Much cheaper than read_document for a document that's already been indexed. Pass fileName to scope the search to one specific document if the user names it.",
      inputSchema: z.object({
        query: z
          .string()
          .min(2)
          .max(300)
          .describe("What to look for — a question or topic, e.g. 'shareholder percentages' or 'termination clause'."),
        fileName: z.string().max(200).optional().describe("Restrict to a specific previously-uploaded file, if the user named it."),
      }),
      execute: async ({ query, fileName }) => {
        let docId: string | undefined;
        if (fileName) {
          const docs = await listDocuments(userId);
          const match = docs.find((d) => d.fileName.toLowerCase().includes(fileName.toLowerCase()));
          if (!match) {
            return {
              ok: false as const,
              error: `No remembered document matching "${fileName}". Use list_documents to see what's available.`,
            };
          }
          docId = match.docId;
        }
        const hits = await searchDocuments(userId, query, docId);
        if (!hits.length) {
          return { ok: true as const, results: [], message: "No matching content found in remembered documents." };
        }
        return {
          ok: true as const,
          results: hits.map((h) => ({ fileName: h.fileName, excerpt: h.text })),
        };
      },
    }),

    forget_document: tool({
      description: "Remove a previously-remembered document from long-term recall.",
      inputSchema: z.object({
        fileName: z.string().min(1).max(200).describe("Name of the document to forget, from list_documents."),
      }),
      execute: async ({ fileName }) => {
        const docs = await listDocuments(userId);
        const match = docs.find((d) => d.fileName.toLowerCase().includes(fileName.toLowerCase()));
        if (!match) return { ok: false as const, error: `No remembered document matching "${fileName}".` };
        await deleteDocument(userId, match.docId);
        return { ok: true as const, message: `Forgot "${match.fileName}".` };
      },
    }),
  };
}
