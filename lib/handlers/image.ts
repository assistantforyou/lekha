import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { appendTurn } from "@/lib/memory/history";
import { appendRecentMedia, listRecentMedia } from "@/lib/memory/recent-media";
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
  const ack =
    batchCount > 1
      ? `Got your ${batchCount} images. Ask me to read text from them, describe them, or scan them as receipts.`
      : "Got your image. Ask me to read text from it, describe it, or scan it as a receipt.";
  await replyOrPush(userId, replyToken, [textMsg(ack)]);
  await appendTurn(userId, { role: "user", content: "[sent an image]", ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: ack, ts: Date.now() });
  endHandler({ mode: "normal" });
}
