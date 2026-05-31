import { redis } from "./redis";

export type UserSettings = {
  /** IANA timezone, e.g. "Asia/Bangkok". Defaults below if unset. */
  timezone: string;
  /** BCP-47 language tag the user prefers replies in, e.g. "en", "th". null = auto-detect. */
  language: string | null;
  /** Optional human-readable location label ("Bangkok, Thailand"). */
  location: string | null;
  /** Daily morning-briefing time in HH:mm 24h, in user's timezone. null = disabled. */
  morningBriefingTime: string | null;
  /** Pre-meeting reminder lead times in minutes. Empty = disabled. e.g. [1440, 60, 30] for 1d/1h/30m before. */
  preMeetingLeads: number[];
  /** Whether to auto-summarize unread Gmail in the morning briefing. */
  inboxBriefingEnabled: boolean;
  /** Last time we ran the morning briefing for this user (ms). */
  lastMorningBriefingTs: number | null;
  /** QStash schedule id for the morning briefing. Internal. */
  morningBriefingScheduleId: string | null;
  /** Set of disabled tool categories — used to gate tools the user opted out of. */
  disabledCategories: string[];
  /** Whether to push an evening summary (tasks leftover, tomorrow's events, top news). */
  eveningSummaryEnabled: boolean;
  /** Evening summary time in HH:mm 24h, in user's timezone. */
  eveningSummaryTime: string;
  /** Last time we ran the evening summary for this user (ms). */
  lastEveningSummaryTs: number | null;
  /** QStash schedule id for the evening summary. Internal. */
  eveningSummaryScheduleId: string | null;
  // ── Dashboard-surfaced feature controls ─────────────────────────────────
  /** Daily end-of-day task check-in: ask "Did you finish X?" for all open tasks. */
  taskCheckInEnabled: boolean;
  /** Time to fire the check-in (HH:mm 24h, user's timezone). */
  taskCheckInTime: string;
  /** Last time the task check-in was sent (ms). Internal — not surfaced in dashboard. */
  lastTaskCheckInTs: number | null;
  /** QStash schedule id for the task check-in. Internal. */
  taskCheckInScheduleId: string | null;
  // ── Dashboard state (v4) ───────────────────────────────────────────────
  /** Which briefing topic verticals are enabled. */
  briefingTopics: Record<string, boolean>;
  /** Briefing output length. */
  briefingLength: "Headlines" | "Bullets" | "Full";
  /** Briefing language preference. */
  briefingLanguage: "English" | "ไทย" | "EN + ไทย";
  /** Briefing delivery channels. */
  briefingChannels: { line: boolean; email: boolean; push: boolean };
  /** Per-topic custom news source domains (e.g. { stocks: ["bloomberg.com", "reuters.com"] }). */
  briefingTopicSources: Record<string, string[]>;
  /** Per-tool enabled flags (todo, reminders, calendar, email, drive). */
  tools: Record<string, boolean>;
  /** Per-tool configuration objects. */
  toolSettings: Record<string, Record<string, unknown>>;
  /** Auto-compact conversation history every N messages. */
  memoryCompactAt: number;
  /** Whether long-term memory / fact extraction is enabled. */
  memoryEnabled: boolean;
  /** Persona controls how Lekha sounds. */
  personaTone: "Warm" | "Professional" | "Playful";
  /** How Lekha addresses the user. */
  personaAddressing: "First name" | "Khun" | "Sir / Madam" | "No address";
  /** Primary language the user wants Lekha to use. */
  personaPrimaryLang: "English" | "Thai";
  /** Whether to match the user's writing voice. */
  personaVoiceMatch: boolean;
  // ────────────────────────────────────────────────────────────────────────
  /**
   * Keys the user has explicitly configured via a settings tool. Migrations skip
   * these so we never silently override a deliberate user choice.
   */
  userConfigured: string[];
  /** Tracks which migration version has been applied. Bump CURRENT_VERSION when
   *  changing defaults, then add a migration entry below. */
  settingsVersion: number;
  updatedAt: number;
};

// Bump this and add a migration entry below every time you change a default value.
const CURRENT_VERSION = 5;

