import { defineScenario, taskListState, noState } from "@/eval/engine/scenario";
import { requiredTool } from "@/eval/engine/matchers";

export const morningBriefingScenarios = [
  defineScenario({
    id: "mb-empty",
    name: "Morning briefing — empty database",
    category: "morning-briefing",
    layer: 3,
    suite: ["small", "medium", "full"],
    state: noState(),
    userText: "morning briefing",
    expected: {
      requiredTools: ["get_morning_briefing"],
      forbiddenTools: ["list_tasks", "list_reminders"],
    },
    notes: "Empty state still triggers the dedicated briefing tool.",
  }),

  defineScenario({
    id: "mb-no-tasks",
    name: "Morning briefing — no tasks",
    category: "morning-briefing",
    layer: 3,
    suite: ["full"],
    state: noState(),
    userText: "what's my morning briefing",
    expected: {
      requiredTools: ["get_morning_briefing"],
      forbiddenTools: ["list_tasks"],
    },
  }),

  defineScenario({
    id: "mb-many-tasks",
    name: "Morning briefing — many tasks",
    category: "morning-briefing",
    layer: 3,
    suite: ["medium", "full"],
    state: taskListState(["email client", "prep slides", "book flight", "call mom", "grocery run"]),
    userText: "morning briefing",
    expected: {
      requiredTools: ["get_morning_briefing"],
    },
  }),

  defineScenario({
    id: "mb-overdue",
    name: "Morning briefing — overdue tasks",
    category: "morning-briefing",
    layer: 3,
    suite: ["full"],
    state: taskListState(["submit report", "pay invoice"], { dueAt: Date.now() - 86_400_000 }),
    userText: "morning briefing",
    expected: {
      requiredTools: ["get_morning_briefing"],
    },
  }),

  defineScenario({
    id: "mb-completed",
    name: "Morning briefing — all tasks completed",
    category: "morning-briefing",
    layer: 3,
    suite: ["full"],
    state: taskListState(["yoga", "read email"], { done: true }),
    userText: "morning briefing",
    expected: {
      requiredTools: ["get_morning_briefing"],
    },
  }),
];
