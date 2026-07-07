import { performance } from "perf_hooks";
import type { ModelMessage } from "ai";
import { runMastraAgent, type MastraRunOptions } from "@/mastra/run";
import { fastClassify } from "@/lib/fast-classify";
import { getSettings } from "@/lib/memory/settings";
import { loadFacts } from "@/lib/memory/facts";
import { listAccounts } from "@/lib/tools/google-auth";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { evaluateScenario } from "./matchers";
import { cachedResultExists, readCachedResult, writeCachedResult } from "./cache";
import { appendRunRecord } from "./history";
import type { Scenario, RunRecord, SuiteTag } from "./types";
import { testProfile } from "@/eval/fixtures/user";
import { resetEvalState, seedState } from "@/eval/fixtures/state";

export type RunnerOptions = {
  suite: SuiteTag;
  promptVersion: string;
  commitHash: string;
  model: string;
  runId: string;
  useCache: boolean;
  maxCostUsd?: number;
  onProgress?: (done: number, total: number) => void;
};

export async function runScenario(
  scenario: Scenario,
  opts: RunnerOptions,
): Promise<RunRecord> {
  const userId = `eval_${scenario.id}_${Date.now().toString(36)}`;
  const ctx = { userId, profile: testProfile(), state: {} };

  await resetEvalState();
  if (scenario.state) {
    if (typeof scenario.state === "function") {
      await scenario.state(ctx);
    } else {
      await seedState(ctx, scenario.state);
    }
  }

  const [settings, accounts, staged, facts] = await Promise.all([
    getSettings(userId),
    listAccounts(userId),
    listRecentMedia(userId),
    loadFacts(userId),
  ]);

  const userHasGoogle = accounts.accounts.length > 0;
  const hasStagedMedia = staged.length > 0;
  const hint = fastClassify(scenario.userText, { hasStagedMedia });

  const messages: ModelMessage[] = [...(scenario.history ?? []), { role: "user", content: scenario.userText }];

  const runOpts: MastraRunOptions = {
    userId,
    profile: testProfile(),
    facts,
    settings,
    accounts,
    staged,
    hasStagedMedia,
    hint,
  };

  if (opts.useCache && cachedResultExists(scenario, opts.promptVersion, opts.model)) {
    const cached = readCachedResult(scenario, opts.promptVersion, opts.model);
    if (cached) return { ...cached, runId: opts.runId };
  }

  const start = performance.now();
  let result;
  let error: string | undefined;
  try {
    result = await runMastraAgent(messages, runOpts);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    result = {
      text: error,
      hints: { confirmDraft: false, hasDraftFlex: false, pickAccount: false, needsGoogleConnect: false },
      toolCalls: [],
      historyText: error,
    };
  }
  const latencyMs = Math.round(performance.now() - start);

  const evalResult = evaluateScenario(result, scenario.expected);

  const record: RunRecord = {
    runId: opts.runId,
    ts: Date.now(),
    suite: opts.suite,
    promptVersion: opts.promptVersion,
    commitHash: opts.commitHash,
    model: opts.model,
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    category: scenario.category,
    userText: scenario.userText,
    // Mastra builds the per-user tool registry internally, so the runner no longer
    // has direct access to the available tool list. TODO: expose from runMastraAgent.
    availableTools: [],
    calledTools: result.toolCalls?.map((c) => c.toolName) ?? [],
    toolInputs: result.toolCalls?.map((c) => ({ toolName: c.toolName, input: c.input })) ?? [],
    latencyMs,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    result: error ? "fail" : evalResult.pass ? "pass" : "fail",
    failureReason: error ?? evalResult.reason,
  };

  if (opts.useCache) writeCachedResult(scenario, opts.promptVersion, opts.model, record);
  appendRunRecord(opts.runId, record);

  return record;
}

export async function runSuite(scenarios: Scenario[], opts: RunnerOptions): Promise<RunRecord[]> {
  const records: RunRecord[] = [];
  let totalCost = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const scenario = scenarios[i];
    if (!scenario) continue;
    const record = await runScenario(scenario, opts);
    records.push(record);
    totalCost += record.costUsd;
    opts.onProgress?.(i + 1, scenarios.length);

    if (opts.maxCostUsd && totalCost > opts.maxCostUsd) {
      console.warn(`[eval] cost budget $${opts.maxCostUsd} exceeded; stopping suite early.`);
      break;
    }
  }

  return records;
}
