import type { FlexMessage } from "@/lib/line/client";

/**
 * Wrap the morning briefing / evening summary text in a Flex bubble with a
 * footer rail of quick actions. The full briefing text is kept verbatim in
 * the body; the buttons let the user act on the most likely next steps.
 */
export function briefingFlex(
  kind: "morning" | "evening",
  bodyText: string,
): FlexMessage {
  const title = kind === "morning" ? "☀️  Morning briefing" : "🌙  Evening summary";
  // LINE Flex text caps each block at ~2000 chars — split on newlines into
  // a series of text nodes so long briefings render fully.
  const lines = bodyText.split(/\n+/).filter((l) => l.trim().length > 0);
  const textBlocks = lines.slice(0, 30).map((l) => ({
    type: "text" as const,
    text: l.slice(0, 500),
    wrap: true,
    size: "sm" as const,
    color: "#222222",
  }));
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
        spacing: "sm",
        contents: textBlocks,
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
