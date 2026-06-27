import { z } from "zod";
import { tool } from "ai";
import { fetchWeather } from "./weather-shared";

export function buildWeatherTools() {
  return {
    weather: tool({
      description:
        "Get current weather + a 3-day forecast for a place. Fast (<1s), no API key required. Use this for ANY weather question — never web_search. If no location is known, ASK the user before calling.",
      inputSchema: z.object({
        location: z
          .string()
          .min(1)
          .max(120)
          .describe("City, address, or coords. e.g. 'Bangkok', 'Tokyo', 'San Francisco', '13.7563,100.5018'"),
      }),
      execute: async ({ location }) => {
        const result = await fetchWeather(location);
        if (!result) return { ok: false as const, error: "Both weather providers failed. Try again in a moment." };
        return result;
      },
    }),
  };
}
