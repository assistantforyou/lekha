import type { LineMessage } from "@/lib/line/client";
import {
  taskListFlex,
  type TaskRow,
  listItemsFlex,
  gmailResultsFlex,
  calendarEventsFlex,
  newsFlex,
  briefingFlex,
  googleConnectFlex,
  factsListFlex,
  type FactsListItem,
} from "@/lib/line/flex";
import { buildPlacesFlex, type PlaceItem } from "@/lib/line/places-flex";
import { buildWeatherFlex, type WeatherResult } from "@/lib/line/weather-flex";
import { buildStockFlex, buildCryptoFlex, type StockResult, type CryptoResult } from "@/lib/line/finance-flex";
import { extractToolValue } from "@/lib/llm/agent-helpers";

type StepLike = {
  toolResults?: { toolCallId?: string; toolName?: string; output?: unknown }[];
  toolCalls?: { toolCallId?: string; toolName?: string; input?: unknown }[];
};

function looksLikeNewsRequest(text: string): boolean {
  return /\b(news|headlines?|breaking|latest\s+news|current events|what'?s happening|top\s+\d+\s+news|finance news|stock news|market news|world news|today'?s news|news today)\b/i.test(text);
}

function cleanSnippet(s: string): string {
  return s
    .replace(/^#+\s*/gm, "")
    .replace(/\*{1,2}/g, "")
    .replace(/\s*\|\s*\S+\s*$/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 140);
}

function stripMarkdown(s: string): string {
  return s
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*[*\-]\s+/gm, "• ")
    .replace(/#{1,6}\s+/g, "")
    .replace(/`{1,3}(.*?)`{1,3}/g, "$1");
}

function stripMetaPrefix(s: string): string {
  return s
    .replace(/^(Here[']?s? (is |are )?a? ?(summary|quick summary|brief summary)( of [^:：]*)?[：:]?\s*)/i, "")
    .replace(/^(Summary[：:]?\s*)/i, "")
    .replace(/^(In summary[，:,]?\s*)/i, "")
    .replace(/^(This document (is about|discusses|describes|contains)[：:]?\s*)/i, "")
    .replace(/^(The following is (a summary|an overview)[：:]?\s*)/i, "")
    .replace(/^\d+\s+bullets?[：:]?\s*/i, "")
    .replace(/^(ใน\s*\d+\s*ข้อ[：:]?\s*)/, "")
    .replace(/^(สรุป[：:]?\s*)/, "")
    .trim();
}

function fmtDateTime(isoOrMs: string | number, tz = "UTC"): string {
  const d = typeof isoOrMs === "number" ? new Date(isoOrMs) : new Date(String(isoOrMs));
  if (isNaN(d.getTime())) return String(isoOrMs).slice(0, 16).replace("T", " ");
  return d.toLocaleString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Generic data card: colored header + labeled item rows with separators.
 * Exported for reuse in fallback functions (agent.ts).
 */
export function buildSimpleCardFlex(
  title: string,
  headerColor: string,
  items: Array<{ primary: string; secondary?: string; link?: string; linkLabel?: string }>,
  emptyText = "Nothing here.",
): LineMessage {
  const rows = items.slice(0, 15);

  let bodyContents: object[];
  if (rows.length === 0) {
    bodyContents = [{ type: "text", text: emptyText, size: "sm", color: "#999999", align: "center" }];
  } else {
    bodyContents = [];
    rows.forEach((item, i) => {
      if (i > 0) {
        bodyContents.push({ type: "separator", color: "#f2f2f2" });
      }
      bodyContents.push({
        type: "box",
        layout: "vertical",
        paddingTop: "10px",
        paddingBottom: "10px",
        spacing: "xs",
        contents: [
          {
            type: "text",
            text: item.primary.slice(0, 120),
            size: "sm",
            weight: "bold",
            wrap: true,
            color: "#222222",
          },
          ...(item.secondary
            ? [
                {
                  type: "text",
                  text: item.secondary.slice(0, 80),
                  size: "xs",
                  color: "#888888",
                  wrap: true,
                  margin: "xs",
                },
              ]
            : []),
          ...(item.link
            ? [
                {
                  type: "button",
                  style: "link",
                  height: "sm",
                  margin: "sm",
                  action: { type: "uri", label: (item.linkLabel ?? "View photo").slice(0, 40), uri: item.link },
                },
              ]
            : []),
        ],
      });
    });
  }

  const altParts = rows
    .map((r) => r.primary)
    .join(", ")
    .slice(0, 360);

  return {
    type: "flex",
    altText: `${title}${altParts ? ": " + altParts : ""}`.slice(0, 400),
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerColor,
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

/** Card for long text outputs (document summaries, transcripts, OCR). Keeps the
 *  full text readable instead of squashing it into the 120-char list-row limit. */
function buildLongTextCardFlex(title: string, text: string, headerColor: string): LineMessage {
  const maxChars = 4000;
  const cleaned = stripMetaPrefix(stripMarkdown(text));
  const truncated = cleaned.length > maxChars;
  const display = truncated ? cleaned.slice(0, maxChars).replace(/\s+\S*$/, " …") : cleaned;

  return {
    type: "flex",
    altText: `${title}: ${cleaned.slice(0, 200)}`.slice(0, 400),
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: headerColor,
        paddingAll: "16px",
        contents: [{ type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "md" }],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: display,
            size: "sm",
            wrap: true,
            color: "#333333",
          },
        ],
      },
    },
  } as LineMessage;
}

/** Drive files as a carousel with Open buttons where links exist. */
function buildDriveFilesFlex(files: Array<Record<string, unknown>>): LineMessage {
  const rows = files.slice(0, 10);
  if (rows.length === 0) return buildSimpleCardFlex("📁 Drive Files", "#4285F4", [], "No files found.");

  const hasAnyLink = rows.some((f) => typeof f.webViewLink === "string" && (f.webViewLink as string).length > 0);
  if (!hasAnyLink) {
    return buildSimpleCardFlex(
      "📁 Drive Files",
      "#4285F4",
      rows.map((f) => ({
        primary: String(f.name ?? "Untitled"),
        secondary: String(f.mimeType ?? "")
          .replace("application/vnd.google-apps.", "")
          .replace("application/", ""),
      })),
    );
  }

  return {
    type: "flex",
    altText: `Drive: ${rows.map((f) => String(f.name ?? "")).join(", ").slice(0, 350)}`,
    contents: {
      type: "carousel",
      contents: rows.map((f) => {
        const name = String(f.name ?? "Untitled");
        const mime = String(f.mimeType ?? "")
          .replace("application/vnd.google-apps.", "Google ")
          .replace("application/", "");
        const link = typeof f.webViewLink === "string" && f.webViewLink ? f.webViewLink : null;
        return {
          type: "bubble" as const,
          size: "kilo" as const,
          header: {
            type: "box" as const,
            layout: "vertical" as const,
            backgroundColor: "#4285F4",
            paddingAll: "12px",
            contents: [
              { type: "text" as const, text: "📁 Drive", color: "#FFFFFF", size: "xs", weight: "bold" as const },
            ],
          },
          body: {
            type: "box" as const,
            layout: "vertical" as const,
            spacing: "sm" as const,
            contents: [
              {
                type: "text" as const,
                text: name.slice(0, 80),
                weight: "bold" as const,
                size: "sm" as const,
                wrap: true,
                color: "#333333",
              },
              { type: "text" as const, text: mime.slice(0, 60) || "file", size: "xs" as const, color: "#888888" },
            ],
          },
          ...(link
            ? {
                footer: {
                  type: "box" as const,
                  layout: "vertical" as const,
                  contents: [
                    {
                      type: "button" as const,
                      style: "primary" as const,
                      height: "sm" as const,
                      color: "#4285F4",
                      action: { type: "uri" as const, label: "Open", uri: link },
                    },
                  ],
                },
              }
            : {}),
        };
      }),
    },
  } as LineMessage;
}

/** Web search card — synthesized answer + numbered source list. */
function buildWebSearchFlex(value: Record<string, unknown>, userText: string): LineMessage {
  const answer = typeof value.answer === "string" ? value.answer.trim().slice(0, 900) : null;
  const results = (Array.isArray(value.results) ? value.results : []) as Array<Record<string, unknown>>;

  const bodyContents: object[] = [];
  if (answer) {
    bodyContents.push({ type: "text", text: answer, size: "sm", wrap: true, color: "#333333" });
  }
  if (results.length > 0) {
    if (answer) bodyContents.push({ type: "separator", margin: "lg", color: "#EEEEEE" });
    bodyContents.push({
      type: "text",
      text: "Sources",
      size: "xs",
      weight: "bold",
      color: "#888888",
      margin: answer ? "lg" : "none",
    });
    results.slice(0, 5).forEach((r, i) => {
      bodyContents.push({
        type: "text",
        text: `${i + 1}. ${String(r.title ?? "").slice(0, 90)}`,
        size: "xs",
        wrap: true,
        color: "#555555",
        margin: "sm",
      });
    });
  }
  if (bodyContents.length === 0) {
    bodyContents.push({ type: "text", text: "Search completed.", size: "sm", color: "#888888" });
  }

  return {
    type: "flex",
    altText: (answer ?? `Search: ${userText}`).slice(0, 400),
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0984E3",
        paddingAll: "16px",
        contents: [{ type: "text", text: "🔍 Web Search", color: "#FFFFFF", weight: "bold", size: "md" }],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        spacing: "none",
        contents: bodyContents,
      },
    },
  } as LineMessage;
}

/** FX rate card with large rate display. */
function buildFxRateFlex(value: Record<string, unknown>): LineMessage {
  const from = String(value.from ?? "").toUpperCase();
  const to = String(value.to ?? "").toUpperCase();
  const amount = typeof value.amount === "number" ? value.amount : 1;
  const converted = typeof value.converted === "number" ? value.converted : null;
  const rate = typeof value.rate === "number" ? value.rate : null;
  const asOf = value.asOf ? String(value.asOf).slice(0, 10) : null;
  const source = typeof value.source === "string" ? value.source : null;

  const contents: object[] = [
    { type: "text", text: "💱 Exchange Rate", color: "#DDDDDD", size: "xs", weight: "bold" },
    {
      type: "text",
      text:
        converted != null
          ? `${amount.toLocaleString()} ${from} = ${converted.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${to}`
          : "Rate unavailable",
      size: "xl",
      weight: "bold",
      color: "#FFFFFF",
      wrap: true,
      margin: "sm",
    },
  ];
  if (rate != null) {
    contents.push({
      type: "text",
      text: `1 ${from} = ${rate.toFixed(4)} ${to}`,
      size: "xs",
      color: "#CCCCCC",
      margin: "sm",
    });
  }
  if (asOf || source) {
    contents.push({
      type: "text",
      text: [asOf ? `As of ${asOf}` : null, source].filter(Boolean).join(" · "),
      size: "xs",
      color: "#999999",
      margin: "xs",
    });
  }

  return {
    type: "flex",
    altText:
      converted != null
        ? `${amount} ${from} = ${converted.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${to}`
        : `${from}/${to} rate`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#00B894",
        paddingAll: "20px",
        spacing: "none",
        contents,
      },
    },
  } as LineMessage;
}

