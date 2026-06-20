import { tool } from "ai";
import { z } from "zod";

export function buildPlacesTools() {
  return {
    suggest_places: tool({
      description:
        "Display a rich visual list of places (restaurants, cafes, hotels, things to do) with Google Maps links. Call this after web_search when the user asks for local recommendations. Populate items with real results from the search.",
      inputSchema: z.object({
        title: z.string().describe("Card header, e.g. 'Date Night Spots · Bangkok'"),
        items: z
          .array(
            z.object({
              name: z.string().describe("Place name"),
              note: z
                .string()
                .describe(
                  "One-liner: cuisine/type, vibe, price range — e.g. 'Thai fine dining · romantic · ~800 ฿/person'",
                ),
              mapsQuery: z
                .string()
                .describe("Google Maps search string, e.g. 'Err Urban Rustic Pub Bangkok'"),
            }),
          )
          .min(1)
          .max(5),
      }),
      execute: async ({ title, items }) => ({ ok: true, title, items }),
    }),
  };
}
