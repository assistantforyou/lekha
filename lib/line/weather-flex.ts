import { flex, type LineMessage } from "./client";

export type WeatherResult = {
  ok: true;
  place: string;
  current: {
    tempC: number | null;
    feelsLikeC: number | null;
    description: string;
    humidityPct: number | null;
    windKmh: number | null;
    windDir: string | null;
  } | null;
  forecast: Array<{
    date?: string | null;
    highC: number | null;
    lowC: number | null;
    condition: string | null;
    rainChancePct: number | null;
  }>;
  source: string;
};

function conditionEmoji(desc: string): string {
  const d = desc.toLowerCase();
  if (/thunder|storm/.test(d)) return "⛈️";
  if (/snow|blizzard|sleet/.test(d)) return "❄️";
  if (/heavy rain/.test(d)) return "🌧️";
  if (/rain|drizzle|shower/.test(d)) return "🌦️";
  if (/fog|mist|haze/.test(d)) return "🌫️";
  if (/overcast/.test(d)) return "☁️";
  if (/partly|partial/.test(d)) return "⛅";
  if (/clear|sunny/.test(d)) return "☀️";
  return "🌤️";
}

function headerBg(desc: string): string {
  const d = desc.toLowerCase();
  if (/thunder|storm/.test(d)) return "#263238";
  if (/snow/.test(d)) return "#37474F";
  if (/heavy rain/.test(d)) return "#0D47A1";
  if (/rain|drizzle|shower/.test(d)) return "#1565C0";
  if (/overcast/.test(d)) return "#546E7A";
  if (/partly|partial/.test(d)) return "#1976D2";
  if (/clear|sunny/.test(d)) return "#E65100";
  return "#1565C0";
}

function fmtDate(s: string): string {
  try {
    const d = new Date(`${s}T12:00:00Z`);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return s;
  }
}

function fmtSource(raw: string): string {
  // Strip URLs and clean up source string
  return raw.replace(/https?:\/\/\S+/g, "").trim() || raw;
}

function statCol(label: string, value: string): unknown {
  return {
    type: "box",
    layout: "vertical",
    flex: 1,
    contents: [
      { type: "text", text: value, size: "sm", weight: "bold", color: "#ffffff", align: "center" },
      { type: "text", text: label, size: "xxs", color: "#AAAAAA", align: "center", margin: "xs" },
    ],
  };
}

function vDivider(): unknown {
  return {
    type: "box",
    layout: "vertical",
    width: "1px",
    contents: [{ type: "filler" }],
  };
}

export function buildWeatherFlex(result: WeatherResult): LineMessage {
  const cur = result.current;
  const condDesc = cur?.description ?? "";
  const bg = headerBg(condDesc);
  const emoji = conditionEmoji(condDesc);
  const tempText = cur?.tempC != null ? `${Math.round(cur.tempC)}°C` : "—";

  // Stat columns: feels like / humidity / wind
  const stats: unknown[] = [];
  if (cur?.feelsLikeC != null) stats.push(statCol("Feels like", `${Math.round(cur.feelsLikeC)}°C`));
  if (cur?.humidityPct != null) stats.push(statCol("Humidity", `${cur.humidityPct}%`));
  if (cur?.windKmh != null) {
    const dir = cur.windDir ? `${cur.windDir} ` : "";
    stats.push(statCol("Wind", `${dir}${Math.round(cur.windKmh)} km/h`));
  }

  const statRow: unknown[] = [];
  stats.forEach((col, i) => {
    if (i > 0) statRow.push(vDivider());
    statRow.push(col);
  });

  const headerContents: unknown[] = [
    {
      type: "box",
      layout: "horizontal",
      alignItems: "center",
      contents: [
        { type: "text", text: `📍 ${result.place}`, size: "sm", color: "#DDDDDD", flex: 1, wrap: true },
        { type: "text", text: emoji, size: "xxl", flex: 0 },
      ],
    },
    { type: "text", text: tempText, size: "5xl", weight: "bold", color: "#ffffff", margin: "sm" },
    { type: "text", text: condDesc, size: "sm", color: "#EEEEEE", margin: "xs", wrap: true },
  ];

  if (statRow.length > 0) {
    headerContents.push({ type: "separator", margin: "md", color: "#557799" });
    headerContents.push({
      type: "box",
      layout: "horizontal",
      margin: "md",
      height: "44px",
      alignItems: "center",
      contents: statRow,
    });
  }

  // Forecast rows — up to 7 days
  const forecastDays = result.forecast.slice(0, 7);
  const forecastRows: unknown[] = [];

  forecastDays.forEach((f, i) => {
    if (i > 0) {
      forecastRows.push({ type: "separator", color: "#f0f0f0" });
    }

    const high = f.highC != null ? `${Math.round(f.highC)}°` : "—";
    const low = f.lowC != null ? `${Math.round(f.lowC)}°` : "—";
    const isToday = i === 0;
    const rainPct = f.rainChancePct;
    const rainText = rainPct != null ? `${rainPct}%` : "";
    const rainColor = rainPct != null && rainPct >= 60 ? "#1565C0" : rainPct != null && rainPct >= 30 ? "#42A5F5" : "#aaaaaa";

    forecastRows.push({
      type: "box",
      layout: "horizontal",
      paddingTop: "10px",
      paddingBottom: "10px",
      alignItems: "center",
      contents: [
        {
          type: "text",
          text: f.date ? fmtDate(f.date) : "—",
          size: "sm",
          flex: 5,
          color: isToday ? "#111111" : "#555555",
          weight: isToday ? "bold" : "regular",
        },
        { type: "text", text: conditionEmoji(f.condition ?? ""), size: "md", flex: 1, align: "center" },
        {
          type: "box",
          layout: "horizontal",
          flex: 4,
          alignItems: "center",
          contents: [
            { type: "text", text: high, size: "sm", weight: "bold", color: "#E65100", flex: 1, align: "center" },
            { type: "text", text: "/", size: "xs", color: "#cccccc", flex: 0, margin: "xs" },
            { type: "text", text: low, size: "sm", color: "#90A4AE", flex: 1, align: "center" },
          ],
        },
        {
          type: "text",
          text: rainText ? `💧 ${rainText}` : "",
          size: "xs",
          flex: 3,
          align: "end",
          color: rainColor,
        },
      ],
    });
  });

  const bubble: Record<string, unknown> = {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: bg,
      paddingAll: "20px",
      paddingBottom: statRow.length > 0 ? "16px" : "20px",
      contents: headerContents,
    },
    footer: {
      type: "box",
      layout: "vertical",
      paddingTop: "8px",
      paddingBottom: "10px",
      paddingStart: "16px",
      paddingEnd: "16px",
      contents: [
        {
          type: "text",
          text: `Source: ${fmtSource(result.source)}`,
          size: "xxs",
          color: "#bbbbbb",
        },
      ],
    },
  };

  if (forecastRows.length > 0) {
    bubble.body = {
      type: "box",
      layout: "vertical",
      paddingStart: "16px",
      paddingEnd: "16px",
      paddingTop: "12px",
      paddingBottom: "4px",
      spacing: "none",
      contents: [
        {
          type: "text",
          text: forecastDays.length > 1 ? "FORECAST" : "TOMORROW",
          size: "xxs",
          weight: "bold",
          color: "#aaaaaa",
          letterSpacing: "1px",
        },
        { type: "separator", margin: "sm", color: "#eeeeee" },
        ...forecastRows,
      ],
    };
  }

  return flex(`${result.place}: ${tempText} ${condDesc}`, bubble);
}
