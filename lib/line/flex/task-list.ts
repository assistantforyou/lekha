import type { FlexMessage } from "@/lib/line/client";

export type TaskRow = {
  id: string;
  title: string;
  done: boolean;
  dueAt?: number;
};

function formatDueDate(ts: number, timezone = "Asia/Bangkok"): string {
  const due = new Date(ts);
  const now = new Date();
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);

  const dueDate = fmtDate(due);
  const nowDate = fmtDate(now);
  if (dueDate === nowDate) return "Today";

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (fmtDate(tomorrow) === dueDate) return "Tomorrow";

  const currentYear = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
  }).format(now);
  const dueYear = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
  }).format(due);

  if (dueYear === currentYear) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "short",
      day: "numeric",
    }).format(due);
  }
  return dueDate;
}

/**
 * Render a list of tasks as a Flex bubble. Each row has a tap button:
 *   - open task   → "Done"   postback "task:done:<id>"
 *   - done task   → "Reopen" postback "task:reopen:<id>"
 *
 * Postback data is capped by LINE at 300 chars, so we expect short ids
 * (UUIDs are fine — 36 chars + 12-char prefix = 48).
 */
export function taskListFlex(
  tasks: TaskRow[],
  opts?: { title?: string; timezone?: string },
): FlexMessage {
  const title = opts?.title ?? "Your tasks";
  const timezone = opts?.timezone ?? "Asia/Bangkok";
  const rows = tasks.slice(0, 10); // LINE Flex bubble: keep it readable
  if (rows.length === 0) {
    return {
      type: "flex",
      altText: `${title}: (none)`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: title, weight: "bold", size: "lg" },
            { type: "text", text: "No tasks. 🎉", color: "#888888", margin: "md" },
          ],
        },
      },
    };
  }

  return {
    type: "flex",
    altText: `${title}: ${rows.map((r, i) => `${i + 1}. ${r.title}${r.done ? " ✓" : ""}`).join(" • ")}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: title, weight: "bold", size: "lg" },
          { type: "separator", margin: "md" },
          ...rows.map((row) => {
            const dueText = row.dueAt ? formatDueDate(row.dueAt, timezone) : null;
            return {
              type: "box" as const,
              layout: "vertical" as const,
              spacing: "sm" as const,
              margin: "md" as const,
              contents: [
                {
                  type: "box" as const,
                  layout: "horizontal" as const,
                  spacing: "sm" as const,
                  contents: [
                    {
                      type: "box" as const,
                      layout: "vertical" as const,
                      flex: 1,
                      contents: [
                        {
                          type: "text" as const,
                          text: row.title,
                          size: "sm" as const,
                          wrap: true,
                          weight: row.done ? "regular" : "bold",
                          color: row.done ? "#888888" : "#111111",
                        },
                        ...(dueText
                          ? [
                              {
                                type: "text" as const,
                                text: `Due ${dueText}`,
                                size: "xs" as const,
                                color: "#888888" as const,
                                margin: "sm" as const,
                              },
                            ]
                          : []),
                      ],
                    },
                    {
                      type: "box" as const,
                      layout: "vertical" as const,
                      width: "72px",
                      justifyContent: "center",
                      alignItems: "center",
                      contents: [
                        {
                          type: "button" as const,
                          style: row.done ? ("secondary" as const) : ("primary" as const),
                          height: "sm" as const,
                          action: {
                            type: "postback" as const,
                            label: row.done ? "Reopen" : "Done",
                            data: `task:${row.done ? "reopen" : "done"}:${row.id}`,
                            displayText: row.done
                              ? `Reopen "${row.title.slice(0, 30)}"`
                              : `Done: ${row.title.slice(0, 30)}`,
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            };
          }),
        ],
      },
    },
  };
}
