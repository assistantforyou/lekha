import type { FlexMessage } from "@/lib/line/client";

export type GmailRow = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  unread?: boolean;
  date?: string;
};

/** Render gmail search hits as a Flex carousel (one bubble per email). */
export function gmailResultsFlex(messages: GmailRow[]): FlexMessage {
  const rows = messages.slice(0, 10);
  if (rows.length === 0) {
    return {
      type: "flex",
      altText: "Gmail: no results",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [{ type: "text", text: "No matching emails.", color: "#888888" }],
        },
      },
    };
  }
  return {
    type: "flex",
    altText: `Inbox: ${rows.map((m) => m.subject).join(" • ").slice(0, 380)}`,
    contents: {
      type: "carousel",
      contents: rows.map((m) => ({
        type: "bubble" as const,
        size: "kilo" as const,
        body: {
          type: "box" as const,
          layout: "vertical" as const,
          spacing: "sm" as const,
          contents: [
            {
              type: "text" as const,
              text: m.from.slice(0, 60),
              size: "xs" as const,
              color: "#666666",
              weight: m.unread ? ("bold" as const) : ("regular" as const),
            },
            {
              type: "text" as const,
              text: m.subject.slice(0, 80),
              weight: "bold" as const,
              size: "sm" as const,
              wrap: true,
            },
            {
              type: "text" as const,
              text: m.snippet.slice(0, 140),
              size: "xs" as const,
              color: "#555555",
              wrap: true,
              margin: "sm" as const,
            },
          ],
        },
        footer: {
          type: "box" as const,
          layout: "vertical" as const,
          spacing: "xs" as const,
          contents: [
            {
              type: "button" as const,
              style: "primary" as const,
              height: "sm" as const,
              action: {
                type: "postback" as const,
                label: "Reply",
                data: `gmail:reply:${m.id}`.slice(0, 300),
                displayText: `Draft reply to "${m.subject.slice(0, 30)}"`,
              },
            },
            {
              type: "button" as const,
              style: "secondary" as const,
              height: "sm" as const,
              action: {
                type: "postback" as const,
                label: "Archive",
                data: `gmail:archive:${m.id}`.slice(0, 300),
                displayText: `Archive "${m.subject.slice(0, 30)}"`,
              },
            },
          ],
        },
      })),
    },
  };
}