const DEFAULTS: UserSettings = {
  timezone: "Asia/Bangkok",
  language: null,
  location: null,
  morningBriefingTime: "07:00",
  morningBriefingScheduleId: null,
  preMeetingLeads: [1440, 60, 15],
  inboxBriefingEnabled: true,
  lastMorningBriefingTs: null,
  disabledCategories: [],
  eveningSummaryEnabled: true,
  eveningSummaryTime: "21:00",
  lastEveningSummaryTs: null,
  eveningSummaryScheduleId: null,
  taskCheckInEnabled: true,
  taskCheckInTime: "20:30",
  lastTaskCheckInTs: null,
  taskCheckInScheduleId: null,
  // dashboard defaults
  briefingTopics: {
    stocks: true,
    wellness: true,
    politics: false,
    crime: false,
    sports: false,
    business: true,
    entertain: false,
  },
  briefingLength: "Headlines",
  briefingLanguage: "EN + ไทย",
  briefingChannels: { line: true, email: false, push: true },
  briefingTopicSources: {},
  tools: {
    todo: true,
    reminders: true,
    calendar: true,
    email: true,
    drive: true,
  },
  toolSettings: {
    todo: { prio: "Deadline", nudge: 2, followup: true },
    reminders: { quietStart: "22:00", quietEnd: "06:30", preempt: 15, skipHolidays: true },
    calendar: { tz: "Asia/Bangkok", deepStart: "09:00", deepEnd: "11:00", noMeet: ["Wed", "Fri"], prebrief: true },
    email: { tone: "Warm", signoff: "Best,", autosend: "Always confirm" },
    drive: { scope: "My Drive", fmt: "Bullets", autosort: true },
  },
  memoryCompactAt: 10,
  memoryEnabled: true,
  personaTone: "Warm",
  personaAddressing: "First name",
  personaPrimaryLang: "English",
  personaVoiceMatch: true,
  userConfigured: [],
  settingsVersion: CURRENT_VERSION,
  updatedAt: 0,
};

type StoredSettings = Partial<UserSettings>;

/**
 * Migration table. Index N upgrades a stored object from version N to N+1.
 * The function receives the current stored data and the user's explicit-override
 * set, and returns ONLY the fields that should change. Migrations automatically
 * skip any field present in userConfigured.
 */
const MIGRATIONS: Array<(s: StoredSettings, configured: Set<string>) => Partial<UserSettings>> = [
  // v0 → v1: initial versioning stamp, no field changes needed
  () => ({}),

  // v1 → v2: enable morning briefing (7 AM), pre-meeting alerts (1d/1h/15m),
  //          inbox in briefing, and evening summary for all existing users
  (s, configured) => {
    const patch: Partial<UserSettings> = {};
    if (!configured.has("morningBriefingTime") && !s.morningBriefingTime)
      patch.morningBriefingTime = "07:00";
    if (!configured.has("preMeetingLeads") && (!s.preMeetingLeads || s.preMeetingLeads.length === 0))
      patch.preMeetingLeads = [1440, 60, 15];
    if (!configured.has("inboxBriefingEnabled") && !s.inboxBriefingEnabled)
      patch.inboxBriefingEnabled = true;
    if (!configured.has("eveningSummaryEnabled") && !s.eveningSummaryEnabled)
      patch.eveningSummaryEnabled = true;
    return patch;
  },

  // v2 → v3: enable daily task check-in at 21:30 for all existing users
  (_s, configured) => {
    const patch: Partial<UserSettings> = {};
    if (!configured.has("taskCheckInEnabled")) patch.taskCheckInEnabled = true;
    if (!configured.has("taskCheckInTime")) patch.taskCheckInTime = "20:30";
    return patch;
  },

  // v3 → v4: add dashboard fields with sensible defaults
  (_s, configured) => {
    const patch: Partial<UserSettings> = {};
    if (!configured.has("briefingTopics")) patch.briefingTopics = DEFAULTS.briefingTopics;
    if (!configured.has("briefingLength")) patch.briefingLength = DEFAULTS.briefingLength;
    if (!configured.has("briefingLanguage")) patch.briefingLanguage = DEFAULTS.briefingLanguage;
    if (!configured.has("briefingChannels")) patch.briefingChannels = DEFAULTS.briefingChannels;
    if (!configured.has("tools")) patch.tools = DEFAULTS.tools;
    if (!configured.has("toolSettings")) patch.toolSettings = DEFAULTS.toolSettings;
    if (!configured.has("memoryCompactAt")) patch.memoryCompactAt = DEFAULTS.memoryCompactAt;
    if (!configured.has("memoryEnabled")) patch.memoryEnabled = DEFAULTS.memoryEnabled;
    if (!configured.has("personaTone")) patch.personaTone = DEFAULTS.personaTone;
    if (!configured.has("personaAddressing")) patch.personaAddressing = DEFAULTS.personaAddressing;
    if (!configured.has("personaPrimaryLang")) patch.personaPrimaryLang = DEFAULTS.personaPrimaryLang;
    if (!configured.has("personaVoiceMatch")) patch.personaVoiceMatch = DEFAULTS.personaVoiceMatch;
    if (!configured.has("eveningSummaryTime")) patch.eveningSummaryTime = DEFAULTS.eveningSummaryTime;
    return patch;
  },

  // v4 → v5: add QStash schedule ids for proactive fixed-time events
  () => {
    const patch: Partial<UserSettings> = {};
    patch.morningBriefingScheduleId = null;
    patch.eveningSummaryScheduleId = null;
    patch.taskCheckInScheduleId = null;
    return patch;
  },
];

