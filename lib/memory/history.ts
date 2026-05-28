import { redis } from "./redis";
import { generateText } from "ai";
import { extractorModel } from "@/lib/llm/provider";
import type { ModelMessage } from "ai";
import { createHash } from "crypto";
import { span } from "@/lib/timing";

const MAX_TURNS = 20;
const TOKEN_CAP = 3000;
const SUMMARY_TARGET_TOKENS = 200;
const OLDEST_CHUNK = 10;

export type StoredTurn = {
  role: "user" | "assistant";
  content: string;
  ts: number;
};

const key = (userId: string) => `user:${userId}:history`;
const summaryKey = (userId: string, hash: string) => `history:summary:${userId}:${hash}`;

export async function loadHistory(userId: string): Promise<StoredTurn[]> {
  const end = span("history:load");
  const raw = await redis().lrange<StoredTurn | string>(key(userId), 0, MAX_TURNS - 1);
  const parsed = raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as StoredTurn) : r));
  end({ turns: parsed.length });
  return parsed.reverse();
}

export async function appendTurn(userId: string, turn: StoredTurn): Promise<number> {
  const end = span("history:append");
  const k = key(userId);
  const tx = redis().multi();
  tx.lpush(k, turn);
  tx.ltrim(k, 0, MAX_TURNS - 1);
  tx.llen(k);
  const res = (await tx.exec()) as [number, string, number];
  end({ role: turn.role });
  return res[2];
}

export async function turnCounter(userId: string): Promise<number> {
  const k = `user:${userId}:turn_counter`;
  const n = (await redis().incr(k)) as number;
  await redis().expire(k, 60 * 60 * 24 * 90);
  return n;
}

/** Rough token estimate: chars/4. Good enough for triggering the cap. */
export function estimateTokens(turns: StoredTurn[]): number {
  let chars = 0;
  for (const t of turns) chars += t.content.length + 10; // +role label overhead
  return Math.ceil(chars / 4);
}

/**
 * Build the message list to feed to the model. If the stored history would
 * exceed the token cap, summarize the oldest chunk to a ~200-token block and
 * prepend it to the recent kept turns. The summary is cached by content hash
 * so we don't regenerate it every turn.
 */
export async function historyForPrompt(userId: string): Promise<ModelMessage[]> {
  const endOverall = span("history:forPrompt");
  const history = await loadHistory(userId);
  const est = estimateTokens(history);
  if (est <= TOKEN_CAP || history.length <= OLDEST_CHUNK) {
    endOverall({ cached: "n/a", turns: history.length, estTokens: est });
    return history.map(toModelMessage);
  }
  const oldest = history.slice(0, history.length - OLDEST_CHUNK);
  const recent = history.slice(history.length - OLDEST_CHUNK);
  const hash = hashTurns(oldest);
  const cached = await redis().get<string>(summaryKey(userId, hash));
  let summary = cached ?? null;
  if (!summary) {
    const endSum = span("history:summarize");
    summary = await summarizeOldest(oldest);
    endSum({ turns: oldest.length, estTokens: est });
    if (summary) {
      // Cache for 7 days — older history will get re-summarized after that
      // window (cheap; only fires when the cap is exceeded).
      await redis()
        .set(summaryKey(userId, hash), summary, { ex: 60 * 60 * 24 * 7 })
        .catch(() => {});
    }
    endOverall({ cached: false, turns: history.length, estTokens: est });
  } else {
    endOverall({ cached: true, turns: history.length, estTokens: est });
  }
  const summaryTurn: ModelMessage = {
    role: "user",
    content: `[Earlier conversation summary]\n${summary ?? "(no summary available)"}`,
  };
  const ack: ModelMessage = { role: "assistant", content: "Noted." };
  return [summaryTurn, ack, ...recent.map(toModelMessage)];
}

function toModelMessage(t: StoredTurn): ModelMessage {
  return { role: t.role === "user" ? "user" : "assistant", content: t.content };
}

function hashTurns(turns: StoredTurn[]): string {
  const h = createHash("sha1");
  for (const t of turns) h.update(`${t.ts}|${t.role}|${t.content}\n`);
  return h.digest("hex").slice(0, 16);
}

async function summarizeOldest(oldest: StoredTurn[]): Promise<string | null> {
  try {
    const transcript = oldest
      .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
      .join("\n");
    const r = await generateText({
      model: extractorModel(),
      system: `Summarize the earlier portion of a conversation between a user and their assistant in roughly ${SUMMARY_TARGET_TOKENS} tokens (~150 words). Capture: ongoing tasks, decisions, commitments, important entities (people/places/dates). Be concrete. Output the summary only — no preamble.`,
      prompt: transcript,
    });
    const s = r.text.trim();
    return s.length > 30 ? s : null;
  } catch (err) {
    console.warn("[history] summarize failed", err);
    return null;
  }
}
