import type { FlexMessage } from "@/lib/line/client";
import { t, uiLang, dateLocale } from "@/lib/i18n";

export type TaskRow = {
  id: string;
  title: string;
  done: boolean;
  dueAt?: number;
};

function formatDueDate(ts: number, timezone = "Asia/Bangkok", locale = "en-US"): string {
  const due = new Date(ts);
  const now = new Date();
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);

  const dueDate = fmtDate(due);
  const nowDate = fmtDate(now);
  if (dueDate === nowDate) return t(uiLang(locale === "th-TH" ? "th" : "en"), "dueToday");

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (fmtDate(tomorrow) === dueDate) return t(uiLang(locale === "th-TH" ? "th" : "en"), "dueTomorrow");

  const isOverdue = due < now && !dueDate.includes(nowDate);

  const currentYear = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: "numeric",
  }).format(now);
  const dueYear = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    year: "numeric",
  }).format(due);

  const label = dueYear === currentYear
    ? new Intl.DateTimeFormat(locale, { timeZone: timezone, month: "short", day: "numeric" }).format(due)
    : dueDate;

  const overduePrefix = t(uiLang(locale === "th-TH" ? "th" : "en"), "taskOverduePrefix");
  return isOverdue ? `${overduePrefix}${label}` : label;
}

/**
 * Render a list of tasks as a Flex bubble with clear row separators.
 * Each row has a tap button: open → "Done", done → "Reopen".
 */
export function taskListFlex(
  tasks: TaskRow[],
  opts?: { title?: string; timezone?: string; language?: string | null },
): FlexMessage {
  const lang = uiLang(opts?.language);
  const locale = dateLocale(opts?.language);
  const title = opts?.title ?? t(lang, "tasksTitle");
  const timezone = opts?.timezone ?? "Asia/Bangkok";
  const rows = tasks.slice(0, 10);

  if (rows.length === 0) {
    return {
      type: "flex",
      altText: t(lang, "noTasks"),
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#00B894",
          paddingAll: "16px",
          contents: [
            { type: "text", text: t(lang, "taskHeader"), color: "#ffffff", weight: "bold", size: "md" },
          ],
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "20px",
          contents: [
            { type: "text", text: t(lang, "noTasks"), size: "sm", color: "#888888", align: "center" },
          ],
        },
      },
    };
  }

  const open = rows.filter((r) => !r.done).length;
  const headerTitle = open > 0
    ? t(lang, "taskOpenCount", { open: String(open), done: String(rows.length - open) })
    : t(lang, "taskAllDone");

  const taskRows: object[] = [];
  rows.forEach((row, i) => {
    if (i > 0) {
      taskRows.push({ type: "separator", color: "#f2f2f2" });
    }

    const dueText = row.dueAt ? formatDueDate(row.dueAt, timezone, locale) : null;
    const isOverdue = dueText?.startsWith(t(lang, "taskOverduePrefix").trim()) ?? false;

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
            label: row.done ? t(lang, "taskReopenBtn") : t(lang, "taskDoneBtn"),
            data: `task:${row.done ? "reopen" : "done"}:${row.id}`,
            displayText: row.done
              ? `${t(lang, "taskReopenBtn")} "${row.title.slice(0, 30)}"`
              : `${t(lang, "taskDoneBtn")}: ${row.title.slice(0, 30)}`,
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
          { type: "text", text: t(lang, "taskHeader"), color: "#ffffff", weight: "bold", size: "md" },
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
