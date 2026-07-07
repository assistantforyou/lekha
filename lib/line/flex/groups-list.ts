import type { FlexMessage } from "@/lib/line/client";

export type GroupRow = {
  groupId: string;
  allowed: boolean;
  admin: boolean;
};

export function groupsListFlex(groups: GroupRow[]): FlexMessage {
  const allowed = groups.filter((g) => g.allowed || g.admin);
  const pending = groups.filter((g) => !g.allowed && !g.admin);

  const bubbles: unknown[] = [];

  if (allowed.length) {
    bubbles.push(makeSectionBubble(`✅ Allowed groups (${allowed.length})`, "#e8f5e9", "#2e7d32"));
    bubbles.push(...allowed.map(makeGroupBubble));
  }

  if (pending.length) {
    bubbles.push(makeSectionBubble(`⏳ Discovered, not allowed (${pending.length})`, "#fff3e0", "#ef6c00"));
    bubbles.push(...pending.map(makeGroupBubble));
  }

  if (!bubbles.length) {
    bubbles.push(makeSectionBubble("No groups discovered yet", "#f5f5f5", "#616161"));
  }

  return {
    type: "flex",
    altText: `Groups: ${allowed.length} allowed, ${pending.length} pending`,
    contents:
      bubbles.length === 1
        ? bubbles[0]
        : { type: "carousel", contents: bubbles },
  };
}

function makeSectionBubble(title: string, bgColor: string, color: string) {
  return {
    type: "bubble",
    size: "micro",
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "12px",
      backgroundColor: bgColor,
      contents: [{ type: "text", text: title, weight: "bold", size: "sm", color, wrap: true }],
    },
  };
}

function makeGroupBubble(g: GroupRow) {
  const shortId = `${g.groupId.slice(0, 16)}…`;
  const tag = g.admin ? "ADMIN" : g.allowed ? "ALLOWED" : "PENDING";
  const tagColor = g.admin ? "#1565c0" : g.allowed ? "#2e7d32" : "#ef6c00";

  const actionButton = g.allowed || g.admin
    ? {
        type: "button",
        style: "secondary",
        height: "sm",
        action: {
          type: "postback",
          label: "🗑 Remove",
          data: `group:remove:${g.groupId}`,
          displayText: `Remove group ${shortId}`,
        },
      }
    : {
        type: "button",
        style: "primary",
        height: "sm",
        color: "#06C755",
        action: {
          type: "postback",
          label: "✓ Allow",
          data: `group:allow:${g.groupId}`,
          displayText: `Allow group ${shortId}`,
        },
      };

  return {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "14px",
      contents: [
        { type: "text", text: tag, weight: "bold", size: "xs", color: tagColor },
        { type: "text", text: g.groupId, size: "xs", wrap: true, color: "#333333" },
        { type: "text", text: shortId, size: "xs", color: "#888888" },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingAll: "10px",
      contents: [actionButton],
    },
  };
}
