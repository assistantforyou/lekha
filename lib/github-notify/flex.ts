import type { FlexMessage } from "@/lib/line/client";

export interface GithubCard {
  eventLabel: string;  // "PR merged to main", "Push", "CI failed", etc.
  color: string;       // header background
  title: string;       // PR title, commit message, branch name, workflow name
  rows: { key: string; val: string }[];
  url: string;
}

export function githubEventFlex(card: GithubCard): FlexMessage {
  return {
    type: "flex",
    altText: `${card.eventLabel} — ${card.title}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: card.color,
        paddingAll: "14px",
        contents: [
          {
            type: "text",
            text: card.eventLabel,
            color: "#ffffff",
            weight: "bold",
            size: "sm",
          },
          {
            type: "text",
            text: "assistantforyou/lekha",
            color: "#ffffffbb",
            size: "xxs",
            margin: "xs",
          },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: card.title,
            weight: "bold",
            size: "md",
            wrap: true,
            maxLines: 3,
          },
          ...(card.rows.length > 0
            ? [
                { type: "separator" as const, margin: "md" as const },
                ...card.rows.map(({ key, val }) => ({
                  type: "box" as const,
                  layout: "horizontal" as const,
                  margin: "sm" as const,
                  contents: [
                    {
                      type: "text" as const,
                      text: key,
                      size: "xs" as const,
                      color: "#888888",
                      flex: 3,
                    },
                    {
                      type: "text" as const,
                      text: val,
                      size: "xs" as const,
                      color: "#333333",
                      flex: 7,
                      wrap: true,
                    },
                  ],
                })),
              ]
            : []),
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "10px",
        contents: [
          {
            type: "button",
            style: "link",
            height: "sm",
            action: {
              type: "uri",
              label: "View on GitHub →",
              uri: card.url,
            },
          },
        ],
      },
    },
  };
}

// Header colours per event type
export const COLORS = {
  push: "#1A73E8",
  prMergedMain: "#06C755",
  prMerged: "#34A853",
  issueClosed: "#34A853",
  branchCreated: "#7C3AED",
  branchDeleted: "#6B7280",
  ciPassed: "#06C755",
  ciFailed: "#EF4444",
} as const;
