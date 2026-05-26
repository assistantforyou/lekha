import type { FlexMessage } from "@/lib/line/client";

/** Sent to non-allowlisted users who message the bot. */
export function signupGateFlex(signupUrl: string): FlexMessage {
  return {
    type: "flex",
    altText: "Lekha is subscription-based. Tap to sign up.",
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
            text: "Get access to Lekha",
            weight: "bold",
            size: "xl",
            color: "#FFFFFF",
          },
          {
            type: "text",
            text: "Lekha is a subscription-based personal assistant. Sign up to get started with a 7-day free trial.",
            wrap: true,
            size: "sm",
            color: "#AABBDD",
            margin: "md",
          },
        ],
        backgroundColor: "#071124",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "none",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#1a7fe0",
            height: "sm",
            action: {
              type: "uri",
              label: "Sign up — 7 days free",
              uri: signupUrl,
            },
          },
        ],
        backgroundColor: "#071124",
      },
    },
  };
}
