import type { FlexMessage } from "@/lib/line/client";
import { t, uiLang } from "@/lib/i18n";

export function newGroupAdminFlex(groupId: string, opts?: { language?: string | null }): FlexMessage {
  const lang = uiLang(opts?.language);
  const shortId = `${groupId.slice(0, 16)}…`;
  return {
    type: "flex",
    altText: `${t(lang, "newGroupAdminTitle")} ${shortId}`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          { type: "text", text: t(lang, "newGroupAdminTitle"), weight: "bold", size: "md" },
          { type: "text", text: groupId, size: "xs", wrap: true, color: "#333333" },
          { type: "text", text: shortId, size: "xs", color: "#888888" },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "postback",
              label: t(lang, "newGroupAdminIgnore"),
              data: `group:remove:${groupId}`,
              displayText: `${t(lang, "newGroupAdminIgnore")} ${shortId}`,
            },
          },
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#06C755",
            action: {
              type: "postback",
              label: t(lang, "newGroupAdminAllow"),
              data: `group:allow:${groupId}`,
              displayText: `${t(lang, "newGroupAdminAllow")} ${shortId}`,
            },
          },
        ],
      },
    },
  };
}

export function groupGateFlex(baseUrl: string, opts?: { language?: string | null }): FlexMessage {
  const lang = uiLang(opts?.language);
  return {
    type: "flex",
    altText: t(lang, "groupGateBody"),
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          {
            type: "text",
            text: t(lang, "groupGateTitle"),
            weight: "bold",
            size: "xl",
            color: "#FFFFFF",
          },
          {
            type: "text",
            text: t(lang, "groupGateBody"),
            wrap: true,
            size: "sm",
            color: "#AABBDD",
          },
        ],
        backgroundColor: "#071124",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#06C755",
            height: "sm",
            action: {
              type: "uri",
              label: t(lang, "groupGateMonthly"),
              uri: `${baseUrl}/signup?plan=team_monthly`,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "uri",
              label: t(lang, "groupGateYearly"),
              uri: `${baseUrl}/signup?plan=team_yearly`,
            },
          },
        ],
        backgroundColor: "#071124",
      },
    },
  };
}
