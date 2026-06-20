import { redis } from "./redis";

const TTL_SEC = 2 * 60 * 60; // 2 hours, refreshed on every access

export type DocContent = {
  summary: string;   // comprehensive extraction — answers most questions
  fileName?: string;
  mediaType?: string;
  ts: number;
};

const key = (userId: string, messageId: string) => `doc_cache:${userId}:${messageId}`;

export async function getDocContent(userId: string, messageId: string): Promise<DocContent | null> {
  const k = key(userId, messageId);
  const raw = await redis().get<string | DocContent>(k);
  if (!raw) return null;
  const doc: DocContent = typeof raw === "string" ? JSON.parse(raw) : raw;
  await redis().expire(k, TTL_SEC); // refresh TTL on every read
  return doc;
}

export async function setDocContent(
  userId: string,
  messageId: string,
  content: DocContent,
): Promise<void> {
  await redis().set(key(userId, messageId), JSON.stringify(content), { ex: TTL_SEC });
}
