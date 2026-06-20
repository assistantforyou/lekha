import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { env } from "@/lib/env";
import { appendTurn } from "@/lib/memory/history";
import { appendRecentMedia } from "@/lib/memory/recent-media";
import {
  guessMimeFromFilename,
  defaultMimeForKind,
  isArchive,
  isReadableDoc,
} from "@/lib/line/mime";
import { prereadDoc } from "@/lib/llm/preread-doc";

export async function respondToOtherMedia(
  replyToken: string,
  userId: string,
  messageId: string,
  kind: "video" | "audio" | "file",
  fileName: string | undefined,
  fileSize: number | undefined,
  durationMs: number | undefined,
  mode: "normal" | "stage_only" = "normal",
): Promise<void> {
  // Stage immediately with guessed type so a concurrent text follow-up can find
  // this media without a race. The HEAD probe below refines the type but must
  // not block staging — it arrives too late if the user texts right away.
  const contentType = guessMimeFromFilename(fileName) ?? defaultMimeForKind(kind);
  await appendRecentMedia(userId, {
    kind,
    messageId,
    contentType,
    fileName,
    sizeBytes: fileSize,
    durationMs,
    ts: Date.now(),
  });

  // Best-effort content-type refinement — fire-and-forget, non-blocking.
  fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}`,
      Range: "bytes=0-0",
    },
  })
    .then(async (head) => {
      const ct = head.headers.get("content-type");
      await head.body?.cancel().catch(() => {});
      if (ct && ct !== contentType) {
        await appendRecentMedia(userId, {
          kind,
          messageId,
          contentType: ct,
          fileName,
          sizeBytes: fileSize,
          durationMs,
          ts: Date.now(),
        });
      }
    })
    .catch(() => {});

  const isDoc = isReadableDoc(contentType, fileName);

  // For readable docs: kick off background pre-read so the first question answers instantly.
  if (isDoc) {
    prereadDoc(userId, messageId, fileName, env().LINE_CHANNEL_ACCESS_TOKEN).catch(() => {});
  }

  // stage_only: media+text arrived in same batch — text handler runs the agent.
  if (mode === "stage_only") return;

  const ack = isArchive(contentType, fileName)
    ? `Got your zip file${fileName ? ` (${fileName})` : ""} — I can attach it to emails but I can't open or extract the contents.`
    : isDoc
    ? `Got your document${fileName ? ` (${fileName})` : ""} — reading it now. What would you like to know?`
    : kind === "audio"
    ? `Got your voice memo — want me to transcribe or summarize it?`
    : `Got your ${kind}${fileName ? ` (${fileName})` : ""} — it's ready. What would you like to do with it?`;

  await replyOrPush(userId, replyToken, [textMsg(ack)]);
  await appendTurn(userId, {
    role: "user",
    content: `[sent a ${kind}${fileName ? `: ${fileName}` : ""}]`,
    ts: Date.now(),
  });
  await appendTurn(userId, { role: "assistant", content: ack, ts: Date.now() });
}
