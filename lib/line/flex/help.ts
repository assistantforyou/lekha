import type { FlexMessage } from "@/lib/line/client";

export type HelpExample = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

export const HELP_EXAMPLES: HelpExample[] = [
  {
    id: "memory",
    category: "Memory",
    question: "Remember that I prefer espresso",
    answer: "Got it — I'll remember you prefer espresso. ☕",
  },
  {
    id: "task",
    category: "Tasks",
    question: "Add a task to call the plumber",
    answer: "Added to your tasks: call the plumber. ✅",
  },
  {
    id: "reminder",
    category: "Reminders",
    question: "Remind me in 5 minutes to stretch",
    answer: "⏰ I'll remind you to stretch in 5 minutes.",
  },
  {
    id: "list",
    category: "Lists",
    question: "Add milk to my grocery list",
    answer: "Added milk to your grocery list. 🥛",
  },
  {
    id: "settings",
    category: "Settings",
    question: "Set my timezone to Asia/Bangkok",
    answer: "Timezone set to Asia/Bangkok. 🌏",
  },
];

const CATEGORIES = [
  { icon: "🧠", title: "Memory", examples: "remember facts, recall what I know, update memories" },
  { icon: "✅", title: "Tasks", examples: "add tasks, mark done, list open work" },
  { icon: "⏰", title: "Reminders", examples: "one-shot or recurring LINE pushes" },
  { icon: "📋", title: "Lists", examples: "grocery, packing, or any named list" },
  { icon: "📧", title: "Email & Inbox", examples: "draft/send/search Gmail (Google needed)" },
  { icon: "📅", title: "Calendar", examples: "schedule events, list upcoming (Google needed)" },
  { icon: "📁", title: "Drive & Docs", examples: "search, upload, read files (Google needed)" },
  { icon: "📷", title: "Media", examples: "photos, voice notes, PDFs, Office files" },
  { icon: "🧾", title: "Receipts", examples: "scan, list, search expense receipts" },
  { icon: "🌐", title: "Search & Info", examples: "web search, weather, stocks, news" },
  { icon: "⚙️", title: "Settings", examples: "timezone, location, language, briefings" },
];

function categoryRow(cat: (typeof CATEGORIES)[number]): object {
  return {
    type: "box",
    layout: "vertical",
    spacing: "xs",
    margin: "md",
    contents: [
      {
        type: "text",
        text: `${cat.icon}  ${cat.title}`,
        weight: "bold",
        size: "sm",
        color: "#333333",
        wrap: true,
      },
      {
        type: "text",
        text: cat.examples,
        size: "xs",
        color: "#777777",
        wrap: true,
      },
    ],
  };
}

export function helpFlex(): FlexMessage {
  const bodyContents: object[] = [
    {
      type: "text",
      text: "Here's what I can do:",
      size: "sm",
      color: "#555555",
      wrap: true,
    },
  ];

  for (const cat of CATEGORIES) {
    bodyContents.push({ type: "separator", margin: "md", color: "#f2f2f2" });
    bodyContents.push(categoryRow(cat));
  }

  bodyContents.push({ type: "separator", margin: "xl", color: "#e0e0e0" });
  bodyContents.push({
    type: "text",
    text: "Tap an example to see how I reply:",
    weight: "bold",
    size: "sm",
    color: "#333333",
    wrap: true,
    margin: "md",
  });

  const exampleButtons = HELP_EXAMPLES.map((ex) => ({
    type: "button",
    style: "secondary",
    height: "sm",
    action: {
      type: "message",
      label: ex.question,
      text: ex.question,
    },
  }));

  return {
    type: "flex",
    altText: "Lekha help: memory, tasks, reminders, lists, email, calendar, drive, media, receipts, search, settings.",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#5B6FF0",
        paddingAll: "14px",
        contents: [
          { type: "text", text: "🤖  Lekha Help", color: "#FFFFFF", weight: "bold", size: "lg" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "none",
        paddingAll: "16px",
        contents: bodyContents,
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: exampleButtons.slice(0, 5),
      },
    },
  };
}

/** Return the curated answer for a help example question, or null if no match. */
export function curatedAnswer(question: string): string | null {
  const normalized = question.trim().toLowerCase();
  const ex = HELP_EXAMPLES.find((e) => e.question.toLowerCase() === normalized);
  return ex?.answer ?? null;
}