/** Stock historical data card with dark theme. */
function buildStockHistoryFlex(value: Record<string, unknown>): LineMessage {
  const symbol = String(value.symbol ?? "").toUpperCase();
  const lastPrice = typeof value.lastPrice === "number" ? value.lastPrice : null;
  const firstPrice = typeof value.firstPrice === "number" ? value.firstPrice : null;
  const highPrice = typeof value.highPrice === "number" ? value.highPrice : null;
  const lowPrice = typeof value.lowPrice === "number" ? value.lowPrice : null;
  const changePercent = typeof value.changePercent === "number" ? value.changePercent : null;
  const currency = String(value.currency ?? "USD");
  const range = String(value.range ?? "");
  const firstDate = String(value.firstDate ?? "");
  const lastDate = String(value.lastDate ?? "");
  const isUp = changePercent != null ? changePercent >= 0 : null;

  const statBoxes: object[] = [];
  if (highPrice != null)
    statBoxes.push({
      type: "box",
      layout: "vertical",
      flex: 1,
      contents: [
        { type: "text", text: "High", size: "xxs", color: "#AAAAAA" },
        {
          type: "text",
          text: highPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }),
          size: "sm",
          weight: "bold",
          color: "#FFFFFF",
        },
      ],
    });
  if (lowPrice != null)
    statBoxes.push({
      type: "box",
      layout: "vertical",
      flex: 1,
      contents: [
        { type: "text", text: "Low", size: "xxs", color: "#AAAAAA" },
        {
          type: "text",
          text: lowPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }),
          size: "sm",
          weight: "bold",
          color: "#FFFFFF",
        },
      ],
    });
  if (firstPrice != null)
    statBoxes.push({
      type: "box",
      layout: "vertical",
      flex: 1,
      contents: [
        { type: "text", text: "Open", size: "xxs", color: "#AAAAAA" },
        {
          type: "text",
          text: firstPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }),
          size: "sm",
          weight: "bold",
          color: "#FFFFFF",
        },
      ],
    });

  const contents: object[] = [
    {
      type: "text",
      text: `${symbol}${range ? "  ·  " + range : ""}`,
      color: "#C0C0C0",
      size: "xs",
      weight: "bold",
    },
    {
      type: "text",
      text:
        lastPrice != null
          ? `${lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`
          : "N/A",
      size: "xxl",
      weight: "bold",
      color: "#FFFFFF",
      margin: "sm",
    },
    ...(changePercent != null
      ? [
          {
            type: "text",
            text: `${isUp ? "▲" : "▼"} ${Math.abs(changePercent).toFixed(2)}%`,
            size: "sm",
            color: isUp ? "#55EFC4" : "#FF7675",
            margin: "xs",
          },
        ]
      : []),
    ...(statBoxes.length > 0
      ? [
          { type: "separator", margin: "lg", color: "#334466" },
          { type: "box", layout: "horizontal", margin: "lg", contents: statBoxes },
        ]
      : []),
    ...(firstDate && lastDate
      ? [
          {
            type: "text",
            text: `${firstDate} → ${lastDate}`,
            size: "xxs",
            color: "#888888",
            margin: "sm",
          },
        ]
      : []),
  ];

  return {
    type: "flex",
    altText: `${symbol} history${lastPrice != null ? ": " + lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + currency : ""}`,
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#2D3436",
        paddingAll: "20px",
        spacing: "none",
        contents,
      },
    },
  } as LineMessage;
}

