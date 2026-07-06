import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { RunSummary, RunRecord } from "./types";

const REPORTS_DIR = join(process.cwd(), "eval", "results", "reports");

function ensureReportsDir() {
  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
}

export function generateMarkdownReport(summary: RunSummary, records: RunRecord[]): string {
  const lines: string[] = [
    `# LLM Evaluation Report`,
    "",
    `**Prompt Version:** ${summary.promptVersion}`,
    `**Commit:** ${summary.commitHash}`,
    `**Model:** ${summary.model}`,
    `**Suite:** ${summary.suite}`,
    `**Ran at:** ${new Date(summary.ts).toISOString()}`,
    "",
    `## Summary`,
    "",
    `- **Passed:** ${summary.passed}`,
    `- **Failed:** ${summary.failed}`,
    `- **Total:** ${summary.total}`,
    `- **Cost USD:** $${summary.costUsd.toFixed(4)}`,
    `- **Latency:** ${summary.latencyMs}ms`,
    "",
  ];

  if (summary.failures.length > 0) {
    lines.push(`## Failure Summary`, "");
    for (const f of summary.failures) {
      lines.push(
        `### ${f.scenarioName} (${f.scenarioId})`,
        "",
        `- **Category:** ${f.category}`,
        `- **Expected:** ${f.expected}`,
        `- **Observed:** ${f.observed}`,
        `- **Risk:** ${f.risk.toUpperCase()}`,
        `- **Recommendation:** ${f.recommendation}`,
        "",
      );
    }
  } else {
    lines.push(`## Failure Summary`, "", "No failures. 🎉", "");
  }

  lines.push(`## Per-Scenario Results`, "", "| Scenario | Result | Tools | Cost | Latency |", "|---|---|---|---|---|");
  for (const r of records) {
    lines.push(
      `| ${r.scenarioName} | ${r.result.toUpperCase()} | ${r.calledTools.join(", ") || "-"} | $${r.costUsd.toFixed(4)} | ${r.latencyMs}ms |`,
    );
  }

  return lines.join("\n");
}

export function writeReport(runId: string, summary: RunSummary, records: RunRecord[]): { mdPath: string; jsonPath: string } {
  ensureReportsDir();
  const mdPath = join(REPORTS_DIR, `${runId}.md`);
  const jsonPath = join(REPORTS_DIR, `${runId}.json`);
  writeFileSync(mdPath, generateMarkdownReport(summary, records));
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2));
  return { mdPath, jsonPath };
}

export function consoleReport(summary: RunSummary): void {
  console.log(`\nLLM Evaluation: ${summary.suite}`);
  console.log(`  Prompt: ${summary.promptVersion} | Commit: ${summary.commitHash} | Model: ${summary.model}`);
  console.log(`  Passed: ${summary.passed}/${summary.total} | Failed: ${summary.failed} | Cost: $${summary.costUsd.toFixed(4)} | Time: ${summary.latencyMs}ms`);
  if (summary.failures.length) {
    console.log("\n  Failures:");
    for (const f of summary.failures) {
      console.log(`    - ${f.scenarioName}: ${f.observed}`);
    }
  }
}
