import { buildReminderTools } from "./reminders";
import { buildWebSearchTool } from "./web-search";
import { buildMemoryTools } from "./memory";
import { buildEmailTools } from "./email";
import { buildCalendarTools } from "./calendar";
import { buildDriveTools } from "./drive";
import { buildGoogleAccountTools } from "./google-accounts";
import { buildStagedMediaTools } from "./staged-media";
import { buildSettingsTools } from "./settings";
import { buildTaskTools } from "./tasks";
import { buildHelpTools } from "./help";
import { buildExportTools } from "./export";
import { buildGmailInboxTools } from "./gmail-inbox";
import { buildMediaAiTools } from "./media-ai";
import { buildScheduledEmailTools } from "./scheduled-email";
import { buildSentHistoryTools } from "./sent-history";
import { buildFinanceTools } from "./finance";
import { buildWeatherTools } from "./weather";
import { buildNewsTools } from "./news";
import { buildListTools } from "./lists";
import { buildDocsTools } from "./docs";
import { buildRenderFlexTool } from "./render-flex";
import { buildPlacesTools } from "./places";
import { buildMorningBriefingTool } from "./morning-briefing";
import { buildEveningSummaryTool } from "./evening-summary";
import { buildReceiptTools } from "./receipts";
import { buildContactsTools } from "./contacts";
import { listAccounts } from "./google-auth";
import { hasGoogleOAuth, hasQStash, env } from "@/lib/env";
import type { ToolSet } from "ai";
import type { Intent } from "@/lib/intent";

type Need = "google_oauth_env" | "google_user_connected" | "qstash" | "tavily";

