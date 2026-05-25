import { withQuickReplies, text as textMsg, type LineMessage } from "@/lib/line/client";
import type { AgentHints } from "@/lib/llm/agent";

/**
 * Turn an agent reply (text + structured hints) into a LINE message, optionally
 * attaching quick-reply buttons. Replaces the old regex-on-model-text approach
 * that broke whenever Gemini reworded its response.
 */
export function enrichReply(
  replyText: string,
  hints: AgentHints,
  accountEmails: string[],
): LineMessage {
  if (hints.confirmDraft) {
    return withQuickReplies(replyText, [
      { label: "✅ YES", text: "YES" },
      { label: "✗ No", text: "No" },
    ]);
  }
  if (hints.pickAccount && accountEmails.length > 1) {
    return withQuickReplies(
      replyText,
      accountEmails.slice(0, 4).map((e) => ({ label: e.split("@")[0]!, text: e })),
    );
  }
  if (hints.needsGoogleConnect) {
    return withQuickReplies(replyText, [{ label: "Connect Google", text: "connect google" }]);
  }
  return textMsg(replyText);
}
