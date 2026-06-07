import { env } from "@/lib/env";
import { getRecipients } from "./recipients";

export async function broadcast(message: string): Promise<void> {
  const token = env().GITHUB_NOTIFY_CHANNEL_ACCESS_TOKEN;
  if (!token) return;

  const recipients = await getRecipients();
  if (recipients.length === 0) return;

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

/** Format a duration between two ISO timestamps as "2h 15m", "3d 4h", etc. */
export function formatSla(openedAt: string, closedAt: string): string {
  const diffMs = new Date(closedAt).getTime() - new Date(openedAt).getTime();
  const totalMinutes = Math.floor(diffMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
}
