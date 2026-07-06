import { defineScenario, noState } from "@/eval/engine/scenario";

export const weatherScenarios = [
  defineScenario({
    id: "weather-bangkok",
    name: "Weather — Bangkok",
    category: "weather",
    layer: 3,
    suite: ["small", "medium", "full"],
    state: noState(),
    userText: "what's the weather in Bangkok",
    expected: {
      requiredTools: ["weather"],
      forbiddenTools: ["web_search", "news_search"],
      maxToolCalls: 2,
    },
  }),
];
