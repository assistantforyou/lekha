import type { FlexMessage } from "@/lib/line/client";

/**
 * Confirm/Cancel bubble for a pending action queue. Two postback buttons:
 *   - "Yes, send"   → data="confirm:yes"
 *   - "Cancel"      → data="confirm:no"
 *
 * `summary` is the verbatim draft preview text (already-rendered text body
 * from `renderDraftsBlock`). LINE renders this inside the bubble; we trim
 * for the altText fallback.
 */
export function confirmCancelFlex(summary: string, opts?: { yesLabel?: string; noLabel?: string }): FlexMessage {
  const yesLabel = opts?.yesLabel ?? "Yes, send";
  const noLabel = opts?.noLabel ?? "Cancel";
  const trimmed = summary.length > 1000 ? summary.slice(0, 990) + "…" : summary;
  return {
    type: "flex",
    altText: `Confirm? ${summary.slice(0, 200)}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: "Confirm?", weight: "bold", size: "lg" },
          {
            type: "text",
            text: trimmed,
            wrap: true,
            size: "sm",
            color: "#555555",
          },
        ],
      },
      footer: {
        type: "box",
        layout: "horizontal",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "secondary",
            height: "sm",
            action: { type: "postback", label: noLabel, data: "confirm:no", displayText: noLabel },
          },
          {
            type: "button",
            style: "primary",
            color: "#06C755",
            height: "sm",
            action: { type: "postback", label: yesLabel, data: "confirm:yes", displayText: yesLabel },
          },
        ],
      },
    },
  };
}
