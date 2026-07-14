import PDFDocument from "pdfkit";
import { createCanvas } from "canvas";

/**
 * Generate a synthetic PDF for testing Lekha's document parser.
 * Contains text, a table, and a simple bar chart image.
 */

export function generateSampleReport(): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  return new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

  // Title
  doc.fontSize(20).text("Lekha Test Report: Quarterly Sales", { align: "center" });
  doc.moveDown();

  // Paragraph
  doc.fontSize(12).text(
    "This report summarizes the quarterly sales performance for the Southeast Asia region. " +
      "Revenue grew by 18% compared to the previous quarter, driven by strong demand in Thailand and Vietnam. " +
      "The top-performing product was the Premium Widget, which accounted for 35% of total sales.",
    { align: "justify" },
  );
  doc.moveDown();

  // Table
  doc.fontSize(14).text("Product Sales Table", { underline: true });
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const colWidths = [180, 100, 100, 100];
  const headers = ["Product", "Units", "Price", "Revenue"];
  const rows = [
    ["Premium Widget", "1,200", "$45.00", "$54,000"],
    ["Standard Widget", "2,500", "$28.00", "$70,000"],
    ["Mini Widget", "3,800", "$15.00", "$57,000"],
    ["Pro Widget", "900", "$89.00", "$80,100"],
  ];

  function drawRow(y: number, cells: string[], isHeader = false) {
    let x = 50;
    doc.font(isHeader ? "Helvetica-Bold" : "Helvetica").fontSize(11);
    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i]!, x, y, { width: colWidths[i]!, align: "left" });
      x += colWidths[i]!;
    }
  }

  drawRow(tableTop, headers, true);
  let rowY = tableTop + 20;
  for (const row of rows) {
    drawRow(rowY, row);
    rowY += 20;
  }

  doc.y = rowY + 20;
  doc.moveDown();

  // Chart image
  doc.fontSize(14).text("Revenue by Product (Bar Chart)", { underline: true });
  doc.moveDown(0.5);

  const chartPng = generateBarChartPng();
  doc.image(chartPng, { width: 400 });

  doc.end();
  });
}

function generateBarChartPng(): Buffer {
  const width = 500;
  const height = 300;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Title
  ctx.fillStyle = "#000000";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText("Revenue by Product", 50, 30);

  // Data
  const labels = ["Premium", "Standard", "Mini", "Pro"];
  const values = [54000, 70000, 57000, 80100];
  const max = 90000;
  const barWidth = 60;
  const gap = 50;
  const chartBottom = 250;
  const chartLeft = 80;
  const chartHeight = 200;

  // Axes
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(chartLeft, chartBottom);
  ctx.lineTo(chartLeft + labels.length * (barWidth + gap) + gap, chartBottom);
  ctx.moveTo(chartLeft, chartBottom);
  ctx.lineTo(chartLeft, chartBottom - chartHeight);
  ctx.stroke();

  // Bars
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];
  for (let i = 0; i < labels.length; i++) {
    const x = chartLeft + gap + i * (barWidth + gap);
    const barHeight = (values[i]! / max) * chartHeight;
    const y = chartBottom - barHeight;

    ctx.fillStyle = colors[i]!;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Label
    ctx.fillStyle = "#000000";
    ctx.font = "12px sans-serif";
    ctx.fillText(labels[i]!, x, chartBottom + 20);

    // Value
    ctx.fillText(`$${(values[i]! / 1000).toFixed(0)}k`, x + 5, y - 10);
  }

  // Y-axis label
  ctx.save();
  ctx.translate(20, chartBottom - chartHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = "12px sans-serif";
  ctx.fillText("Revenue (USD)", 0, 0);
  ctx.restore();

  return canvas.toBuffer("image/png");
}
