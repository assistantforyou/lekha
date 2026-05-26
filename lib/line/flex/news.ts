import type { FlexMessage } from "@/lib/line/client";

export type NewsRow = {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
};

/** Render news search hits as a Flex carousel — each bubble has a "Read" URI button. */
export function newsFlex(stories: NewsRow[]): FlexMessage {
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
  return {
    type: "flex",
    altText: `News: ${rows.map((s) => s.title).join(" • ").slice(0, 380)}`,
    contents: {
      type: "carousel",
      contents: rows.map((s) => ({
        type: "bubble" as const,
        size: "kilo" as const,
        body: {
          type: "box" as const,
          layout: "vertical" as const,
          spacing: "sm" as const,
          contents: [
            {
              type: "text" as const,
              text: s.title.slice(0, 100),
              weight: "bold" as const,
              size: "sm" as const,
              wrap: true,
            },
            ...(s.source
              ? [
                  {
                    type: "text" as const,
                    text: s.source.slice(0, 50),
                    size: "xxs" as const,
                    color: "#999999",
                    margin: "sm" as const,
                  },
                ]
              : []),
            ...(s.snippet
              ? [
                  {
                    type: "text" as const,
                    text: s.snippet.slice(0, 140),
                    size: "xs" as const,
                    color: "#555555",
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
              action: { type: "uri" as const, label: "Read", uri: s.url },
            },
          ],
        },
      })),
    },
  };
}
