import { defineScenario, taskListState, noState } from "@/eval/engine/scenario";

export const taskScenarios = [
  defineScenario({
    id: "tasks-open",
    name: "Tasks — list open tasks",
    category: "tasks",
    layer: 3,
    suite: ["small", "medium", "full"],
    state: taskListState(["buy milk", "call mom"]),
    userText: "what tasks do I have",
    expected: {
      requiredTools: ["list_tasks"],
      forbiddenTools: ["add_task", "web_search"],
    },
  }),

  defineScenario({
    id: "tasks-completed",
    name: "Tasks — completed tasks",
    category: "tasks",
    layer: 3,
    suite: ["medium", "full"],
    state: taskListState(["buy milk", "call mom"], { done: true }),
    userText: "show completed tasks",
    expected: {
      requiredTools: ["list_tasks"],
    },
  }),

  defineScenario({
    id: "tasks-overdue",
    name: "Tasks — overdue tasks",
    category: "tasks",
    layer: 3,
    suite: ["full"],
    state: taskListState(["submit report"], { dueAt: Date.now() - 86_400_000 }),
    userText: "what tasks are overdue",
    expected: {
      requiredTools: ["list_tasks"],
    },
  }),

  defineScenario({
    id: "tasks-invalid",
    name: "Tasks — invalid task request",
    category: "tasks",
    layer: 3,
    suite: ["full"],
    state: noState(),
    userText: "complete task that doesn't exist",
    expected: {
      requiredTools: ["complete_task"],
    },
  }),

  defineScenario({
    id: "tasks-duplicate",
    name: "Tasks — duplicate task",
    category: "tasks",
    layer: 3,
    suite: ["full"],
    state: taskListState(["buy milk"]),
    userText: "add buy milk to my tasks",
    expected: {
      requiredTools: ["add_task"],
    },
  }),

  defineScenario({
    id: "tasks-large-list",
    name: "Tasks — large task list",
    category: "tasks",
    layer: 3,
    suite: ["full"],
    state: taskListState(Array.from({ length: 25 }, (_, i) => `task ${i + 1}`)),
    userText: "list all my tasks",
    expected: {
      requiredTools: ["list_tasks"],
      maxToolCalls: 2,
    },
  }),

  defineScenario({
    id: "tasks-mixed-lang",
    name: "Tasks — mixed languages",
    category: "tasks",
    layer: 3,
    suite: ["full"],
    state: taskListState(["ซื้อนม", "call mom"]),
    userText: "มีงานอะไรเหลือบ้าง",
    expected: {
      requiredTools: ["list_tasks"],
      forbiddenTools: ["web_search"],
    },
  }),
];
