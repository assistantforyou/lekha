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
import { hasGoogleOAuth, hasQStash, env } from "@/lib/env";

/**
 * Returns the full tool registry bound to a single user. Tools that depend on
 * unconfigured services are omitted.
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
    ...(hasGoogleOAuth() ? buildGoogleAccountTools(userId) : {}),
    ...(hasGoogleOAuth() && hasQStash() ? buildScheduledEmailTools(userId) : {}),
    ...buildStagedMediaTools(userId),
    ...buildListTools(userId),
    ...(hasGoogleOAuth() ? buildDocsTools(userId) : {}),
  };
}
