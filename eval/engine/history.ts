import { existsSync, mkdirSync, appendFileSync, readFileSync } from "fs";
import { join } from "path";
import type { RunRecord, RunSummary } from "./types";

const RUNS_DIR = join(process.cwd(), "eval", "results", "runs");

function ensureRunsDir() {
  if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });
}

export function runFilePath(runId: string): string {
  ensureRunsDir();
  return join(RUNS_DIR, `${runId}.jsonl`);
}

export function appendRunRecord(runId: string, record: RunRecord): void {
  ensureRunsDir();
  appendFileSync(runFilePath(runId), JSON.stringify(record) + "\n");
}

export function readRunRecords(runId: string): RunRecord[] {
  const path = runFilePath(runId);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RunRecord);
}

export function findPreviousRun(suite: string): RunRecord[] | null {
  ensureRunsDir();
  // Simple heuristic: find the most recent JSONL file for the same suite.
  const files = require("fs")
    .readdirSync(RUNS_DIR)
    .filter((f: string) => f.endsWith(".jsonl") && f.includes(`-${suite}`))
    .sort()
    .reverse();
  if (files.length === 0) return null;
  const latest = files[0] as string;
  return readFileSync(join(RUNS_DIR, latest), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RunRecord);
}

export function detectRegressions(current: RunRecord[], baseline: RunRecord[]): Array<{
  scenarioId: string;
  previous: "pass" | "fail";
  current: "pass" | "fail";
}> {
  const regressions: Array<{ scenarioId: string; previous: "pass" | "fail"; current: "pass" | "fail" }> = [];
  const baselineById = new Map(baseline.map((r) => [r.scenarioId, r]));
  for (const cur of current) {
    const base = baselineById.get(cur.scenarioId);
    if (!base) continue;
    if (base.result === "pass" && cur.result === "fail") {
      regressions.push({ scenarioId: cur.scenarioId, previous: "pass", current: "fail" });
    }
  }
  return regressions;
}

export function buildRunSummary(records: RunRecord[], runId: string, suite: string, promptVersion: string, commitHash: string, model: string): RunSummary {
  const passed = records.filter((r) => r.result === "pass").length;
  const failed = records.filter((r) => r.result === "fail").length;
  return {
    runId,
    ts: Date.now(),
    suite: suite as RunSummary["suite"],
    promptVersion,
    commitHash,
    model,
    total: records.length,
    passed,
    failed,
    costUsd: records.reduce((sum, r) => sum + r.costUsd, 0),
    latencyMs: records.reduce((sum, r) => sum + r.latencyMs, 0),
    failures: records
      .filter((r) => r.result === "fail")
      .map((r) => ({
        scenarioId: r.scenarioId,
        scenarioName: r.scenarioName,
        category: r.category,
        expected: `required tools: ${r.calledTools.join(", ") || "none"}`,
        observed: r.failureReason ?? "failed",
        risk: "high",
        recommendation: "Review scenario definition and recent prompt/tool changes.",
      })),
  };
}
