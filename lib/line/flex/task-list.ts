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

  const isOverdue = due < now && !dueDate.includes(nowDate);

  const currentYear = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
  }).format(now);
  const dueYear = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
  }).format(due);

  const label = dueYear === currentYear
    ? new Intl.DateTimeFormat("en-US", { timeZone: timezone, month: "short", day: "numeric" }).format(due)
    : dueDate;

  return isOverdue ? `Overdue · ${label}` : label;
}

/**
 * Render a list of tasks as a Flex bubble with clear row separators.
 * Each row has a tap button: open → "Done", done → "Reopen".
 */
export function taskListFlex(
  tasks: TaskRow[],
  opts?: { title?: string; timezone?: string },
): FlexMessage {
  const title = opts?.title ?? "Your tasks";
  const timezone = opts?.timezone ?? "Asia/Bangkok";
  const rows = tasks.slice(0, 10);

  if (rows.length === 0) {
    return {
      type: "flex",
      altText: "No tasks. 🎉",
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#00B894",
          paddingAll: "16px",
          contents: [
            { type: "text", text: "✅ Tasks", color: "#ffffff", weight: "bold", size: "md" },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "20px",
          contents: [
            { type: "text", text: "Nothing on your list. 🎉", size: "sm", color: "#888888", align: "center" },
          ],
        },
      },
    };
  }

  const open = rows.filter((r) => !r.done).length;
  const headerTitle = open > 0 ? `${open} open  ·  ${rows.length - open} done` : "All done 🎉";

  const taskRows: object[] = [];
  rows.forEach((row, i) => {
    if (i > 0) {
      taskRows.push({ type: "separator", color: "#f2f2f2" });
    }

    const dueText = row.dueAt ? formatDueDate(row.dueAt, timezone) : null;
    const isOverdue = dueText?.startsWith("Overdue") ?? false;

    taskRows.push({
      type: "box",
      layout: "horizontal",
      paddingTop: "12px",
      paddingBottom: "12px",
      alignItems: "center",
      spacing: "sm",
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 1,
          spacing: "xs",
          contents: [
            {
              type: "text",
              text: row.title,
              size: "sm",
              wrap: true,
              weight: row.done ? "regular" : "bold",
              color: row.done ? "#aaaaaa" : "#111111",
              decoration: row.done ? "line-through" : "none",
            },
            ...(dueText
              ? [
                  {
                    type: "text",
                    text: dueText,
                    size: "xs",
                    color: isOverdue ? "#E53935" : "#888888",
                    margin: "xs",
                  },
                ]
              : []),
          ],
        },
        {
          type: "button",
          style: row.done ? "secondary" : "primary",
          height: "sm",
          flex: 0,
          color: row.done ? undefined : "#00B894",
          action: {
            type: "postback",
            label: row.done ? "Reopen" : "Done",
            data: `task:${row.done ? "reopen" : "done"}:${row.id}`,
            displayText: row.done
              ? `Reopen "${row.title.slice(0, 30)}"`
              : `Done: ${row.title.slice(0, 30)}`,
          },
        },
      ],
    });
  });

  return {
    type: "flex",
    altText: `${title}: ${rows.map((r, i) => `${i + 1}. ${r.title}${r.done ? " ✓" : ""}`).join(" • ")}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#00B894",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "✅  Tasks", color: "#ffffff", weight: "bold", size: "md" },
          { type: "text", text: headerTitle, color: "#CCCCCC", size: "xs", margin: "xs" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingStart: "16px",
        paddingEnd: "16px",
        paddingTop: "0px",
        paddingBottom: "8px",
        spacing: "none",
        contents: taskRows,
      },
    },
  };
}
