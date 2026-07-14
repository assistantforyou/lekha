import { generateObject, generateText } from "ai";
import { z } from "zod";
import type { ParsedDocument } from "@/lib/document-parser/types";
import { extractorModel, withExtractorFallback } from "@/lib/llm/provider";
import { fetchCachedWebSearch } from "@/lib/search-cache";
import { env } from "@/lib/env";

const ResearchQueriesSchema = z.object({
  queries: z
    .array(z.string().min(5).max(200))
    .max(6)
    .describe("Concise web search queries that will verify or expand on the document content"),
});

const SynthesisSchema = z.object({
  findings: z.array(
    z.object({
      claim: z.string().describe("A claim, fact, or topic from the document"),
      onlineEvidence: z.string().describe("What online sources say about it"),
      verdict: z.enum(["confirmed", "contradicted", "unclear", "context"]).describe("Your assessment"),
      sources: z.array(z.string()).describe("Source URLs"),
    }),
  ).max(8),
  summary: z.string().describe("2-4 sentence overall summary for the user"),
});

export type ResearchReport = {
  queries: string[];
  findings: {
    claim: string;
    onlineEvidence: string;
    verdict: "confirmed" | "contradicted" | "unclear" | "context";
    sources: string[];
  }[];
  summary: string;
};

/**
 * Perform multi-claim research on a parsed document.
 *
 * 1. Extract key claims/topics relevant to the user's question.
 * 2. Run parallel web searches.
 * 3. Synthesize findings with verdicts and citations.
 */
export async function planDocumentResearch(
  doc: ParsedDocument,
  userQuestion: string,
): Promise<ResearchReport> {
  const apiKey = env().TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("Web search is not configured (TAVILY_API_KEY).");
  }

  const queries = await extractQueries(doc, userQuestion);
  const searchResults = await Promise.all(
    queries.map(async (q) => ({ query: q, result: await fetchCachedWebSearch(q, apiKey, 5) })),
  );

  const synthesis = await synthesizeFindings(doc, userQuestion, queries, searchResults);
  return {
    queries,
    findings: synthesis.findings,
    summary: synthesis.summary,
  };
}

async function extractQueries(doc: ParsedDocument, userQuestion: string): Promise<string[]> {
  const docSummary = buildDocSummary(doc);
  try {
    const result = await withExtractorFallback((model) =>
      generateObject({
        model,
        schema: ResearchQueriesSchema,
        system: `You are a research assistant. Given a document summary and a user question, generate 1-6 specific web search queries that will verify claims, find current context, or compare the document's content to online sources.

Rules:
- Each query should be self-contained and search-engine friendly.
- Prefer queries about named entities, numbers, prices, dates, products, or organizations.
- If the question is vague, generate queries about the document's main topics.
- Output JSON only.`,
        prompt: `User question: ${userQuestion}\n\nDocument summary:\n${docSummary.slice(0, 3000)}`,
      }),
    );
    return result.object.queries.slice(0, 6);
  } catch (err) {
    console.warn("[research-planner] query extraction failed, falling back", err);
    return [userQuestion, `${doc.title} current information`].filter(Boolean);
  }
}

async function synthesizeFindings(
  doc: ParsedDocument,
  userQuestion: string,
  queries: string[],
  searchResults: { query: string; result: { answer: string | null; results: { title: string; url: string; snippet: string }[] } }[],
) {
  const evidenceBlock = searchResults
    .map(
      (s) =>
        `Query: ${s.query}\nAnswer: ${s.result.answer ?? "n/a"}\n` +
        s.result.results.map((r) => `- ${r.title} (${r.url})\n  ${r.snippet}`).join("\n"),
    )
    .join("\n\n");

  try {
    const result = await withExtractorFallback((model) =>
      generateObject({
        model,
        schema: SynthesisSchema,
        system: `You synthesize online research about a document. Be factual, concise, and cite sources.

Rules:
- Each finding must map to something in the document or the user's question.
- Verdicts: confirmed (online sources agree), contradicted (sources disagree), unclear (conflicting or missing), context (background/additional info).
- Include source URLs for each finding.
- Output JSON only.`,
        prompt: `Document title: ${doc.title}\nUser question: ${userQuestion}\n\nOnline evidence:\n${evidenceBlock.slice(0, 6000)}`,
      }),
    );
    return result.object;
  } catch (err) {
    console.warn("[research-planner] synthesis failed, using text fallback", err);
    const fallback = await generateText({
      model: extractorModel(),
      system: "Synthesize the following online research into a short report. List key findings and cite sources.",
      prompt: `User question: ${userQuestion}\n\n${evidenceBlock.slice(0, 6000)}`,
    });
    return {
      findings: [
        {
          claim: userQuestion,
          onlineEvidence: fallback.text,
          verdict: "context" as const,
          sources: searchResults.flatMap((s) => s.result.results.map((r) => r.url)),
        },
      ],
      summary: fallback.text,
    };
  }
}

function buildDocSummary(doc: ParsedDocument): string {
  const parts: string[] = [];
  parts.push(`Title: ${doc.title}`);
  parts.push(`Pages: ${doc.pageCount}`);
  if (doc.tables.length) {
    parts.push(`Tables: ${doc.tables.length}`);
    for (const t of doc.tables.slice(0, 3)) {
      parts.push(`- ${t.title ?? "Table"}: ${t.headers.join(", ")}`);
    }
  }
  if (doc.charts.length) {
    parts.push(`Charts: ${doc.charts.length}`);
  }
  parts.push("Section outline:");
  for (const s of doc.sections.slice(0, 8)) {
    parts.push(`- ${s.title} (pages ${s.startPage}-${s.endPage})`);
  }
  return parts.join("\n");
}

/** Format a ResearchReport for a LINE reply. */
export function formatResearchReport(report: ResearchReport): string {
  const lines: string[] = [];
  lines.push(report.summary);
  if (report.findings.length) {
    lines.push("");
    for (const f of report.findings) {
      const emoji = { confirmed: "✅", contradicted: "⚠️", unclear: "❓", context: "ℹ️" }[f.verdict];
      lines.push(`${emoji} ${f.claim}`);
      lines.push(f.onlineEvidence);
      if (f.sources.length) {
        lines.push(f.sources.slice(0, 3).join("\n"));
      }
      lines.push("");
    }
  }
  return lines.join("\n").trim();
}
