import type { FlexMessage } from "@/lib/line/client";

export function newGroupAdminFlex(groupId: string): FlexMessage {
  const shortId = `${groupId.slice(0, 16)}…`;
  return {
    type: "flex",
    altText: `Bot added to group ${shortId}`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "Bot added to a group", weight: "bold", size: "md" },
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
              label: "🗑 Ignore",
              data: `group:remove:${groupId}`,
              displayText: `Ignore group ${shortId}`,
            },
          },
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#06C755",
            action: {
              type: "postback",
              label: "✓ Allow",
              data: `group:allow:${groupId}`,
              displayText: `Allow group ${shortId}`,
            },
          },
        ],
      },
    },
  };
}

export function groupGateFlex(baseUrl: string): FlexMessage {
  return {
    type: "flex",
    altText: "Lekha Team plan required for group chat.",
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
            text: "Lekha in groups",
            weight: "bold",
            size: "xl",
            color: "#FFFFFF",
          },
          {
            type: "text",
            text: "A Team plan is needed to use Lekha inside group chats.",
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
              label: "Team Monthly — ฿800/mo",
              uri: `${baseUrl}/signup?plan=team_monthly`,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "uri",
              label: "Team Yearly — ฿8,000/yr",
              uri: `${baseUrl}/signup?plan=team_yearly`,
            },
          },
        ],
        backgroundColor: "#071124",
      },
    },
  };
}
