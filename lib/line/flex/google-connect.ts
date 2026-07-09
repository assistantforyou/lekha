import type { FlexMessage } from "@/lib/line/client";
import { t, uiLang } from "@/lib/i18n";

/**
 * Connect-Google bubble with a real `uri` action button. A raw URL pasted
 * into a text bubble is NOT tappable — Flex `text` components don't get
 * LINE's auto-linkification the way native text messages do, and the token
 * is long enough that manual copy/paste corrupts it. A button carries the
 * URL programmatically instead.
 */
export function googleConnectFlex(url: string, opts?: { reason?: string; language?: string | null }): FlexMessage {
  const lang = uiLang(opts?.language);
  const reason = opts?.reason ?? t(lang, "googleConnectDefaultReason");
  return {
    type: "flex",
    altText: t(lang, "googleConnectDefaultReason"),
    contents: {
      type: "bubble",
      size: "kilo",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          { type: "text", text: t(lang, "googleConnectTitle"), weight: "bold", size: "lg", color: "#e7c88d" },
          { type: "text", text: reason, wrap: true, size: "sm", color: "#555555" },
          { type: "text", text: t(lang, "googleConnectExpires"), wrap: true, size: "xs", color: "#999999" },
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
            action: { type: "uri", label: t(lang, "googleConnectButton"), uri: url },
          },
        ],
      },
    },
  };
}
