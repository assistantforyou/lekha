import { defineScenario, noState } from "@/eval/engine/scenario";

export const casualScenarios = [
  defineScenario({
    id: "casual-greeting",
    name: "Casual — greeting should not call tools",
    category: "casual",
    layer: 3,
    suite: ["small", "medium", "full"],
    state: noState(),
    userText: "hi",
    expected: {
      requiredTools: [],
      forbiddenTools: ["list_tasks", "list_reminders", "web_search", "news_search"],
      maxToolCalls: 0,
    },
  }),
];
