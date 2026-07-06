import { defineScenario, taskListState, withHistory } from "@/eval/engine/scenario";

function buildLongHistory(turns: number) {
  const history = withHistory([]);
  for (let i = 0; i < turns; i++) {
    history.push({ role: "user", content: `Turn ${i + 1}: remind me to follow up on task ${i + 1}` });
    history.push({ role: "assistant", content: `[reminder set for task ${i + 1}]` });
  }
  return history;
}

export const longContextScenarios = [
  defineScenario({
    id: "long-context-10",
    name: "Long context — 10 turns",
    category: "long-context",
    layer: 3,
    suite: ["full"],
    state: taskListState(["current task"]),
    history: buildLongHistory(10),
    userText: "what tasks do I have",
    expected: {
      requiredTools: ["list_tasks"],
    },
  }),

  defineScenario({
    id: "long-context-20",
    name: "Long context — 20 turns",
    category: "long-context",
    layer: 3,
    suite: ["full", "stress"],
    state: taskListState(["current task"]),
    history: buildLongHistory(20),
    userText: "what tasks do I have",
    expected: {
      requiredTools: ["list_tasks"],
    },
  }),

  defineScenario({
    id: "long-context-35",
    name: "Long context — 35 turns",
    category: "long-context",
    layer: 3,
    suite: ["stress"],
    state: taskListState(["current task"]),
    history: buildLongHistory(35),
    userText: "what tasks do I have",
    expected: {
      requiredTools: ["list_tasks"],
    },
  }),

  defineScenario({
    id: "long-context-50",
    name: "Long context — 50 turns",
    category: "long-context",
    layer: 3,
    suite: ["stress"],
    state: taskListState(["current task"]),
    history: buildLongHistory(50),
    userText: "what tasks do I have",
    expected: {
      requiredTools: ["list_tasks"],
    },
  }),

  defineScenario({
    id: "long-context-100",
    name: "Long context — 100 turns",
    category: "long-context",
    layer: 3,
    suite: ["stress"],
    state: taskListState(["current task"]),
    history: buildLongHistory(100),
    userText: "what tasks do I have",
    expected: {
      requiredTools: ["list_tasks"],
    },
  }),
];
