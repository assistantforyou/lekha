import { type ModelMessage } from "ai";
import { reply, showLoading, getMessageContent } from "@/lib/line/client";
import { runAgent } from "@/lib/llm/agent";
import { appendTurn, loadHistory } from "@/lib/memory/history";
import { loadFacts } from "@/lib/memory/facts";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { listAccounts } from "@/lib/tools/google-auth";
import { enrichReply } from "../enrich-reply";
import { span, timed } from "@/lib/timing";

export async function respondToText(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  userText: string,
  traceId?: string,
): Promise<void> {
  const endHandler = span("text:respondToText", traceId);
  showLoading(userId, 60).catch(() => {}); // fire-and-forget

  const endPreload = span("text:preload", traceId);
  const [history, facts, staged, accounts] = await Promise.all([
    loadHistory(userId),
    loadFacts(userId),
    listRecentMedia(userId),
    listAccounts(userId),
  ]);
  endPreload({ historyTurns: history.length, facts: facts.facts.length, staged: staged.length, accounts: accounts.accounts.length });

  // If a fresh image was just staged (< 30s ago), bundle it into the message
  // so the model sees text + image in one turn.
  const freshImage = staged.find((m) => m.kind === "image" && Date.now() - m.ts < 30_000);
  let userContent: ModelMessage["content"];
  if (freshImage) {
    try {
      const { bytes, contentType } = await timed(
        "text:getMessageContent",
        traceId,
        () => getMessageContent(freshImage.messageId),
        { sizeBytes: freshImage.sizeBytes },
      );
      userContent = [
        { type: "image", image: bytes, mediaType: contentType },
        { type: "text", text: userText },
      ];
    } catch {
      userContent = userText;
    }
  } else {
    userContent = userText;
  }

  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: userContent },
  ];

  const { text: replyText, hints } = await runAgent(userId, profile, facts, messages, traceId);

  const endReply = span("text:reply", traceId);
  await reply(
    replyToken,
    enrichReply(
      replyText,
      hints,
      accounts.accounts.map((a) => a.email),
    ).slice(0, 5), // LINE caps replies at 5 messages
  );
  endReply();

  const endAppend = span("text:appendTurns", traceId);
  await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
  endAppend();

  endHandler({ userTextLength: userText.length, replyLength: replyText.length });
}
