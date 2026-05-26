import type { FlexMessage } from "@/lib/line/client";

/**
 * Render a named list (grocery, packing, etc.) with a delete button per row.
 * Postback verb: `list:rm:<listName>:<itemIdx>` — index keeps payloads short
 * regardless of item text length.
 */
export function listItemsFlex(listName: string, items: string[]): FlexMessage {
  const title = listName.charAt(0).toUpperCase() + listName.slice(1);
  const rows = items.slice(0, 12);
  if (rows.length === 0) {
    return {
      type: "flex",
      altText: `${title}: (empty)`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            { type: "text", text: title, weight: "bold", size: "lg" },
            { type: "text", text: "Empty list.", color: "#888888", margin: "md" },
          ],
        },
      },
    };
  }
  // Encode listName for postback safety: replace ':' with '-'.
  const safeName = listName.replace(/:/g, "-");
  return {
    type: "flex",
    altText: `${title}: ${rows.join(", ")}${items.length > rows.length ? ` (+${items.length - rows.length} more)` : ""}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: title, weight: "bold", size: "lg" },
          { type: "separator", margin: "md" },
          ...rows.map((item, i) => ({
            type: "box" as const,
            layout: "horizontal" as const,
            spacing: "sm" as const,
            margin: "md" as const,
            contents: [
              {
                type: "text" as const,
                text: `• ${item}`,
                size: "sm" as const,
                wrap: true,
                flex: 5,
                color: "#111111",
              },
              {
                type: "button" as const,
                style: "secondary" as const,
                height: "sm" as const,
                flex: 2,
                action: {
                  type: "postback" as const,
                  label: "Remove",
                  data: `list:rm:${safeName}:${i}`,
                  displayText: `remove ${item.slice(0, 30)} from ${listName}`,
                },
              },
            ],
          })),
        ],
      },
    },
  };
}
