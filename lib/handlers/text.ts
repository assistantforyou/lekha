import { type ModelMessage } from "ai";
import { replyOrPush, showLoading, getMessageContent } from "@/lib/line/client";
import { runAgent } from "@/lib/llm/agent";
import { generateCasualReply } from "@/lib/llm/casual-reply";
import { appendTurn, historyForPrompt } from "@/lib/memory/history";
import { loadFacts } from "@/lib/memory/facts";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { getSettings } from "@/lib/memory/settings";
import { listAccounts } from "@/lib/tools/google-auth";
import { toolsForUser } from "@/lib/tools";
import { classifyIntent } from "@/lib/intent";
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

  const intentResult = await classifyIntent(userText, { hasImage: Boolean(imageData) });

  // If the user is asking about tasks, strip stale assistant task-list replies
  // from history so the model is forced to call list_tasks for fresh data.
  const isTaskQuery = /\b(my tasks|tasks?|todo|to do|what do i need to do|remaining tasks|open tasks)\b/i.test(userText);
  const sanitizedHistory = isTaskQuery
    ? historyMsgs.filter((m) => {
        if (m.role !== "assistant") return true;
        const text = typeof m.content === "string" ? m.content : "";
        // Heuristic: assistant message that looks like a task list reply
        return !(/\b(open tasks?|remaining tasks?|here are your tasks|your tasks)\b/i.test(text) && /[•\-]\s+\w/.test(text));
      })
    : historyMsgs;

  let userContent: ModelMessage["content"];
  if (imageData) {
    userContent = [
      { type: "image", image: imageData.bytes, mediaType: imageData.contentType },
      { type: "text", text: userText },
    ];
  } else {
    userContent = userText;
  }

  // For task queries, prepend a strong freshness instruction to the user message
  // so the model cannot rely on stale summaries or history.
  const finalUserContent = isTaskQuery && typeof userContent === "string"
    ? `${userContent} [ALWAYS call list_tasks — NEVER answer from memory or history]`
    : userContent;

  const messages: ModelMessage[] = [
    ...sanitizedHistory,
    { role: "user", content: finalUserContent },
  ];

  let replyText: string;
  let hints: Awaited<ReturnType<typeof runAgent>>["hints"];

  if (intentResult.primary === "casual") {
    replyText = await generateCasualReply(userText);
    hints = { confirmDraft: false, pickAccount: false, needsGoogleConnect: false };
  } else {
    const userHasGoogle = accounts.accounts.length > 0;
    const intent =
      intentResult.isMulti || intentResult.confidence === "low" ? undefined : intentResult.primary;
    const tools = await toolsForUser(userId, {
      userHasGoogle,
      disabledCategories: settings.disabledCategories,
      intent,
    });

    // R1: Pass pre-loaded accounts, staged, and filtered tools to avoid double-fetch in runAgent
    const result = await runAgent(userId, profile, facts, messages, traceId, {
      accounts,
      staged,
      tools,
    });
    replyText = result.text;
    hints = result.hints;
  }

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