// R5: In-memory cache for tool sets (functions can't serialize to Redis).
// Cache key = userId + google-connected flag + disabled categories hash + intent. TTL = 5 min.
const toolCache = new Map<string, { tools: ToolSet; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Each builder returns a partial ToolSet keyed by tool name. We accept loose
// typing here because individual builders use the `tool()` helper which infers
// its own input/output types — combining them at the registry level would
// over-narrow. `toolsForUser` casts the merged result back to ToolSet.
type Builder = (userId: string) => Record<string, unknown>;

type Entry = {
  build: Builder;
  needs?: Need[];
  category?: string;
  intents?: Intent[];
  /** Always register this tool when the user has staged LINE media, even if the
   *  classifier picked a different intent. Used for image/PDF/receipt tools. */
  alwaysWithStagedMedia?: boolean;
};

/**
 * Declarative tool registry. Add or remove a tool by editing one row.
 * Each entry lists the env/user prerequisites; the dispatcher omits any tool
 * whose prerequisites aren't satisfied.
 *
 * Categories: tasks, reminders, calendar, email, drive — used by the dashboard
 * to let users disable whole surfaces.
 *
 * intents: which classifier intents include this tool. `fallback` and `multi`
 * include everything so the model can disambiguate; high-confidence single
 * intents get a focused subset to reduce blanking.
 */
const REGISTRY: Entry[] = [
  { build: () => buildHelpTools(), intents: ["help", "fallback", "multi"] },
  { build: (u) => buildMorningBriefingTool(u), intents: ["briefing", "fallback", "multi"] },
  { build: (u) => buildEveningSummaryTool(u), intents: ["briefing", "fallback", "multi"] },
  { build: () => buildRenderFlexTool(), intents: ["weather", "finance", "news", "search", "fallback", "multi"] },
  { build: () => buildPlacesTools(), intents: ["search", "fallback", "multi"] },
  { build: () => buildFinanceTools(), intents: ["finance", "fallback", "multi"] },
  { build: () => buildWeatherTools(), intents: ["weather", "fallback", "multi"] },
  { build: () => buildNewsTools(), needs: ["tavily"], intents: ["news", "fallback", "multi"] },
  { build: (u) => buildSettingsTools(u), intents: ["settings", "fallback", "multi"] },
  { build: (u) => buildMemoryTools(u), intents: ["memory", "fallback", "multi"] },
  { build: (u) => buildTaskTools(u), category: "tasks", intents: ["task", "fallback", "multi"] },
  { build: (u) => buildExportTools(u), intents: ["fallback", "multi"] },
  { build: (u) => buildSentHistoryTools(u), intents: ["email", "fallback", "multi"] },
  { build: (u) => buildMediaAiTools(u), intents: ["media", "fallback", "multi"], alwaysWithStagedMedia: true },
  { build: (u) => buildReceiptTools(u), intents: ["receipts", "fallback", "multi"], alwaysWithStagedMedia: true },
  { build: (u) => buildReminderTools(u), needs: ["qstash"], category: "reminders", intents: ["reminder", "fallback", "multi"] },
  { build: () => buildWebSearchTool(), needs: ["tavily"], intents: ["search", "fallback", "multi"] },
  // Connect/list/switch — registered as soon as Google OAuth env is configured,
  // even before this user has linked an account, so the model can offer to link.
  { build: (u) => buildGoogleAccountTools(u), needs: ["google_oauth_env"], intents: ["connect", "email", "calendar", "drive", "contacts", "fallback", "multi"] },
  // Per-user Google surface — gated on whether THIS user has linked an account.
  { build: (u) => buildEmailTools(u), needs: ["google_user_connected"], category: "email", intents: ["email", "fallback", "multi"] },
  { build: (u) => buildCalendarTools(u), needs: ["google_user_connected"], category: "calendar", intents: ["calendar", "fallback", "multi"] },
  { build: (u) => buildDriveTools(u), needs: ["google_user_connected"], category: "drive", intents: ["drive", "fallback", "multi"] },
  { build: (u) => buildGmailInboxTools(u), needs: ["google_user_connected"], category: "email", intents: ["email", "fallback", "multi"] },
  { build: (u) => buildDocsTools(u), needs: ["google_user_connected"], category: "drive", intents: ["drive", "fallback", "multi"] },
  { build: (u) => buildContactsTools(u), needs: ["google_user_connected"], category: "email", intents: ["contacts", "fallback", "multi"] },
  { build: (u) => buildScheduledEmailTools(u), needs: ["google_user_connected", "qstash"], category: "email", intents: ["email", "fallback", "multi"] },
  { build: (u) => buildStagedMediaTools(u), intents: ["media", "email", "fallback", "multi"] },
  { build: (u) => buildListTools(u), intents: ["lists", "fallback", "multi"] },
];

function envHas(need: Need, _userHasGoogle: boolean): boolean {
  switch (need) {
    case "google_oauth_env":
      return hasGoogleOAuth();
    case "google_user_connected":
      // Always register Google-dependent tools so the model can offer connect links.
      // Tools handle missing auth at runtime via withGoogleClient → { need_google_auth }.
      return true;
    case "qstash":
      return hasQStash();
    case "tavily":
      return Boolean(env().TAVILY_API_KEY);
  }
}

function buildTools(
  userId: string,
  userHasGoogle: boolean,
  disabled: string[],
  intent?: Intent,
  hasStagedMedia?: boolean,
): ToolSet {
  const out: Record<string, unknown> = {};
  for (const entry of REGISTRY) {
    const ok = (entry.needs ?? []).every((n) => envHas(n, userHasGoogle));
    if (!ok) continue;
    if (entry.category && disabled.includes(entry.category)) continue;
    if (intent && entry.intents && !entry.intents.includes(intent) && !(hasStagedMedia && entry.alwaysWithStagedMedia)) continue;
    Object.assign(out, entry.build(userId));
  }
  return out as ToolSet;
}

/**
 * Returns the tool registry bound to a single user. Tools that depend on
 * unconfigured services or on an unconnected Google account are omitted
 * (CLAUDE.md decision #18). An optional intent narrows the registry to reduce
 * model confusion. Cached per-user for 5 minutes.
 */
export async function toolsForUser(
  userId: string,
  opts?: { userHasGoogle?: boolean; disabledCategories?: string[]; intent?: Intent; hasStagedMedia?: boolean },
): Promise<ToolSet> {
  const userHasGoogle =
    opts?.userHasGoogle !== undefined
      ? opts.userHasGoogle
      : hasGoogleOAuth()
        ? (await listAccounts(userId)).accounts.length > 0
        : false;

  const disabled = opts?.disabledCategories ?? [];
  const intent = opts?.intent;
  const hasStagedMedia = opts?.hasStagedMedia;
  const disabledKey = disabled.sort().join(",");
  const intentKey = intent ?? "all";
  const stagedKey = hasStagedMedia ? "staged" : "nostaged";
  // v4: optional per-intent filtering. fallback/multi see everything;
  // high-confidence single intents get a focused subset.
  // When staged media exists, media/receipt tools are also included.
  const cacheKey = `v4:${userId}:${disabledKey}:${intentKey}:${stagedKey}`;
  const cached = toolCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.tools;
  }

  const tools = buildTools(userId, userHasGoogle, disabled, intent, hasStagedMedia);
  toolCache.set(cacheKey, { tools, ts: Date.now() });
  return tools;
}
