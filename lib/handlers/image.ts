import { generateText, type ModelMessage } from "ai";
import { reply, text as textMsg, showLoading, getMessageContent } from "@/lib/line/client";
import { chatModel, AGENT_TIMEOUT_MS, GEMINI_PROVIDER_OPTIONS } from "@/lib/llm/provider";
import { buildSystemPrompt } from "@/lib/llm/prompts";
import { stripMarkdown, withTimeout } from "@/lib/llm/agent";
import { appendTurn, loadHistory } from "@/lib/memory/history";
import { loadFacts, factsToPromptBlock } from "@/lib/memory/facts";
import { getSettings } from "@/lib/memory/settings";
import { appendRecentMedia } from "@/lib/memory/recent-media";

export async function respondToImage(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  messageId: string,
  mode: "normal" | "stage_only" = "normal",
): Promise<void> {
  const t0 = Date.now();
  let imageBytes: Uint8Array;
  let imageContentType: string;
  try {
    const { bytes, contentType } = await getMessageContent(messageId);
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
      await reply(replyToken, [textMsg("I couldn't load that image — can you resend it?")]);
    }
    return;
  }

  // stage_only: a text message follows in the same batch, so skip responding here.
  if (mode === "stage_only") return;

  showLoading(userId, 60).catch(() => {});
  const [history, facts, settings] = await Promise.all([
    loadHistory(userId),
    loadFacts(userId),
    getSettings(userId),
  ]);
  console.log("[webhook] image preload done", { ms: Date.now() - t0 });

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
  try {
    const result = await withTimeout(
      generateText({
        model: chatModel(),
        system: buildSystemPrompt(factsToPromptBlock(facts), profile, settings),
        messages,
        maxRetries: 3,
        providerOptions: GEMINI_PROVIDER_OPTIONS,
      }),
      AGENT_TIMEOUT_MS,
    );
    replyText = stripMarkdown(
      result.text?.trim() || "Hmm, I couldn't read that image. Can you try sending it again?",
    );
  } catch (err) {
    console.warn("[webhook] image generateText failed", err);
    replyText = "Couldn't analyze that image. Try resending it?";
  }

  await reply(replyToken, [textMsg(replyText)]);
  await appendTurn(userId, { role: "user", content: "[sent an image]", ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
}
