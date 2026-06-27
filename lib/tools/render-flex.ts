import { tool } from "ai";
import { z } from "zod";

const FlexActionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.enum(["uri", "postback", "message", "datetimepicker", "camera", "cameraRoll", "location"]),
    label: z.string().max(40).optional(),
    data: z.string().max(300).optional(),
    text: z.string().max(300).optional(),
    uri: z.string().max(1000).optional(),
    mode: z.enum(["datetime", "date", "time"]).optional(),
    initial: z.string().optional(),
    max: z.string().optional(),
    min: z.string().optional(),
  }).passthrough()
);

const FlexComponentSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal("box"),
      layout: z.enum(["vertical", "horizontal", "baseline"]),
      contents: z.array(FlexComponentSchema),
    }).passthrough(),
    z.object({
      type: z.literal("text"),
      text: z.string().min(1).max(5000),
    }).passthrough(),
    z.object({
      type: z.literal("button"),
      action: FlexActionSchema,
    }).passthrough(),
    z.object({
      type: z.literal("image"),
      url: z.string().min(1).max(2000),
    }).passthrough(),
    z.object({
      type: z.enum(["separator", "filler", "spacer"]),
    }).passthrough(),
  ])
);

const FlexBubbleSchema = z.object({
  type: z.literal("bubble"),
  header: z.object({ type: z.literal("box"), layout: z.enum(["vertical", "horizontal", "baseline"]), contents: z.array(FlexComponentSchema) }).passthrough().optional(),
  hero: z.union([z.object({ type: z.literal("box"), layout: z.enum(["vertical", "horizontal", "baseline"]), contents: z.array(FlexComponentSchema) }).passthrough(), z.object({ type: z.literal("image"), url: z.string() }).passthrough()]).optional(),
  body: z.object({ type: z.literal("box"), layout: z.enum(["vertical", "horizontal", "baseline"]), contents: z.array(FlexComponentSchema) }).passthrough().optional(),
  footer: z.object({ type: z.literal("box"), layout: z.enum(["vertical", "horizontal", "baseline"]), contents: z.array(FlexComponentSchema) }).passthrough().optional(),
}).passthrough();

const FlexCarouselSchema = z.object({
  type: z.literal("carousel"),
  contents: z.array(FlexBubbleSchema).max(10),
}).passthrough();

const FlexContentsSchema = z.union([FlexBubbleSchema, FlexCarouselSchema]);

export function buildRenderFlexTool() {
  return {
    render_flex: tool({
      description: `Render a rich LINE Flex Message card visible to the user in chat.
Call this after fetching data to show a visual card for structured outputs like schedules, comparison tables, summaries, or custom data displays.

DO NOT call render_flex for weather, stocks, crypto, FX, places, news, web search, tasks, reminders, lists, or Gmail/calendar results — those are rendered automatically by the system.

LINE Flex JSON rules:
• Top level contents must be either { "type": "bubble", ... } or { "type": "carousel", "contents": [bubble, ...] }.
• A bubble has optional sections: header, hero, body, footer. Each section must be a box or image.
• Box: { "type": "box", "layout": "vertical"|"horizontal"|"baseline", "contents": [...components] }
• Text: { "type": "text", "text": "...", "wrap": true, "size": "xs"|"sm"|"md"|"lg", "weight": "bold", "color": "#333333" }
• Button: { "type": "button", "style": "primary"|"link", "height": "sm", "action": { "type": "uri", "label": "Open", "uri": "https://..." } }
• Postback buttons: action { "type": "postback", "label": "Done", "data": "task:done:abc123" }. data must be ≤ 300 chars.
• Image: { "type": "image", "url": "https://...", "size": "full"|"lg"|"md"|"sm" }
• Separator: { "type": "separator", "margin": "md" }
• Carousel max 10 bubbles. Each bubble size "mega" (full width) or "kilo" (use for carousel cards).
• Header background: set via box backgroundColor with white text.
• altText is required, plain text, no markdown, ≤ 400 chars — it shows in push notifications.

Example bubble:
{
  "type": "bubble",
  "body": {
    "type": "box",
    "layout": "vertical",
    "spacing": "sm",
    "paddingAll": "16px",
    "contents": [
      { "type": "text", "text": "Trip Summary", "weight": "bold", "size": "lg" },
      { "type": "separator", "margin": "md" },
      { "type": "text", "text": "Bangkok → Tokyo, 7 nights", "wrap": true }
    ]
  }
}`,
      inputSchema: z.object({
        altText: z.string().min(1).max(400).describe("Push notification text and fallback for older LINE clients. Plain text, no markdown."),
        contents: FlexContentsSchema.describe("LINE Flex Message contents — a bubble or carousel object"),
      }),
      execute: async ({ altText, contents }) => ({ ok: true, altText, contents }),
    }),
  };
}
