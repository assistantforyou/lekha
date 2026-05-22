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
import { listAccounts } from "./google-auth";

/**
 * Returns the full tool registry bound to a single user. Tools that depend on
 * unconfigured services are omitted. Google-dependent tools are also gated on
 * whether THIS user has actually connected a Google account — saves ~2K tokens
 * per request for users without OAuth.
 */
export async function toolsForUser(userId: string) {
  const userHasGoogle = hasGoogleOAuth()
    ? (await listAccounts(userId)).accounts.length > 0
    : false;
  // Even without a connected account, expose the "connect" tool so the model
  // can offer to wire it up. Suppress the rest of the Google surface area.
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
    ...(hasGoogleOAuth() ? buildGoogleAccountTools(userId) : {}),
    ...(userHasGoogle ? buildEmailTools(userId) : {}),
    ...(userHasGoogle ? buildCalendarTools(userId) : {}),
    ...(userHasGoogle ? buildDriveTools(userId) : {}),
    ...(userHasGoogle ? buildGmailInboxTools(userId) : {}),
    ...(userHasGoogle && hasQStash() ? buildScheduledEmailTools(userId) : {}),
    ...buildStagedMediaTools(userId),
    ...buildListTools(userId),
    ...(userHasGoogle ? buildDocsTools(userId) : {}),
  };
}
