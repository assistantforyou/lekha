import type { FlexMessage } from "@/lib/line/client";
import { t, uiLang, dateLocale } from "@/lib/i18n";

export type ReminderRow = {
  id: string;
  message: string;
  fireAt: number;
};

function formatFireAt(ts: number, timezone = "Asia/Bangkok", locale = "en-US"): string {
  const fire = new Date(ts);
  const now = new Date();
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat(locale, { timeZone: timezone, year: "numeric", month: "short", day: "numeric" }).format(d);

  const fireDate = fmtDate(fire);
  const nowDate = fmtDate(now);
  const time = fmt(fire).split(", ").pop() ?? fmt(fire);

  if (fireDate === nowDate) return `${time}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (fmtDate(tomorrow) === fireDate) {
    const tomorrowLabel = t(uiLang(locale === "th-TH" ? "th" : "en"), "tomorrow");
    return `${tomorrowLabel}, ${time}`;
  }

  return fmt(fire);
}

/** Render a list of pending reminders as a Flex bubble. */
export function reminderListFlex(
  reminders: ReminderRow[],
  opts?: { title?: string; timezone?: string; language?: string | null },
): FlexMessage {
  const lang = uiLang(opts?.language);
  const locale = dateLocale(opts?.language);
  const title = opts?.title ?? t(lang, "remindersTitle");
  const timezone = opts?.timezone ?? "Asia/Bangkok";
  const rows = reminders.slice(0, 10);

  if (rows.length === 0) {
    return {
      type: "flex",
      altText: t(lang, "noReminders"),
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#5B6FF0",
          paddingAll: "16px",
          contents: [{ type: "text", text: t(lang, "remindersHeader"), color: "#ffffff", weight: "bold", size: "md" }],
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingAll: "20px",
          contents: [{ type: "text", text: t(lang, "noReminders"), size: "sm", color: "#888888", align: "center" }],
        },
      },
    };
  }

  const reminderRows: object[] = [];
  rows.forEach((row, i) => {
    if (i > 0) {
      reminderRows.push({ type: "separator", color: "#f2f2f2" });
    }
    reminderRows.push({
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
              text: row.message,
              size: "sm",
              wrap: true,
              weight: "bold",
              color: "#111111",
            },
            {
              type: "text",
              text: formatFireAt(row.fireAt, timezone, locale),
              size: "xs",
              color: "#888888",
              margin: "xs",
            },
          ],
        },
        {
          type: "button",
          style: "secondary",
          height: "sm",
          flex: 0,
          action: {
            type: "postback",
            label: t(lang, "reminderCancelBtn"),
            data: `reminder:cancel:${row.id}`,
            displayText: `${t(lang, "reminderCancelBtn")}: ${row.message.slice(0, 30)}`,
          },
        },
      ],
    });
  });

  return {
    type: "flex",
    altText: `${title}: ${rows.map((r, i) => `${i + 1}. ${r.message}`).join(" • ")}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#5B6FF0",
        paddingAll: "16px",
        contents: [
          { type: "text", text: t(lang, "remindersHeader"), color: "#ffffff", weight: "bold", size: "md" },
          { type: "text", text: title, color: "#CCCCCC", size: "xs", margin: "xs" },
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
        contents: reminderRows,
      },
    },
  };
}
