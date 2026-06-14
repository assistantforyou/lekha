import { type ModelMessage } from "ai";
import { replyOrPush, showLoading, getMessageContent } from "@/lib/line/client";
import { runAgent } from "@/lib/llm/agent";
import { appendTurn, historyForPrompt } from "@/lib/memory/history";
import { loadFacts } from "@/lib/memory/facts";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { getSettings } from "@/lib/memory/settings";
import { listAccounts } from "@/lib/tools/google-auth";
import { toolsForUser } from "@/lib/tools";
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

  // R7: Load staged first so we can kick off image download in parallel with other preloads
  const staged = await listRecentMedia(userId);
  const freshImage = staged.find((m) => m.kind === "image" && Date.now() - m.ts < 30_000);

  const imagePromise = freshImage
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
  });

  // With full Flash + static tool registry, the agent routes itself. No intent
  // classifier, no history sanitization, no freshness injection needed.

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

  let replyText: string;
  let hints: Awaited<ReturnType<typeof runAgent>>["hints"];

  const userHasGoogle = accounts.accounts.length > 0;
  const tools = await toolsForUser(userId, {
    userHasGoogle,
    disabledCategories: settings.disabledCategories,
  });

  // R1: Pass pre-loaded accounts, staged, and full tool registry to avoid double-fetch in runAgent
  const result = await runAgent(userId, profile, facts, messages, traceId, {
    accounts,
    staged,
    tools,
  });
  replyText = result.text;
  hints = result.hints;

  const endReply = span("text:reply", traceId);
  // R2: Fallback to push if replyToken expired (slow requests)
  await replyOrPush(
    userId,
    replyToken,
    enrichReply(
      replyText,
      hints,
      accounts.accounts.map((a) => a.email),
    ).slice(0, 5), // LINE caps replies at 5 messages
  );
  endReply();

  const endAppend = span("text:appendTurns", traceId);
  await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
  endAppend();

  endHandler({ userTextLength: userText.length, replyLength: replyText.length });
}
