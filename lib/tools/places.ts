import { tool } from "ai";
import { z } from "zod";

export function buildPlacesTools() {
  return {
    suggest_places: tool({
      description:
        "Display a rich visual card of places (restaurants, cafes, bars, hotels, things to do) with Google Maps links. Call this after web_search. The card IS the full reply — do NOT write a separate text reply.",
      inputSchema: z.object({
        title: z.string().describe("Card header, e.g. 'Date Night Bars · Bangkok'"),
        headerColor: z
          .string()
          .optional()
          .describe(
            "Header background hex color — match the vibe. Night/romantic: #1a1a2e (navy), #2d1b69 (deep purple), #0f172a (near-black). Sunny/daytime: #b45309 (amber), #0369a1 (sky blue), #15803d (garden green). Brunch: #92400e (warm brown). Nightlife: #7c3aed (vivid purple), #be185d (hot pink). Beach/tropical: #047857 (teal). Default if unsure: #1a1a2e.",
          ),
        introText: z
          .string()
          .optional()
          .describe(
            "Opening 1–2 sentences shown at the top of the card, e.g. 'Here are 4 low-key date night bars under 1,000 ฿:'",
          ),
        closingText: z
          .string()
          .optional()
          .describe(
            "Warm 1-sentence sign-off shown at the bottom of the card, e.g. 'Hope you and your date have a wonderful night! 🥂'",
          ),
        items: z
          .array(
            z.object({
              name: z.string().describe("Place name"),
              note: z
                .string()
                .describe(
                  "One-liner: cuisine/type, vibe, price range — e.g. 'rooftop bar · romantic · ~600 ฿/drink'",
                ),
              mapsQuery: z
                .string()
                .describe("Google Maps search string, e.g. 'Eagle Nest Bar Bangkok'"),
            }),
          )
          .min(1)
          .max(10),
      }),
      execute: async ({ title, headerColor, introText, closingText, items }) => ({
        ok: true,
        title,
        headerColor,
        introText,
        closingText,
        items,
      }),
    }),
  };
}
