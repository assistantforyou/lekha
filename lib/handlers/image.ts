import { replyOrPush, text as textMsg, getMessageContent } from "@/lib/line/client";
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

  // Download and stage the image so the agent can access it via summarize_image / ocr_image.
  try {
    const { bytes, contentType } = await getMessageContent(messageId);
    await appendRecentMedia(userId, {
      kind: "image",
      messageId,
      contentType,
      sizeBytes: bytes.byteLength,
      ts: Date.now(),
    });
  } catch (err) {
    console.warn("[webhook] image fetch failed", err);
    if (mode !== "stage_only") {
      await replyOrPush(userId, replyToken, [textMsg("I couldn't load that image — can you resend it?")]);
    }
    endHandler({ failed: "image-fetch" });
    return;
  }

  // When a text message immediately follows in the same webhook batch, skip the ack —
  // the text handler will process both image and text together.
  if (mode === "stage_only") {
    endHandler({ mode: "stage_only" });
    return;
  }

  // Always ack without auto-analyzing. If the user immediately follows with text
  // (e.g. "rate my new product"), the text handler sees the staged image and the
  // agent answers in context. If the image arrives alone, the ack prompts what to do.
  const ack = "Got your image — what would you like to do with it?";
  await replyOrPush(userId, replyToken, [textMsg(ack)]);
  await appendTurn(userId, { role: "user", content: "[sent an image]", ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: ack, ts: Date.now() });

  endHandler({ mode: "normal" });
}
