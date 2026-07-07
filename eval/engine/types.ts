import type { ModelMessage } from "ai";
import type { AgentResult } from "@/lib/llm/agent-helpers";

export type SuiteTag = "small" | "medium" | "full" | "stress";

export type EvalResult = {
  pass: boolean;
  reason?: string;
};

export type ToolArgCheck = {
  tool: string;
  field: string;
  check: "equals" | "contains" | "matches" | "exists" | "type";
  value?: unknown;
  regex?: RegExp;
  expectedType?: "string" | "number" | "boolean" | "object" | "array";
};

export type Constraint = {
  id: string;
  description: string;
  check: (result: AgentResult) => EvalResult;
};

export type SeededState = {
  settings?: Record<string, unknown>;
  facts?: Array<{ category: string; content: string; priority?: number }>;
  tasks?: Array<{ title: string; notes?: string; dueAt?: number; doneAt?: number }>;
  reminders?: Array<{ message: string; fireAt: number; cron?: string }>;
  history?: ModelMessage[];
  accounts?: Array<{ email: string; active?: boolean }>;
  staged?: Array<{
    kind: "image" | "file" | "audio" | "video";
    messageId: string;
    contentType: string;
    fileName?: string;
    sizeBytes?: number;
    ts?: number;
  }>;
};

export type ScenarioContext = {
  userId: string;
  profile: { displayName: string };
  state: SeededState;
};

export type SeedStateFn = (ctx: ScenarioContext) => Promise<void> | void;

export type Scenario = {
  id: string;
  name: string;
  category: string;
  layer: 2 | 3;
  suite: SuiteTag[];
  state?: SeedStateFn | SeededState;
  history?: ModelMessage[];
  userText: string;
  expected: {
    requiredTools?: string[];
    forbiddenTools?: string[];
    toolArgumentChecks?: ToolArgCheck[];
    constraints?: Constraint[];
    maxToolCalls?: number;
    minToolCalls?: number;
  };
  maxCostUsd?: number;
  notes?: string;
};

export type RunRecord = {
  runId: string;
  ts: number;
  suite: SuiteTag;
  promptVersion: string;
  commitHash: string;
  model: string;
  scenarioId: string;
  scenarioName: string;
  category: string;
  userText: string;
  availableTools: string[];
  calledTools: string[];
  toolInputs: Array<{ toolName: string; input: unknown }>;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  result: "pass" | "fail";
  failureReason?: string;
};

export type RunSummary = {
  runId: string;
  ts: number;
  suite: SuiteTag;
  promptVersion: string;
  commitHash: string;
  model: string;
  total: number;
  passed: number;
  failed: number;
  costUsd: number;
  latencyMs: number;
  failures: Array<{
    scenarioId: string;
    scenarioName: string;
    category: string;
    expected: string;
    observed: string;
    risk: "high" | "medium" | "low";
    recommendation: string;
  }>;
};
