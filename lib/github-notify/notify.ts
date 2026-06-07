import { env } from "@/lib/env";
import { getRecipients } from "./recipients";

interface MergePayload {
  prTitle: string;
  prNumber: number;
  author: string;
  prUrl: string;
  commits: number;
}

export async function notifyMerge(payload: MergePayload): Promise<void> {
  const token = env().GITHUB_NOTIFY_CHANNEL_ACCESS_TOKEN;
  if (!token) return;

  const recipients = await getRecipients();
  if (recipients.length === 0) return;

  const commitWord = payload.commits === 1 ? "commit" : "commits";
  const message = [
    `✅ Merged to main — assistantforyou/lekha`,
    `PR #${payload.prNumber}: ${payload.prTitle}`,
    `👤 ${payload.author} · ${payload.commits} ${commitWord}`,
    payload.prUrl,
  ].join("\n");

  await Promise.all(
    recipients.map((userId) =>
      fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: userId,
          messages: [{ type: "text", text: message }],
        }),
      }).catch((err) => {
        console.warn("[github-notify] push failed for", userId, err);
      }),
    ),
  );
}