// ── Draft confirmation Flex cards ──────────────────────────────────────────

function draftFooter(yesLabel: string): object {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    paddingAll: "12px",
    contents: [
      {
        type: "button",
        style: "secondary",
        height: "sm",
        action: { type: "postback", label: "Cancel", data: "confirm:no", displayText: "Cancel" },
      },
      {
        type: "button",
        style: "primary",
        color: "#06C755",
        height: "sm",
        action: { type: "postback", label: yesLabel, data: "confirm:yes", displayText: yesLabel },
      },
    ],
  };
}

function draftFieldRow(label: string, value: string, bold = false): object {
  return {
    type: "box",
    layout: "horizontal",
    spacing: "sm",
    paddingTop: "8px",
    paddingBottom: "8px",
    contents: [
      { type: "text", text: label, size: "xs", color: "#999999", flex: 3, gravity: "top" },
      { type: "text", text: value, size: "sm", flex: 10, wrap: true, color: bold ? "#111111" : "#333333", weight: bold ? "bold" : "regular" },
    ],
  };
}

function draftFmtDate(iso: string, timezone?: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: timezone ?? "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function draftFmtRange(start?: string, end?: string, timezone?: string): string {
  try {
    const s = start ? draftFmtDate(start, timezone) : "?";
    const e = end ? draftFmtDate(end, timezone) : "?";
    return `${s} → ${e}`;
  } catch {
    return `${start ?? "?"} → ${end ?? "?"}`;
  }
}

