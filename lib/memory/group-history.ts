import { redis } from "@/lib/memory/redis";
import { getConversationMemberProfile } from "@/lib/line/group-client";
import type { ModelMessage } from "ai";

export type GroupTurn = {
  userId: string;
  displayName: string;
  text: string;
  ts: number;
  messageId: string;
  quoteToken?: string;
  mentionsBot?: boolean;
};

const MAX_TURNS = 50;
const CONTEXT_TURNS = 20;
const HISTORY_TTL_SEC = 60 * 60 * 24 * 30;
const PROFILE_TTL_SEC = 60 * 60 * 24;

function historyKey(conversationId: string) {
  return `${conversationId}:history`;
}

function profileKey(conversationId: string, userId: string) {
  return `${conversationId}:profile:${userId}`;
}

function parseTurn(raw: GroupTurn | string): GroupTurn {
  return typeof raw === "string" ? (JSON.parse(raw) as GroupTurn) : raw;
}

export async function appendGroupTurn(conversationId: string, turn: GroupTurn): Promise<void> {
  const k = historyKey(conversationId);
  const tx = redis().multi();
  tx.rpush(k, turn);
  tx.ltrim(k, -MAX_TURNS, -1);
  tx.expire(k, HISTORY_TTL_SEC);
  await tx.exec();
}

export async function loadGroupTurns(conversationId: string, limit = CONTEXT_TURNS): Promise<GroupTurn[]> {
  const k = historyKey(conversationId);
  const raw = await redis().lrange<GroupTurn | string>(k, -limit, -1);
  // RPUSH stores oldest on the left, so lrange -limit:-1 already returns chronological order.
  return raw.map(parseTurn);
}

export async function clearGroupHistory(conversationId: string): Promise<void> {
  await redis().del(historyKey(conversationId));
}

export async function getSpeakerDisplayName(conversationId: string, userId: string): Promise<string | undefined> {
  const cached = await redis().get<string>(profileKey(conversationId, userId));
  if (cached) return cached;
  const profile = await getConversationMemberProfile(conversationId, userId).catch(() => null);
  if (profile?.displayName) {
    await redis().set(profileKey(conversationId, userId), profile.displayName, { ex: PROFILE_TTL_SEC });
  }
  return profile?.displayName;
}

export async function setSpeakerDisplayName(conversationId: string, userId: string, displayName: string): Promise<void> {
  await redis().set(profileKey(conversationId, userId), displayName, { ex: PROFILE_TTL_SEC });
}

export async function clearGroupProfiles(conversationId: string): Promise<void> {
  const keys = await redis().keys(`${profileKey(conversationId, "*")}`);
  if (keys.length) await redis().del(...keys);
}

export function groupTurnsToMessages(turns: GroupTurn[], botUserId: string | undefined): ModelMessage[] {
  const out: ModelMessage[] = [];
  for (const turn of turns) {
    const isBot = Boolean(botUserId && turn.userId === botUserId);
    if (isBot) {
      out.push({ role: "assistant", content: turn.text });
    } else {
      out.push({ role: "user", content: `[${turn.displayName}]: ${turn.text}` });
    }
  }
  return out;
}

export async function groupContextForPrompt(
  conversationId: string,
  botUserId: string | undefined,
  limit = CONTEXT_TURNS,
): Promise<ModelMessage[]> {
  const turns = await loadGroupTurns(conversationId, limit);
  return groupTurnsToMessages(turns, botUserId);
}
