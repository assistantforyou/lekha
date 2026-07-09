import { type ModelMessage } from "ai";
import { replyOrPush, showLoading, getMessageContent, text as textMsg } from "@/lib/line/client";
import { runMastraAgent } from "@/mastra/run";

import { loadFacts } from "@/lib/memory/facts";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { getSettings } from "@/lib/memory/settings";
import { listAccounts } from "@/lib/tools/google-auth";
import { fastClassify } from "@/lib/fast-classify";
import { enrichReply } from "../enrich-reply";
import { detectMessageLanguage } from "@/lib/i18n";
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

  // If the user wants to use the image in an action (email, draft, upload),
  // don't preload it into the prompt. The staged-media list + attach_recent_media
  // is the correct path, and preloading adds a restrictive "answer only from the
  // image" instruction that confuses the model.
  const isActionOnImage = /\b(send|email|e-mail|forward|attach|upload|draft)\b/i.test(userText);

  const imagePromise = freshImage && imageLooksReferenced && !isActionOnImage
    ? timed(
        "text:getMessageContent",
        traceId,
        () => getMessageContent(freshImage.messageId, userId),
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
  const [groupMsgs, facts, accounts, settings, imageData] = await Promise.all([
    groupContextPromise,
    loadFacts(userId, 30),
    listAccounts(userId),
    getSettings(userId),
    imagePromise,
  ]);

  const detectedLang = detectMessageLanguage(userText);
  const replyLang = detectedLang ?? settings.language ?? "en";
  const turnSettings = { ...settings, language: replyLang };

  endPreload({
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
    {
      role: "user",
      content:
        opts?.groupContext && typeof userContent === "string"
          ? `[${opts.groupContext.speakerName}]: ${userContent}`
          : userContent,
    },
  ];

  const result = await runMastraAgent(messages, {
    userId,
    profile,
    facts,
    accounts,
    staged,
    hasStagedMedia,
    settings: turnSettings,
    hint,
    imageBundled: !!imageData,
    isGroupChat: Boolean(opts?.groupContext),
    speakerName: opts?.groupContext?.speakerName,
    conversationId: opts?.groupContext?.conversationId,
    groupContext: groupMsgs,
    timeoutMs: imageData ? 55_000 : undefined,
    traceId,
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
      replyLang,
    ).slice(0, 5),
    opts?.onQuoteTokens,
  );
  endReply();

  const endAppend = span("text:appendTurns", traceId);
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
  await appendGroup;
  endAppend();

  endHandler({ userTextLength: userText.length, replyLength: replyText.length });
}
