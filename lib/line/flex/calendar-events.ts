import type { FlexMessage } from "@/lib/line/client";

export type CalendarEventRow = {
  id: string;
  summary: string;
  start: string;
  end: string;
  location?: string | null;
  htmlLink?: string | null;
};

function fmtTime(iso: string, tz?: string): string {
  if (!iso) return "";
  // YYYY-MM-DD (all-day) → keep as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    timeZone: tz ?? "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Render upcoming calendar events as a Flex carousel. */
export function calendarEventsFlex(events: CalendarEventRow[], timezone?: string): FlexMessage {
  const rows = events.slice(0, 10);
  if (rows.length === 0) {
    return {
      type: "flex",
      altText: "Calendar: nothing upcoming",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [{ type: "text", text: "Nothing on the calendar.", color: "#888888" }],
        },
      },
    };
  }
  return {
    type: "flex",
    altText: `Upcoming: ${rows.map((e) => `${e.summary} ${fmtTime(e.start, timezone)}`).join(" • ").slice(0, 380)}`,
    contents: {
      type: "carousel",
      contents: rows.map((e) => {
        const footerButtons: any[] = [];
        if (e.htmlLink) {
          footerButtons.push({
            type: "button",
            style: "primary",
            height: "sm",
            action: { type: "uri", label: "Open", uri: e.htmlLink },
          });
        }
        footerButtons.push({
          type: "button",
          style: "secondary",
          height: "sm",
          action: {
            type: "postback",
            label: "Remind me",
            data: `event:remind:${e.id}`.slice(0, 300),
            displayText: `Remind me about ${e.summary.slice(0, 40)}`,
          },
        });
        return {
          type: "bubble" as const,
          size: "kilo" as const,
          body: {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "sm" as const,
            contents: [
              {
                type: "text" as const,
                text: e.summary.slice(0, 80),
                weight: "bold" as const,
                size: "sm" as const,
                wrap: true,
              },
              {
                type: "text" as const,
                text: fmtTime(e.start, timezone),
                size: "xs" as const,
                color: "#666666",
                margin: "sm" as const,
              },
              ...(e.location
                ? [
                    {
                      type: "text" as const,
                      text: `📍 ${e.location.slice(0, 60)}`,
                      size: "xs" as const,
                      color: "#555555",
                      wrap: true,
                    },
                  ]
                : []),
            ],
          },
          footer: {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "xs" as const,
            contents: footerButtons,
          },
        };
      }),
    },
  };
}
