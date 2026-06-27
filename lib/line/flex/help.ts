import type { FlexMessage } from "@/lib/line/client";

export type HelpExample = {
  id: string;
  question: string;
  answer: string;
};

export const HELP_EXAMPLES: HelpExample[] = [
  {
    id: "memory",
    question: "What do you know about me?",
    answer: "I remember a few things about you:\n• You prefer espresso over filter coffee ☕\n• Your timezone is Asia/Bangkok 🌏\n• You like morning briefings at 7 AM ☀️\n\nTell me more anytime with \"remember that I...\".",
  },
  {
    id: "tasks",
    question: "List my open tasks",
    answer: "Here are your open tasks:\n1. Review Q3 report\n2. Call Alice about the contract\n\nSay \"mark task #1 done\" when you finish one. ✅",
  },
  {
    id: "weather",
    question: "What's the weather in Bangkok?",
    answer: "In Bangkok right now it's 32°C and partly cloudy. 🌤️\n\nI can check weather anywhere — just ask \"what's the weather in Tokyo?\"",
  },
  {
    id: "search",
    question: "Search the web for Thai recipes",
    answer: "Here are a few popular Thai recipes:\n• Pad Thai\n• Tom Yum Goong\n• Green Curry\n\nWant me to dig deeper into one?",
  },
  {
    id: "receipt",
    question: "How do I scan a receipt?",
    answer: "Send me a photo of the receipt and say \"scan this\". I'll save the merchant, amount, date, and items so you can search them later. 🧾",
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

function exampleRow(ex: HelpExample): object {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    margin: "md",
    alignItems: "center",
    contents: [
      {
        type: "text",
        text: ex.question,
        flex: 1,
        size: "sm",
        color: "#333333",
        wrap: true,
        align: "start",
      },
      {
        type: "button",
        style: "primary",
        color: "#00B894",
        height: "sm",
        flex: 0,
        action: {
          type: "message",
          label: "Try it",
          text: ex.question,
        },
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
    text: "Tap a green button to see how I reply:",
    weight: "bold",
    size: "sm",
    color: "#333333",
    wrap: true,
    margin: "md",
  });

  for (const ex of HELP_EXAMPLES) {
    bodyContents.push(exampleRow(ex));
  }

  return {
    type: "flex",
    altText: "Lekha help: memory, tasks, reminders, lists, email, calendar, drive, media, receipts, search, settings. Tap an example to see a reply.",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#5B6FF0",
        paddingAll: "14px",
        contents: [{ type: "text", text: "🤖  Lekha Help", color: "#FFFFFF", weight: "bold", size: "lg" }],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "none",
        paddingAll: "16px",
        contents: bodyContents,
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
