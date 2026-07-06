import { redis } from "./redis";

const MAX_RECEIPTS = 200;

export type Receipt = {
  id: string;
  ts: number;
  merchant: string;
  date: string;
  total: number;
  currency: string;
  /** "food" | "transport" | "shopping" | "utilities" | "health" | "entertainment" | "other" */
  category: string;
  items: string[];
  notes?: string;
  /** LINE message ID the image came from — may expire but kept for reference. */
  imageMessageId?: string;
  /** Set when the original photo was uploaded to the user's Google Drive. */
  driveFileId?: string;
  /** Shareable Drive link for the saved photo — used for the "View photo" button. */
  driveLink?: string;
};

const key = (userId: string) => `receipts:${userId}`;

export async function appendReceipt(userId: string, receipt: Receipt): Promise<void> {
  const k = key(userId);
  await redis().rpush(k, JSON.stringify(receipt));
  await redis().ltrim(k, -MAX_RECEIPTS, -1);
}

export async function listReceipts(userId: string): Promise<Receipt[]> {
  const raw = await redis().lrange<string | Receipt>(key(userId), 0, -1);
  return raw
    .map((r) => (typeof r === "string" ? (JSON.parse(r) as Receipt) : r))
    .reverse(); // newest first
}

export async function deleteReceipt(userId: string, id: string): Promise<boolean> {
  const k = key(userId);
  const raw = await redis().lrange<string | Receipt>(k, 0, -1);
  const items = raw.map((r) => (typeof r === "string" ? r : JSON.stringify(r)));
  const before = items.length;
  const filtered = items.filter((r) => {
    try {
      return (JSON.parse(r) as Receipt).id !== id;
    } catch {
      return true;
    }
  });
  if (filtered.length === before) return false;
  await redis().del(k);
  if (filtered.length > 0) {
    await redis().rpush(k, ...filtered);
  }
  return true;
}

export async function searchReceipts(userId: string, query: string): Promise<Receipt[]> {
  const all = await listReceipts(userId);
  const q = query.toLowerCase();
  return all.filter(
    (r) =>
      r.merchant.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.date.includes(q) ||
      (r.notes ?? "").toLowerCase().includes(q) ||
      r.items.some((i) => i.toLowerCase().includes(q)),
  );
}
