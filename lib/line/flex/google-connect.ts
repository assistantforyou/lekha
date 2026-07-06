import type { FlexMessage } from "@/lib/line/client";

/**
 * Connect-Google bubble with a real `uri` action button. A raw URL pasted
 * into a text bubble is NOT tappable — Flex `text` components don't get
 * LINE's auto-linkification the way native text messages do, and the token
 * is long enough that manual copy/paste corrupts it. A button carries the
 * URL programmatically instead.
 */
export function googleConnectFlex(url: string, opts?: { reason?: string }): FlexMessage {
  const reason = opts?.reason ?? "Connect your Google account for email, calendar, and Drive.";
  return {
    type: "flex",
    altText: "Tap to connect your Google account",
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          { type: "text", text: "Google Connect", weight: "bold", size: "lg", color: "#e7c88d" },
          { type: "text", text: reason, wrap: true, size: "sm", color: "#555555" },
          { type: "text", text: "Link expires in 10 minutes.", wrap: true, size: "xs", color: "#999999" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#06C755",
            height: "sm",
            action: { type: "uri", label: "Connect Google Account", uri: url },
          },
        ],
      },
    },
  };
}
