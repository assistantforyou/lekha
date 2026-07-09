/**
 * Derive the default task check-in time from the evening-summary time.
 * Check-in fires 30 minutes before the evening summary.
 */
export function deriveCheckInTime(eveningTime: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(eveningTime);
  if (!m) return "20:30";
  let hh = parseInt(m[1]!, 10);
  let mm = parseInt(m[2]!, 10);
  mm -= 30;
  if (mm < 0) {
    mm += 60;
    hh -= 1;
  }
  if (hh < 0) hh += 24;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Parse a flexible time input into HH:MM (24h).
 * Accepts: 07:30, 7:30, 19.30, 7:30 AM, 7:30 น., 19:30 น., 7am, 7AM.
 */
export function parseTimeInput(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (raw === "off") return null;

  // Normalize Thai suffix and dot separator.
  const t = raw.replace(/\s*น\.?\s*$/, "").replace(".", ":");

  const m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const amp = m[3]?.toLowerCase();

  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (min < 0 || min > 59) return null;

  if (amp) {
    if (h < 1 || h > 12) return null;
    if (amp === "pm" && h !== 12) h += 12;
    if (amp === "am" && h === 12) h = 0;
  } else {
    if (h < 0 || h > 23) return null;
  }

  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Returns true if the input is a valid HH:MM or flexible natural time. */
export function isValidFlexibleTime(input: string): boolean {
  return parseTimeInput(input) !== null;
}

const TIMEZONE_ALIASES: Record<string, string> = {
  bangkok: "Asia/Bangkok",
  กรุงเทพ: "Asia/Bangkok",
  กรุงเทพมหานคร: "Asia/Bangkok",
  thailand: "Asia/Bangkok",
  ไทย: "Asia/Bangkok",
  singapore: "Asia/Singapore",
  สิงคโปร์: "Asia/Singapore",
  tokyo: "Asia/Tokyo",
  โตเกียว: "Asia/Tokyo",
  japan: "Asia/Tokyo",
  ญี่ปุ่น: "Asia/Tokyo",
  london: "Europe/London",
  ลอนดอน: "Europe/London",
  uk: "Europe/London",
  england: "Europe/London",
  "new york": "America/New_York",
  นิวยอร์ก: "America/New_York",
  nyc: "America/New_York",
  "los angeles": "America/Los_Angeles",
  แอลเอ: "America/Los_Angeles",
  la: "America/Los_Angeles",
  sydney: "Australia/Sydney",
  ซิดนีย์: "Australia/Sydney",
  hong: "Asia/Hong_Kong",
  "hong kong": "Asia/Hong_Kong",
  ฮ่องกง: "Asia/Hong_Kong",
  dubai: "Asia/Dubai",
  ดูไบ: "Asia/Dubai",
  paris: "Europe/Paris",
  ปารีส: "Europe/Paris",
  berlin: "Europe/Berlin",
  เบอร์ลิน: "Europe/Berlin",
  seoul: "Asia/Seoul",
  โซล: "Asia/Seoul",
  jakarta: "Asia/Jakarta",
  จาการ์ตา: "Asia/Jakarta",
  mumbai: "Asia/Kolkata",
  มุมไบ: "Asia/Kolkata",
  india: "Asia/Kolkata",
  อินเดีย: "Asia/Kolkata",
  taipei: "Asia/Taipei",
  ไทเป: "Asia/Taipei",
  manila: "Asia/Manila",
  มะนิลา: "Asia/Manila",
  kuala: "Asia/Kuala_Lumpur",
  "kuala lumpur": "Asia/Kuala_Lumpur",
  กัวลาลัมเปอร์: "Asia/Kuala_Lumpur",
  beijing: "Asia/Shanghai",
  ปักกิ่ง: "Asia/Shanghai",
  shanghai: "Asia/Shanghai",
  เซี่ยงไฮ้: "Asia/Shanghai",
  "ho chi minh": "Asia/Ho_Chi_Minh",
  "ho chi minh city": "Asia/Ho_Chi_Minh",
  hanoi: "Asia/Bangkok",
  vietnam: "Asia/Bangkok",
  yangon: "Asia/Yangon",
  ย่างกุ้ง: "Asia/Yangon",
};

let _supportedTimeZones: string[] | null = null;
function supportedTimeZones(): string[] {
  if (_supportedTimeZones) return _supportedTimeZones;
  try {
    _supportedTimeZones = (Intl as unknown as { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone");
  } catch {
    _supportedTimeZones = [];
  }
  return _supportedTimeZones;
}

function isValidTimeZone(name: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a user-typed timezone to a canonical IANA zone.
 * Supports aliases, IANA names, and fuzzy matching by city/region.
 */
export function resolveTimezone(input: string): string | null {
  const key = input.trim().toLowerCase();
  if (TIMEZONE_ALIASES[key]) return TIMEZONE_ALIASES[key];

  const normalized = key.replace(/_/g, "/").replace(/-/g, "/");
  const zones = supportedTimeZones();

  // Exact IANA match (case-insensitive), returning canonical casing.
  const exact = zones.find((z) => z.toLowerCase() === normalized);
  if (exact) return exact;

  // If the user gave a full path with different casing, accept it and return canonical.
  if (normalized.includes("/")) {
    const canonical = zones.find((z) => z.toLowerCase() === normalized);
    if (canonical) return canonical;
    if (isValidTimeZone(input.trim())) return input.trim();
  }

  // Fuzzy match by last segment (city) or full path.
  const matches = zones.filter((z) => {
    const lower = z.toLowerCase();
    return lower.endsWith(`/${normalized}`) || lower.replace("/", " ") === key;
  });
  if (matches.length === 1) return matches[0]!;

  // Ambiguous city names: prefer the most common primary zone.
  const primaryOrder = ["Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "Asia/Seoul", "Asia/Hong_Kong"];
  const primary = matches.find((z) => primaryOrder.includes(z));
  if (primary) return primary;

  return null;
}
