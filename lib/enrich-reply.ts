import { withQuickReplies, text as textMsg, type LineMessage } from "@/lib/line/client";
import { confirmCancelFlex } from "@/lib/line/flex";
import { t } from "@/lib/i18n";
import type { AgentHints } from "@/lib/llm/agent-helpers";

/**
 * Turn an agent reply (text + structured hints) into a list of LINE messages.
 * Returns an array so we can pair the text reply with a Flex card (e.g. a
 * confirm bubble, a task carousel) and still keep quick-reply suggestions on
 * the text part.
 *
 * When replyText is empty and flexMessages are present, skip the text message
 * entirely — this happens when a display-only tool (news, morning briefing)
 * generates a Flex carousel that IS the reply.
 */
export function enrichReply(
  replyText: string,
  hints: AgentHints,
  accountEmails: string[],
  language?: string | null,
): LineMessage[] {
  const followUps = hints.followUps ?? [];
  const flex = hints.flexMessages ?? [];

  // Account picker takes priority over generic follow-ups — it's a forced choice.
  if (hints.pickAccount && accountEmails.length > 1) {
    return [
      withQuickReplies(
        replyText,
        accountEmails.slice(0, 4).map((e) => ({ label: e.split("@")[0]!, text: e })),
      ),
      ...flex,
    ];
  }

  if (hints.needsGoogleConnect) {
    return [
      withQuickReplies(replyText, [{ label: t(language, "googleConnectButton"), text: "connect google" }]),
      ...flex,
    ];
  }

  if (hints.confirmDraft) {
    // New-style: Flex card has YES/NO postback buttons built in — no extra confirm bubble.
    if (hints.hasDraftFlex && flex.length > 0) {
      return flex;
    }
    // Old-style fallback: text block + separate confirm bubble.
    const textPart =
      followUps.length > 0
        ? withQuickReplies(replyText, followUps.slice(0, 13))
        : textMsg(replyText);
    return [textPart, confirmCancelFlex(replyText, { language }), ...flex];
  }

  // When text is empty (suppressed for display tools), just send the Flex messages.
  if (!replyText.trim() && flex.length > 0) {
    return flex;
  }

  const textPart =
    followUps.length > 0
      ? withQuickReplies(replyText, followUps.slice(0, 13))
      : textMsg(replyText);
  return [textPart, ...flex];
}
