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

const MAX_TURNS = 60;
const CONTEXT_TURNS = 40;
const CONTEXT_TOKEN_BUDGET = 2500;
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

function estimateTurnTokens(turn: GroupTurn): number {
  // Weighted estimate: CJK/Thai ~1.5 chars/token, Latin ~4 chars/token.
  const text = `${turn.displayName}: ${turn.text}`;
  let cjkThai = 0;
  let latin = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    if (
      (cp >= 0x4e00 && cp <= 0x9fff) ||
      (cp >= 0x3400 && cp <= 0x4dbf) ||
      (cp >= 0xac00 && cp <= 0xd7af) ||
      (cp >= 0x0e00 && cp <= 0x0e7f) ||
      (cp >= 0x3040 && cp <= 0x309f) ||
      (cp >= 0x30a0 && cp <= 0x30ff)
    ) {
      cjkThai++;
    } else {
      latin++;
    }
  }
  return Math.ceil(cjkThai / 1.5) + Math.ceil(latin / 4) + 4;
}

function capTurnsByTokens(turns: GroupTurn[], budget: number): GroupTurn[] {
  let tokens = 0;
  const out: GroupTurn[] = [];
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i]!;
    const t = estimateTurnTokens(turn);
    if (tokens + t > budget && out.length > 0) break;
    tokens += t;
    out.unshift(turn);
  }
  return out;
}

export async function groupContextForPrompt(
  conversationId: string,
  botUserId: string | undefined,
  limit = CONTEXT_TURNS,
): Promise<ModelMessage[]> {
  const turns = await loadGroupTurns(conversationId, limit);
  const capped = capTurnsByTokens(turns, CONTEXT_TOKEN_BUDGET);
  return groupTurnsToMessages(capped, botUserId);
}
