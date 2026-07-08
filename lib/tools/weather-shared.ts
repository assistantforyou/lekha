import { fetchJSON } from "@/lib/fetch";
import { LruMap } from "@/lib/lru-cache";

export type WeatherResult = {
  ok: true;
  place: string;
  current: {
    tempC: number | null;
    tempF: number | null;
    feelsLikeC: number | null;
    description: string;
    humidityPct: number | null;
    windKmh: number | null;
    windDir: string | null;
  } | null;
  forecast: Array<{
    date?: string;
    highC: number | null;
    lowC: number | null;
    condition: string | null;
    rainChancePct: number | null;
  }>;
  source: string;
};

const weatherCache = new LruMap<string, { result: WeatherResult; ts: number }>(500);
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;

export async function fetchWeather(location: string): Promise<WeatherResult | null> {
  const cacheKey = location.toLowerCase().trim();
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < WEATHER_CACHE_TTL_MS) {
    return cached.result;
  }
  const result = await Promise.any([
    tryWttr(location).then((r) => r ?? Promise.reject(new Error("wttr null"))),
    tryOpenMeteo(location).then((r) => r ?? Promise.reject(new Error("meteo null"))),
  ]).catch(() => null);
  if (result) {
    weatherCache.set(cacheKey, { result, ts: Date.now() });
  }
  return result;
}

async function tryWttr(location: string): Promise<WeatherResult | null> {
  const t0 = Date.now();
  try {
    const data = await fetchJSON<{
      current_condition?: Array<{
        temp_C?: string; temp_F?: string; FeelsLikeC?: string;
        weatherDesc?: Array<{ value?: string }>; humidity?: string;
        windspeedKmph?: string; winddir16Point?: string;
      }>;
      nearest_area?: Array<{
        areaName?: Array<{ value?: string }>; country?: Array<{ value?: string }>;
        region?: Array<{ value?: string }>;
      }>;
      weather?: Array<{
        date?: string; maxtempC?: string; mintempC?: string;
        hourly?: Array<{ chanceofrain?: string; weatherDesc?: Array<{ value?: string }>; time?: string }>;
      }>;
    }>(`https://wttr.in/${encodeURIComponent(location)}?format=j1`, { timeoutMs: 5000 });
    console.log("[weather] wttr.in", { location, ms: Date.now() - t0 });
    const cur = data.current_condition?.[0];
    const area = data.nearest_area?.[0];
    const place = [area?.areaName?.[0]?.value, area?.region?.[0]?.value, area?.country?.[0]?.value]
      .filter(Boolean).join(", ") || location;
    return {
      ok: true,
      place,
      current: cur ? {
        tempC: cur.temp_C ? Number(cur.temp_C) : null,
        tempF: cur.temp_F ? Number(cur.temp_F) : null,
        feelsLikeC: cur.FeelsLikeC ? Number(cur.FeelsLikeC) : null,
        description: cur.weatherDesc?.[0]?.value ?? "",
        humidityPct: cur.humidity ? Number(cur.humidity) : null,
        windKmh: cur.windspeedKmph ? Number(cur.windspeedKmph) : null,
        windDir: cur.winddir16Point ?? null,
      } : null,
      forecast: data.weather?.slice(0, 3).map((d) => ({
        date: d.date,
        highC: d.maxtempC ? Number(d.maxtempC) : null,
        lowC: d.mintempC ? Number(d.mintempC) : null,
        condition: d.hourly?.[4]?.weatherDesc?.[0]?.value ?? null,
        rainChancePct: d.hourly?.[4]?.chanceofrain ? Number(d.hourly[4]!.chanceofrain) : null,
      })) ?? [],
      source: "wttr.in",
    };
  } catch {
    console.warn("[weather] wttr.in failed", { location, ms: Date.now() - t0 });
    return null;
  }
}

async function tryOpenMeteo(location: string): Promise<WeatherResult | null> {
  const t0 = Date.now();
  try {
    const geo = await fetchJSON<{ results?: Array<{ latitude: number; longitude: number; name: string; country?: string }> }>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`,
      { timeoutMs: 5000 },
    );
    const place = geo.results?.[0];
    if (!place) return null;
    const { latitude: lat, longitude: lon, name, country } = place;

    const wx = await fetchJSON<{
      current?: { temperature_2m?: number; relative_humidity_2m?: number; wind_speed_10m?: number; weather_code?: number };
      daily?: { time?: string[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[]; weather_code?: number[] };
    }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&forecast_days=7&timezone=auto`,
      { timeoutMs: 5000 },
    );
    console.log("[weather] open-meteo fallback", { location, ms: Date.now() - t0 });
    const cur = wx.current;
    const daily = wx.daily;
    return {
      ok: true,
      place: [name, country].filter(Boolean).join(", "),
      current: cur ? {
        tempC: cur.temperature_2m ?? null,
        tempF: cur.temperature_2m != null ? Math.round(cur.temperature_2m * 9 / 5 + 32) : null,
        feelsLikeC: null,
        description: wmoDesc(cur.weather_code),
        humidityPct: cur.relative_humidity_2m ?? null,
        windKmh: cur.wind_speed_10m ?? null,
        windDir: null,
      } : null,
      forecast: (daily?.time ?? []).slice(0, 7).map((date, i) => ({
        date,
        highC: daily?.temperature_2m_max?.[i] ?? null,
        lowC: daily?.temperature_2m_min?.[i] ?? null,
        condition: wmoDesc(daily?.weather_code?.[i]),
        rainChancePct: daily?.precipitation_probability_max?.[i] ?? null,
      })),
      source: "Open-Meteo",
    };
  } catch {
    console.warn("[weather] open-meteo failed", { location, ms: Date.now() - t0 });
    return null;
  }
}

function wmoDesc(code: number | null | undefined): string {
  if (code == null) return "";
  if (code === 0) return "Clear sky";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 49) return "Foggy";
  if (code <= 59) return "Drizzle";
  if (code <= 69) return "Rain";
  if (code <= 79) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}
