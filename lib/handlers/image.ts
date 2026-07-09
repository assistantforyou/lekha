import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { appendTurn, loadHistory } from "@/lib/memory/history";
import { appendRecentMedia, listRecentMedia } from "@/lib/memory/recent-media";
import { getSettings } from "@/lib/memory/settings";
import { detectMessageLanguage, t } from "@/lib/i18n";
import { span } from "@/lib/timing";

/** Items staged within this window count as "sent together" for ack wording. */
const BATCH_WINDOW_MS = 10_000;

export async function respondToImage(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  messageId: string,
  mode: "normal" | "stage_only" = "normal",
  traceId?: string,
  chatId?: string,
): Promise<void> {
  const endHandler = span("image:respondToImage", traceId);

  // Stage immediately — no download needed. The agent tools (summarize_image,
  // ocr_image) fetch the bytes themselves via getMessageContent when called.
  // Staging first eliminates the race when the user texts right after sending.
  await appendRecentMedia(userId, {
    kind: "image",
    messageId,
    contentType: "image/jpeg", // LINE images are always jpeg/png; tools re-detect on use
    ts: Date.now(),
  });

  // stage_only: image+text arrived in the same webhook batch — text handler responds.
  if (mode === "stage_only") {
    endHandler({ mode: "stage_only" });
    return;
  }

  const staged = await listRecentMedia(userId);
  const batchCount = staged.filter((m) => Date.now() - m.ts < BATCH_WINDOW_MS).length;

  // Match the ack language to the last user text we have, falling back to settings.
  const settings = await getSettings(userId);
  const history = await loadHistory(userId);
  const lastUserText = [...history]
    .reverse()
    .find((h) => h.role === "user" && typeof h.content === "string" && !h.content.startsWith("["))
    ?.content as string | undefined;
  const ackLang = detectMessageLanguage(lastUserText ?? "") ?? settings.language ?? "en";
  const ack =
    batchCount > 1
      ? t(ackLang, "imagesAck", { count: String(batchCount) })
      : t(ackLang, "imageAck");
  await replyOrPush(chatId ?? userId, replyToken, [textMsg(ack)]);
  await appendTurn(userId, { role: "user", content: "[sent an image]", ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: ack, ts: Date.now() });
  endHandler({ mode: "normal" });
}
