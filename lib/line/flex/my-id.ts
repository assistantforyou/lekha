import type { FlexMessage } from "@/lib/line/client";

export function myIdFlex(userId: string): FlexMessage {
  return {
    type: "flex",
    altText: `Your LINE ID: ${userId}`,
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "Your LINE ID", weight: "bold", size: "md" },
          { type: "text", text: userId, size: "sm", wrap: true, color: "#333333" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "12px",
        contents: [
          {
            type: "button",
            style: "primary",
            height: "sm",
            color: "#06C755",
            action: { type: "clipboard", label: "📋 Copy my ID", content: userId },
          },
        ],
      },
    },
  };
}