function buildEmailDraftFlex(input: unknown, tz: string): LineMessage {
  const args = input as {
    to?: string[]; cc?: string[]; bcc?: string[];
    subject?: string; body?: string; fromEmail?: string;
  };
  const to = (args.to ?? []).join(", ") || "(missing)";
  const subject = args.subject ?? "(no subject)";
  const bodyText = (args.body ?? "").trim();
  const bodyPreview = bodyText.slice(0, 220);

  const rows: object[] = [];
  if (args.fromEmail) {
    rows.push(draftFieldRow("From", args.fromEmail));
    rows.push({ type: "separator", color: "#f0f0f0" });
  }
  rows.push(draftFieldRow("To", to));
  if (args.cc?.length) {
    rows.push({ type: "separator", color: "#f0f0f0" });
    rows.push(draftFieldRow("Cc", args.cc.join(", ")));
  }
  rows.push({ type: "separator", color: "#f0f0f0" });
  rows.push(draftFieldRow("Subject", subject, true));
  if (bodyPreview) {
    rows.push({ type: "separator", color: "#f0f0f0" });
    rows.push({
      type: "text",
      text: bodyText.length > 220 ? bodyPreview + " …" : bodyPreview,
      size: "sm",
      color: "#555555",
      wrap: true,
      paddingTop: "10px",
      paddingBottom: "10px",
    });
  }

  return {
    type: "flex",
    altText: `Draft email to ${to} — ${subject}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#0D1B4B",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "📧  EMAIL DRAFT", size: "xs", color: "#C0C0C0", weight: "bold", letterSpacing: undefined },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingStart: "16px",
        paddingEnd: "16px",
        paddingTop: "0px",
        paddingBottom: "4px",
        spacing: "none",
        contents: rows,
      },
      footer: draftFooter("Send Email"),
    },
  } as LineMessage;
}

function buildCalendarDraftFlex(input: unknown, tz: string): LineMessage {
  const args = input as {
    summary?: string; startISO?: string; endISO?: string;
    location?: string; attendees?: string[]; description?: string; fromEmail?: string;
  };
  const title = args.summary ?? "(no title)";
  const when = draftFmtRange(args.startISO, args.endISO, tz);

  const rows: object[] = [
    {
      type: "text",
      text: title,
      size: "lg",
      weight: "bold",
      color: "#111111",
      wrap: true,
      paddingTop: "14px",
      paddingBottom: "10px",
    },
    { type: "separator", color: "#f0f0f0" },
    draftFieldRow("🕐", when),
  ];
  if (args.location) {
    rows.push({ type: "separator", color: "#f0f0f0" });
    rows.push(draftFieldRow("📍", args.location));
  }
  if (args.attendees?.length) {
    rows.push({ type: "separator", color: "#f0f0f0" });
    rows.push(draftFieldRow("👥", args.attendees.slice(0, 5).join(", ")));
  }
  if (args.fromEmail) {
    rows.push({ type: "separator", color: "#f0f0f0" });
    rows.push(draftFieldRow("Cal", args.fromEmail));
  }

  return {
    type: "flex",
    altText: `Draft event: ${title} — ${when}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#1A73E8",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "📅  CALENDAR EVENT", size: "xs", color: "#C0C0C0", weight: "bold", letterSpacing: undefined },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingStart: "16px",
        paddingEnd: "16px",
        paddingTop: "0px",
        paddingBottom: "4px",
        spacing: "none",
        contents: rows,
      },
      footer: draftFooter("Create Event"),
    },
  } as LineMessage;
}

