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
  /** Set of disabled tool categories — used to gate tools the user opted out of. */
  disabledCategories: string[];
  /** Whether to push a 9 PM evening summary (tasks leftover, tomorrow's events, top news). */
  eveningSummaryEnabled: boolean;
  /** Last time we ran the evening summary for this user (ms). */
  lastEveningSummaryTs: number | null;
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
const CURRENT_VERSION = 2;

const DEFAULTS: UserSettings = {
  timezone: "Asia/Bangkok",
  language: null,
  location: null,
  morningBriefingTime: "07:00",
  preMeetingLeads: [1440, 60, 15],
  inboxBriefingEnabled: true,
  lastMorningBriefingTs: null,
  disabledCategories: [],
  eveningSummaryEnabled: true,
  lastEveningSummaryTs: null,
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
  if (!stored) return { ...DEFAULTS };
  const migrated = applyMigrations(stored);
  // Persist after migration so it only runs once per user per version bump.
  if ((stored.settingsVersion ?? 0) < CURRENT_VERSION) {
    void redis().set(key(userId), { ...migrated, updatedAt: Date.now() });
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
  const internal = new Set(["lastMorningBriefingTs", "lastEveningSummaryTs", "userConfigured", "settingsVersion", "updatedAt", "disabledCategories"]);
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
