import { env } from "@/lib/env";
import type { Gate } from "@/lib/gate";
import { clearBotQuoteTokens, getBotUserId, getConversationId, rawGroupId } from "@/lib/group";
import {
  addAllowedGroup,
  isGroupAllowed,
  removeAllowedGroup,
  registerDiscoveredGroup,
  removeDiscoveredGroup,
  getAdminGroupIds,
  getAdminUserIds,
} from "@/lib/group-access";
import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { groupGateFlex, newGroupAdminFlex } from "@/lib/line/flex/group-gate";
import { clearGroupHistory, clearGroupProfiles } from "@/lib/memory/group-history";
import { getSettings } from "@/lib/memory/settings";
import { t } from "@/lib/i18n";
import type { JoinEvent, LeaveEvent, MemberJoinedEvent, MemberLeftEvent } from "@/lib/line/types";

async function groupWelcomeText(groupId: string): Promise<string> {
  const settings = await getSettings(groupId).catch(() => null);
  return t(settings?.language, "groupWelcome");
}

export async function handleJoin(event: JoinEvent, gate: Gate): Promise<boolean> {
  const groupId = rawGroupId(event.source);
  if (!groupId) return false;

  await registerDiscoveredGroup(groupId);
  const welcome = await groupWelcomeText(groupId);

  if (await isGroupAllowed(groupId)) {
    if (event.replyToken) {
      await replyOrPush(groupId, event.replyToken, [textMsg(welcome)]);
    }
    return true;
  }

  const inviterId = event.source.userId;
  if (inviterId && gate.isAdmin(inviterId)) {
    await addAllowedGroup(groupId);
    if (event.replyToken) {
      await replyOrPush(groupId, event.replyToken, [textMsg(welcome)]);
    }
    return true;
  }

  // Notify admins so they can allow the group with one tap.
  await notifyAdminsNewGroup(groupId);

  if (event.replyToken) {
    await replyOrPush(groupId, event.replyToken, [groupGateFlex(env().APP_BASE_URL, { language: inviterId ? await getSettings(inviterId).then(s => s.language).catch(() => null) : null })]);
  }
  return true;
}

export async function handleLeave(event: LeaveEvent): Promise<void> {
  const groupId = rawGroupId(event.source);
  const conversationId = getConversationId(event.source);
  if (!groupId || !conversationId) return;
  await removeAllowedGroup(groupId);
  await removeDiscoveredGroup(groupId);
  await clearGroupHistory(conversationId);
  await clearGroupProfiles(conversationId);
  await clearBotQuoteTokens(conversationId);
}

export async function handleMemberJoined(event: MemberJoinedEvent, gate: Gate): Promise<boolean> {
  const groupId = rawGroupId(event.source);
  if (!groupId) return false;

  const botId = getBotUserId();
  const botAdded = botId && event.joined.members.some((m) => m.userId === botId);
  if (!botAdded) return true;

  await registerDiscoveredGroup(groupId);

  const inviterId = event.source.userId;
  const inviterLang = inviterId ? await getSettings(inviterId).then(s => s.language).catch(() => null) : null;
  const welcome = t(inviterLang, "groupWelcome");
  const wasAllowed = await isGroupAllowed(groupId);
  if (inviterId && gate.isAdmin(inviterId)) {
    await addAllowedGroup(groupId);
    if (event.replyToken && !wasAllowed) {
      await replyOrPush(groupId, event.replyToken, [textMsg(welcome)]);
    }
    return true;
  }

  if (wasAllowed) {
    if (event.replyToken) {
      await replyOrPush(groupId, event.replyToken, [textMsg(welcome)]);
    }
    return true;
  }

  // Notify admins so they can allow the group with one tap.
  await notifyAdminsNewGroup(groupId);

  if (event.replyToken) {
    await replyOrPush(groupId, event.replyToken, [groupGateFlex(env().APP_BASE_URL, { language: inviterLang })]);
  }
  return true;
}

export async function handleMemberLeft(event: MemberLeftEvent): Promise<void> {
  const groupId = rawGroupId(event.source);
  const conversationId = getConversationId(event.source);
  const botId = getBotUserId();
  if (!groupId || !conversationId || !botId) return;

  const botRemoved = event.left.members.some((m) => m.userId === botId);
  if (!botRemoved) return;

  await removeAllowedGroup(groupId);
  await removeDiscoveredGroup(groupId);
  await clearGroupHistory(conversationId);
  await clearGroupProfiles(conversationId);
  await clearBotQuoteTokens(conversationId);
}

async function notifyAdminsNewGroup(groupId: string): Promise<void> {
  const adminIds = getAdminUserIds();
  const adminGroupIds = getAdminGroupIds();
  // Don't notify for admin-owned groups — they're already allowed implicitly.
  if (adminGroupIds.has(groupId)) return;
  for (const adminId of adminIds) {
    const lang = await getSettings(adminId).then(s => s.language).catch(() => null);
    const msg = newGroupAdminFlex(groupId, { language: lang });
    await replyOrPush(adminId, "", [msg]).catch(() => {});
  }
}
