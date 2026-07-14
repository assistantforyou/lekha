import type { Page, PageClassification, PageFlag } from "./types";

/**
 * Heuristic classification of PDF pages to decide which pages need visual
 * table/chart extraction vs. plain text extraction.
 */

const CHART_KEYWORDS = new Set([
  "chart", "graph", "figure", "fig.", "plot", "trend", "distribution",
  "bar", "line chart", "pie chart", "scatter", "histogram",
  "แผนภูมิ", "กราฟ", "ตาราง", // Thai
]);

const TABLE_KEYWORDS = new Set([
  "table", "tabular", "schedule", "inventory", "price list",
  "ตาราง", "รายการ", "ราคา", // Thai
]);

export function classifyPage(page: Page): PageClassification {
  const lowerText = page.text.toLowerCase();
  const words = page.words;
  const lineCount = page.lines.length || 1;

  // Table heuristic: many short numeric/currency lines, repeated vertical alignment.
  const avgLineLength = words.length / lineCount;
  const numericCells = words.filter((w) => /^[\d,\.\-฿$€£¥%]+$/.test(w.text.trim())).length;
  const numericRatio = words.length ? numericCells / words.length : 0;

  // Detect columns by grouping words into rough vertical bands.
  const bands = estimateColumnBands(words, page.width);
  const multiColumn = bands.length >= 3 && bands.length <= 12;

  const hasTableKeyword = [...TABLE_KEYWORDS].some((k) => lowerText.includes(k));
  const hasChartKeyword = [...CHART_KEYWORDS].some((k) => lowerText.includes(k));

  let flag: PageFlag = "text";
  let confidence = 0;
  let reason = "Mostly prose";

  if ((hasTableKeyword || (multiColumn && numericRatio > 0.25)) && avgLineLength < 12) {
    flag = "table";
    confidence = hasTableKeyword ? 0.9 : 0.7;
    reason = hasTableKeyword ? "Table keyword detected" : "Multi-column numeric layout";
  } else if (hasChartKeyword || (numericRatio < 0.1 && avgLineLength < 8 && lineCount < 20)) {
    // Sparse page with chart keywords or very sparse numeric content.
    flag = "chart";
    confidence = hasChartKeyword ? 0.85 : 0.5;
    reason = hasChartKeyword ? "Chart keyword detected" : "Sparse layout suggests figure";
  } else if ((multiColumn || hasTableKeyword || hasChartKeyword) && avgLineLength < 15) {
    flag = "mixed";
    confidence = 0.6;
    reason = "Mixed text and structured content";
  }

  return { page: page.number, flag, confidence, reason };
}

/**
 * Very rough column detection: bucket word x-positions and look for tight bands.
 * Returns the number of likely columns.
 */
function estimateColumnBands(words: { x: number; width: number }[], pageWidth: number): { center: number; count: number }[] {
  if (!words.length) return [];
  const centers = words.map((w) => w.x + w.width / 2).sort((a, b) => a - b);
  const tolerance = Math.max(8, pageWidth * 0.02);

  const bands: { center: number; count: number }[] = [];
  for (const c of centers) {
    const existing = bands.find((b) => Math.abs(b.center - c) <= tolerance);
    if (existing) {
      existing.center = (existing.center * existing.count + c) / (existing.count + 1);
      existing.count++;
    } else {
      bands.push({ center: c, count: 1 });
    }
  }

  // Only count bands with meaningful density.
  const threshold = Math.max(2, words.length / bands.length / 3);
  return bands.filter((b) => b.count >= threshold);
}

export function findLikelyTitle(page: Page): string | undefined {
  // First non-empty line with larger-than-average font size is likely the title.
  const firstLines = page.lines.slice(0, 3);
  for (const line of firstLines) {
    const lineWords = page.words.filter((w) => line.includes(w.text));
    const avgSize = lineWords.length
      ? lineWords.reduce((s, w) => s + (w.fontSize ?? 10), 0) / lineWords.length
      : 0;
    if (avgSize > 14 && line.length < 120) return line;
  }
  return firstLines.find((l) => l.length < 120 && l.length > 5);
}
