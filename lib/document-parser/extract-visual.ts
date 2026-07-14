import { generateObject } from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/llm/provider";
import type { Chart, Table } from "./types";

const TableSchema = z.object({
  title: z.string().optional().describe("Table title or caption if visible"),
  headers: z.array(z.string()).describe("Column headers"),
  rows: z.array(z.array(z.string())).describe("Each row as an array of cell values"),
});

const TablesSchema = z.object({
  tables: z.array(TableSchema).max(5).describe("All tables visible on the page"),
});

const ChartSchema = z.object({
  title: z.string().optional().describe("Chart title or caption if visible"),
  type: z.enum(["bar", "line", "pie", "scatter", "unknown"]).describe("Chart type"),
  xAxis: z.object({
    label: z.string().optional(),
    categories: z.array(z.string()).optional().describe("Category labels if categorical axis"),
  }).optional(),
  yAxis: z.object({
    label: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),
  series: z.array(z.object({
    name: z.string(),
    values: z.array(z.number()),
  })).describe("Data series"),
  note: z.string().optional().describe("Any caveat, e.g. 'values are approximate'"),
});

const ChartsSchema = z.object({
  charts: z.array(ChartSchema).max(5).describe("All charts visible on the page"),
});

function tableToMarkdown(table: Table): string {
  if (!table.headers.length && !table.rows.length) return "";
  const header = table.headers.length ? `| ${table.headers.join(" | ")} |` : "";
  const sep = table.headers.length ? `| ${table.headers.map(() => "---").join(" | ")} |` : "";
  const rows = table.rows.map((r) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`).join("\n");
  return [header, sep, rows].filter(Boolean).join("\n");
}

function sanitizeCell(cell: string): string {
  return cell.trim().replace(/\s+/g, " ");
}

/**
 * Extract tables from a rendered page image using Gemini vision.
 */
export async function extractTablesFromPage(
  pageImage: Buffer,
  pageTextHint: string,
  pageNumber: number,
): Promise<Table[]> {
  try {
    const result = await generateObject({
      model: chatModel(),
      schema: TablesSchema,
      system: `You are a document intelligence assistant. Look at the provided page image and extract every visible table as structured data.

Rules:
- Preserve exact text, numbers, currency, dates, and Thai text.
- If a cell is empty, return an empty string.
- Do not merge cells; emit one value per cell.
- If no table is visible, return { "tables": [] }.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `Extract all tables from this PDF page. Page text hint:\n${pageTextHint.slice(0, 1000)}` },
            { type: "image", image: pageImage, mediaType: "image/png" },
          ],
        },
      ],
    });

    return result.object.tables.map((t, i) => {
      const headers = t.headers.map(sanitizeCell);
      const rows = t.rows.map((row) =>
        // Pad or truncate rows to match header count for clean Markdown.
        headers.map((_, ci) => sanitizeCell(row[ci] ?? "")),
      );
      const table: Table = {
        id: `table-p${pageNumber}-${i + 1}`,
        page: pageNumber,
        title: t.title,
        headers,
        rows,
        markdown: "",
      };
      table.markdown = tableToMarkdown(table);
      return table;
    });
  } catch (err) {
    console.warn("[document-parser] table extraction failed", { pageNumber, err });
    return [];
  }
}

/**
 * Extract charts from a rendered page image using Gemini vision.
 */
export async function extractChartsFromPage(
  pageImage: Buffer,
  pageNumber: number,
): Promise<Chart[]> {
  try {
    const result = await generateObject({
      model: chatModel(),
      schema: ChartsSchema,
      system: `You are a document intelligence assistant. Look at the provided page image and extract every visible chart/graph as structured data.

Rules:
- Identify chart type (bar, line, pie, scatter, unknown).
- Extract axis labels and category labels if visible.
- Extract each data series with numeric values.
- If values are approximate, note it in the "note" field.
- If no chart is visible, return { "charts": [] }.`,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all charts from this PDF page." },
            { type: "image", image: pageImage, mediaType: "image/png" },
          ],
        },
      ],
    });

    return result.object.charts.map((c, i) => ({
      id: `chart-p${pageNumber}-${i + 1}`,
      page: pageNumber,
      title: c.title,
      type: c.type,
      xAxis: c.xAxis,
      yAxis: c.yAxis,
      series: c.series,
      note: c.note,
    }));
  } catch (err) {
    console.warn("[document-parser] chart extraction failed", { pageNumber, err });
    return [];
  }
}
