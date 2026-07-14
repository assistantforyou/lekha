import { extractTextAndLayout, renderPageToImage } from "./parse-pdf";
import { classifyPage, findLikelyTitle } from "./detect-content";
import { extractTablesFromPage, extractChartsFromPage } from "./extract-visual";
import type { ParsedDocument, Page, Section } from "./types";

export type { ParsedDocument, Page, Table, Chart, Section } from "./types";
export { extractTextAndLayout, renderPageToImage } from "./parse-pdf";
export { classifyPage } from "./detect-content";

/** Options for parseDocument. */
export type ParseOptions = {
  /** Render scale for page images. Higher = better OCR, slower. */
  renderScale?: number;
  /** Skip visual extraction entirely (text only). */
  skipVisual?: boolean;
  /** Limit visual extraction to the first N pages. */
  visualPageLimit?: number;
};

/**
 * Parse a PDF into a structured document: text per page, extracted tables,
 * extracted charts, and inferred sections.
 *
 * This is the main entry point for the production-grade document pipeline.
 */
export async function parseDocument(
  bytes: Uint8Array,
  fileName: string,
  opts: ParseOptions = {},
): Promise<ParsedDocument> {
  const pages = await extractTextAndLayout(bytes);
  const title = findLikelyTitle(pages[0]!) ?? fileName.replace(/\.pdf$/i, "");

  const classifications = pages.map(classifyPage);
  const tables = [];
  const charts = [];

  if (!opts.skipVisual) {
    const limit = opts.visualPageLimit ?? pages.length;
    for (const page of pages.slice(0, limit)) {
      const cls = classifications[page.number - 1]!;
      if (cls.flag === "text") continue;

      try {
        const { buffer } = await renderPageToImage(bytes, page.number, opts.renderScale ?? 2.0);
        if (cls.flag === "table" || cls.flag === "mixed") {
          const pageTables = await extractTablesFromPage(buffer, page.text, page.number);
          tables.push(...pageTables);
        }
        if (cls.flag === "chart" || cls.flag === "mixed") {
          const pageCharts = await extractChartsFromPage(buffer, page.number);
          charts.push(...pageCharts);
        }
      } catch (err) {
        console.warn("[document-parser] visual extraction error", { page: page.number, err });
      }
    }
  }

  const sections = inferSections(pages);

  return {
    fileName,
    title,
    pageCount: pages.length,
    pages,
    tables,
    charts,
    sections,
    parsedAt: new Date().toISOString(),
  };
}

/**
 * Infer document sections from font-size jumps and heading-like lines.
 * Falls back to one section per page.
 */
function inferSections(pages: Page[]): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;

  for (const page of pages) {
    const heading = findSectionHeading(page.words, page.lines);
    if (heading) {
      if (current) {
        current.endPage = page.number - 1;
      }
      current = {
        title: heading,
        startPage: page.number,
        endPage: page.number,
        text: page.text,
      };
      sections.push(current);
    } else if (current) {
      current.endPage = page.number;
      current.text += "\n" + page.text;
    } else {
      current = {
        title: `Page ${page.number}`,
        startPage: page.number,
        endPage: page.number,
        text: page.text,
      };
      sections.push(current);
    }
  }

  return sections.length ? sections : pages.map((p) => ({ title: `Page ${p.number}`, startPage: p.number, endPage: p.number, text: p.text }));
}

function findSectionHeading(words: { text: string; fontSize?: number; y: number }[], lines: string[]): string | null {
  if (!words.length) return null;
  const avgSize = words.reduce((s, w) => s + (w.fontSize ?? 10), 0) / words.length;

  // Look for the first short line with font size significantly above average.
  for (const line of lines.slice(0, 8)) {
    const lineWords = words.filter((w) => line.includes(w.text));
    if (!lineWords.length) continue;
    const size = lineWords.reduce((s, w) => s + (w.fontSize ?? 10), 0) / lineWords.length;
    if (size > avgSize * 1.3 && line.length < 100 && line.length > 5) {
      return line;
    }
  }
  return null;
}
