import type { SuiteTag, Scenario } from "./types";

export const SUITES: Record<SuiteTag, string[]> = {
  small: [
    "mb-empty",
    "tasks-open",
    "reminders-none",
    "settings-open",
    "weather-bangkok",
    "casual-greeting",
  ],
  medium: [
    "mb-empty",
    "mb-many-tasks",
    "tasks-open",
    "tasks-completed",
    "tasks-overdue",
    "reminders-none",
    "reminders-many",
    "settings-open",
    "settings-timezone",
    "weather-bangkok",
    "mixed-flow",
    "casual-greeting",
  ],
  full: [
    "mb-empty",
    "mb-no-tasks",
    "mb-many-tasks",
    "mb-overdue",
    "mb-completed",
    "tasks-open",
    "tasks-completed",
    "tasks-invalid",
    "tasks-duplicate",
    "tasks-large-list",
    "tasks-mixed-lang",
    "reminders-none",
    "reminders-many",
    "reminders-overdue",
    "reminders-deleted",
    "reminders-duplicate",
    "settings-open",
    "settings-modify",
    "settings-invalid",
    "weather-bangkok",
    "mixed-flow",
    "long-context-10",
    "long-context-20",
    "casual-greeting",
  ],
  stress: [
    "long-context-10",
    "long-context-20",
    "long-context-35",
    "long-context-50",
    "long-context-100",
  ],
};

export function scenarioIdsForSuite(tag: SuiteTag): string[] {
  return SUITES[tag];
}

export function filterScenarios(scenarios: Scenario[], tag: SuiteTag): Scenario[] {
  const ids = new Set(SUITES[tag]);
  return scenarios.filter((s) => ids.has(s.id));
}
