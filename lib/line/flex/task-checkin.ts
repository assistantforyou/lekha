import type { FlexMessage } from "@/lib/line/client";

export type CheckInRow = {
  id: string;
  title: string;
};

/**
 * End-of-day task check-in bubble. Each row has two buttons:
 *   - "✓ Done"   → postback "checkin:done:<id>"
 *   - "Not yet"  → postback "checkin:skip:<id>"
 * Footer has "Done all" → "checkin:done:all"
 */
export function taskCheckinFlex(tasks: CheckInRow[]): FlexMessage {
  const rows = tasks.slice(0, 10);
  return {
    type: "flex",
    altText: `Quick check-in: ${rows.map((r) => r.title).join(", ").slice(0, 340)} — did you finish these today?`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1a7fe0",
        paddingAll: "12px",
        contents: [
          { type: "text", text: "✅  Quick check-in", weight: "bold", size: "lg", color: "#FFFFFF" },
          { type: "text", text: "Which of these did you finish today?", size: "sm", color: "#DDEEFF", margin: "sm" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: rows.map((row) => ({
          type: "box" as const,
          layout: "horizontal" as const,
          spacing: "sm" as const,
          margin: "md" as const,
          contents: [
            {
              type: "text" as const,
              text: row.title,
              size: "sm" as const,
              wrap: true,
              flex: 5,
              color: "#111111",
            },
            {
              type: "box" as const,
              layout: "horizontal" as const,
              flex: 3,
              spacing: "xs" as const,
              contents: [
                {
                  type: "button" as const,
                  style: "primary" as const,
                  height: "sm" as const,
                  flex: 1,
                  action: {
                    type: "postback" as const,
                    label: "✓",
                    data: `checkin:done:${row.id}`.slice(0, 300),
                    displayText: `Done: ${row.title.slice(0, 40)}`,
                  },
                },
                {
                  type: "button" as const,
                  style: "secondary" as const,
                  height: "sm" as const,
                  flex: 1,
                  action: {
                    type: "postback" as const,
                    label: "✗",
                    data: `checkin:skip:${row.id}`.slice(0, 300),
                    displayText: `Not yet: ${row.title.slice(0, 40)}`,
                  },
                },
              ],
            },
          ],
        })),
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: "Done all",
              data: "checkin:done:all",
              displayText: "Done all — mark everything complete",
            },
          },
        ],
      },
    },
  };
}
