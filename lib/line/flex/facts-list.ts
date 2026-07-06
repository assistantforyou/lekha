import type { LineMessage } from "@/lib/line/client";
import { FACT_CATEGORIES, type FactCategory } from "@/lib/memory/facts";

export type FactsListItem = {
  content: string;
  category: FactCategory;
  updatedAt?: number;
};

const CATEGORY_EMOJI: Record<FactCategory, string> = {
  preferences: "⚙️",
  people: "👤",
  habits: "🔄",
  deadlines: "⏰",
  context: "📍",
  health: "🩺",
  work: "💼",
  other: "📝",
};

function humanAgo(ms: number): string {
  if (ms < 60_000) return "just now";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

/**
 * Build a grouped "What I Remember" Flex card.
 * Facts are grouped by category with a small header per category and a
 * "last updated" timestamp. Total displayed facts is capped to keep the
 * bubble within LINE Flex component limits.
 */
export function factsListFlex(
  facts: FactsListItem[],
  opts?: { title?: string; maxFacts?: number },
): LineMessage {
  const title = opts?.title ?? "🧠 What I Remember";
  const maxFacts = opts?.maxFacts ?? 15;
  const now = Date.now();

  if (facts.length === 0) {
    return {
      type: "flex",
      altText: `${title}: Nothing saved yet.`,
      contents: {
        type: "bubble",
        size: "mega",
        header: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#A29BFE",
          paddingAll: "16px",
          contents: [{ type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "md" }],
        },
        body: {
          type: "box",
          layout: "vertical",
          paddingStart: "16px",
          paddingEnd: "16px",
          paddingTop: "16px",
          paddingBottom: "16px",
          contents: [{ type: "text", text: "Nothing saved yet.", size: "sm", color: "#999999", align: "center" }],
        },
      },
    } as LineMessage;
  }

  // Preserve newest-first order while grouping by category.
  const recent = facts.slice(0, maxFacts);
  const byCat = new Map<FactCategory, FactsListItem[]>();
  for (const f of recent) {
    if (!byCat.has(f.category)) byCat.set(f.category, []);
    byCat.get(f.category)!.push(f);
  }

  const bodyContents: object[] = [];
  let firstCategory = true;

  for (const cat of FACT_CATEGORIES) {
    const list = byCat.get(cat);
    if (!list?.length) continue;

    if (!firstCategory) {
      bodyContents.push({ type: "separator", margin: "xl", color: "#E0E0E0" });
    }
    firstCategory = false;

    bodyContents.push({
      type: "text",
      text: `${CATEGORY_EMOJI[cat]} ${cat.toUpperCase()}`,
      size: "xs",
      weight: "bold",
      color: "#A29BFE",
      margin: "md",
    });

    list.forEach((f, i) => {
      if (i > 0) {
        bodyContents.push({ type: "separator", margin: "md", color: "#F2F2F2" });
      }
      bodyContents.push({
        type: "box",
        layout: "vertical",
        spacing: "xs",
        paddingTop: "8px",
        paddingBottom: "8px",
        contents: [
          {
            type: "text",
            text: f.content.slice(0, 160),
            size: "sm",
            weight: "bold",
            wrap: true,
            color: "#222222",
          },
          ...(f.updatedAt
            ? [
                {
                  type: "text",
                  text: humanAgo(now - f.updatedAt),
                  size: "xs",
                  color: "#888888",
                  margin: "xs",
                },
              ]
            : []),
        ],
      });
    });
  }

  if (facts.length > maxFacts) {
    bodyContents.push({
      type: "text",
      text: `Showing ${maxFacts} of ${facts.length} memories.`,
      size: "xs",
      color: "#AAAAAA",
      align: "center",
      margin: "xl",
    });
  }

  const altParts = recent
    .slice(0, 5)
    .map((f) => f.content)
    .join(", ")
    .slice(0, 320);

  return {
    type: "flex",
    altText: `${title}${altParts ? ": " + altParts : ""}`.slice(0, 400),
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#A29BFE",
        paddingAll: "16px",
        contents: [{ type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "md" }],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingStart: "16px",
        paddingEnd: "16px",
        paddingTop: "0px",
        paddingBottom: "8px",
        spacing: "none",
        contents: bodyContents,
      },
    },
  } as LineMessage;
}
