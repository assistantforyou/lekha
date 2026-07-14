import { describe, it, expect } from "vitest";
import { generateSampleReport } from "./fixtures/sample-report";
import { extractTextAndLayout, countWords } from "@/lib/document-parser/parse-pdf";
import { classifyPage } from "@/lib/document-parser/detect-content";
import { chunkDocument } from "@/lib/memory/documents";
import type { ParsedDocument } from "@/lib/document-parser/types";

describe("document parser", () => {
  it("extracts text and preserves page order", async () => {
    const pdf = await generateSampleReport();
    const pages = await extractTextAndLayout(pdf);

    expect(pages.length).toBe(1);
    expect(pages[0]!.text).toContain("Lekha Test Report");
    expect(pages[0]!.text).toContain("Premium Widget");
    expect(pages[0]!.text).toContain("$54,000");
  });

  it("classifies the table region as table or mixed", async () => {
    const pdf = await generateSampleReport();
    const pages = await extractTextAndLayout(pdf);
    const cls = classifyPage(pages[0]!);

    expect(["table", "mixed"]).toContain(cls.flag);
    expect(cls.confidence).toBeGreaterThan(0.5);
  });

  it("chunks a parsed document without splitting tables", () => {
    const doc: ParsedDocument = {
      fileName: "sample.pdf",
      title: "Sample",
      pageCount: 1,
      pages: [
        {
          number: 1,
          width: 612,
          height: 792,
          text: "Intro paragraph. " + "Word. ".repeat(500),
          words: [],
          lines: [],
        },
      ],
      tables: [
        {
          id: "t1",
          page: 1,
          title: "Products",
          headers: ["Product", "Price"],
          rows: [
            ["Widget A", "$10"],
            ["Widget B", "$20"],
          ],
          markdown: "",
        },
      ],
      charts: [],
      sections: [{ title: "Section 1", startPage: 1, endPage: 1, text: "Section text" }],
      parsedAt: new Date().toISOString(),
    };

    const chunks = chunkDocument(doc, "doc-1");
    const tableChunks = chunks.filter((c) => c.metadata.kind === "table");

    expect(tableChunks.length).toBe(1);
    expect(tableChunks[0]!.text).toContain("Widget A");
    expect(tableChunks[0]!.text).toContain("Widget B");
    expect(tableChunks[0]!.text).toContain("$10");
    expect(tableChunks[0]!.text).toContain("$20");
  });

  it("counts words across pages", async () => {
    const pdf = await generateSampleReport();
    const pages = await extractTextAndLayout(pdf);
    expect(countWords(pages)).toBeGreaterThan(20);
  });
});
