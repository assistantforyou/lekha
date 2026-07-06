import { defineScenario, taskListState, reminderListState, withHistory } from "@/eval/engine/scenario";

export const mixedScenarios = [
  defineScenario({
    id: "mixed-flow",
    name: "Mixed conversation — state remains correct",
    category: "mixed",
    layer: 3,
    suite: ["medium", "full"],
    state: {
      ...taskListState(["buy milk"]),
      ...reminderListState(["call mom"]),
    },
    history: withHistory([
      { role: "user", text: "morning briefing" },
      { role: "assistant", text: "[morning briefing delivered]" },
      { role: "user", text: "what's the weather like" },
      { role: "assistant", text: "[weather card delivered]" },
      { role: "user", text: "add call dad to tasks" },
      { role: "assistant", text: "[task added]" },
      { role: "user", text: "any advice on productivity" },
      { role: "assistant", text: "[advice given]" },
    ]),
    userText: "list my reminders",
    expected: {
      requiredTools: ["list_reminders"],
      forbiddenTools: ["list_tasks", "get_morning_briefing", "weather"],
      maxToolCalls: 2,
    },
  }),
];
