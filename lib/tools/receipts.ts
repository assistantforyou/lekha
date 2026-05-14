import { z } from "zod";
import { tool } from "ai";
import { generateText } from "ai";
import { extractorModel } from "@/lib/llm/provider";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { getMessageContent } from "@/lib/line/client";
import {
  appendReceipt,
  listReceipts,
  searchReceipts,
  deleteReceipt,
  type Receipt,
} from "@/lib/memory/receipts";

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const EXTRACT_PROMPT = `You are analyzing a receipt image. Extract the following and respond with ONLY valid JSON — no prose, no markdown fences.

{
  "merchant": "store or restaurant name",
  "date": "date shown on receipt, YYYY-MM-DD format if possible, otherwise as written",
  "total": 0.00,
  "currency": "THB",
  "category": "one of: food, transport, shopping, utilities, health, entertainment, other",
  "items": ["item name and price as string", ...]
}

Rules:
- merchant: use the full store name from the receipt header
- total: the grand total amount (number, no commas or currency symbols)
- currency: infer from symbols or context (THB for ฿, USD for $, etc.)
- category: guess from the merchant type (7-Eleven → food, PTT → transport, etc.)
- items: up to 10 most notable line items, each as "Name 25.00". Empty array if illegible.
- If the image is not a receipt, return { "error": "not a receipt" }`;

export function buildReceiptTools(userId: string) {
  return {
    scan_receipt: tool({
      description:
        "Scan a receipt photo the user sent in LINE. Extracts merchant, date, total, items, and category, then saves it to the user's receipt history. Call this when the user sends a receipt image and wants to log or record it.",
      inputSchema: z.object({
        index: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("1-indexed staged position. Omit to use most recent image."),
        notes: z.string().max(200).optional().describe("Optional note to attach (e.g. 'client dinner', 'reimbursable')."),
      }),
      execute: async ({ index, notes }) => {
        const staged = await listRecentMedia(userId);
        if (!staged.length) {
          return { ok: false as const, error: "No staged media. Send the receipt photo first." };
        }
        const item = (() => {
          if (index !== undefined) {
            if (index < 1 || index > staged.length) return null;
            return staged[index - 1];
          }
          for (let i = staged.length - 1; i >= 0; i--) {
            if (staged[i]!.kind === "image") return staged[i];
          }
          return staged[staged.length - 1];
        })();
        if (!item) return { ok: false as const, error: "Index out of range" };

        let bytes: Uint8Array;
        let mediaType: string;
        try {
          const fetched = await getMessageContent(item.messageId);
          bytes = fetched.bytes;
          mediaType = fetched.contentType;
        } catch (err) {
          return {
            ok: false as const,
            error: `Couldn't fetch image from LINE: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        let extracted: Record<string, unknown>;
        try {
          const r = await generateText({
            model: extractorModel(),
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: EXTRACT_PROMPT },
                  { type: "file", data: bytes, mediaType },
                ],
              },
            ],
          });
          const text = r.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "");
          extracted = JSON.parse(text) as Record<string, unknown>;
        } catch (err) {
          return {
            ok: false as const,
            error: `Gemini extraction failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        if ("error" in extracted) {
          return { ok: false as const, error: String(extracted["error"]) };
        }

        const receipt: Receipt = {
          id: randomId(),
          ts: Date.now(),
          merchant: String(extracted["merchant"] ?? "Unknown"),
          date: String(extracted["date"] ?? new Date().toISOString().slice(0, 10)),
          total: Number(extracted["total"] ?? 0),
          currency: String(extracted["currency"] ?? "THB"),
          category: String(extracted["category"] ?? "other"),
          items: Array.isArray(extracted["items"])
            ? (extracted["items"] as unknown[]).map(String).slice(0, 10)
            : [],
          notes,
          imageMessageId: item.messageId,
        };

        await appendReceipt(userId, receipt);
        return { ok: true as const, receipt };
      },
    }),

    list_receipts: tool({
      description: "List the user's saved receipts, newest first.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional().describe("How many to show (default 10)."),
        category: z.string().optional().describe("Filter by category (food, transport, shopping, etc.)."),
      }),
      execute: async ({ limit = 10, category }) => {
        let receipts = await listReceipts(userId);
        if (category) {
          receipts = receipts.filter((r) => r.category.toLowerCase() === category.toLowerCase());
        }
        receipts = receipts.slice(0, limit);
        if (!receipts.length) return { ok: true as const, receipts: [], message: "No receipts saved yet." };
        const total = receipts.reduce((s, r) => s + r.total, 0);
        return { ok: true as const, receipts, shown: receipts.length, total };
      },
    }),

    search_receipts: tool({
      description: "Search saved receipts by merchant name, category, date, or notes.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Search term — merchant name, category, date fragment, or note keyword."),
      }),
      execute: async ({ query }) => {
        const receipts = await searchReceipts(userId, query);
        if (!receipts.length) return { ok: true as const, receipts: [], message: `No receipts matching "${query}".` };
        return { ok: true as const, receipts, count: receipts.length };
      },
    }),

    delete_receipt: tool({
      description: "Delete a saved receipt by its ID.",
      inputSchema: z.object({
        id: z.string().min(1).describe("Receipt ID from list_receipts or scan_receipt."),
      }),
      execute: async ({ id }) => {
        const deleted = await deleteReceipt(userId, id);
        return deleted
          ? { ok: true as const, message: "Receipt deleted." }
          : { ok: false as const, error: `No receipt found with id "${id}".` };
      },
    }),
  };
}
