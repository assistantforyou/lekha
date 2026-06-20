import { flex, type FlexMessage } from "./client";

export type PlaceItem = {
  name: string;
  note: string;
  mapsQuery: string;
};

export function buildPlacesFlex(title: string, items: PlaceItem[]): FlexMessage {
  const bodyContents: unknown[] = [];

  items.forEach((item, i) => {
    bodyContents.push({
      type: "box",
      layout: "horizontal",
      paddingTop: "10px",
      paddingBottom: "10px",
      alignItems: "center",
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 6,
          contents: [
            {
              type: "text",
              text: item.name,
              weight: "bold",
              size: "sm",
              color: "#111111",
              wrap: true,
            },
            {
              type: "text",
              text: item.note,
              size: "xs",
              color: "#666666",
              wrap: true,
              margin: "xs",
            },
          ],
        },
        {
          type: "button",
          flex: 2,
          style: "link",
          height: "sm",
          action: {
            type: "uri",
            label: "📍 Map",
            uri: `https://maps.google.com/?q=${encodeURIComponent(item.mapsQuery)}`,
          },
        },
      ],
    });

    if (i < items.length - 1) {
      bodyContents.push({ type: "separator", color: "#eeeeee" });
    }
  });

  return flex(title, {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1a1a2e",
      paddingAll: "16px",
      contents: [
        {
          type: "text",
          text: "📍 " + title,
          size: "sm",
          weight: "bold",
          color: "#ffffff",
          wrap: true,
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingStart: "14px",
      paddingEnd: "4px",
      paddingTop: "4px",
      paddingBottom: "8px",
      contents: bodyContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingBottom: "8px",
      paddingEnd: "16px",
      contents: [
        {
          type: "text",
          text: "via web search",
          size: "xxs",
          color: "#bbbbbb",
          align: "end",
        },
      ],
    },
  });
}
