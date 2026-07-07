import { env } from "@/lib/env";
import { redis } from "@/lib/memory/redis";
import type { LineEvent, LineMessageEvent, LineTextMessage } from "@/lib/line/types";

export type ConversationSource = {
  type: "user" | "group" | "room";
  userId?: string;
  groupId?: string;
  roomId?: string;
};

export function getConversationId(source: ConversationSource): string | undefined {
  if (source.type === "group" && source.groupId) return `group:${source.groupId}`;
  if (source.type === "room" && source.roomId) return `room:${source.roomId}`;
  return undefined;
}

export function rawGroupId(source: ConversationSource): string | undefined {
  return source.groupId ?? source.roomId;
}

export function isGroupEvent(event: LineEvent): boolean {
  return event.source?.type === "group" || event.source?.type === "room";
}

export function isGroupSource(source: ConversationSource): boolean {
  return source.type === "group" || source.type === "room";
}

export function getBotUserId(): string | undefined {
  return env().LINE_BOT_USER_ID;
}

export function isMentionOfBot(textMessage: { text: string; mention?: { mentionees: { userId?: string }[] } | undefined }, botUserId?: string): boolean {
  if (textMessage.mention?.mentionees) {
    const botId = botUserId ?? getBotUserId();
    if (botId && textMessage.mention.mentionees.some((m) => m.userId === botId)) {
      return true;
    }
  }
  return false;
}

const NAME_INVOCATION_RE = /^@?Lekha\b/i;

export function isNameInvocation(text: string): boolean {
  return NAME_INVOCATION_RE.test(text.trim());
}

export function isReplyToBot(quoteToken: string | undefined, botQuoteTokens: Set<string>): boolean {
  return Boolean(quoteToken && botQuoteTokens.has(quoteToken));
}

export function shouldRespondInGroup(
  event: LineMessageEvent,
  botUserId: string | undefined,
  botQuoteTokens: Set<string>,
): boolean {
  if (!isGroupEvent(event)) return false;
  if (event.message.type !== "text") return false;
  const textMessage = event.message as LineTextMessage;
  const text = textMessage.text.trim();
  if (isMentionOfBot(textMessage, botUserId)) return true;
  if (isNameInvocation(text)) return true;
  if (isReplyToBot(textMessage.quoteToken, botQuoteTokens)) return true;
  return false;
}

export function formatSpeakerName(displayName: string): string {
  return displayName.split(/\s+/)[0] ?? displayName;
}

const BOT_QUOTE_TTL_MS = 24 * 60 * 60 * 1000;
const BOT_QUOTE_KEY_TTL_SEC = 60 * 60 * 24;

function botQuoteKey(conversationId: string) {
  return `bot-quotes:${conversationId}`;
}

export async function recordBotQuoteTokens(conversationId: string, tokens: string[]): Promise<void> {
  if (!tokens.length) return;
  const key = botQuoteKey(conversationId);
  const score = Date.now();
  for (const member of tokens) {
    await redis().zadd(key, { score, member });
  }
  await redis().expire(key, BOT_QUOTE_KEY_TTL_SEC);
}

export async function isReplyToBotQuote(conversationId: string, quoteToken: string | undefined): Promise<boolean> {
  if (!quoteToken) return false;
  const score = await redis().zscore(botQuoteKey(conversationId), quoteToken);
  if (score === null) return false;
  return Date.now() - Number(score) <= BOT_QUOTE_TTL_MS;
}

export async function clearBotQuoteTokens(conversationId: string): Promise<void> {
  await redis().del(botQuoteKey(conversationId));
}
