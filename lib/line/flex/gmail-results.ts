import type { FlexMessage } from "@/lib/line/client";

export type GmailRow = {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  unread?: boolean;
  date?: string;
};

/** Render gmail search hits as a Flex carousel — one bubble per email with an "Open" URI button. */
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
      contents: rows.map((m) => {
        const headerColor = m.unread ? "#1a5f9a" : "#666666";
        return {
          type: "bubble" as const,
          size: "kilo" as const,
          header: {
            type: "box" as const,
            layout: "vertical" as const,
            paddingAll: "8px",
            backgroundColor: headerColor,
            contents: [
              {
                type: "text" as const,
                text: m.from.slice(0, 60),
                size: "xxs" as const,
                color: "#FFFFFF",
                weight: "bold" as const,
              },
            ],
          },
          body: {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "sm" as const,
            contents: [
              {
                type: "text" as const,
                text: m.subject.slice(0, 80),
                weight: "bold" as const,
                size: "sm" as const,
                wrap: true,
                color: "#222222",
              },
              ...(m.snippet
                ? [
                    {
                      type: "text" as const,
                      text: m.snippet.slice(0, 140),
                      size: "xs" as const,
                      color: "#666666",
                      wrap: true,
                      margin: "sm" as const,
                    },
                  ]
                : []),
            ],
          },
          footer: {
            type: "box" as const,
            layout: "vertical" as const,
            contents: [
              {
                type: "button" as const,
                style: "primary" as const,
                height: "sm" as const,
                color: headerColor,
                action: {
                  type: "uri" as const,
                  label: "Open in Gmail",
                  uri: `https://mail.google.com/mail/u/0/#all/${m.id}`,
                },
              },
            ],
          },
        };
      }),
    },
  };
}
