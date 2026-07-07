import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { env } from "@/lib/env";
import { appendTurn } from "@/lib/memory/history";
import { appendRecentMedia, listRecentMedia } from "@/lib/memory/recent-media";
import { autoProcessAudio } from "@/lib/tools/media-ai";
import { maybeExtractFacts } from "@/lib/maybe-extract";
import { getSettings } from "@/lib/memory/settings";
import { t } from "@/lib/i18n";

/** Items staged within this window count as "sent together" for ack wording. */
const BATCH_WINDOW_MS = 10_000;
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

  // Audio: auto-transcribe and save the full transcript for later recall. When
  // batched with text, the text handler leads the reply and we just transcribe in
  // the background; when standalone, we send a brief ack.
  if (kind === "audio") {
    const settings = await getSettings(userId);
    if (mode === "stage_only") {
      autoProcessAudio(userId, messageId, fileName).catch((err) =>
        console.warn("[other-media] background audio transcription failed", err),
      );
    } else {
      try {
        const { transcript } = await autoProcessAudio(userId, messageId, fileName);
        const durationHint = durationMs && durationMs > 0 ? ` (${Math.round(durationMs / 1000)}s)` : "";
        const reply =
          transcript && transcript !== "No speech detected."
            ? t(settings.language, "voiceMemoAck", { duration: durationHint })
            : t(settings.language, "voiceMemoNoSpeech", { duration: durationHint });
        await replyOrPush(userId, replyToken, [textMsg(reply)]);
        await appendTurn(userId, {
          role: "user",
          content: transcript && transcript !== "No speech detected."
            ? `[sent a voice memo, transcribed and saved]`
            : "[sent a voice memo, no speech detected]",
          ts: Date.now(),
        });
        await appendTurn(userId, { role: "assistant", content: reply, ts: Date.now() });
        maybeExtractFacts(userId).catch(() => {});
        return;
      } catch (err) {
        console.warn("[other-media] auto audio processing failed", err);
        // Fall through to the generic ack below.
      }
    }
  }

  // stage_only: media+text arrived in same batch — text handler runs the agent.
  if (mode === "stage_only") return;

  const settings = await getSettings(userId);
  const lang = settings.language;
  const staged = await listRecentMedia(userId);
  const batchCount = staged.filter((m) => Date.now() - m.ts < BATCH_WINDOW_MS).length;
  let ack: string;
  if (batchCount > 1) {
    ack = t(lang, "docsAck", { count: String(batchCount) });
  } else if (isArchive(contentType, fileName)) {
    ack = t(lang, "zipAck", { name: fileName ?? "" });
  } else if (isDoc) {
    ack = t(lang, "docAck", { name: fileName ?? "" });
  } else if (kind === "audio") {
    ack = t(lang, "audioAck");
  } else {
    ack = t(lang, "genericMediaAck", { kind, name: fileName ?? "" });
  }

  await replyOrPush(userId, replyToken, [textMsg(ack)]);
  await appendTurn(userId, {
    role: "user",
    content: `[sent a ${kind}${fileName ? `: ${fileName}` : ""}]`,
    ts: Date.now(),
  });
  await appendTurn(userId, { role: "assistant", content: ack, ts: Date.now() });
}
