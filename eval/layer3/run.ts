#!/usr/bin/env node
import { performance } from "perf_hooks";
import { ALL_SCENARIOS } from "./scenarios";
import { scenarioIdsForSuite, filterScenarios } from "@/eval/engine/suite";
import { getPromptVersion, getCommitHash } from "@/eval/engine/version";
import { runSuite } from "@/eval/engine/runner";
import { buildRunSummary, readRunRecords, findPreviousRun, detectRegressions } from "@/eval/engine/history";
import { writeReport, consoleReport } from "@/eval/engine/reporter";
import type { SuiteTag } from "@/eval/engine/types";

function parseArgs() {
  const args = process.argv.slice(2);
  const suite = (args.find((a) => a.startsWith("--suite="))?.split("=")[1] ?? "small") as SuiteTag;
  const model = args.find((a) => a.startsWith("--model="))?.split("=")[1] ?? "gemini-2.5-flash";
  const useCache = !args.includes("--no-cache");
  const maxCost = args.find((a) => a.startsWith("--max-cost="))?.split("=")[1];
  const list = args.includes("--list");
  const compare = args.includes("--compare");
  return { suite, model, useCache, maxCostUsd: maxCost ? Number.parseFloat(maxCost) : undefined, list, compare };
}

async function main() {
  const { suite, model, useCache, maxCostUsd, list, compare } = parseArgs();

  if (!["small", "medium", "full", "stress"].includes(suite)) {
    console.error(`Unknown suite: ${suite}`);
    process.exit(1);
  }

  if (suite === "stress") {
    console.warn("Stress suite runs manually only and may incur significant API cost.");
  }

  if (list) {
    console.log(`Scenarios in ${suite} suite:`);
    for (const id of scenarioIdsForSuite(suite)) {
      const s = ALL_SCENARIOS.find((sc) => sc.id === id);
      console.log(`  - ${id}: ${s?.name ?? "(not found)"}`);
    }
    return;
  }

  const scenarios = filterScenarios(ALL_SCENARIOS, suite);
  if (scenarios.length === 0) {
    console.log(`No scenarios found for suite: ${suite}`);
    return;
  }

  const promptVersion = getPromptVersion();
  const commitHash = getCommitHash();
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${suite}`;

  console.log(`Running ${suite} suite (${scenarios.length} scenarios)...`);
  console.log(`  Model: ${model} | Prompt: ${promptVersion} | Commit: ${commitHash} | Cache: ${useCache ? "on" : "off"}`);

  const start = performance.now();
  const records = await runSuite(scenarios, {
    suite,
    promptVersion,
    commitHash,
    model,
    runId,
    useCache,
    maxCostUsd,
    onProgress: (done, total) => {
      process.stdout.write(`\r  ${done}/${total} complete`);
    },
  });
  process.stdout.write("\n");

  const summary = buildRunSummary(records, runId, suite, promptVersion, commitHash, model);
  const { mdPath, jsonPath } = writeReport(runId, summary, records);
  consoleReport(summary);
  console.log(`\nReport written to:\n  ${mdPath}\n  ${jsonPath}`);

  if (compare) {
    const baseline = findPreviousRun(suite);
    if (baseline) {
      const regressions = detectRegressions(records, baseline);
      if (regressions.length) {
        console.log("\nRegressions detected compared to previous run:");
        for (const r of regressions) {
          console.log(`  - ${r.scenarioId}: ${r.previous} → ${r.current}`);
        }
        process.exit(1);
      } else {
        console.log("\nNo regressions compared to previous run.");
      }
    } else {
      console.log("\nNo previous run found for comparison.");
    }
  }

  if (summary.failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
