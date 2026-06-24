import type { FlexMessage } from "@/lib/line/client";

export type PendingUserRow = {
  userId: string;
  displayName?: string;
  requestedAt: number;
};

export function pendingUsersFlex(users: PendingUserRow[]): FlexMessage {
  const bubbles = users.slice(0, 12).map(makeBubble);
  return {
    type: "flex",
    altText: `Pending access: ${users.length} user${users.length === 1 ? "" : "s"} waiting`,
    contents:
      bubbles.length === 1
        ? bubbles[0]!
        : { type: "carousel", contents: bubbles },
  };
}

function makeBubble(u: PendingUserRow) {
  const name = u.displayName ?? "Unknown";
  const shortId = `${u.userId.slice(0, 10)}…`;
  const ts = new Date(u.requestedAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    type: "bubble" as const,
    size: "kilo" as const,
    body: {
      type: "box" as const,
      layout: "vertical" as const,
      spacing: "sm" as const,
      paddingAll: "16px" as const,
      contents: [
        { type: "text" as const, text: name, weight: "bold" as const, size: "md" as const, wrap: true },
        { type: "text" as const, text: shortId, size: "xs" as const, color: "#888888" },
        { type: "text" as const, text: `Requested ${ts}`, size: "xs" as const, color: "#aaaaaa" },
      ],
    },
    footer: {
      type: "box" as const,
      layout: "horizontal" as const,
      spacing: "sm" as const,
      paddingAll: "12px" as const,
      contents: [
        {
          type: "button" as const,
          style: "secondary" as const,
          height: "sm" as const,
          action: {
            type: "postback" as const,
            label: "✗ Deny",
            data: `pending:deny:${u.userId}`,
            displayText: `Denied ${name}`,
          },
        },
        {
          type: "button" as const,
          style: "primary" as const,
          height: "sm" as const,
          color: "#06C755",
          action: {
            type: "postback" as const,
            label: "✓ Allow",
            data: `pending:allow:${u.userId}`,
            displayText: `Allowed ${name}`,
          },
        },
      ],
    },
  };
}
