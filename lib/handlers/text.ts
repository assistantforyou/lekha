import { type ModelMessage } from "ai";
import { replyOrPush, showLoading, getMessageContent, text as textMsg } from "@/lib/line/client";
import { runAgent } from "@/lib/llm/agent";
import { appendTurn, historyForPrompt } from "@/lib/memory/history";
import { loadFacts } from "@/lib/memory/facts";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { getSettings } from "@/lib/memory/settings";
import { listAccounts } from "@/lib/tools/google-auth";
import { toolsForUser } from "@/lib/tools";
import { fastClassify } from "@/lib/fast-classify";
import { enrichReply } from "../enrich-reply";
import { span, timed } from "@/lib/timing";

export async function respondToText(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  userText: string,
  traceId?: string,
): Promise<void> {
  const endHandler = span("text:respondToText", traceId);
  showLoading(userId, 60).catch(() => {}); // fire-and-forget

  // Load staged first so we can kick off image download in parallel with other preloads.
  const staged = await listRecentMedia(userId);
  const hasStagedMedia = staged.length > 0;
  const freshImage = staged.find((m) => m.kind === "image" && Date.now() - m.ts < 30_000);
  const imageLooksReferenced = freshImage
    ? /\b(this|that|it|the\s+(image|photo|picture|screenshot))\b/i.test(userText) ||
      /^(what|where|who|which|how|can|could|would|will|did|do|does|is|are|am)\b/i.test(userText) ||
      /\b(read|see|look|check|find|tell|get|extract|identify|describe|summarize|analy[sz]e|ocr|scan)\b/i.test(userText) ||
      /\b(ip\s+address|mac\s+address|serial|version|password|wifi|qr|barcode|text|code|error|screen|monitor|display)\b/i.test(userText)
    : false;

  const imagePromise = freshImage && imageLooksReferenced
    ? timed(
        "text:getMessageContent",
        traceId,
        () => getMessageContent(freshImage.messageId),
        { sizeBytes: freshImage.sizeBytes },
      ).catch(() => null)
    : Promise.resolve(null);

  // If we're about to read a bundled image, acknowledge immediately so the chat
  // doesn't look blank while Gemini processes the bytes. Use PUSH for the ack so
  // the single-use replyToken stays available for the actual answer (push is
  // best-effort on the free LINE plan; reply is guaranteed within the 1-min window).
  let ackPromise: Promise<"reply" | "push" | "failed"> | undefined;
  if (freshImage && imageLooksReferenced) {
    ackPromise = replyOrPush(userId, undefined, [textMsg("Reading the image, one sec…")]);
  }

  const hint = fastClassify(userText, { hasStagedMedia });

  const endPreload = span("text:preload", traceId);
  const [rawHistoryMsgs, facts, accounts, settings, imageData] = await Promise.all([
    historyForPrompt(userId),
    loadFacts(userId, 30),
    listAccounts(userId),
    getSettings(userId),
    imagePromise,
  ]);

  // Stateless lookups don't benefit from a long history window — skip everything
  // except the last 5 pairs to keep the prompt lean.
  const STATELESS_HINTS = new Set(["weather", "finance", "news"]);
  const historyMsgs = hint && STATELESS_HINTS.has(hint)
    ? rawHistoryMsgs.slice(-10)
    : rawHistoryMsgs;

  endPreload({
    historyTurns: historyMsgs.length,
    facts: facts.facts.length,
    staged: staged.length,
    accounts: accounts.accounts.length,
    bundledImage: imageData ? freshImage?.messageId : null,
    imagePreloaded: imageLooksReferenced,
    hint: hint ?? "none",
  });

  let userContent: ModelMessage["content"];
  if (imageData) {
    userContent = [
      { type: "image", image: imageData.bytes, mediaType: imageData.contentType },
      { type: "text", text: userText },
    ];
  } else {
    userContent = userText;
  }

  const messages: ModelMessage[] = [
    ...historyMsgs,
    { role: "user", content: userContent },
  ];

  const userHasGoogle = accounts.accounts.length > 0;
  const tools = await toolsForUser(userId, {
    userHasGoogle,
    disabledCategories: settings.disabledCategories,
    hasStagedMedia,
    hint,
  });

  const result = await runAgent(userId, profile, facts, messages, traceId, {
    accounts,
    staged,
    tools,
    hasStagedMedia,
    settings,
    hint,
    imageBundled: !!imageData,
    // Image already staged — give Gemini vision + response steps more time
    timeoutMs: imageData ? 55_000 : undefined,
  });
  const { text: replyText, hints, historyText } = result;

  const endReply = span("text:reply", traceId);
  // Always use the replyToken for the actual answer. The earlier ack was sent via
  // push (best effort); if the free plan's push quota is exhausted, the user still
  // gets the answer via reply and sees the loading animation while processing.
  await replyOrPush(
    userId,
    replyToken,
    enrichReply(
      replyText,
      hints,
      accounts.accounts.map((a) => a.email),
    ).slice(0, 5),
  );
  endReply();

  const endAppend = span("text:appendTurns", traceId);
  await Promise.all([
    appendTurn(userId, { role: "user", content: userText, ts: Date.now() }),
    appendTurn(userId, { role: "assistant", content: historyText, ts: Date.now() }),
  ]);
  endAppend();

  endHandler({ userTextLength: userText.length, replyLength: replyText.length });
}
