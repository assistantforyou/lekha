import type { AgentResult } from "@/lib/llm/agent";
import type { EvalResult, ToolArgCheck } from "./types";

export function calledToolNames(result: AgentResult): string[] {
  return result.toolCalls?.map((c) => c.toolName) ?? [];
}

export function uniqueToolNames(result: AgentResult): string[] {
  return [...new Set(calledToolNames(result))];
}

export function requiredTool(result: AgentResult, name: string): EvalResult {
  const names = uniqueToolNames(result);
  if (names.includes(name)) return { pass: true };
  return { pass: false, reason: `expected tool "${name}" to be called, got [${names.join(", ") || "none"}]` };
}

export function forbiddenTool(result: AgentResult, name: string): EvalResult {
  const names = uniqueToolNames(result);
  if (!names.includes(name)) return { pass: true };
  return { pass: false, reason: `forbidden tool "${name}" was called` };
}

export function requiredTools(result: AgentResult, names: string[], mode: "all" | "any" = "all"): EvalResult {
  const called = uniqueToolNames(result);
  if (mode === "all") {
    const missing = names.filter((n) => !called.includes(n));
    if (missing.length === 0) return { pass: true };
    return { pass: false, reason: `missing required tool(s): ${missing.join(", ")}` };
  }
  const hit = names.some((n) => called.includes(n));
  if (hit) return { pass: true };
  return { pass: false, reason: `expected at least one of [${names.join(", ")}], got none` };
}

export function forbiddenTools(result: AgentResult, names: string[]): EvalResult {
  const called = uniqueToolNames(result);
  const hit = names.filter((n) => called.includes(n));
  if (hit.length === 0) return { pass: true };
  return { pass: false, reason: `forbidden tool(s) called: ${hit.join(", ")}` };
}

export function toolCallCount(result: AgentResult): number {
  return calledToolNames(result).length;
}

export function toolCountInRange(result: AgentResult, min?: number, max?: number): EvalResult {
  const count = toolCallCount(result);
  if (min !== undefined && count < min) return { pass: false, reason: `expected at least ${min} tool call(s), got ${count}` };
  if (max !== undefined && count > max) return { pass: false, reason: `expected at most ${max} tool call(s), got ${count}` };
  return { pass: true };
}

export function replyContains(result: AgentResult, text: string): EvalResult {
  if (result.text.toLowerCase().includes(text.toLowerCase())) return { pass: true };
  return { pass: false, reason: `expected reply to contain "${text}", got: ${result.text.slice(0, 200)}` };
}

export function replyExcludes(result: AgentResult, text: string): EvalResult {
  if (!result.text.toLowerCase().includes(text.toLowerCase())) return { pass: true };
  return { pass: false, reason: `expected reply NOT to contain "${text}"` };
}

export function hasDraftConfirmation(result: AgentResult): EvalResult {
  if (result.hints?.confirmDraft) return { pass: true };
  return { pass: false, reason: "expected draft confirmation hint" };
}

function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function checkToolArgument(result: AgentResult, check: ToolArgCheck): EvalResult {
  const calls = result.toolCalls?.filter((c) => c.toolName === check.tool) ?? [];
  if (calls.length === 0) {
    return { pass: false, reason: `cannot check argument for "${check.tool}" — tool was not called` };
  }

  for (const call of calls) {
    const value = getPath(call.input, check.field);
    switch (check.check) {
      case "exists":
        if (value !== undefined) return { pass: true };
        break;
      case "equals":
        if (value === check.value) return { pass: true };
        break;
      case "contains":
        if (typeof value === "string" && typeof check.value === "string" && value.includes(check.value)) return { pass: true };
        break;
      case "matches":
        if (typeof value === "string" && check.regex && check.regex.test(value)) return { pass: true };
        break;
      case "type":
        if (check.expectedType === "array" && Array.isArray(value)) return { pass: true };
        if (typeof value === check.expectedType) return { pass: true };
        break;
    }
  }

  return { pass: false, reason: `argument check failed for ${check.tool}.${check.field} (${check.check})` };
}

export function noHallucinatedSources(result: AgentResult, allowed: string[]): EvalResult {
  const text = result.text;
  const hallucinated = [
    "as an AI",
    "I don't have access",
    "I cannot",
    "I can only",
  ];
  const found = hallucinated.filter((phrase) => text.toLowerCase().includes(phrase.toLowerCase()));
  if (found.length === 0) return { pass: true };
  return { pass: false, reason: `reply contains disclaimer/hallucination marker(s): ${found.join(", ")}` };
}

export function evaluateScenario(result: AgentResult, expected: Scenario["expected"]): EvalResult {
  const checks: EvalResult[] = [];

  if (expected.requiredTools?.length) {
    checks.push(requiredTools(result, expected.requiredTools, "all"));
  }

  if (expected.forbiddenTools?.length) {
    checks.push(forbiddenTools(result, expected.forbiddenTools));
  }

  if (expected.toolArgumentChecks?.length) {
    for (const check of expected.toolArgumentChecks) {
      checks.push(checkToolArgument(result, check));
    }
  }

  if (expected.constraints?.length) {
    for (const constraint of expected.constraints) {
      checks.push(constraint.check(result));
    }
  }

  if (expected.minToolCalls !== undefined || expected.maxToolCalls !== undefined) {
    checks.push(toolCountInRange(result, expected.minToolCalls, expected.maxToolCalls));
  }

  const failures = checks.filter((c) => !c.pass);
  if (failures.length === 0) return { pass: true };
  return { pass: false, reason: failures.map((f) => f.reason).join("; ") };
}

import type { Scenario } from "./types";
