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
import { buildRenderFlexTool } from "./render-flex";
import { buildPlacesTools } from "./places";
import { buildMorningBriefingTool } from "./morning-briefing";
import { buildEveningSummaryTool } from "./evening-summary";
import { buildReceiptTools } from "./receipts";
import { buildContactsTools } from "./contacts";
import { listAccounts } from "./google-auth";
import { hasGoogleOAuth, hasQStash, env } from "@/lib/env";
import type { ToolSet } from "ai";

type Need = "google_oauth_env" | "google_user_connected" | "qstash" | "tavily";

// In-memory cache per user × google-state × disabled-categories × staged-media. TTL = 5 min.
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
  /** Only register when the user has staged LINE media (image/audio/file). */
  alwaysWithStagedMedia?: boolean;
};

/**
 * Declarative tool registry. Add a tool by adding one row.
 * needs: env/user prerequisites — omits the tool if unmet.
 * category: user-disableable surface (tasks, reminders, calendar, email, drive).
 * alwaysWithStagedMedia: include even when hasStagedMedia is false.
 */
const REGISTRY: Entry[] = [
  { build: () => buildHelpTools() },
  { build: (u) => buildMorningBriefingTool(u) },
  { build: (u) => buildEveningSummaryTool(u) },
  { build: () => buildRenderFlexTool() },
  { build: () => buildPlacesTools() },
  { build: () => buildFinanceTools() },
  { build: () => buildWeatherTools() },
  { build: () => buildNewsTools(), needs: ["tavily"] },
  { build: (u) => buildSettingsTools(u) },
  { build: (u) => buildMemoryTools(u) },
  { build: (u) => buildTaskTools(u), category: "tasks" },
  { build: (u) => buildExportTools(u) },
  { build: (u) => buildSentHistoryTools(u) },
  { build: (u) => buildMediaAiTools(u), alwaysWithStagedMedia: true },
  { build: (u) => buildReceiptTools(u), alwaysWithStagedMedia: true },
  { build: (u) => buildReminderTools(u), needs: ["qstash"], category: "reminders" },
  { build: () => buildWebSearchTool(), needs: ["tavily"] },
  // Account tools: available to everyone with OAuth configured, so the model can guide linking.
  { build: (u) => buildGoogleAccountTools(u), needs: ["google_oauth_env"] },
  // Feature tools: only for users who have actually connected Google.
  { build: (u) => buildEmailTools(u), needs: ["google_user_connected"], category: "email" },
  { build: (u) => buildCalendarTools(u), needs: ["google_user_connected"], category: "calendar" },
  { build: (u) => buildDriveTools(u), needs: ["google_user_connected"], category: "drive" },
  { build: (u) => buildGmailInboxTools(u), needs: ["google_user_connected"], category: "email" },
  { build: (u) => buildContactsTools(u), needs: ["google_user_connected"], category: "email" },
  { build: (u) => buildScheduledEmailTools(u), needs: ["google_user_connected", "qstash"], category: "email" },
  { build: (u) => buildStagedMediaTools(u) },
  { build: (u) => buildListTools(u) },
];

function envHas(need: Need, userHasGoogle: boolean): boolean {
  switch (need) {
    case "google_oauth_env":
      return hasGoogleOAuth();
    case "google_user_connected":
      // Gate on actual connection — saves ~15K tokens of schema for non-Google users.
      // buildGoogleAccountTools is gated on google_oauth_env (not this) so connect/list/switch
      // remain available to all users regardless.
      return userHasGoogle;
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
  hasStagedMedia?: boolean,
): ToolSet {
  const out: Record<string, unknown> = {};
  for (const entry of REGISTRY) {
    const ok = (entry.needs ?? []).every((n) => envHas(n, userHasGoogle));
    if (!ok) continue;
    if (entry.category && disabled.includes(entry.category)) continue;
    if (!hasStagedMedia && entry.alwaysWithStagedMedia) continue;
    Object.assign(out, entry.build(userId));
  }
  return out as ToolSet;
}

/**
 * Returns the tool registry bound to a single user. Google-dependent tools
 * are omitted for users who haven't connected an account (decision #18).
 * Cached 5 min per user + google state.
 */
export async function toolsForUser(
  userId: string,
  opts?: { userHasGoogle?: boolean; disabledCategories?: string[]; hasStagedMedia?: boolean },
): Promise<ToolSet> {
  const userHasGoogle =
    opts?.userHasGoogle !== undefined
      ? opts.userHasGoogle
      : hasGoogleOAuth()
        ? (await listAccounts(userId)).accounts.length > 0
        : false;

  const disabled = opts?.disabledCategories ?? [];
  const hasStagedMedia = opts?.hasStagedMedia;
  const disabledKey = disabled.sort().join(",");
  const googleKey = userHasGoogle ? "g1" : "g0";
  const stagedKey = hasStagedMedia ? "staged" : "nostaged";
  // v5: google gating restored; docs/slides removed.
  const cacheKey = `v5:${userId}:${disabledKey}:${googleKey}:${stagedKey}`;
  const cached = toolCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.tools;
  }

  const tools = buildTools(userId, userHasGoogle, disabled, hasStagedMedia);
  toolCache.set(cacheKey, { tools, ts: Date.now() });
  return tools;
}
