import type { FlexMessage } from "@/lib/line/client";
import { t, uiLang } from "@/lib/i18n";

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
export function taskCheckinFlex(tasks: CheckInRow[], opts?: { language?: string | null }): FlexMessage {
  const lang = uiLang(opts?.language);
  const rows = tasks.slice(0, 10);
  const titles = rows.map((r) => r.title).join(", ").slice(0, 340);
  return {
    type: "flex",
    altText: `${t(lang, "taskCheckinTitle")}: ${titles} — ${t(lang, "taskCheckinSubtitle")}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1a7fe0",
        paddingAll: "12px",
        contents: [
          { type: "text", text: t(lang, "taskCheckinTitle"), weight: "bold", size: "lg", color: "#FFFFFF" },
          { type: "text", text: t(lang, "taskCheckinSubtitle"), size: "sm", color: "#DDEEFF", margin: "sm" },
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
                    displayText: `${t(lang, "taskDoneBtn")}: ${row.title.slice(0, 40)}`,
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
                    displayText: `${t(lang, "taskReopenBtn")}: ${row.title.slice(0, 40)}`,
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
              label: t(lang, "taskCheckinDoneAll"),
              data: "checkin:confirm-all",
              displayText: t(lang, "taskCheckinDoneAllDisplay"),
            },
          },
        ],
      },
    },
  };
}

/**
 * Two-tap confirmation for the destructive "Done all" action.
 */
export function doneAllConfirmFlex(count: number, opts?: { language?: string | null }): FlexMessage {
  const lang = uiLang(opts?.language);
  const summary = t(lang, "doneAllConfirmTitle", { count: String(count), s: count === 1 ? "" : "s" });
  return {
    type: "flex",
    altText: summary,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        contents: [
          { type: "text", text: summary, weight: "bold", size: "md", wrap: true },
          { type: "text", text: t(lang, "doneAllConfirmHint"), size: "xs", color: "#888888", margin: "sm", wrap: true },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "postback", label: t(lang, "cancel"), data: "checkin:cancel-all", displayText: t(lang, "cancel") },
          },
          {
            type: "button",
            style: "primary",
            color: "#06C755",
            height: "sm",
            action: { type: "postback", label: t(lang, "yesDoneAll"), data: "checkin:done:all", displayText: t(lang, "yesMarkAllDone") },
          },
        ],
      },
    },
  };
}