function applyMigrations(stored: StoredSettings): StoredSettings {
  const v = stored.settingsVersion ?? 0;
  if (v >= CURRENT_VERSION) return stored;
  const configured = new Set(stored.userConfigured ?? []);
  let data = { ...stored };
  for (let i = v; i < CURRENT_VERSION; i++) {
    const migrate = MIGRATIONS[i];
    if (migrate) data = { ...data, ...migrate(data, configured) };
  }
  data.settingsVersion = CURRENT_VERSION;
  return data;
}

const key = (userId: string) => `user:${userId}:settings`;

export async function getSettings(userId: string): Promise<UserSettings> {
  const stored = await redis().get<StoredSettings>(key(userId));
  if (!stored) {
    const defaults = { ...DEFAULTS };
    void redis().set(key(userId), { ...defaults, updatedAt: Date.now() });
    void import("@/lib/proactive-schedules").then((m) => m.syncAllProactiveSchedules(userId));
    return defaults;
  }
  const migrated = applyMigrations(stored);
  // Persist after migration so it only runs once per user per version bump.
  if ((stored.settingsVersion ?? 0) < CURRENT_VERSION) {
    void redis().set(key(userId), { ...migrated, updatedAt: Date.now() });
    // v4 → v5: create per-user QStash schedules for existing users.
    if ((stored.settingsVersion ?? 0) < 5) {
      void import("@/lib/proactive-schedules").then((m) => m.syncAllProactiveSchedules(userId));
    }
  }
  return { ...DEFAULTS, ...migrated };
}

/**
 * Patch user settings. Keys in `patch` are automatically added to `userConfigured`
 * so future migrations will not override them.
 */
export async function updateSettings(
  userId: string,
  patch: Partial<UserSettings>,
): Promise<UserSettings> {
  const cur = await getSettings(userId);
  // Track which keys this user has deliberately configured.
  const internal = new Set([
    "lastMorningBriefingTs",
    "lastEveningSummaryTs",
    "lastTaskCheckInTs",
    "morningBriefingScheduleId",
    "eveningSummaryScheduleId",
    "taskCheckInScheduleId",
    "userConfigured",
    "settingsVersion",
    "updatedAt",
    "disabledCategories",
  ]);
  const newConfigured = Array.from(
    new Set([
      ...(cur.userConfigured ?? []),
      ...Object.keys(patch).filter((k) => !internal.has(k)),
    ]),
  );
  const next: UserSettings = {
    ...cur,
    ...patch,
    userConfigured: newConfigured,
    settingsVersion: CURRENT_VERSION,
    updatedAt: Date.now(),
  };
  await redis().set(key(userId), next);
  return next;
}
