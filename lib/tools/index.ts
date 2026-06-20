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
  /**
   * fastClassify intents that include this tool.
   * Entries without hints are universal — always included regardless of intent.
   * When a hint is active, only universal entries + matching-hint entries are built.
   */
  hints?: string[];
};

/**
 * Declarative tool registry. Add a tool by adding one row.
 * needs: env/user prerequisites — omits the tool if unmet.
 * category: user-disableable surface (tasks, reminders, calendar, email, drive).
 * alwaysWithStagedMedia: include even when hasStagedMedia is false.
 * hints: fastClassify intent strings; omit for universal tools.
 */
const REGISTRY: Entry[] = [
  // ── Universal (no hints = always included) ───────────────────────────
  { build: () => buildHelpTools() },
  { build: () => buildRenderFlexTool() },
  { build: (u) => buildSettingsTools(u) },
  { build: (u) => buildGoogleAccountTools(u), needs: ["google_oauth_env"] },
  { build: (u) => buildStagedMediaTools(u) },
  // ── Intent-gated ─────────────────────────────────────────────────────
  { build: (u) => buildMorningBriefingTool(u), hints: ["briefing"] },
  { build: (u) => buildEveningSummaryTool(u),   hints: ["briefing"] },
  { build: () => buildPlacesTools(),             hints: ["search"] },
  { build: () => buildFinanceTools(),            hints: ["finance"] },
  { build: () => buildWeatherTools(),            hints: ["weather"] },
  { build: () => buildNewsTools(), needs: ["tavily"], hints: ["news", "search"] },
  { build: (u) => buildMemoryTools(u),           hints: ["memory", "search"] },
  { build: (u) => buildTaskTools(u), category: "tasks", hints: ["task", "calendar"] },
  { build: (u) => buildExportTools(u),           hints: ["memory"] },
  { build: (u) => buildSentHistoryTools(u),      hints: ["email", "search"] },
  { build: (u) => buildMediaAiTools(u),  alwaysWithStagedMedia: true, hints: ["media", "receipts"] },
  { build: (u) => buildReceiptTools(u),  alwaysWithStagedMedia: true, hints: ["media", "receipts"] },
  { build: (u) => buildReminderTools(u), needs: ["qstash"], category: "reminders", hints: ["reminder", "calendar"] },
  { build: () => buildWebSearchTool(), needs: ["tavily"], hints: ["search", "news"] },
  // Feature tools: only for users who have actually connected Google.
  { build: (u) => buildEmailTools(u), needs: ["google_user_connected"], category: "email", hints: ["email"] },
  { build: (u) => buildCalendarTools(u), needs: ["google_user_connected"], category: "calendar", hints: ["calendar", "task", "reminder"] },
  { build: (u) => buildDriveTools(u), needs: ["google_user_connected"], category: "drive", hints: ["email", "search"] },
  { build: (u) => buildGmailInboxTools(u), needs: ["google_user_connected"], category: "email", hints: ["email"] },
  { build: (u) => buildContactsTools(u), needs: ["google_user_connected"], category: "email", hints: ["email", "calendar"] },
  { build: (u) => buildScheduledEmailTools(u), needs: ["google_user_connected", "qstash"], category: "email", hints: ["email"] },
  { build: (u) => buildListTools(u), hints: ["lists"] },
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
  hint?: string,
): ToolSet {
  const out: Record<string, unknown> = {};
  for (const entry of REGISTRY) {
    const ok = (entry.needs ?? []).every((n) => envHas(n, userHasGoogle));
    if (!ok) continue;
    if (entry.category && disabled.includes(entry.category)) continue;
    if (!hasStagedMedia && entry.alwaysWithStagedMedia) continue;
    // Narrow tool set when a hint is active: skip entries that don't match the hint.
    // Entries with no hints field are universal and always included.
    if (hint && entry.hints && !entry.hints.includes(hint)) continue;
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
  opts?: { userHasGoogle?: boolean; disabledCategories?: string[]; hasStagedMedia?: boolean; hint?: string },
): Promise<ToolSet> {
  const userHasGoogle =
    opts?.userHasGoogle !== undefined
      ? opts.userHasGoogle
      : hasGoogleOAuth()
        ? (await listAccounts(userId)).accounts.length > 0
        : false;

  const disabled = opts?.disabledCategories ?? [];
  const hasStagedMedia = opts?.hasStagedMedia;
  const hint = opts?.hint;
  const disabledKey = disabled.sort().join(",");
  const googleKey = userHasGoogle ? "g1" : "g0";
  const stagedKey = hasStagedMedia ? "staged" : "nostaged";
  const hintKey = hint ?? "all";
  // v6: hint-based narrowing via fastClassify.
  const cacheKey = `v6:${userId}:${disabledKey}:${googleKey}:${stagedKey}:${hintKey}`;
  const cached = toolCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.tools;
  }

  const tools = buildTools(userId, userHasGoogle, disabled, hasStagedMedia, hint);
  toolCache.set(cacheKey, { tools, ts: Date.now() });
  return tools;
}
