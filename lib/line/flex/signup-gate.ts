import type { FlexMessage } from "@/lib/line/client";

/** Sent to non-allowlisted users who message the bot. */
export function signupGateFlex(baseUrl: string): FlexMessage {
  return {
    type: "flex",
    altText: "Unlock Lekha / ปลดล็อก Lekha — choose a plan or start a free trial.",
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
            text: "Unlock Lekha",
            weight: "bold",
            size: "xl",
            color: "#FFFFFF",
          },
          {
            type: "text",
            text: "ปลดล็อก Lekha",
            weight: "bold",
            size: "lg",
            color: "#FFFFFF",
          },
          {
            type: "text",
            text: "Start with a free trial, or subscribe to chat unlimited.",
            wrap: true,
            size: "sm",
            color: "#AABBDD",
            margin: "md",
          },
          {
            type: "text",
            text: "เริ่มทดลองใช้ฟรี หรือสมัครสมาชิกเพื่อแชทไม่จำกัด",
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
              type: "postback",
              label: "Free trial / ทดลองใช้ฟรี",
              data: "trial:start",
              displayText: "Free trial / ทดลองใช้ฟรี",
            },
          },
          {
            type: "button",
            style: "secondary",
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
          {
            type: "button",
            style: "secondary",
            color: "#5B8DEF",
            height: "sm",
            action: {
              type: "uri",
              label: "Team — ฿800/mo",
              uri: `${baseUrl}/signup?plan=team_monthly`,
            },
          },
        ],
        backgroundColor: "#071124",
      },
    },
  };
}
