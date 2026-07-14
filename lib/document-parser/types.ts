/**
 * Structured document model for Lekha's production-grade document parser.
 * Separates text, tables, and charts so each can be retrieved and reasoned
 * about without re-reading the whole PDF.
 */

export type WordBox = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  /** Font size in PDF units. */
  fontSize?: number;
};

export type Page = {
  number: number;
  width: number;
  height: number;
  text: string;
  words: WordBox[];
  /** Estimated reading order lines. */
  lines: string[];
};

export type Table = {
  id: string;
  page: number;
  title?: string;
  headers: string[];
  rows: string[][];
  /** Approximate bounding box on the page. */
  bbox?: { x: number; y: number; width: number; height: number };
  /** Markdown rendering for prompt/context use. */
  markdown: string;
};

export type ChartSeries = {
  name: string;
  values: number[];
  color?: string;
};

export type Chart = {
  id: string;
  page: number;
  title?: string;
  type: "bar" | "line" | "pie" | "scatter" | "unknown";
  xAxis?: { label?: string; categories?: string[] };
  yAxis?: { label?: string; min?: number; max?: number };
  series: ChartSeries[];
  note?: string;
};

export type Section = {
  title: string;
  startPage: number;
  endPage: number;
  text: string;
};

export type ParsedDocument = {
  fileName: string;
  title: string;
  pageCount: number;
  pages: Page[];
  tables: Table[];
  charts: Chart[];
  sections: Section[];
  /** ISO timestamp of parsing. */
  parsedAt: string;
};

export type PageFlag = "table" | "chart" | "text" | "mixed";

export type PageClassification = {
  page: number;
  flag: PageFlag;
  confidence: number;
  reason: string;
};
