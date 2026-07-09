import type { FlexMessage } from "@/lib/line/client";

export type NewsRow = {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
};

/** Render news search hits as a Flex carousel — each bubble has a "Read" URI button. */
export function newsFlex(stories: NewsRow[], headerLabel?: string): FlexMessage {
  const rows = stories.slice(0, 10);
  if (rows.length === 0) {
    return {
      type: "flex",
      altText: "News: no results",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [{ type: "text", text: "No matching stories.", color: "#888888" }],
        },
      },
    };
  }

  const label = headerLabel ?? "📰 News";

  return {
    type: "flex",
    altText: `${label}: ${rows.map((s) => s.title).join(" • ").slice(0, 360)}`,
    contents: {
      type: "carousel",
      contents: rows.map((s) => {
        const sourceColor = s.source === "Markets" ? "#1a7f5a" : "#1a5f9a";
        return {
          type: "bubble" as const,
          size: "kilo" as const,
          header: s.source
            ? {
                type: "box" as const,
                layout: "vertical" as const,
                paddingAll: "8px",
                backgroundColor: sourceColor,
                contents: [
                  {
                    type: "text" as const,
                    text: s.source,
                    size: "xxs" as const,
                    color: "#FFFFFF",
                    weight: "bold" as const,
                  },
                ],
              }
            : undefined,
          body: {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "sm" as const,
            contents: [
              {
                type: "text" as const,
                text: s.title.slice(0, 120),
                weight: "bold" as const,
                size: "sm" as const,
                wrap: true,
                color: "#222222",
              },
              ...(s.snippet
                ? [
                    {
                      type: "text" as const,
                      text: s.snippet.slice(0, 300),
                      size: "xs" as const,
                      color: "#666666",
                      wrap: true,
                      margin: "sm" as const,
                    },
                  ]
                : []),
            ],
          },
          footer: {
            type: "box" as const,
            layout: "vertical" as const,
            contents: [
              {
                type: "button" as const,
                style: "primary" as const,
                height: "sm" as const,
                color: sourceColor,
                action: { type: "uri" as const, label: "Read", uri: s.url },
              },
            ],
          },
        };
      }),
    },
  };
}