function buildScheduledEmailDraftFlex(input: unknown, tz: string): LineMessage {
  const args = input as {
    to?: string[]; cc?: string[];
    subject?: string; body?: string; sendAt?: string; fromEmail?: string;
  };
  const to = (args.to ?? []).join(", ") || "(missing)";
  const subject = args.subject ?? "(no subject)";
  const sendAt = args.sendAt ? draftFmtDate(args.sendAt, tz) : "(unknown)";
  const bodyText = (args.body ?? "").trim();
  const bodyPreview = bodyText.slice(0, 180);

  const rows: object[] = [];
  if (args.fromEmail) {
    rows.push(draftFieldRow("From", args.fromEmail));
    rows.push({ type: "separator", color: "#f0f0f0" });
  }
  rows.push(draftFieldRow("To", to));
  rows.push({ type: "separator", color: "#f0f0f0" });
  rows.push(draftFieldRow("Subject", subject, true));
  rows.push({ type: "separator", color: "#f0f0f0" });
  rows.push(draftFieldRow("📅 Send at", sendAt));
  if (bodyPreview) {
    rows.push({ type: "separator", color: "#f0f0f0" });
    rows.push({
      type: "text",
      text: bodyText.length > 180 ? bodyPreview + " …" : bodyPreview,
      size: "sm",
      color: "#555555",
      wrap: true,
      paddingTop: "10px",
      paddingBottom: "10px",
    });
  }

  return {
    type: "flex",
    altText: `Scheduled email to ${to} — ${subject} — send at ${sendAt}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: "#00897B",
        paddingAll: "16px",
        contents: [
          { type: "text", text: "📤  SCHEDULED EMAIL", size: "xs", color: "#C0C0C0", weight: "bold", letterSpacing: undefined },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        paddingStart: "16px",
        paddingEnd: "16px",
        paddingTop: "0px",
        paddingBottom: "4px",
        spacing: "none",
        contents: rows,
      },
      footer: draftFooter("Schedule Email"),
    },
  } as LineMessage;
}

/**
 * Build styled Flex confirmation cards for draft tool calls (email/calendar/scheduled email).
 * Each card includes YES/NO postback buttons tied to the pending-action queue.
 */
export function buildDraftFlexCards(
  calls: ReadonlyArray<{ toolName: string; input: unknown }>,
  timezone?: string,
): LineMessage[] {
  const tz = timezone ?? "UTC";
  return calls.flatMap((call) => {
    try {
      if (call.toolName === "draft_email") return [buildEmailDraftFlex(call.input, tz)];
      if (call.toolName === "draft_calendar_event") return [buildCalendarDraftFlex(call.input, tz)];
      if (call.toolName === "schedule_email") return [buildScheduledEmailDraftFlex(call.input, tz)];
    } catch { /* skip malformed */ }
    return [];
  });
}

/**
 * Walk every tool result emitted by the agent and convert structured outputs
 * into designed Flex cards. Every data-returning tool produces a Flex card and
 * sets suppressText=true so the model's redundant text is omitted.
 */
export function buildFlexFromToolResults(
  result: { steps?: StepLike[] },
  timezone?: string,
  opts?: { userText?: string },
): {
  messages: LineMessage[];
  suppressText: boolean;
} {
  const out: LineMessage[] = [];
  const seen = new Set<string>();
  let suppressText = false;
  const userText = opts?.userText ?? "";
  const tz = timezone ?? "UTC";

  // Build a map of toolCallId → call input so result handlers can access the call's input.
  const callInputMap = new Map<string, unknown>();
  for (const step of result.steps ?? []) {
    for (const tc of step.toolCalls ?? []) {
      if (tc?.toolCallId) callInputMap.set(tc.toolCallId, tc.input);
    }
  }

  // Pre-scan: if the model successfully called render_flex, skip auto-renders
  // to avoid double-rendering. A failed render_flex (ok=false) does NOT count —
  // that must fall through to the auto-build so the user gets a card.
  const modelCalledRenderFlex = (result.steps ?? []).some((s) =>
    (s.toolResults ?? []).some((tr) => {
      if ((tr as { toolName?: string }).toolName !== "render_flex") return false;
      const v = extractToolValue((tr as { output?: unknown }).output);
      return v != null && typeof v === "object" && (v as Record<string, unknown>).ok !== false;
    }),
  );

  // Pre-scan: if the model produced a places card, the web-search card is redundant
  // and would become a second push notification. The places card already carries the answer.
  const hasPlacesResult = (result.steps ?? []).some((s) =>
    (s.toolResults ?? []).some((tr) => {
      if ((tr as { toolName?: string }).toolName !== "suggest_places") return false;
      const v = extractToolValue((tr as { output?: unknown }).output);
      return v != null && typeof v === "object" && (v as Record<string, unknown>).ok === true &&
        Array.isArray((v as Record<string, unknown>).items);
    }),
  );

  let renderFlexCount = 0;
  let webSearchAnswerForPlaces: string | null = null;

  for (const step of result.steps ?? []) {
    for (const tr of step.toolResults ?? []) {
      if (!tr) continue;
      const toolName = (tr as { toolName?: string }).toolName ?? "";
      const callId = (tr as { toolCallId?: string }).toolCallId;
      const callInput = callId ? callInputMap.get(callId) : undefined;
      const v = extractToolValue((tr as { output?: unknown }).output);
      if (!v || typeof v !== "object") continue;
      const value = v as Record<string, unknown>;
      if (value.ok === false) continue;

      // ── Model-generated Flex (render_flex) ────────────────────────────
      if (toolName === "render_flex" && renderFlexCount < 3) {
        out.push({
          type: "flex",
          altText: String(value.altText ?? "Card"),
          contents: value.contents as object,
        } as LineMessage);
        renderFlexCount++;
        suppressText = true;
        continue;
      }

      if (seen.has(toolName)) continue;

      // ── Weather ────────────────────────────────────────────────────────
      if (toolName === "weather" && value.ok === true && !modelCalledRenderFlex) {
        try {
          out.push(buildWeatherFlex(value as WeatherResult));
          suppressText = true;
        } catch { /* skip malformed */ }
        seen.add(toolName);
        continue;
      }

      // ── Stock price ────────────────────────────────────────────────────
      if (toolName === "stock_price" && value.ok === true && typeof value.price === "number" && !modelCalledRenderFlex) {
        try {
          out.push(buildStockFlex(value as StockResult));
          suppressText = true;
        } catch { /* skip */ }
        seen.add(toolName);
        continue;
      }

      // ── Crypto price ───────────────────────────────────────────────────
      if (toolName === "crypto_price" && value.ok === true && typeof value.usd === "number" && !modelCalledRenderFlex) {
        try {
          out.push(buildCryptoFlex(value as CryptoResult));
          suppressText = true;
        } catch { /* skip */ }
        seen.add(toolName);
        continue;
      }

      // ── FX rate ────────────────────────────────────────────────────────
      if (toolName === "fx_rate" && typeof value.rate === "number" && !modelCalledRenderFlex) {
        try {
          out.push(buildFxRateFlex(value));
          suppressText = true;
        } catch { /* skip */ }
        seen.add(toolName);
        continue;
      }

      // ── Stock history ──────────────────────────────────────────────────
      if (toolName === "stock_history" && typeof value.lastPrice === "number" && !modelCalledRenderFlex) {
        try {
          out.push(buildStockHistoryFlex(value));
          suppressText = true;
        } catch { /* skip */ }
        seen.add(toolName);
        continue;
      }

      // ── Google connect link ─────────────────────────────────────────────
      // The model tends to paste the raw URL from the tool result into its
      // text reply, which is dead/unselectable inside a Flex text bubble.
      // Render a real tappable button instead and suppress the model's text.
      if (toolName === "connect_google_account" && typeof value.url === "string") {
        out.push(googleConnectFlex(value.url));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Morning briefing ───────────────────────────────────────────────
      if (toolName === "get_morning_briefing" && value.briefingType === "morning") {
        const text = String(value.text ?? "");
        const news = Array.isArray(value.news)
          ? (value.news as Array<{ title: string; url: string; source: string }>)
          : [];
        const inbox = Array.isArray(value.inbox)
          ? (value.inbox as Array<{ id: string; from: string; subject: string; snippet: string }>)
          : [];
        if (text) out.push(briefingFlex("morning", text));
        if (news.length > 0) out.push(newsFlex(news, "📰 Today's news"));
        if (inbox.length > 0) out.push(gmailResultsFlex(inbox.map((m) => ({ ...m, unread: true }))));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Evening summary ────────────────────────────────────────────────
      if (toolName === "get_evening_summary" && value.briefingType === "evening") {
        const text = String(value.text ?? "");
        const news = Array.isArray(value.news)
          ? (value.news as Array<{ title: string; url: string; source: string }>)
          : [];
        if (text) out.push(briefingFlex("evening", text));
        if (news.length > 0) out.push(newsFlex(news, "📰 Today's news"));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Task added ────────────────────────────────────────────────────
      if (toolName === "add_task" && value.ok === true) {
        const task = value.task as Record<string, unknown> | undefined;
        const title = String(task?.title ?? "");
        if (title) {
          const dueAt = typeof task?.dueAt === "number" ? fmtDateTime(task.dueAt, tz) : null;
          out.push(buildSimpleCardFlex("✅ Task Added", "#00B894", [
            { primary: title, secondary: dueAt ?? undefined },
          ]));
          suppressText = true;
        }
        seen.add(toolName);
        continue;
      }

      // ── Reminder set ──────────────────────────────────────────────────
      if ((toolName === "set_reminder" || toolName === "set_recurring_reminder") && value.ok === true) {
        const input = callInput as { message?: string; text?: string; cron?: string } | undefined;
        const msg = String(input?.message ?? input?.text ?? "");
        const fireAt = typeof value.fireAt === "string" ? value.fireAt : null;
        const fireText = fireAt ? fmtDateTime(fireAt, tz) : input?.cron ? `Recurring: ${input.cron}` : null;
        if (msg) {
          out.push(buildSimpleCardFlex("🔔 Reminder Set", "#E17055", [
            { primary: msg, secondary: fireText ?? undefined },
          ]));
          suppressText = true;
        }
        seen.add(toolName);
        continue;
      }

      // ── Task list ──────────────────────────────────────────────────────
      if (toolName === "list_tasks" && Array.isArray(value.tasks)) {
        const tasks = (value.tasks as Array<Record<string, unknown>>).map<TaskRow>((t) => ({
          id: String(t.id ?? ""),
          title: String(t.title ?? ""),
          done: Boolean(t.doneAt),
          dueAt: typeof t.dueAt === "number" ? t.dueAt : undefined,
        }));
        out.push(taskListFlex(tasks, { timezone: tz }));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Named list (grocery, packing, custom) ─────────────────────────
      if (toolName === "list_items" && Array.isArray(value.items)) {
        const items = (value.items as unknown[]).map((s) => String(s));
        const listName = String(value.list ?? "list");
        if (items.length > 0) {
          out.push(listItemsFlex(listName, items));
          suppressText = true;
        }
        seen.add(toolName);
        continue;
      }

      // ── Gmail search ───────────────────────────────────────────────────
      if (toolName === "gmail_search" && Array.isArray(value.messages)) {
        const msgs = (value.messages as Array<Record<string, unknown>>).map((m) => ({
          id: String(m.id ?? ""),
          from: String(m.from ?? ""),
          subject: String(m.subject ?? "(no subject)"),
          snippet: String(m.snippet ?? ""),
          unread: Boolean(m.unread),
          date: String(m.date ?? ""),
        }));
        if (msgs.length > 0) {
          out.push(gmailResultsFlex(msgs));
          suppressText = true;
        }
        seen.add(toolName);
        continue;
      }

      // ── Calendar events (list / today / week / search) ────────────────
      if (
        (toolName === "list_upcoming_events" ||
          toolName === "calendar_today" ||
          toolName === "calendar_week" ||
          toolName === "search_events") &&
        Array.isArray(value.events)
      ) {
        const events = (value.events as Array<Record<string, unknown>>).map((e) => ({
          id: String(e.id ?? ""),
          summary: String(e.summary ?? "(no title)"),
          start: String(e.start ?? ""),
          end: String(e.end ?? ""),
          location: (e.location as string | null) ?? null,
          htmlLink: (e.htmlLink as string | null) ?? null,
        }));
        if (events.length > 0) {
          out.push(calendarEventsFlex(events, timezone));
        } else {
          out.push(buildSimpleCardFlex("📅 Calendar", "#4285F4", [], "Nothing on the calendar."));
        }
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Reminders ──────────────────────────────────────────────────────
      if (toolName === "list_reminders" && Array.isArray(value.reminders)) {
        const reminders = value.reminders as Array<Record<string, unknown>>;
        const items = reminders.map((r) => ({
          primary: String(r.text ?? r.message ?? ""),
          secondary: r.fireAt
            ? fmtDateTime(String(r.fireAt), tz)
            : r.recurring
              ? "Recurring"
              : undefined,
        }));
        out.push(buildSimpleCardFlex("🔔 Reminders", "#E17055", items, "No reminders set."));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Contacts ───────────────────────────────────────────────────────
      if (toolName === "contacts_search" && Array.isArray(value.contacts)) {
        const contacts = value.contacts as Array<Record<string, unknown>>;
        const items = contacts.map((c) => ({
          primary: String(c.name ?? "Unknown"),
          secondary:
            [c.email, c.phone]
              .filter(Boolean)
              .map(String)
              .join("  ·  ") || undefined,
        }));
        out.push(buildSimpleCardFlex("👤 Contacts", "#00CEC9", items, "No contacts found."));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Free time slots ────────────────────────────────────────────────
      if (toolName === "calendar_find_free_time" && Array.isArray(value.slots)) {
        const slots = value.slots as Array<Record<string, unknown>>;
        const items = slots.map((s) => ({
          primary: fmtDateTime(String(s.startISO ?? ""), tz),
          secondary: typeof s.minutes === "number" ? `${s.minutes} min available` : undefined,
        }));
        out.push(buildSimpleCardFlex("🕐 Free Time Slots", "#00B894", items, "No free slots found."));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Memories ───────────────────────────────────────────────────────
      if (toolName === "list_memories" && Array.isArray(value.facts)) {
        const facts = (value.facts as Array<Record<string, unknown>>).map<FactsListItem>((f) => ({
          content: String(f.content ?? f.text ?? f.display ?? ""),
          category: String(f.category ?? "other") as FactsListItem["category"],
          updatedAt: typeof f.updatedAt === "number" ? f.updatedAt : undefined,
        }));
        out.push(factsListFlex(facts));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Drive files ────────────────────────────────────────────────────
      if ((toolName === "drive_search" || toolName === "drive_list_recent") && Array.isArray(value.files)) {
        try {
          out.push(buildDriveFilesFlex(value.files as Array<Record<string, unknown>>));
          suppressText = true;
        } catch { /* skip */ }
        seen.add(toolName);
        continue;
      }

      // ── Drive read text ────────────────────────────────────────────────
      if (toolName === "drive_read_text" && typeof value.text === "string") {
        const name = String(value.name ?? "File");
        const text = (value.text as string).slice(0, 900);
        const truncated = value.truncated || (value.text as string).length > 900;
        out.push(buildSimpleCardFlex(
          `📄 ${name}`,
          "#4285F4",
          [{ primary: truncated ? text + " …" : text }],
        ));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Drive get link ─────────────────────────────────────────────────
      if (toolName === "drive_get_link" && typeof value.link === "string") {
        const name = String(value.name ?? "File");
        out.push(buildSimpleCardFlex("📁 Drive Link", "#4285F4", [
          { primary: name, secondary: value.link as string },
        ]));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Drive upload ───────────────────────────────────────────────────
      if (toolName === "drive_upload_recent_media" && Array.isArray(value.uploaded)) {
        const uploaded = value.uploaded as Array<{ name?: string; webViewLink?: string | null }>;
        const items = uploaded.map((u) => ({
          primary: String(u.name ?? "File"),
          secondary: "Saved to Google Drive",
          link: typeof u.webViewLink === "string" ? u.webViewLink : undefined,
          linkLabel: "Open in Drive",
        }));
        out.push(buildSimpleCardFlex("📁 Saved to Drive", "#4285F4", items));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Media AI (OCR / image / document / audio) ──────────────────────
      if (
        (toolName === "ocr_image" || toolName === "summarize_image" || toolName === "read_document" ||
         toolName === "summarize_document" || toolName === "transcribe_audio" || toolName === "summarize_audio") &&
        typeof value.output === "string"
      ) {
        const label =
          toolName === "ocr_image" ? "🔍 OCR Result"
          : toolName === "summarize_image" ? "🖼️ Image Summary"
          : toolName === "read_document" ? "📄 Document"
          : toolName === "transcribe_audio" ? "🎤 Transcript"
          : toolName === "summarize_audio" ? "🎙️ Voice Summary"
          : "📄 Document Summary";
        out.push(buildLongTextCardFlex(label, value.output as string, "#636E72"));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Receipts ───────────────────────────────────────────────────────
      if ((toolName === "list_receipts" || toolName === "search_receipts") && Array.isArray(value.receipts)) {
        const receipts = value.receipts as Array<Record<string, unknown>>;
        const items = receipts.map((r) => {
          const amount =
            typeof r.total === "number" ? `${r.total.toFixed(2)} ${r.currency ?? ""}`.trim() : null;
          return {
            primary: `${String(r.merchant ?? "Unknown")}${amount ? "  ·  " + amount : ""}`,
            secondary: r.date ? String(r.date).slice(0, 10) : undefined,
            link: typeof r.photoUrl === "string" ? r.photoUrl : undefined,
            linkLabel: "View photo",
          };
        });
        out.push(buildSimpleCardFlex("🧾 Receipts", "#FDCB6E", items, "No receipts found."));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── All lists overview ─────────────────────────────────────────────
      if (toolName === "show_all_lists" && Array.isArray(value.lists)) {
        const lists = value.lists as Array<Record<string, unknown>>;
        const items = lists.map((l) => ({
          primary: String(l.name ?? "List"),
          secondary:
            typeof l.count === "number"
              ? `${l.count} item${l.count === 1 ? "" : "s"}`
              : undefined,
        }));
        out.push(buildSimpleCardFlex("📋 My Lists", "#E17055", items, "No lists yet."));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Scheduled emails ───────────────────────────────────────────────
      if (toolName === "list_scheduled_emails" && Array.isArray(value.scheduled)) {
        const scheduled = value.scheduled as Array<Record<string, unknown>>;
        const items = scheduled.map((s) => {
          const to = Array.isArray(s.to) ? (s.to as string[]).join(", ") : String(s.to ?? "");
          const sendAt = s.sendAt ? fmtDateTime(String(s.sendAt), tz) : null;
          return {
            primary: String(s.subject ?? "(no subject)"),
            secondary: [to ? `To: ${to}` : null, sendAt].filter(Boolean).join("  ·  ") || undefined,
          };
        });
        out.push(buildSimpleCardFlex("📤 Scheduled Emails", "#74B9FF", items, "No scheduled emails."));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Sent history ───────────────────────────────────────────────────
      if (toolName === "sent_history" && Array.isArray(value.entries)) {
        const entries = value.entries as Array<Record<string, unknown>>;
        const items = entries.map((e) => {
          const detail = e.detail as Record<string, unknown> | null;
          const subject = detail?.subject ? String(detail.subject) : null;
          const kind = String(e.kind ?? "unknown");
          return {
            primary: subject ? `${kind}: ${subject}` : kind,
            secondary: e.ts ? fmtDateTime(e.ts as number, tz) : undefined,
          };
        });
        out.push(buildSimpleCardFlex("📬 Sent History", "#636E72", items, "No sent items found."));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Archived memory search ─────────────────────────────────────────
      if (toolName === "search_archived_memory" && Array.isArray(value.results)) {
        const results = value.results as Array<Record<string, unknown>>;
        const items = results.map((r) => ({
          primary: String(r.summary ?? r.text ?? "").slice(0, 120),
          secondary: r.ts ? fmtDateTime(r.ts as number, tz) : undefined,
        }));
        out.push(buildSimpleCardFlex("📚 Memory Archive", "#6C5CE7", items, "No matching memories."));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Archived memory list ───────────────────────────────────────────
      if (toolName === "list_archived_memory" && Array.isArray(value.chunks)) {
        const chunks = value.chunks as Array<Record<string, unknown>>;
        const items = chunks.map((c) => ({
          primary: String(c.summary ?? "").slice(0, 120),
          secondary: c.ts ? fmtDateTime(c.ts as number, tz) : undefined,
        }));
        out.push(buildSimpleCardFlex("📚 Memory Archive", "#6C5CE7", items, "No archived memories yet."));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Place recommendations ──────────────────────────────────────────
      if (toolName === "suggest_places" && value.ok === true && Array.isArray(value.items)) {
        const items = (value.items as Array<Record<string, unknown>>).map<PlaceItem>((p) => ({
          name: String(p.name ?? ""),
          note: String(p.note ?? ""),
          mapsQuery: String(p.mapsQuery ?? ""),
        }));
        const title = String(value.title ?? "Places");
        const headerColor = typeof value.headerColor === "string" ? value.headerColor : undefined;
        const modelIntro = typeof value.introText === "string" ? value.introText.trim() : undefined;
        const closingText = typeof value.closingText === "string" ? value.closingText : undefined;
        // If web_search also ran, prepend its summary above the places list so the
        // user gets the research context and the maps card in a single message.
        const introText = webSearchAnswerForPlaces
          ? modelIntro
            ? `${webSearchAnswerForPlaces}\n\n${modelIntro}`
            : webSearchAnswerForPlaces
          : modelIntro;
        if (items.length > 0) {
          out.push(buildPlacesFlex(title, items, { headerColor, introText, closingText }));
          suppressText = true;
          seen.add(toolName);
        }
        continue;
      }

      // ── News search ────────────────────────────────────────────────────
      if (
        toolName === "news_search" &&
        Array.isArray(value.stories ?? value.results)
      ) {
        if (userText && !looksLikeNewsRequest(userText)) {
          console.warn("[agent-flex] news_search called for non-news request; suppressing carousel", {
            userText: userText.slice(0, 100),
          });
          seen.add(toolName);
          continue;
        }
        const raw = ((value.stories ?? value.results) as any[]) ?? [];
        const stories = raw
          .map((s) => ({
            title: String(s.title ?? ""),
            url: String(s.url ?? ""),
            snippet: cleanSnippet(String(s.snippet ?? s.content ?? "")),
            source: s.source ? String(s.source) : undefined,
          }))
          .filter((s) => s.url && s.title);
        if (stories.length > 0) {
          out.push(newsFlex(stories));
          suppressText = true;
          seen.add(toolName);
        }
        continue;
      }

      // ── Web search ─────────────────────────────────────────────────────
      if (toolName === "web_search") {
        const answer = typeof value.answer === "string" ? value.answer.trim() : null;
        const results = Array.isArray(value.results) ? value.results : [];

        // If suggest_places also ran, fold the web-search summary into the places
        // card instead of sending a second message (and second push notification).
        if (hasPlacesResult) {
          if (answer) webSearchAnswerForPlaces = answer;
          seen.add(toolName);
          continue;
        }

        if (answer || results.length > 0) {
          try {
            out.push(buildWebSearchFlex(value, userText));
            // Suppress model text only when Tavily has a synthesized answer;
            // otherwise keep the model's research alongside the sources card.
            if (answer) suppressText = true;
          } catch { /* skip */ }
        }
        seen.add(toolName);
        continue;
      }
    }
  }

  // LINE allows max 5 messages per reply — reserve one slot for the text message.
  return { messages: out.slice(0, 4), suppressText };
}

const ACTION_TOOLS = new Set([
  "add_task",
  "complete_task",
  "reopen_task",
  "delete_task",
  "complete_all_open_tasks",
  "remember",
  "forget_memory",
  "set_reminder",
  "cancel_reminder",
  "set_recurring_reminder",
  "schedule_email",
]);

/**
 * Build a short "what next?" quick-reply rail based on what tools just ran.
 */
export function buildFollowUps(
  toolNames: string[],
  ctx: { confirmDraft: boolean; modelText?: string },
): { label: string; text: string }[] {
  if (ctx.confirmDraft) return [];
  const names = new Set(toolNames);
  const out: { label: string; text: string }[] = [];
  const push = (label: string, text: string) => {
    if (out.find((b) => b.label === label)) return;
    if (out.length < 4) out.push({ label, text });
  };

  if (names.has("list_tasks")) {
    push("Add task", "add a task");
    push("Clear done", "delete all completed tasks");
  }
  if (names.has("gmail_search")) {
    push("Reply to first", "reply to the first email");
    push("Show unread", "show me my unread emails");
  }
  if (names.has("list_upcoming_events") || names.has("calendar_today") || names.has("search_events")) {
    push("Tomorrow?", "what's on my calendar tomorrow");
    push("Add event", "add a calendar event");
  }
  if (names.has("list_items")) {
    push("Add item", "add to this list");
    push("Clear list", "clear this list");
  }
  if (names.has("weather")) {
    push("Tomorrow?", "weather tomorrow");
    push("This week?", "weather this week");
  }
  if (names.has("news_search")) {
    push("More like this", "show me more news on this");
  }
  if (names.has("get_morning_briefing")) {
    push("What's on my calendar?", "what's on my calendar today");
    push("Check my inbox", "summarize my recent unread email");
  }
  if (names.has("list_reminders")) {
    push("Add reminder", "set a reminder");
  }
  if (names.has("list_memories")) {
    push("Add memory", "remember something for me");
  }

  if (out.length === 0 && toolNames.some((t) => ACTION_TOOLS.has(t))) {
    push("What's next?", "what should I do next");
  }

  return out;
}
