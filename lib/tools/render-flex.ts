import { tool } from "ai";
import { z } from "zod";

export function buildRenderFlexTool() {
  return {
    render_flex: tool({
      description: `Render a rich LINE Flex Message card visible to the user in chat.
Call this after fetching data (weather, stocks, crypto, places, search results) to show a visual card.
You write the LINE Flex JSON directly — make it clear and well-structured.

LINE Flex JSON guide:
• Top level: { "type": "bubble" } or { "type": "carousel", "contents": [bubble, ...] }
• Bubble sections: header, body, footer — each must be a box
• Box: { "type": "box", "layout": "vertical"|"horizontal", "contents": [...], "spacing": "sm", "paddingAll": "14px" }
• Text: { "type": "text", "text": "...", "size": "xs"|"sm"|"md"|"lg", "weight": "bold", "color": "#333333", "wrap": true }
• Button: { "type": "button", "style": "primary"|"link", "height": "sm", "action": { "type": "uri", "label": "...", "uri": "https://..." } }
• Separator: { "type": "separator", "margin": "md" }
• Bubble size: "mega" (full width) or "kilo" (use for carousel cards)
• Header background: set via { "type": "box", ..., "backgroundColor": "#1a1a2e" } with white text
• Max 5 total messages per reply (text bubble + cards combined)
• altText is required and shown in push notifications — keep it under 400 chars`,
      inputSchema: z.object({
        altText: z.string().max(400).describe("Push notification text and fallback for older LINE clients"),
        contents: z.record(z.string(), z.unknown()).describe("LINE Flex Message contents — a bubble or carousel object"),
      }),
      execute: async ({ altText, contents }) => ({ ok: true, altText, contents }),
    }),
  };
}
