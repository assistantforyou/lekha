import type { FlexMessage } from "@/lib/line/client";

export type HelpCategory = {
  id: string;
  icon: string;
  title: string;
  description: string;
  demoAnswer: string;
};

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "memory",
    icon: "🧠",
    title: "Memory",
    description: "remember facts, recall what I know, update memories",
    demoAnswer: "I can remember your preferences, routines, and important details so I don't have to ask twice. Try telling me anything — I'll store it.",
  },
  {
    id: "tasks",
    icon: "✅",
    title: "Tasks",
    description: "add tasks, mark done, list open work",
    demoAnswer: "Here's what I'd do: add a task 'call the plumber'. ✅\n\n(Demo only — no task was created.)",
  },
  {
    id: "reminders",
    icon: "⏰",
    title: "Reminders",
    description: "one-shot or recurring LINE pushes",
    demoAnswer: "I'd set a reminder: stretch in 5 minutes. ⏰\n\n(Demo only — no reminder was set.)",
  },
  {
    id: "lists",
    icon: "📋",
    title: "Lists",
    description: "grocery, packing, or any named list",
    demoAnswer: "I'd add milk to your grocery list. 🥛\n\n(Demo only — list unchanged.)",
  },
  {
    id: "email",
    icon: "📧",
    title: "Email & Inbox",
    description: "draft/send/search Gmail (Google needed)",
    demoAnswer: "With Google connected, I can search your inbox, draft replies, and send emails. Say 'connect google' to link an account.",
  },
  {
    id: "calendar",
    icon: "📅",
    title: "Calendar",
    description: "schedule events, list upcoming (Google needed)",
    demoAnswer: "With Google connected, I can check your schedule and draft events. I can also warn you before meetings if you want.",
  },
  {
    id: "drive",
    icon: "📁",
    title: "Drive & Docs",
    description: "search, upload, read files (Google needed)",
    demoAnswer: "I can search Drive, get share links, read text files, and upload photos or documents you send me.",
  },
  {
    id: "media",
    icon: "📷",
    title: "Media",
    description: "photos, voice notes, PDFs, Office files",
    demoAnswer: "Send me a photo and I'll read text or describe it. Send a PDF and I'll summarize it. Voice notes work too.",
  },
  {
    id: "receipts",
    icon: "🧾",
    title: "Receipts",
    description: "scan, list, search expense receipts",
    demoAnswer: "Send a receipt photo and say 'scan this'. I'll save the merchant, amount, date, and items so you can search them later. 🧾",
  },
  {
    id: "search",
    icon: "🌐",
    title: "Search & Info",
    description: "web search, weather, stocks, news",
    demoAnswer: "I can search the web, check weather, look up stocks/crypto, and get news. I always cite sources with a timestamp.",
  },
  {
    id: "settings",
    icon: "⚙️",
    title: "Settings",
    description: "timezone, location, language, briefings",
    demoAnswer: "I'd set your timezone to Asia/Bangkok. 🌏\n\n(Demo only — settings unchanged.)",
  },
];

function categoryRow(cat: HelpCategory): object {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    margin: "md",
    alignItems: "center",
    contents: [
      {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        flex: 1,
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
            text: cat.description,
            size: "xs",
            color: "#777777",
            wrap: true,
          },
        ],
      },
      {
        type: "button",
        style: "primary",
        color: "#00B894",
        height: "sm",
        flex: 0,
        action: {
          type: "postback",
          label: "Try it",
          data: `help-demo:${cat.id}`,
          displayText: cat.title,
        },
      },
    ],
  };
}

export function helpFlex(): FlexMessage {
  const bodyContents: object[] = [
    {
      type: "text",
      text: "Here's what I can do. Tap a green button to see how I reply:",
      size: "sm",
      color: "#555555",
      wrap: true,
    },
  ];

  for (const cat of HELP_CATEGORIES) {
    bodyContents.push({ type: "separator", margin: "md", color: "#f2f2f2" });
    bodyContents.push(categoryRow(cat));
  }

  return {
    type: "flex",
    altText: "Lekha help: memory, tasks, reminders, lists, email, calendar, drive, media, receipts, search, settings. Tap a category to see a demo reply.",
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#5B6FF0",
        paddingAll: "14px",
        contents: [{ type: "text", text: "Lekha Help", color: "#FFFFFF", weight: "bold", size: "lg" }],
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

/** Return the curated static demo answer for a help category, or null if unknown. */
export function curatedDemoAnswer(id: string): string | null {
  const cat = HELP_CATEGORIES.find((c) => c.id === id);
  return cat?.demoAnswer ?? null;
}
