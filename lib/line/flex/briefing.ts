import type { FlexMessage } from "@/lib/line/client";

type Section = { header: string; items: string[] };

function parseSections(text: string): { greeting: string; sections: Section[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const greeting = lines[0] ?? "";
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of lines.slice(1)) {
    const isBullet = line.startsWith("•") || line.startsWith("-");
    if (isBullet) {
      if (current) current.items.push(line);
    } else {
      if (current) sections.push(current);
      current = { header: line, items: [] };
    }
  }
  if (current) sections.push(current);
  return { greeting, sections };
}

/**
 * Wrap the morning briefing / evening summary text in a Flex bubble with a
 * footer rail of quick actions. Sections are parsed and rendered with visual
 * separators and styled headers for readability.
 */
export function briefingFlex(
  kind: "morning" | "evening",
  bodyText: string,
): FlexMessage {
  const title = kind === "morning" ? "☀️  Morning briefing" : "🌙  Evening summary";
  const { greeting, sections } = parseSections(bodyText);

  const bodyContents: unknown[] = [
    {
      type: "text",
      text: greeting.slice(0, 200),
      weight: "bold",
      size: "md",
      color: "#111111",
      wrap: true,
    },
  ];

  for (const s of sections) {
    bodyContents.push({ type: "separator", margin: "md" });
    const sectionItems: unknown[] = [
      {
        type: "text",
        text: s.header.slice(0, 200),
        weight: "bold",
        size: "sm",
        color: "#333333",
        wrap: true,
      },
      ...s.items.slice(0, 15).map((item) => ({
        type: "text",
        text: item.slice(0, 200),
        size: "xs",
        color: "#555555",
        wrap: true,
        margin: "xs",
      })),
    ];
    bodyContents.push({
      type: "box",
      layout: "vertical",
      spacing: "xs",
      margin: "md",
      contents: sectionItems,
    });
  }

  return {
    type: "flex",
    altText: `${title}: ${bodyText.slice(0, 380)}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: title, weight: "bold", size: "lg", color: "#FFFFFF" }],
        backgroundColor: kind === "morning" ? "#FF9F43" : "#5B6FF0",
        paddingAll: "12px",
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
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            action: { type: "message", label: "What's on my calendar?", text: "what's on my calendar today" },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "message", label: "Show my tasks", text: "list my tasks" },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "message", label: "Check my inbox", text: "summarize my recent unread email" },
          },
        ],
      },
    },
  };
}
