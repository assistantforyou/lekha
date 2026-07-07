import { env } from "@/lib/env";
import type { Gate } from "@/lib/gate";
import { getBotUserId, getConversationId, rawGroupId } from "@/lib/group";
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
import type { JoinEvent, LeaveEvent, MemberJoinedEvent, MemberLeftEvent } from "@/lib/line/types";

const WELCOME_TEXT =
  "Hi everyone! I'm Lekha 👋\n\nMention me (@Lekha) or reply to my messages when you want my help. I can answer questions, search the web, check weather and stocks, read photos, and more.";

export async function handleJoin(event: JoinEvent, gate: Gate): Promise<boolean> {
  const groupId = rawGroupId(event.source);
  if (!groupId) return false;

  await registerDiscoveredGroup(groupId);

  if (await isGroupAllowed(groupId)) {
    if (event.replyToken) {
      await replyOrPush(groupId, event.replyToken, [textMsg(WELCOME_TEXT)]);
    }
    return true;
  }

  const inviterId = event.source.userId;
  if (inviterId && gate.isAdmin(inviterId)) {
    await addAllowedGroup(groupId);
    if (event.replyToken) {
      await replyOrPush(groupId, event.replyToken, [textMsg(WELCOME_TEXT)]);
    }
    return true;
  }

  // Notify admins so they can allow the group with one tap.
  await notifyAdminsNewGroup(groupId);

  if (event.replyToken) {
    await replyOrPush(groupId, event.replyToken, [groupGateFlex(env().APP_BASE_URL)]);
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
}

export async function handleMemberJoined(event: MemberJoinedEvent, gate: Gate): Promise<boolean> {
  const groupId = rawGroupId(event.source);
  if (!groupId) return false;

  const botId = getBotUserId();
  const botAdded = botId && event.joined.members.some((m) => m.userId === botId);
  if (!botAdded) return true;

  await registerDiscoveredGroup(groupId);

  const inviterId = event.source.userId;
  const wasAllowed = await isGroupAllowed(groupId);
  if (inviterId && gate.isAdmin(inviterId)) {
    await addAllowedGroup(groupId);
    if (event.replyToken && !wasAllowed) {
      await replyOrPush(groupId, event.replyToken, [textMsg(WELCOME_TEXT)]);
    }
    return true;
  }

  if (wasAllowed) {
    if (event.replyToken) {
      await replyOrPush(groupId, event.replyToken, [textMsg(WELCOME_TEXT)]);
    }
    return true;
  }

  // Notify admins so they can allow the group with one tap.
  await notifyAdminsNewGroup(groupId);

  if (event.replyToken) {
    await replyOrPush(groupId, event.replyToken, [groupGateFlex(env().APP_BASE_URL)]);
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
}

async function notifyAdminsNewGroup(groupId: string): Promise<void> {
  const adminIds = getAdminUserIds();
  const adminGroupIds = getAdminGroupIds();
  // Don't notify for admin-owned groups — they're already allowed implicitly.
  if (adminGroupIds.has(groupId)) return;
  const msg = newGroupAdminFlex(groupId);
  for (const adminId of adminIds) {
    await replyOrPush(adminId, "", [msg]).catch(() => {});
  }
}
