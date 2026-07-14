import { generateSampleReport } from "@/tests/fixtures/sample-report";
import { parseDocument, extractTextAndLayout } from "@/lib/document-parser";
import { indexParsedDocument } from "@/lib/memory/documents";
import { planDocumentResearch, formatResearchReport } from "@/lib/research-planner";


const TEST_USER_ID = "U" + "0".repeat(32);

async function main() {
  console.log("=== Lekha Document Pipeline Test ===\n");

  const pdf = await generateSampleReport();
  console.log(`Generated sample PDF: ${pdf.length} bytes\n`);

  // Phase 1: Text extraction
  console.log("--- Phase 1: Text extraction ---");
  const pages = await extractTextAndLayout(pdf);
  console.log(`Pages: ${pages.length}`);
  console.log(`First page text preview:\n${pages[0]!.text.slice(0, 600)}...\n`);

  // Phase 2: Full parse (may invoke Gemini vision for tables/charts)
  console.log("--- Phase 2: Full document parse ---");
  const hasGemini = Boolean(process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY_FREE);
  const parsed = await parseDocument(pdf, "sample-report.pdf", {
    skipVisual: !hasGemini,
    visualPageLimit: 1,
  });

  console.log(`Title: ${parsed.title}`);
  console.log(`Pages: ${parsed.pageCount}`);
  console.log(`Sections: ${parsed.sections.length}`);
  console.log(`Tables detected: ${parsed.tables.length}`);
  for (const t of parsed.tables) {
    console.log(`\nTable on page ${t.page}: ${t.title ?? "(no title)"}`);
    console.log(`Headers: ${t.headers.join(" | ")}`);
    console.log(`Rows: ${t.rows.length}`);
    for (const row of t.rows) {
      console.log(`  ${row.join(" | ")}`);
    }
  }

  console.log(`Charts detected: ${parsed.charts.length}`);
  for (const c of parsed.charts) {
    console.log(`\nChart on page ${c.page}: ${c.title ?? "(no title)"} (${c.type})`);
    console.log(`Series: ${c.series.map((s) => `${s.name}=[${s.values.join(",")}]`).join("; ")}`);
  }

  // Phase 3: Indexing (best-effort; requires Upstash Vector env)
  console.log("\n--- Phase 3: Indexing ---");
  try {
    await indexParsedDocument(TEST_USER_ID, "sample-doc-id", "sample-report.pdf", parsed);
    console.log("Indexed parsed document successfully.");
  } catch (err) {
    console.warn("Indexing skipped or failed:", err instanceof Error ? err.message : String(err));
  }

  // Phase 4: Research planner (requires Tavily)
  console.log("\n--- Phase 4: Research planner ---");
  const hasTavily = Boolean(process.env.TAVILY_API_KEY);
  if (hasTavily) {
    try {
      const report = await planDocumentResearch(parsed, "Verify the sales numbers and product prices in this report.");
      console.log("Research queries:", report.queries);
      console.log("\nFormatted report:\n" + formatResearchReport(report));
    } catch (err) {
      console.error("Research planner failed:", err instanceof Error ? err.message : String(err));
    }
  } else {
    console.log("TAVILY_API_KEY not set; skipping research planner.");
  }

  console.log("\n=== Test complete ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
