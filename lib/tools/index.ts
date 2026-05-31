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
import { buildMorningBriefingTool } from "./morning-briefing";
import { buildEveningSummaryTool } from "./evening-summary";
import { buildReceiptTools } from "./receipts";
import { buildContactsTools } from "./contacts";
import { listAccounts } from "./google-auth";
import { hasGoogleOAuth, hasQStash, env } from "@/lib/env";
import type { ToolSet } from "ai";

type Need = "google_oauth_env" | "google_user_connected" | "qstash" | "tavily";

// R5: In-memory cache for tool sets (functions can't serialize to Redis).
// Cache key = userId + google-connected flag + disabled categories hash. TTL = 5 min.
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
};

/**
 * Declarative tool registry. Add or remove a tool by editing one row.
 * Each entry lists the env/user prerequisites; the dispatcher omits any tool
 * whose prerequisites aren't satisfied.
 *
 * Categories: tasks, reminders, calendar, email, drive — used by the dashboard
 * to let users disable whole surfaces.
 */
const REGISTRY: Entry[] = [
  { build: () => buildHelpTools() },
  { build: (u) => buildMorningBriefingTool(u) },
  { build: (u) => buildEveningSummaryTool(u) },
  { build: () => buildFinanceTools() },
  { build: () => buildWeatherTools() },
  { build: () => buildNewsTools(), needs: ["tavily"] },
  { build: (u) => buildSettingsTools(u) },
  { build: (u) => buildMemoryTools(u) },
  { build: (u) => buildTaskTools(u), category: "tasks" },
  { build: (u) => buildExportTools(u) },
  { build: (u) => buildSentHistoryTools(u) },
  { build: (u) => buildMediaAiTools(u) },
  { build: (u) => buildReceiptTools(u) },
  { build: (u) => buildReminderTools(u), needs: ["qstash"], category: "reminders" },
  { build: () => buildWebSearchTool(), needs: ["tavily"] },
  // Connect/list/switch — registered as soon as Google OAuth env is configured,
  // even before this user has linked an account, so the model can offer to link.
  { build: (u) => buildGoogleAccountTools(u), needs: ["google_oauth_env"] },
  // Per-user Google surface — gated on whether THIS user has linked an account.
  { build: (u) => buildEmailTools(u), needs: ["google_user_connected"], category: "email" },
  { build: (u) => buildCalendarTools(u), needs: ["google_user_connected"], category: "calendar" },
  { build: (u) => buildDriveTools(u), needs: ["google_user_connected"], category: "drive" },
  { build: (u) => buildGmailInboxTools(u), needs: ["google_user_connected"], category: "email" },
  { build: (u) => buildDocsTools(u), needs: ["google_user_connected"], category: "drive" },
  { build: (u) => buildContactsTools(u), needs: ["google_user_connected"], category: "email" },
  { build: (u) => buildScheduledEmailTools(u), needs: ["google_user_connected", "qstash"], category: "email" },
  { build: (u) => buildStagedMediaTools(u) },
  { build: (u) => buildListTools(u) },
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

/**
 * Returns the full tool registry bound to a single user. Tools that depend on
 * unconfigured services or on an unconnected Google account are omitted
 * (CLAUDE.md decision #18). Saves ~2K tokens per request for users without OAuth.
 *
 * R5: Cached per-user for 5 minutes to avoid rebuilding the registry on every request.
 */
export async function toolsForUser(
  userId: string,
  opts?: { userHasGoogle?: boolean; disabledCategories?: string[] },
): Promise<ToolSet> {
  const userHasGoogle =
    opts?.userHasGoogle !== undefined
      ? opts.userHasGoogle
      : hasGoogleOAuth()
        ? (await listAccounts(userId)).accounts.length > 0
        : false;

  const disabled = opts?.disabledCategories ?? [];
  const disabledKey = disabled.sort().join(",");
  // v2: Google tools are always registered (auth handled at runtime)
  const cacheKey = `v2:${userId}:${disabledKey}`;
  const cached = toolCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.tools;
  }

  const out: Record<string, unknown> = {};
  for (const entry of REGISTRY) {
    const ok = (entry.needs ?? []).every((n) => envHas(n, userHasGoogle));
    if (!ok) continue;
    if (entry.category && disabled.includes(entry.category)) continue;
    Object.assign(out, entry.build(userId));
  }
  const tools = out as ToolSet;
  toolCache.set(cacheKey, { tools, ts: Date.now() });
  return tools;
}
