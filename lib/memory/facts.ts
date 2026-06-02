import { redis } from "./redis";

/**
 * Structured fact schema (F1). Each user has up to ~200 facts; LRU evicts
 * the oldest-updated when the cap is exceeded.
 *
 * Old text-blob schema lived at `user:{userId}:facts` — that key is deleted
 * lazily on the first read of the new key (dev env, wipe-OK per James).
 */

export type FactCategory =
  | "preferences"
  | "people"
  | "habits"
  | "deadlines"
  | "context"
  | "health"
  | "work"
  | "other";

export const FACT_CATEGORIES: FactCategory[] = [
  "preferences",
  "people",
  "habits",
  "deadlines",
  "context",
  "health",
  "work",
  "other",
];

export type Fact = {
  id: string;
  category: FactCategory;
  content: string;
  sourceTurnId?: string;
  createdAt: number;
  updatedAt: number;
  confidence?: "high" | "medium" | "low";
};

export type UserFacts = {
  facts: Fact[];
  /** Last time facts were extracted/refreshed (ms). */
  updatedAt: number;
};

const MAX_FACTS = 200;
const MAX_CONTENT = 1000;

const key = (userId: string) => `user:${userId}:facts:v2`;
const legacyKey = (userId: string) => `user:${userId}:facts`;

function isCategory(s: unknown): s is FactCategory {
  return typeof s === "string" && (FACT_CATEGORIES as string[]).includes(s);
}

export async function loadFacts(userId: string): Promise<UserFacts> {
  const v = await redis().get<UserFacts>(key(userId));
  if (v && Array.isArray(v.facts)) return v;
  // Lazy wipe of legacy text-blob key — fresh start on new schema.
  await redis().del(legacyKey(userId)).catch(() => {});
  return { facts: [], updatedAt: 0 };
}

export async function saveFacts(userId: string, facts: UserFacts): Promise<void> {
  // Enforce cap: LRU on updatedAt ascending.
  let list = facts.facts.map((f) => ({
    ...f,
    content: f.content.slice(0, MAX_CONTENT),
  }));
  if (list.length > MAX_FACTS) {
    list = [...list]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_FACTS);
  }
  await redis().set(key(userId), { facts: list, updatedAt: facts.updatedAt });
}

function newFact(content: string, category: FactCategory = "other", opts?: Partial<Fact>): Fact {
  const now = Date.now();
  return {
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 12),
    category,
    content: content.trim().slice(0, MAX_CONTENT),
    createdAt: now,
    updatedAt: now,
    ...opts,
  };
}

/** Add a single fact. Dedupe on lowercase content match within the same category. */
export async function appendFact(
  userId: string,
  content: string,
  opts?: { category?: FactCategory; sourceTurnId?: string; confidence?: Fact["confidence"] },
): Promise<void> {
  const norm = content.trim();
  if (!norm) return;
  const category = opts?.category ?? "other";
  const facts = await loadFacts(userId);
  const dupIdx = facts.facts.findIndex(
    (f) => f.category === category && f.content.toLowerCase() === norm.toLowerCase(),
  );
  if (dupIdx >= 0) {
    // Bump updatedAt so LRU keeps it.
    facts.facts[dupIdx]!.updatedAt = Date.now();
  } else {
    facts.facts.push(
      newFact(norm, category, {
        sourceTurnId: opts?.sourceTurnId,
        confidence: opts?.confidence,
      }),
    );
  }
  facts.updatedAt = Date.now();
  await saveFacts(userId, facts);
}

/** Update a fact at a 1-indexed position (display order: newest first). */
export async function updateFact(userId: string, index1: number, content: string): Promise<boolean> {
  const facts = await loadFacts(userId);
  const ordered = displayOrder(facts.facts);
  const target = ordered[index1 - 1];
  if (!target) return false;
  const norm = content.trim().slice(0, MAX_CONTENT);
  if (!norm) return false;
  target.content = norm;
  target.updatedAt = Date.now();
  facts.updatedAt = Date.now();
  await saveFacts(userId, facts);
  return true;
}

/** Delete a fact at a 1-indexed position (display order). */
export async function removeFact(userId: string, index1: number): Promise<boolean> {
  const facts = await loadFacts(userId);
  const ordered = displayOrder(facts.facts);
  const target = ordered[index1 - 1];
  if (!target) return false;
  facts.facts = facts.facts.filter((f) => f.id !== target.id);
  facts.updatedAt = Date.now();
  await saveFacts(userId, facts);
  return true;
}

export async function clearFacts(userId: string): Promise<number> {
  const facts = await loadFacts(userId);
  const n = facts.facts.length;
  await saveFacts(userId, { facts: [], updatedAt: Date.now() });
  return n;
}

/** Display order = newest-updated first. Stable across calls. */
export function displayOrder(facts: Fact[]): Fact[] {
  return [...facts].sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Render facts for the system prompt: group by category, newest-first within
 * category. Keeps the prompt scannable for the model and stable for caching
 * (categories shown in a fixed order).
 */
export function factsToPromptBlock(facts: UserFacts): string {
  if (!facts.facts.length) return "";
  const byCat = new Map<FactCategory, Fact[]>();
  for (const f of displayOrder(facts.facts)) {
    if (!byCat.has(f.category)) byCat.set(f.category, []);
    byCat.get(f.category)!.push(f);
  }
  const sections: string[] = [];
  for (const cat of FACT_CATEGORIES) {
    const list = byCat.get(cat);
    if (!list?.length) continue;
    sections.push(`[${cat}]\n${list.map((f) => `- ${f.content}`).join("\n")}`);
  }
  return `\n\nWhat you remember about this user:\n${sections.join("\n\n")}`;
}

/** Format a single fact for tool output: "[1] [people] mom = mom@gmail.com — 2m ago". */
export function formatFactLine(f: Fact, index1: number, now = Date.now()): string {
  const ago = humanAgo(now - f.updatedAt);
  return `[${index1}] [${f.category}] ${f.content} — ${ago}`;
}

function humanAgo(ms: number): string {
  if (ms < 60_000) return "just now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

export function _internalNewFact(
  content: string,
  category: FactCategory = "other",
  opts?: Partial<Fact>,
): Fact {
  return newFact(content, category, opts);
}
