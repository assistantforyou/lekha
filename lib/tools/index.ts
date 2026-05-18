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
import { buildContactTools } from "./contacts";
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
import { hasGoogleOAuth, hasQStash, env } from "@/lib/env";

/**
 * Returns the FULL tool registry bound to a single user. Used on the primary
 * (Gemini) path. Tools that depend on unconfigured services are omitted.
 */
export function toolsForUser(userId: string) {
  return {
    ...buildHelpTools(),
    ...buildMorningBriefingTool(userId),
    ...buildEveningSummaryTool(userId),
    ...buildFinanceTools(),
    ...buildWeatherTools(),
    ...(env().TAVILY_API_KEY ? buildNewsTools() : {}),
    ...buildSettingsTools(userId),
    ...buildMemoryTools(userId),
    ...buildTaskTools(userId),
    ...buildExportTools(userId),
    ...buildSentHistoryTools(userId),
    ...buildMediaAiTools(userId),
    ...buildReceiptTools(userId),
    ...(hasQStash() ? buildReminderTools(userId) : {}),
    ...(env().TAVILY_API_KEY ? buildWebSearchTool() : {}),
    ...(hasGoogleOAuth() ? buildEmailTools(userId) : {}),
    ...(hasGoogleOAuth() ? buildCalendarTools(userId) : {}),
    ...(hasGoogleOAuth() ? buildDriveTools(userId) : {}),
    ...(hasGoogleOAuth() ? buildGmailInboxTools(userId) : {}),
    ...(hasGoogleOAuth() ? buildContactTools(userId) : {}),
    ...(hasGoogleOAuth() ? buildGoogleAccountTools(userId) : {}),
    ...(hasGoogleOAuth() && hasQStash() ? buildScheduledEmailTools(userId) : {}),
    ...buildStagedMediaTools(userId),
    ...buildListTools(userId),
    ...(hasGoogleOAuth() ? buildDocsTools(userId) : {}),
  };
}

/**
 * Slim registry for fallback path (Groq). 14 tools covering 90% of fallback
 * requests. Kept small to stay under Groq's free-tier daily token limit
 * (~131K/day) and to reduce per-request cost on paid tier.
 * Specialty tools (finance, media AI, lists, docs, receipts, settings) are
 * dropped — they're rarely the reason Gemini fails.
 */
export function coreToolsForUser(userId: string) {
  const all = toolsForUser(userId);
  const keep = [
    "remember", "list_memories",
    "weather", "web_search", "news_search",
    "set_reminder", "list_reminders", "cancel_reminder",
    "add_task", "list_tasks", "complete_task",
    "draft_email", "draft_calendar_event", "calendar_today",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const name of keep) {
    if (name in all) out[name] = (all as Record<string, unknown>)[name];
  }
  return out as Pick<ReturnType<typeof toolsForUser>, (typeof keep)[number]>;
}
