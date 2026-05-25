/**
 * Mime helpers for LINE media. Keeps file-format trivia out of the webhook.
 */

export function guessMimeFromFilename(name: string | undefined): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".pptx"))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return null;
}

export function defaultMimeForKind(kind: "video" | "audio" | "file"): string {
  if (kind === "video") return "video/mp4";
  if (kind === "audio") return "audio/m4a";
  return "application/octet-stream";
}

const ARCHIVE_EXT = /\.(zip|gz|tar)$/i;
const READABLE_DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|rtf)$/i;

export function isArchive(contentType: string, fileName?: string): boolean {
  if (contentType === "application/zip") return true;
  return !!fileName && ARCHIVE_EXT.test(fileName);
}

export function isReadableDoc(contentType: string, fileName?: string): boolean {
  if (isArchive(contentType, fileName)) return false;
  if (contentType === "application/pdf") return true;
  if (contentType.startsWith("text/")) return true;
  return !!fileName && READABLE_DOC_EXT.test(fileName);
}
