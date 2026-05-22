import type { FlexMessage } from "@/lib/line/client";

export type TaskRow = {
  id: string;
  title: string;
  done: boolean;
};

/**
 * Render a list of tasks as a Flex bubble. Each row has a tap button:
 *   - open task   → "Done"   postback "task:done:<id>"
 *   - done task   → "Reopen" postback "task:reopen:<id>"
 *
 * Postback data is capped by LINE at 300 chars, so we expect short ids
 * (UUIDs are fine — 36 chars + 12-char prefix = 48).
 */
export function taskListFlex(tasks: TaskRow[], opts?: { title?: string }): FlexMessage {
  const title = opts?.title ?? "Your tasks";
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
          ...rows.map((row, i) => ({
            type: "box" as const,
            layout: "horizontal" as const,
            spacing: "sm" as const,
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: `${i + 1}. ${row.title}${row.done ? " ✓" : ""}`,
                size: "sm" as const,
                wrap: true,
                flex: 5,
                color: row.done ? "#888888" : "#111111",
              },
              {
                type: "button" as const,
                style: "secondary" as const,
                height: "sm" as const,
                flex: 2,
                action: {
                  type: "postback" as const,
                  label: row.done ? "Reopen" : "Done",
                  data: `task:${row.done ? "reopen" : "done"}:${row.id}`,
                  displayText: row.done ? `Reopen "${row.title.slice(0, 30)}"` : `Done: ${row.title.slice(0, 30)}`,
                },
              },
            ],
          })),
        ],
      },
    },
  };
}
