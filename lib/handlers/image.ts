import { generateText, type ModelMessage } from "ai";
import { replyOrPush, text as textMsg, showLoading, getMessageContent } from "@/lib/line/client";
import { chatModel, AGENT_TIMEOUT_MS, GEMINI_PROVIDER_OPTIONS } from "@/lib/llm/provider";
import { buildSystemPrompt } from "@/lib/llm/prompts";
import { stripMarkdown } from "@/lib/format";
import { withTimeout } from "@/lib/timing";
import { appendTurn, loadHistory } from "@/lib/memory/history";
import { loadFacts, factsToPromptBlock } from "@/lib/memory/facts";
import { getSettings } from "@/lib/memory/settings";
import { appendRecentMedia } from "@/lib/memory/recent-media";
import { span, timed } from "@/lib/timing";

export async function respondToImage(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  messageId: string,
  mode: "normal" | "stage_only" = "normal",
  traceId?: string,
): Promise<void> {
  const endHandler = span("image:respondToImage", traceId);
  let imageBytes: Uint8Array;
  let imageContentType: string;
  try {
    const { bytes, contentType } = await timed(
      "image:getMessageContent",
      traceId,
      () => getMessageContent(messageId),
    );
    imageBytes = bytes;
    imageContentType = contentType;
    await appendRecentMedia(userId, {
      kind: "image",
      messageId,
      contentType,
      sizeBytes: bytes.byteLength,
      ts: Date.now(),
    });
  } catch (err) {
    console.warn("[webhook] image fetch failed", err);
    if (mode === "normal") {
      await replyOrPush(userId, replyToken, [textMsg("I couldn't load that image — can you resend it?")]);
    }
    endHandler({ failed: "image-fetch" });
    return;
  }

  // stage_only: a text message follows in the same batch, so skip responding here.
  if (mode === "stage_only") {
    endHandler({ mode: "stage_only" });
    return;
  }

  showLoading(userId, 60).catch(() => {});
  const endPreload = span("image:preload", traceId);
  const [history, facts, settings] = await Promise.all([
    loadHistory(userId),
    loadFacts(userId),
    getSettings(userId),
  ]);
  endPreload({ historyTurns: history.length, facts: facts.facts.length });

  // Use generateText directly (no tools) so Gemini just looks at the image bytes
  // and responds in plain text. Passing through runAgent triggers summarize_image /
  // ocr_image tool calls which then return empty model text → "(…)".
  const imagePart = { type: "image" as const, image: imageBytes, mediaType: imageContentType };
  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((t) => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content: [
        imagePart,
        {
          type: "text",
          text:
            "What do you see? If there's text, extract it. If it's a photo or document, describe it. Reply naturally and helpfully.",
        },
      ],
    },
  ];

  let replyText: string;
  const endGenerate = span("image:generateText", traceId);
  try {
    const result = await withTimeout(
      generateText({
        model: chatModel(),
        system: buildSystemPrompt(factsToPromptBlock(facts), profile, settings),
        messages,
        maxRetries: 1,
        providerOptions: GEMINI_PROVIDER_OPTIONS,
      }),
      AGENT_TIMEOUT_MS,
    );
    endGenerate({ success: true });
    replyText = stripMarkdown(
      result.text?.trim() || "Hmm, I couldn't read that image. Can you try sending it again?",
    );
  } catch (err) {
    endGenerate({ error: err instanceof Error ? err.message : String(err) });
    console.warn("[webhook] image generateText failed", err);
    replyText = "Couldn't analyze that image. Try resending it?";
  }

  const endReply = span("image:reply", traceId);
  await replyOrPush(userId, replyToken, [textMsg(replyText)]);
  endReply();

  const endAppend = span("image:appendTurns", traceId);
  await appendTurn(userId, { role: "user", content: "[sent an image]", ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
  endAppend();

  endHandler({ replyLength: replyText.length });
}
