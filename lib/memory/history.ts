import { redis } from "./redis";
import { createTtlCache } from "./cache";
import { generateText } from "ai";
import { extractorModel, withExtractorFallback } from "@/lib/llm/provider";
import type { ModelMessage } from "ai";
import { createHash } from "crypto";
import { span } from "@/lib/timing";

const historyCache = createTtlCache<StoredTurn[]>(5_000);

const MAX_TURNS = 35;
const TOKEN_CAP = 3000;
const SUMMARY_TARGET_TOKENS = 200;

export type StoredTurn = {
  role: "user" | "assistant";
  content: string;
  ts: number;
};

const key = (userId: string) => `user:${userId}:history`;
const summaryKey = (userId: string, hash: string) => `history:summary:${userId}:${hash}`;
const runningSummaryKey = (userId: string) => `history:running_summary:${userId}`;

export async function loadHistory(userId: string): Promise<StoredTurn[]> {
  const cached = historyCache.get(userId);
  if (cached) return cached;

  const end = span("history:load");
  const raw = await redis().lrange<StoredTurn | string>(key(userId), 0, MAX_TURNS - 1);
  const parsed = raw.map((r) => (typeof r === "string" ? (JSON.parse(r) as StoredTurn) : r));
  const result = parsed.reverse();
  historyCache.set(userId, result);
  end({ turns: result.length });
  return result;
}

export async function appendTurn(userId: string, turn: StoredTurn): Promise<number> {
  // Never store empty or placeholder replies — they poison the model's history.
  if (turn.role === "assistant" && isPlaceholderReply(turn.content)) {
    const len = await redis().llen(key(userId));
    return len;
  }
  const end = span("history:append");
  const k = key(userId);
  const tx = redis().multi();
  tx.lpush(k, turn);
  tx.ltrim(k, 0, MAX_TURNS - 1);
  tx.llen(k);
  const res = (await tx.exec()) as [number, string, number];
  historyCache.invalidate(userId);
  end({ role: turn.role });
  return res[2];
}

export async function turnCounter(userId: string): Promise<number> {
  const k = `user:${userId}:turn_counter`;
  const n = (await redis().incr(k)) as number;
  await redis().expire(k, 60 * 60 * 24 * 90);
  return n;
}

/** Token estimate weighted by script: CJK/Thai ~1.5 chars/token, Latin ~4 chars/token. */
export function estimateTokens(turns: StoredTurn[]): number {
  let tokens = 0;
  for (const t of turns) {
    const text = t.content;
    let cjkThai = 0;
    let latin = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0) ?? 0;
      // CJK Unified Ideographs, Hangul, Thai, Hiragana, Katakana
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
    tokens += Math.ceil(cjkThai / 1.5) + Math.ceil(latin / 4) + 3; // +role overhead
  }
  return tokens;
}

function adaptiveRecentCount(totalTurns: number): number {
  return Math.max(10, Math.ceil(totalTurns * 0.4));
}

/**
 * Build the message list to feed to the model. If the stored history would
 * exceed the token cap, summarize the oldest chunk to a ~200-token block and
 * prepend it to the recent kept turns. The summary is cached by content hash
 * so we don't regenerate it every turn. Summaries are also accumulated into a
 * running summary key so older context persists across window shifts.
 */
export async function historyForPrompt(userId: string): Promise<ModelMessage[]> {
  const endOverall = span("history:forPrompt");
  const history = await loadHistory(userId);
  const est = estimateTokens(history);
  const recentCount = adaptiveRecentCount(history.length);

  if (est <= TOKEN_CAP || history.length <= recentCount) {
    const msgs = history.map(toModelMessage).filter(Boolean) as ModelMessage[];
    endOverall({ cached: "n/a", turns: history.length, estTokens: est });
    return msgs;
  }

  const oldest = history.slice(0, history.length - recentCount);
  const recent = history.slice(history.length - recentCount);
  const hash = hashTurns(oldest);
  const cached = await redis().get<string>(summaryKey(userId, hash));
  let summary = cached ?? null;

  if (!summary) {
    const endSum = span("history:summarize");
    summary = await summarizeOldest(oldest);
    endSum({ turns: oldest.length, estTokens: est });
    if (summary) {
      await redis()
        .set(summaryKey(userId, hash), summary, { ex: 60 * 60 * 24 * 30 })
        .catch(() => {});
      // Append to running summary so older context persists across shifts.
      const running = await redis().get<string>(runningSummaryKey(userId));
      const next = running ? `${running}\n${summary}` : summary;
      await redis()
        .set(runningSummaryKey(userId), next.slice(-1200), { ex: 60 * 60 * 24 * 90 })
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
  return [summaryTurn, ...recent.map(toModelMessage).filter(Boolean) as ModelMessage[]];
}

const PLACEHOLDER_REPLIES = new Set(["…", "...", "", " ", "Done."]);
const FALLBACK_PATTERN = /^[a-z_]+ ✓$/i; // e.g. "list_tasks ✓", "weather ✓"

function isPlaceholderReply(text: string): boolean {
  const trimmed = text.trim();
  if (PLACEHOLDER_REPLIES.has(trimmed)) return true;
  if (FALLBACK_PATTERN.test(trimmed)) return true;
  // Catch ultra-short replies that are just labels ("Reminder set", "Task added")
  if (/^(Reminder set|Recurring reminder set|Reminder cancelled|Email scheduled|Scheduled email cancelled|Task added|Task done|Task deleted|Saved to memory|Memory removed|Memories cleared|Calendar event drafted|Timezone updated|Location updated|Language updated|Morning briefing enabled|Morning briefing disabled|Evening summary enabled|Evening summary disabled)$/.test(trimmed)) {
    return true;
  }
  return false;
}

function toModelMessage(t: StoredTurn): ModelMessage | null {
  // Skip empty or placeholder assistant replies — they teach the model bad habits.
  if (t.role === "assistant" && isPlaceholderReply(t.content)) {
    return null;
  }
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
    const r = await withExtractorFallback((model) =>
      generateText({
        model,
        system: `Summarize the earlier portion of a conversation between a user and their assistant in roughly ${SUMMARY_TARGET_TOKENS} tokens (~150 words). Capture: ongoing tasks, decisions, commitments, important entities (people/places/dates). Be concrete. Output the summary only — no preamble.`,
        prompt: transcript,
      }),
    );
    const s = r.text.trim();
    return s.length > 30 ? s : null;
  } catch (err) {
    console.warn("[history] summarize failed", err);
    return null;
  }
}
