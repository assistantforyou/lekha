import { defineScenario, reminderListState, noState } from "@/eval/engine/scenario";

export const reminderScenarios = [
  defineScenario({
    id: "reminders-none",
    name: "Reminders — none",
    category: "reminders",
    layer: 3,
    suite: ["small", "medium", "full"],
    state: noState(),
    userText: "what reminders do I have",
    expected: {
      requiredTools: ["list_reminders"],
      forbiddenTools: ["set_reminder", "web_search"],
    },
  }),

  defineScenario({
    id: "reminders-many",
    name: "Reminders — many",
    category: "reminders",
    layer: 3,
    suite: ["medium", "full"],
    state: reminderListState(["call mom", "dentist", "team standup", "pickup dry cleaning", "water plants"]),
    userText: "list my reminders",
    expected: {
      requiredTools: ["list_reminders"],
    },
  }),

  defineScenario({
    id: "reminders-overdue",
    name: "Reminders — overdue",
    category: "reminders",
    layer: 3,
    suite: ["full"],
    state: reminderListState(["pay invoice"], Date.now() - 86_400_000),
    userText: "what reminders did I miss",
    expected: {
      requiredTools: ["list_reminders"],
    },
  }),

  defineScenario({
    id: "reminders-deleted",
    name: "Reminders — deleted reminder",
    category: "reminders",
    layer: 3,
    suite: ["full"],
    state: noState(),
    userText: "cancel reminder abc123",
    expected: {
      requiredTools: ["cancel_reminder"],
    },
  }),

  defineScenario({
    id: "reminders-duplicate",
    name: "Reminders — duplicate reminder",
    category: "reminders",
    layer: 3,
    suite: ["full"],
    state: reminderListState(["call mom"]),
    userText: "remind me to call mom at 6pm",
    expected: {
      requiredTools: ["set_reminder"],
    },
  }),
];
