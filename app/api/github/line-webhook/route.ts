import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { verifyLineSignature } from "@/lib/line/verify";
import { addRecipient, removeRecipient } from "@/lib/github-notify/recipients";

interface LineEvent {
  type: string;
  source?: { userId?: string };
  replyToken?: string;
}

interface LineWebhookBody {
  events: LineEvent[];
}

async function pushText(userId: string, text: string, token: string): Promise<void> {
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text }],
    }),
  }).catch((err) => {
    console.warn("[github-notify] welcome push failed", err);
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = env().GITHUB_NOTIFY_CHANNEL_SECRET;
  const token = env().GITHUB_NOTIFY_CHANNEL_ACCESS_TOKEN;
  if (!secret || !token) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  const signature = req.headers.get("x-line-signature") ?? "";
  const body = await req.text();

  if (!verifyLineSignature(body, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const { events } = JSON.parse(body) as LineWebhookBody;

  await Promise.all(
    events.map(async (event) => {
      const userId = event.source?.userId;
      if (!userId) return;

      if (event.type === "follow") {
        await addRecipient(userId);
        await pushText(
          userId,
          "✅ You're now registered for merge notifications on assistantforyou/lekha.\n\nYou'll get a message here whenever a PR is merged to main.",
          token,
        );
      } else if (event.type === "unfollow") {
        await removeRecipient(userId);
      }
    }),
  );

  return NextResponse.json({ ok: true });
}
