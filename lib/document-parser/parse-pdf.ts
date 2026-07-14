import type { Page, WordBox } from "./types";

async function loadPdfjs() {
  // pdfjs-dist v6 expects DOMMatrix in the global scope. The canvas package
  // provides it; polyfill before lazily loading the PDF library.
  if (typeof globalThis.DOMMatrix === "undefined") {
    const canvasMod = (await import("canvas")) as unknown as { DOMMatrix: typeof globalThis.DOMMatrix };
    (globalThis as unknown as { DOMMatrix: typeof globalThis.DOMMatrix }).DOMMatrix = canvasMod.DOMMatrix;
  }
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  (pdfjs as unknown as { GlobalWorkerOptions?: { workerSrc?: string } }).GlobalWorkerOptions ??= {};
  return pdfjs;
}

function toUint8Array(bytes: Uint8Array | Buffer): Uint8Array {
  return Buffer.isBuffer(bytes) ? new Uint8Array(bytes) : bytes;
}

/** Render scale for page images. 2.0 gives ~144 DPI, good for table/chart OCR. */
const DEFAULT_RENDER_SCALE = 2.0;

/**
 * Extract text and word positions from every page of a PDF.
 * Does not render images; pure text/layout extraction.
 */
export async function extractTextAndLayout(bytes: Uint8Array | Buffer): Promise<Page[]> {
  const data = toUint8Array(bytes);
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: Page[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const pdfPage = await doc.getPage(i);
    const viewport = pdfPage.getViewport({ scale: 1.0 });
    const textContent = await pdfPage.getTextContent();

    const words: WordBox[] = [];
    for (const item of textContent.items) {
      if (!("str" in item)) continue;
      const typed = item as {
        str: string;
        dir: string;
        width: number;
        height: number;
        transform: number[];
        fontName: string;
        hasEOL: boolean;
      };
      const [a, b, c, d, e, f] = typed.transform as [number, number, number, number, number, number];
      // Use the transform matrix to get position. Standard 2D affine: x = e, y = f.
      words.push({
        text: typed.str,
        x: e,
        y: viewport.height - f, // PDF coords: origin bottom-left; flip for top-left reading order
        width: typed.width,
        height: typed.height,
        fontName: typed.fontName,
        fontSize: Math.hypot(a, b),
      });
    }

    // Reconstruct reading-order lines by sorting top-to-bottom then left-to-right.
    const lines = buildLines(words, viewport.height);

    pages.push({
      number: i,
      width: viewport.width,
      height: viewport.height,
      text: lines.join("\n"),
      words,
      lines,
    });
  }

  return pages;
}

/**
 * Render a single PDF page to a PNG buffer.
 * Requires the `canvas` package (Node.js native dependency).
 */
export async function renderPageToImage(
  bytes: Uint8Array | Buffer,
  pageNumber: number,
  scale = DEFAULT_RENDER_SCALE,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const data = toUint8Array(bytes);
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  if (pageNumber < 1 || pageNumber > doc.numPages) {
    throw new Error(`Page ${pageNumber} out of range (1-${doc.numPages})`);
  }
  const pdfPage = await doc.getPage(pageNumber);
  const viewport = pdfPage.getViewport({ scale });

  const { createCanvas } = (await import("canvas")) as unknown as { createCanvas: typeof import("canvas").createCanvas };
  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext("2d");
  await pdfPage.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport } as any).promise;

  const buffer = canvas.toBuffer("image/png");
  return { buffer, width: viewport.width, height: viewport.height };
}

/**
 * Group words into reading-order lines. PDF text runs are often already in
 * reading order, but we guard against out-of-order extraction by sorting on
 * a coarse Y grid first.
 */
function buildLines(words: WordBox[], pageHeight: number): string[] {
  if (!words.length) return [];

  // Sort top-to-bottom, then left-to-right.
  const sorted = [...words].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 4) return yDiff; // different lines
    return a.x - b.x;
  });

  const lines: WordBox[][] = [];
  for (const w of sorted) {
    if (!w.text.trim()) continue;
    const lastLine = lines[lines.length - 1];
    if (!lastLine) {
      lines.push([w]);
      continue;
    }
    const lastWord = lastLine[lastLine.length - 1]!;
    if (Math.abs(w.y - lastWord.y) < 4) {
      lastLine.push(w);
    } else {
      lines.push([w]);
    }
  }

  return lines.map((lineWords) =>
    lineWords
      .sort((a, b) => a.x - b.x)
      .map((w) => w.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Total word count across pages. */
export function countWords(pages: Page[]): number {
  return pages.reduce((sum, p) => sum + p.text.split(/\s+/).filter(Boolean).length, 0);
}
