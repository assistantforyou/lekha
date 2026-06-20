import { type ModelMessage } from "ai";
import { replyOrPush, showLoading, getMessageContent } from "@/lib/line/client";
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
      /\b(what'?s|what\s+is|describe|ocr|read|summarize|analyze|see)\b/i.test(userText)
    : false;

  const imagePromise = freshImage && imageLooksReferenced
    ? timed(
        "text:getMessageContent",
        traceId,
        () => getMessageContent(freshImage.messageId),
        { sizeBytes: freshImage.sizeBytes },
      ).catch(() => null)
    : Promise.resolve(null);

  const endPreload = span("text:preload", traceId);
  const [historyMsgs, facts, accounts, settings, imageData] = await Promise.all([
    historyForPrompt(userId),
    loadFacts(userId),
    listAccounts(userId),
    getSettings(userId),
    imagePromise,
  ]);
  endPreload({
    historyTurns: historyMsgs.length,
    facts: facts.facts.length,
    staged: staged.length,
    accounts: accounts.accounts.length,
    bundledImage: imageData ? freshImage?.messageId : null,
    imagePreloaded: imageLooksReferenced,
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
  const hint = fastClassify(userText, { hasStagedMedia });
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
  });
  const { text: replyText, hints } = result;

  const endReply = span("text:reply", traceId);
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
  await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
  endAppend();

  endHandler({ userTextLength: userText.length, replyLength: replyText.length });
}
