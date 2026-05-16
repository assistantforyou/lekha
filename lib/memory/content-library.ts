import { redis } from "./redis";
import crypto from "crypto";

const MAX_FILES = 500;

export type StoredFileKind = "image" | "document" | "audio" | "video";

export type StoredFile = {
  id: string;
  fileName: string;
  mimeType: string;
  kind: StoredFileKind;
  sizeBytes: number;
  blobUrl: string;
  summary: string;
  tags: string[];
  uploadedAt: number;
  lastAccessedAt: number;
  accessCount: number;
};

const key = (userId: string) => `content:${userId}:files`;

export function scoreFile(file: StoredFile, now: number): number {
  const daysSinceAccess = (now - file.lastAccessedAt) / 86_400_000;
  const recencyDecay = Math.max(0, 100 - daysSinceAccess * 1.5);
  const frequencyBonus = Math.min(file.accessCount * 5, 50);
  return recencyDecay + frequencyBonus;
}

export async function appendStoredFile(
  userId: string,
  partial: Omit<StoredFile, "id" | "uploadedAt" | "lastAccessedAt" | "accessCount">,
): Promise<StoredFile> {
  const file: StoredFile = {
    ...partial,
    id: crypto.randomUUID(),
    uploadedAt: Date.now(),
    lastAccessedAt: Date.now(),
    accessCount: 0,
  };
  const k = key(userId);
  const tx = redis().multi();
  tx.rpush(k, JSON.stringify(file));
  tx.ltrim(k, -MAX_FILES, -1);
  await tx.exec();
  return file;
}

export async function listStoredFiles(userId: string): Promise<StoredFile[]> {
  const raw = await redis().lrange<string | StoredFile>(key(userId), 0, -1);
  return raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as StoredFile) : r));
}

export async function getStoredFile(userId: string, fileId: string): Promise<StoredFile | null> {
  const all = await listStoredFiles(userId);
  return all.find((f) => f.id === fileId) ?? null;
}

/** Increment access count and update lastAccessedAt. Read-modify-write is safe
 *  here because each userId is a single-writer context. */
export async function touchStoredFile(userId: string, fileId: string): Promise<void> {
  const all = await listStoredFiles(userId);
  const idx = all.findIndex((f) => f.id === fileId);
  if (idx === -1) return;
  const file = all[idx]!;
  all[idx] = { ...file, accessCount: file.accessCount + 1, lastAccessedAt: Date.now() };
  const k = key(userId);
  await redis().del(k);
  if (all.length > 0) {
    const tx = redis().multi();
    for (const f of all) tx.rpush(k, JSON.stringify(f));
    tx.ltrim(k, -MAX_FILES, -1);
    await tx.exec();
  }
}

export async function deleteStoredFile(userId: string, fileId: string): Promise<boolean> {
  const all = await listStoredFiles(userId);
  const next = all.filter((f) => f.id !== fileId);
  if (next.length === all.length) return false;
  const k = key(userId);
  await redis().del(k);
  if (next.length > 0) {
    const tx = redis().multi();
    for (const f of next) tx.rpush(k, JSON.stringify(f));
    tx.ltrim(k, -MAX_FILES, -1);
    await tx.exec();
  }
  return true;
}

export async function getContentLibraryCount(userId: string): Promise<number> {
  return (await redis().llen(key(userId))) ?? 0;
}
