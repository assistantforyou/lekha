import { env } from "@/lib/env";
import type { Gate } from "@/lib/gate";
import {
  getBotUserId,
  getConversationId,
  isMentionOfBot,
  isNameInvocation,
  isReplyToBotQuote,
  rawGroupId,
  recordBotQuoteTokens,
} from "@/lib/group";
import { addAllowedGroup, hasGroupAccess, removeAllowedGroup } from "@/lib/group-access";
import { getSpeakerDisplayName } from "@/lib/memory/group-history";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { groupGateFlex } from "@/lib/line/flex/group-gate";
import { checkRateLimit } from "@/lib/ratelimit";
import { markUserActive } from "@/lib/sweep";
import { registerUser } from "@/lib/memory/user-registry";
import { respondToText } from "@/lib/handlers/text";
import type { LineMessageEvent, LineTextMessage } from "@/lib/line/types";
import { redis } from "@/lib/memory/redis";

const GROUP_ID_RE = /[CR][a-f0-9]{32}/i;

export async function handleGroupMessage(
  event: LineMessageEvent,
  gate: Gate,
  traceId?: string,
): Promise<boolean> {
  const userId = event.source.userId;
  const groupId = rawGroupId(event.source);
  const conversationId = getConversationId(event.source);
  const chatId = groupId;
  if (!userId || !groupId || !conversationId || !chatId) return false;
  if (event.message.type !== "text") return true;

  const textMessage = event.message as LineTextMessage;
  const userText = textMessage.text.trim();

  markUserActive(userId).catch(() => {});
  registerUser(userId).catch(() => {});

  const [profile, displayName] = await Promise.all([
    getOrCreateProfile(userId).catch(() => ({ displayName: "" })),
    getSpeakerDisplayName(conversationId, userId),
  ]);
  const speakerName = displayName || profile.displayName || "User";

  // The turn is logged by respondToText after it runs so the assistant reply is also captured.

  if (gate.isAdmin(userId)) {
    const allowMatch = userText.match(new RegExp(`^/allowgroup\\s+(${GROUP_ID_RE.source})$`, "i"));
    if (allowMatch) {
      const target = allowMatch[1]!;
      await addAllowedGroup(target);
      await replyOrPush(chatId, event.replyToken, [textMsg(`✅ Group ${target} is now allowed.`)]).catch(() => {});
      return true;
    }
    const removeMatch = userText.match(new RegExp(`^/removegroup\\s+(${GROUP_ID_RE.source})$`, "i"));
    if (removeMatch) {
      const target = removeMatch[1]!;
      await removeAllowedGroup(target);
      await replyOrPush(chatId, event.replyToken, [textMsg(`🗑 Group ${target} removed.`)]).catch(() => {});
      return true;
    }
  }

  const botUserId = getBotUserId();
  const isMention = isMentionOfBot(textMessage, botUserId);
  const isName = isNameInvocation(userText);
  const isReply = await isReplyToBotQuote(conversationId, textMessage.quoteToken);
  if (!isMention && !isName && !isReply) return true;

  const allowed = await hasGroupAccess({ userId, groupId, gate });
  if (!allowed) {
    await sendGroupGateNotice(chatId, event.replyToken, groupId);
    return true;
  }

  const rl = await checkRateLimit(userId);
  if (!rl.ok) {
    await replyOrPush(chatId, event.replyToken, [
      textMsg(`Easy there — give me a sec. Try again in ~${rl.retryAfterSec}s.`),
    ]);
    return true;
  }

  await respondToText(event.replyToken, userId, { displayName: speakerName }, userText, traceId, {
    groupContext: {
      conversationId,
      chatId,
      speakerUserId: userId,
      speakerName,
      messageId: textMessage.id,
      quoteToken: textMessage.quoteToken,
    },
    onQuoteTokens: (tokens) => {
      recordBotQuoteTokens(conversationId, tokens).catch(() => {});
    },
  });

  return true;
}

async function sendGroupGateNotice(chatId: string, replyToken: string, groupId: string): Promise<void> {
  const key = `group:gate_notice:${groupId}`;
  const fresh = await redis().set(key, 1, { ex: 60 * 60 * 24, nx: true });
  if (fresh === null) return;
  await replyOrPush(chatId, replyToken, [groupGateFlex(env().APP_BASE_URL)]);
}
