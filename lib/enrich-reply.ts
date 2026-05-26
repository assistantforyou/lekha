import { withQuickReplies, text as textMsg, type LineMessage } from "@/lib/line/client";
import { confirmCancelFlex } from "@/lib/line/flex";
import type { AgentHints } from "@/lib/llm/agent";

/**
 * Turn an agent reply (text + structured hints) into a list of LINE messages.
 * Returns an array so we can pair the text reply with a Flex card (e.g. a
 * confirm bubble, a task carousel) and still keep quick-reply suggestions on
 * the text part.
 */
export function enrichReply(
  replyText: string,
  hints: AgentHints,
  accountEmails: string[],
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
      withQuickReplies(replyText, [{ label: "Connect Google", text: "connect google" }]),
      ...flex,
    ];
  }

  if (hints.confirmDraft) {
    // Confirm bubble carries its own postback buttons — no QR needed on the
    // text part, but follow-ups (if any) still attach.
    const textPart =
      followUps.length > 0
        ? withQuickReplies(replyText, followUps.slice(0, 13))
        : textMsg(replyText);
    return [textPart, confirmCancelFlex(replyText), ...flex];
  }

  const textPart =
    followUps.length > 0
      ? withQuickReplies(replyText, followUps.slice(0, 13))
      : textMsg(replyText);
  return [textPart, ...flex];
}
