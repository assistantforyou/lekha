import type { FlexMessage } from "@/lib/line/client";
import { t, uiLang, type UiLang } from "@/lib/i18n";

export type HelpCategory = {
  id: string;
  icon: string;
  title: string;
  description: string;
  demoAnswer: string;
};

function cat(id: string, icon: string, titleKey: string, descKey: string, demoKey: string, lang: UiLang): HelpCategory {
  return {
    id,
    icon,
    title: t(lang, titleKey as never),
    description: t(lang, descKey as never),
    demoAnswer: t(lang, demoKey as never),
  };
}

export function helpCategories(language?: string | null): HelpCategory[] {
  const lang = uiLang(language);
  return [
    cat("memory", "🧠", "helpCatMemoryTitle", "helpCatMemoryDesc", "helpCatMemoryDemo", lang),
    cat("tasks", "✅", "helpCatTasksTitle", "helpCatTasksDesc", "helpCatTasksDemo", lang),
    cat("reminders", "⏰", "helpCatRemindersTitle", "helpCatRemindersDesc", "helpCatRemindersDemo", lang),
    cat("lists", "📋", "helpCatListsTitle", "helpCatListsDesc", "helpCatListsDemo", lang),
    cat("email", "📧", "helpCatEmailTitle", "helpCatEmailDesc", "helpCatEmailDemo", lang),
    cat("calendar", "📅", "helpCatCalendarTitle", "helpCatCalendarDesc", "helpCatCalendarDemo", lang),
    cat("drive", "📁", "helpCatDriveTitle", "helpCatDriveDesc", "helpCatDriveDemo", lang),
    cat("media", "📷", "helpCatMediaTitle", "helpCatMediaDesc", "helpCatMediaDemo", lang),
    cat("receipts", "🧾", "helpCatReceiptsTitle", "helpCatReceiptsDesc", "helpCatReceiptsDemo", lang),
    cat("search", "🌐", "helpCatSearchTitle", "helpCatSearchDesc", "helpCatSearchDemo", lang),
    cat("settings", "⚙️", "helpCatSettingsTitle", "helpCatSettingsDesc", "helpCatSettingsDemo", lang),
  ];
}

function categoryRow(cat: HelpCategory, lang: UiLang): object {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "md",
    margin: "md",
    alignItems: "center",
    contents: [
      {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        flex: 1,
        contents: [
          {
            type: "text",
            text: `${cat.icon}  ${cat.title}`,
            weight: "bold",
            size: "sm",
            color: "#333333",
            wrap: true,
          },
          {
            type: "text",
            text: cat.description,
            size: "xs",
            color: "#777777",
            wrap: true,
          },
        ],
      },
      {
        type: "button",
        style: "primary",
        color: "#00B894",
        height: "sm",
        flex: 0,
        action: {
          type: "postback",
          label: t(lang, "helpTryIt"),
          data: `help-demo:${cat.id}`,
          displayText: cat.title,
        },
      },
    ],
  };
}

export function helpFlex(opts?: { language?: string | null }): FlexMessage {
  const lang = uiLang(opts?.language);
  const bodyContents: object[] = [
    {
      type: "text",
      text: t(lang, "helpHint"),
      size: "sm",
      color: "#555555",
      wrap: true,
    },
  ];

  for (const c of helpCategories(opts?.language)) {
    bodyContents.push({ type: "separator", margin: "md", color: "#f2f2f2" });
    bodyContents.push(categoryRow(c, lang));
  }

  return {
    type: "flex",
    altText: `${t(lang, "helpTitle")}: ${helpCategories(opts?.language).map((c) => c.title).join(", ").slice(0, 200)}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#5B6FF0",
        paddingAll: "14px",
        contents: [{ type: "text", text: t(lang, "helpTitle"), color: "#FFFFFF", weight: "bold", size: "lg" }],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "none",
        paddingAll: "16px",
        contents: bodyContents,
      },
    },
  };
}

/** Return the curated static demo answer for a help category, or null if unknown. */
export function curatedDemoAnswer(id: string, language?: string | null): string | null {
  const cat = helpCategories(language).find((c) => c.id === id);
  return cat?.demoAnswer ?? null;
}
