import { defineScenario, noState, constraint } from "@/eval/engine/scenario";

export const settingsScenarios = [
  defineScenario({
    id: "settings-open",
    name: "Settings — open menu",
    category: "settings",
    layer: 3,
    suite: ["small", "medium", "full"],
    state: noState(),
    userText: "/settings",
    expected: {
      // Settings command is handled by shortcut, not the agent.
      requiredTools: [],
      forbiddenTools: ["web_search"],
    },
  }),

  defineScenario({
    id: "settings-timezone",
    name: "Settings — modify timezone",
    category: "settings",
    layer: 3,
    suite: ["medium", "full"],
    state: noState(),
    userText: "/set timezone Asia/Tokyo",
    expected: {
      requiredTools: ["set_timezone"],
    },
  }),

  defineScenario({
    id: "settings-modify",
    name: "Settings — modify language",
    category: "settings",
    layer: 3,
    suite: ["full"],
    state: noState(),
    userText: "set my language to th",
    expected: {
      requiredTools: ["set_language"],
    },
  }),

  defineScenario({
    id: "settings-invalid",
    name: "Settings — invalid option",
    category: "settings",
    layer: 3,
    suite: ["full"],
    state: noState(),
    userText: "set my timezone to Mars/Colony",
    expected: {
      constraints: [
        constraint("no-silent-accept", "must not silently accept invalid timezone", (result) => ({
          pass: !result.text.toLowerCase().includes("done") || result.text.toLowerCase().includes("invalid"),
          reason: "model silently accepted invalid timezone",
        })),
      ],
    },
  }),
];
