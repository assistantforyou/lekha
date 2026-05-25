import { reply, text as textMsg } from "@/lib/line/client";
import { env } from "@/lib/env";
import { appendTurn } from "@/lib/memory/history";
import { appendRecentMedia } from "@/lib/memory/recent-media";
import {
  guessMimeFromFilename,
  defaultMimeForKind,
  isArchive,
  isReadableDoc,
} from "@/lib/line/mime";

export async function respondToOtherMedia(
  replyToken: string,
  userId: string,
  messageId: string,
  kind: "video" | "audio" | "file",
  fileName: string | undefined,
  fileSize: number | undefined,
  durationMs: number | undefined,
): Promise<void> {
  // Best-effort content-type probe (HEAD-equivalent via tiny Range request).
  let contentType = guessMimeFromFilename(fileName) ?? defaultMimeForKind(kind);
  try {
    const head = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}`,
        Range: "bytes=0-0",
      },
    });
    const ct = head.headers.get("content-type");
    await head.body?.cancel().catch(() => {});
    if (ct) contentType = ct;
  } catch {
    // best effort
  }

  await appendRecentMedia(userId, {
    kind,
    messageId,
    contentType,
    fileName,
    sizeBytes: fileSize,
    durationMs,
    ts: Date.now(),
  });

  // Just ack + stage. Auto-summarizing here caused 3-minute hangs and duplicate
  // responses when the user immediately follows up.
  const ack = isArchive(contentType, fileName)
    ? `Got your zip file${fileName ? ` (${fileName})` : ""} — I can attach it to emails but I can't open or extract the contents.`
    : isReadableDoc(contentType, fileName)
    ? `Got your document${fileName ? ` (${fileName})` : ""} — what would you like to know about it?`
    : kind === "audio"
    ? `Got your voice memo — want me to transcribe or summarize it?`
    : `Got your ${kind}${fileName ? ` (${fileName})` : ""} — it's ready. What would you like to do with it?`;

  await reply(replyToken, [textMsg(ack)]);
  await appendTurn(userId, {
    role: "user",
    content: `[sent a ${kind}${fileName ? `: ${fileName}` : ""}]`,
    ts: Date.now(),
  });
  await appendTurn(userId, { role: "assistant", content: ack, ts: Date.now() });
}
