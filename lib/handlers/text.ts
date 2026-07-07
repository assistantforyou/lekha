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
import { handleTutorialText } from "@/lib/tutorial";
import { getBotUserId } from "@/lib/group";
import { appendGroupTurn, groupContextForPrompt } from "@/lib/memory/group-history";

export type GroupRespondContext = {
  conversationId: string;
  chatId: string;
  speakerUserId: string;
  speakerName: string;
  messageId: string;
  quoteToken?: string;
};

export async function respondToText(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  userText: string,
  traceId?: string,
  opts?: {
    groupContext?: GroupRespondContext;
    onQuoteTokens?: (tokens: string[]) => void;
  },
): Promise<void> {
  // Tutorial command / in-progress setup takes precedence over normal chat.
  if (await handleTutorialText(userId, replyToken, userText)) return;

  const endHandler = span("text:respondToText", traceId);
  const loadingChatId = opts?.groupContext?.chatId ?? userId;
  showLoading(loadingChatId, 60).catch(() => {}); // fire-and-forget

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

  // No separate "reading the image" push ack here — showLoading() above already
  // gives free, native LINE typing-indicator feedback while Gemini processes the
  // bytes. A push message costs against the account's push quota; this ack was
  // pure UX filler with no information the user needed, so it wasn't worth it.
  const hint = fastClassify(userText, { hasStagedMedia });

  const endPreload = span("text:preload", traceId);
  const groupContextPromise = opts?.groupContext
    ? groupContextForPrompt(opts.groupContext.conversationId, getBotUserId())
    : Promise.resolve([]);
  const [rawHistoryMsgs, groupMsgs, facts, accounts, settings, imageData] = await Promise.all([
    historyForPrompt(userId),
    groupContextPromise,
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

  const messages: ModelMessage[] = opts?.groupContext
    ? [
        ...groupMsgs,
        { role: "user", content: userContent },
      ]
    : [
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
    isGroupChat: Boolean(opts?.groupContext),
    speakerName: opts?.groupContext?.speakerName,
    // Image already staged — give Gemini vision + response steps more time
    timeoutMs: imageData ? 55_000 : undefined,
  });
  const { text: replyText, hints, historyText } = result;

  const endReply = span("text:reply", traceId);
  // Always use the replyToken for the actual answer. The earlier ack was sent via
  // push (best effort); if the free plan's push quota is exhausted, the user still
  // gets the answer via reply and sees the loading animation while processing.
  const replyTo = opts?.groupContext?.chatId ?? userId;
  await replyOrPush(
    replyTo,
    replyToken,
    enrichReply(
      replyText,
      hints,
      accounts.accounts.map((a) => a.email),
    ).slice(0, 5),
    opts?.onQuoteTokens,
  );
  endReply();

  const endAppend = span("text:appendTurns", traceId);
  const appendPersonal = Promise.all([
    appendTurn(userId, { role: "user", content: userText, ts: Date.now() }),
    appendTurn(userId, { role: "assistant", content: historyText, ts: Date.now() }),
  ]);
  const appendGroup = opts?.groupContext
    ? Promise.all([
        appendGroupTurn(opts.groupContext.conversationId, {
          userId: opts.groupContext.speakerUserId,
          displayName: opts.groupContext.speakerName,
          text: userText,
          ts: Date.now(),
          messageId: opts.groupContext.messageId,
          quoteToken: opts.groupContext.quoteToken,
        }),
        appendGroupTurn(opts.groupContext.conversationId, {
          userId: getBotUserId() ?? "bot",
          displayName: "Lekha",
          text: historyText,
          ts: Date.now(),
          messageId: "",
        }),
      ])
    : Promise.resolve();
  await Promise.all([appendPersonal, appendGroup]);
  endAppend();

  endHandler({ userTextLength: userText.length, replyLength: replyText.length });
}
