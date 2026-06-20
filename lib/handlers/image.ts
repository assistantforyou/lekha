import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { appendTurn } from "@/lib/memory/history";
import { appendRecentMedia } from "@/lib/memory/recent-media";
import { span } from "@/lib/timing";

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

  const ack = "Got your image — what would you like to do with it?";
  await replyOrPush(userId, replyToken, [textMsg(ack)]);
  await appendTurn(userId, { role: "user", content: "[sent an image]", ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: ack, ts: Date.now() });
  endHandler({ mode: "normal" });
}
