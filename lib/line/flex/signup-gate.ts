import type { FlexMessage } from "@/lib/line/client";

/** Sent to non-allowlisted users who message the bot. */
export function signupGateFlex(baseUrl: string): FlexMessage {
  return {
    type: "flex",
    altText: "Lekha is subscription-based. Choose a plan to sign up.",
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
            text: "Lekha is a subscription-based personal assistant. Start with a 7-day free trial.",
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
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#1a7fe0",
            height: "sm",
            action: {
              type: "uri",
              label: "Monthly — ฿599/mo",
              uri: `${baseUrl}/signup?plan=monthly`,
            },
          },
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: {
              type: "uri",
              label: "Yearly — ฿5,990/yr (save 17%)",
              uri: `${baseUrl}/signup?plan=yearly`,
            },
          },
        ],
        backgroundColor: "#071124",
      },
    },
  };
}
