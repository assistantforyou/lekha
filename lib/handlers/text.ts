import { type ModelMessage } from "ai";
import { reply, showLoading, getMessageContent } from "@/lib/line/client";
import { runAgent } from "@/lib/llm/agent";
import { appendTurn, loadHistory } from "@/lib/memory/history";
import { loadFacts } from "@/lib/memory/facts";
import { listRecentMedia } from "@/lib/memory/recent-media";
import { listAccounts } from "@/lib/tools/google-auth";
import { enrichReply } from "../enrich-reply";

export async function respondToText(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  userText: string,
): Promise<void> {
  const t0 = Date.now();
  showLoading(userId, 60).catch(() => {}); // fire-and-forget
  const [history, facts, staged, accounts] = await Promise.all([
    loadHistory(userId),
    loadFacts(userId),
    listRecentMedia(userId),
    listAccounts(userId),
  ]);
  console.log("[webhook] preload done", { ms: Date.now() - t0 });

  // If a fresh image was just staged (< 30s ago), bundle it into the message
  // so the model sees text + image in one turn.
  const freshImage = staged.find((m) => m.kind === "image" && Date.now() - m.ts < 30_000);
  let userContent: ModelMessage["content"];
  if (freshImage) {
    try {
      const { bytes, contentType } = await getMessageContent(freshImage.messageId);
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

  const { text: replyText, hints } = await runAgent(userId, profile, facts, messages);
  await reply(replyToken, [
    enrichReply(
      replyText,
      hints,
      accounts.accounts.map((a) => a.email),
    ),
  ]);

  await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
}
