import { flex, type FlexMessage } from "./client";

export type PlaceItem = {
  name: string;
  note: string;
  mapsQuery: string;
};

export type PlacesFlexOpts = {
  headerColor?: string;
  introText?: string;
  closingText?: string;
};

export function buildPlacesFlex(
  title: string,
  items: PlaceItem[],
  opts?: PlacesFlexOpts,
): FlexMessage {
  const headerColor = opts?.headerColor ?? "#1a1a2e";
  const bodyContents: unknown[] = [];

  if (opts?.introText) {
    bodyContents.push({
      type: "text",
      text: opts.introText,
      size: "sm",
      color: "#444444",
      wrap: true,
      margin: "sm",
    });
    bodyContents.push({ type: "separator", color: "#dddddd", margin: "md" });
  }

  items.forEach((item, i) => {
    bodyContents.push({
      type: "box",
      layout: "vertical",
      paddingTop: i === 0 && !opts?.introText ? "4px" : "10px",
      paddingBottom: "4px",
      contents: [
        {
          type: "box",
          layout: "horizontal",
          alignItems: "flex-start",
          contents: [
            {
              type: "box",
              layout: "vertical",
              flex: 1,
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
          ],
        },
        {
          type: "button",
          style: "link",
          height: "sm",
          margin: "xs",
          action: {
            type: "uri",
            label: "📍 Open in Maps",
            uri: `https://maps.google.com/?q=${encodeURIComponent(item.mapsQuery)}`,
          },
        },
      ],
    });

    if (i < items.length - 1) {
      bodyContents.push({ type: "separator", color: "#eeeeee", margin: "sm" });
    }
  });

  if (opts?.closingText) {
    bodyContents.push({ type: "separator", color: "#dddddd", margin: "md" });
    bodyContents.push({
      type: "text",
      text: opts.closingText,
      size: "sm",
      color: "#555555",
      wrap: true,
      margin: "sm",
    });
  }

  return flex(title, {
    type: "bubble",
    size: "kilo",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: headerColor,
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
      paddingStart: "16px",
      paddingEnd: "16px",
      paddingTop: "8px",
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
