import { generateObject, generateText } from "ai";
import { z } from "zod";
import { extractorModel } from "./provider";
import {
  loadFacts,
  saveFacts,
  type UserFacts,
  type Fact,
  type FactCategory,
  FACT_CATEGORIES,
  _internalNewFact,
} from "@/lib/memory/facts";
import type { StoredTurn } from "@/lib/memory/history";
import { appendArchive } from "@/lib/memory/archive";
import { Memory } from "@mastra/memory";
import { getLekhaAgent } from "@/mastra/agents/lekha-agent";

const ExtractedFact = z.object({
  content: z.string().min(5).max(1000),
  category: z.enum(FACT_CATEGORIES as [FactCategory, ...FactCategory[]]),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});
const Schema = z.object({
  facts: z.array(ExtractedFact).max(15),
});

const FACT_EXTRACTION_PROMPT = `You extract durable facts about a user from their recent chat with their assistant. Output structured JSON.

Categories:
- preferences: stable taste ("prefers espresso over filter", "vegetarian")
- people: contacts and relationships ("mom's email is mom@gmail.com", "brother is named Bob")
- habits: recurring routines ("goes to gym Mondays")
- deadlines: known upcoming dates ("conference talk on 2026-06-12")
- context: location/profession/language ("based in Bangkok", "software engineer")
- health: medical/dietary/wellbeing facts
- work: job-related facts ("works at Acme", "ships releases on Fridays")
- other: anything durable that doesn't fit above

Rules:
- 0 to 15 facts. Each <= 200 chars.
- Extract durable facts aggressively: preferences, relationships, routines, deadlines, context, health, work, and anything that will still matter in a week.
- Facts can be inferred — the user does not need to explicitly say "remember that". If they mention their mom, a recurring gym schedule, a project deadline, a food dislike, etc., capture it.
- Do NOT include: one-off questions, transient moods, assistant responses, or anything the user asked you to forget.
- Phrase in third person ("User prefers X").
- Preserve the original language — if the conversation was in Thai, write facts in Thai. Do not translate.
- If nothing durable, return { "facts": [] }.

Output JSON only.`;

export async function extractAndMergeFacts(userId: string, recent: StoredTurn[]): Promise<void> {
  if (recent.length < 4) return;

  const transcript = recent
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n");

  const existing = await loadFacts(userId);
  // Send only the 20 most-recently-updated facts plus a 1-line category summary.
  // Sending all 200 at max capacity wastes ~4k tokens of extractor budget.
  const knownSample = [...existing.facts]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20);
  const otherCategories = new Set(existing.facts.map((f) => f.category));
  knownSample.forEach((f) => otherCategories.delete(f.category));
  const categorySummary = otherCategories.size
    ? `Other categories with older facts: ${[...otherCategories].join(", ")}.`
    : "";
  const existingBlock = knownSample.length
    ? `\n\nFacts already known (do NOT repeat):\n${knownSample.map((f) => `- [${f.category}] ${f.content}`).join("\n")}${categorySummary ? "\n" + categorySummary : ""}`
    : "";

  let result;
  try {
    result = await generateObject({
      model: extractorModel(),
      schema: Schema,
      system: FACT_EXTRACTION_PROMPT,
      prompt: `Conversation:\n${transcript}${existingBlock}`,
    });
  } catch (err) {
    console.warn("[facts] extraction failed", err);
    return;
  }

  const incoming = result.object.facts;
  if (incoming.length) {
    const seen = new Set(
      existing.facts.map((f) => `${f.category}:${f.content.toLowerCase()}`),
    );
    const merged: UserFacts = {
      facts: [...existing.facts],
      updatedAt: Date.now(),
    };
    for (const f of incoming) {
      const k = `${f.category}:${f.content.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const fact: Fact = _internalNewFact(f.content, f.category, {
        confidence: f.confidence,
      });
      merged.facts.push(fact);
    }
    await saveFacts(userId, merged);
  }

  // Long-term archive: 2-4 sentence summary distilled from the chunk.
  try {
    const r = await generateText({
      model: extractorModel(),
      system:
        "Summarize this conversation chunk between a user and their assistant in 2–4 sentences. Capture topics, decisions, commitments, and anything worth being able to recall in weeks. Be concrete (names, dates, places). Output the summary only.",
      prompt: transcript,
    });
    const summary = r.text.trim();
    if (summary.length > 30) {
      await appendArchive(userId, {
        fromTs: recent[0]?.ts ?? Date.now(),
        toTs: recent[recent.length - 1]?.ts ?? Date.now(),
        summary,
      });
    }
  } catch (err) {
    console.warn("[archive] summary failed", err);
  }
}

type MastraMessage = {
  role: "user" | "assistant" | "system" | "signal";
  threadId?: string;
  createdAt: Date;
  content: { parts?: Array<{ type?: string; text?: string }> };
};

/** Read the user's Mastra Memory thread and extract durable facts. */
export async function extractAndMergeFactsFromMastra(userId: string, threadId?: string): Promise<void> {
  const memory = (await getLekhaAgent().getMemory()) as Memory | undefined;
  if (!memory) return;

  const targetThreadId = threadId ?? userId;

  try {
    const { messages } = await memory.listMessagesByResourceId({
      resourceId: userId,
      perPage: 40,
      orderBy: { field: "createdAt", direction: "DESC" },
    });

    const recent = (messages as MastraMessage[])
      .filter((m) => (m.role === "user" || m.role === "assistant") && m.threadId === targetThreadId)
      .map((m) => {
        const text = (m.content?.parts ?? [])
          .filter((p) => p.type === "text" && typeof p.text === "string")
          .map((p) => p.text)
          .filter((t): t is string => Boolean(t))
          .join(" ");
        return {
          role: m.role as "user" | "assistant",
          content: text || "[media]",
          ts: m.createdAt.getTime(),
        };
      })
      .reverse();

    await extractAndMergeFacts(userId, recent);
  } catch (err) {
    console.warn("[facts] Mastra extraction failed", err);
  }
}
