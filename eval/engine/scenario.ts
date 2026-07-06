import type { ModelMessage } from "ai";
import type { Scenario, SeededState, SeedStateFn, SuiteTag, Constraint } from "./types";
import { seedState, taskListState, reminderListState, conversationHistory } from "@/eval/fixtures/state";
import { testProfile } from "@/eval/fixtures/user";

export function defineScenario(scenario: Scenario): Scenario {
  return scenario;
}

export function withState(seed: SeededState): SeedStateFn {
  return async (ctx) => seedState(ctx, seed);
}

export function withHistory(turns: Array<{ role: "user" | "assistant"; text: string }>): ModelMessage[] {
  return conversationHistory(turns);
}

export function noState(): SeedStateFn {
  return async () => {};
}

export function constraint(id: string, description: string, check: Constraint["check"]): Constraint {
  return { id, description, check };
}

export { taskListState, reminderListState, conversationHistory, testProfile };
export type { SuiteTag, Scenario, SeededState };
