import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { verifyLineSignature } from "@/lib/line/verify";
import { Webhook, type LineEvent } from "@/lib/line/types";
import { reply, text as textMsg, showLoading } from "@/lib/line/client";
import { env } from "@/lib/env";
import { redis } from "@/lib/memory/redis";
import { appendTurn } from "@/lib/memory/history";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { registerUser } from "@/lib/memory/user-registry";
import { checkRateLimit } from "@/lib/ratelimit";
import { classify, clearPending, getPending } from "@/lib/confirm";
import { executePendingAll } from "@/lib/pending-runner";
import { buildGate, passesAllowlist } from "@/lib/gate";
import { handleAdminCommand, handleMyId } from "@/lib/admin-commands";
import { dispatchShortcut } from "@/lib/shortcuts";
import { respondToText } from "@/lib/handlers/text";
import { respondToImage } from "@/lib/handlers/image";
import { respondToOtherMedia } from "@/lib/handlers/other-media";
import { maybeExtractFacts } from "@/lib/maybe-extract";
import { handlePostback } from "@/lib/webhook-postback";
import { span } from "@/lib/timing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-line-signature");
  if (!verifyLineSignature(raw, sig, env().LINE_CHANNEL_SECRET)) {
    return new NextResponse("invalid signature", { status: 401 });
  }

  let payload;
  try {
    payload = Webhook.parse(JSON.parse(raw));
  } catch (err) {
    console.warn("[webhook] bad payload", err);
    return new NextResponse("bad payload", { status: 400 });
  }

  // Respond 200 immediately; do all real work after the response.
  after(async () => {
    const events = payload.events;
    const gate = buildGate();
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;
      // Image immediately followed by text → stage only; text handler picks up
      // the staged image and responds to both together.
      const nextEvent = events[i + 1];
      const nextIsText =
        nextEvent?.type === "message" &&
        "message" in nextEvent &&
        nextEvent.message.type === "text";
      const thisIsImage =
        event.type === "message" &&
        "message" in event &&
        event.message.type === "image";
      try {
        await handleEvent(event, gate, thisIsImage && nextIsText ? "stage_only" : "normal");
      } catch (err) {
        console.error("[webhook] event handler crashed", err);
      }
    }
  });

  return NextResponse.json({ ok: true });
}

async function handleEvent(
  event: LineEvent,
  gate: ReturnType<typeof buildGate>,
  mode: "normal" | "stage_only" = "normal",
): Promise<void> {
  const traceId = `${event.source?.userId ?? "unknown"}_${Date.now().toString(36)}`;
  const endEvent = span("webhook:handleEvent", traceId);

  // Idempotency: drop duplicate webhook deliveries.
  if ("webhookEventId" in event && event.webhookEventId) {
    const seenKey = `seen:${event.webhookEventId}`;
    const set = await redis().set(seenKey, 1, { ex: 60 * 10, nx: true });
    if (set === null) {
      endEvent({ skipped: "duplicate" });
      return;
    }
  }

  if (!(await passesAllowlist(event, gate))) {
    endEvent({ skipped: "allowlist" });
    return;
  }

  if (event.type === "follow") {
    const userId = event.source?.userId;
    if (!userId || !("replyToken" in event)) {
      endEvent({ skipped: "no-user" });
      return;
    }
    const endProfile = span("webhook:getOrCreateProfile", traceId);
    const profile = await getOrCreateProfile(userId);
    endProfile();
    const name = profile.displayName && profile.displayName !== "friend" ? ` ${profile.displayName}` : "";
    await reply(event.replyToken, [
      textMsg(
        `Hi${name}! I'm Lekha, your personal assistant 👋\n\nI can set reminders, search the web, look up stocks or weather, read photos, and more.\n\nType "help" to see everything I can do. To connect Google (Gmail, Calendar, Drive), type "connect google".`,
      ),
    ]);
    endEvent({ type: "follow" });
    return;
  }

  if (event.type === "postback") {
    await handlePostback(event);
    endEvent({ type: "postback" });
    return;
  }

  if (event.type !== "message") return;

  const userId = event.source?.userId;
  if (!userId) {
    endEvent({ skipped: "no-user" });
    return;
  }
  if (!("replyToken" in event) || !("message" in event)) {
    endEvent({ skipped: "no-reply-token" });
    return;
  }
  const message = event.message;

  // Pre-flight in parallel. registerUser is fire-and-forget — cron sweep needs it.
  registerUser(userId).catch(() => {});
  const endPreflight = span("webhook:prelight", traceId);
  const [rl, profile, pending] = await Promise.all([
    checkRateLimit(userId),
    getOrCreateProfile(userId),
    getPending(userId),
  ]);
  endPreflight({ rateLimited: !rl.ok, pending: pending.length });

  if (!rl.ok) {
    await reply(event.replyToken, [
      textMsg(`Easy there — give me a sec. Try again in ~${rl.retryAfterSec}s.`),
    ]);
    endEvent({ type: "rate-limited" });
    return;
  }

  if (message.type === "text" && "text" in message && typeof message.text === "string") {
    const userText = message.text.trim();

    // Pending confirmation queue takes priority over shortcuts/admin commands.
    if (pending.length > 0) {
      const decision = classify(userText);
      if (decision === "yes") {
        const endPending = span("webhook:executePending", traceId);
        await showLoading(userId, 25);
        const result = await executePendingAll(userId, pending);
        await clearPending(userId);
        endPending({ actions: pending.length });
        await reply(event.replyToken, [textMsg(result)]);
        await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
        await appendTurn(userId, { role: "assistant", content: result, ts: Date.now() });
        endEvent({ type: "pending-yes", actions: pending.length });
        return;
      }
      if (decision === "no") {
        await clearPending(userId);
        await reply(event.replyToken, [
          textMsg(`Cancelled ${pending.length === 1 ? "that" : `all ${pending.length}`}.`),
        ]);
        endEvent({ type: "pending-no" });
        return;
      }
      await clearPending(userId);
    }

    if (await handleMyId(userId, userText, event.replyToken)) {
      endEvent({ type: "myid" });
      return;
    }
    if (await handleAdminCommand(userId, gate.isAdmin(userId), userText, event.replyToken)) {
      endEvent({ type: "admin" });
      return;
    }
    if (await dispatchShortcut({ userId, replyToken: event.replyToken, userText })) {
      endEvent({ type: "shortcut" });
      return;
    }

    await respondToText(event.replyToken, userId, profile, userText, traceId);
    maybeExtractFacts(userId).catch(() => {});
    endEvent({ type: "text" });
    return;
  }

  if (message.type === "image" && "id" in message && typeof message.id === "string") {
    await respondToImage(event.replyToken, userId, profile, message.id, mode, traceId);
    if (mode !== "stage_only") maybeExtractFacts(userId).catch(() => {});
    endEvent({ type: mode === "stage_only" ? "image-stage" : "image" });
    return;
  }

  if (
    (message.type === "video" || message.type === "audio" || message.type === "file") &&
    "id" in message &&
    typeof message.id === "string"
  ) {
    await respondToOtherMedia(
      event.replyToken,
      userId,
      message.id,
      message.type,
      "fileName" in message && typeof message.fileName === "string" ? message.fileName : undefined,
      "fileSize" in message && typeof message.fileSize === "number" ? message.fileSize : undefined,
      "duration" in message && typeof message.duration === "number" ? message.duration : undefined,
    );
    endEvent({ type: message.type });
    return;
  }

  if (message.type === "sticker") {
    await reply(event.replyToken, [
      textMsg("Cute sticker. Send me text, a photo, or a file if you'd like me to do something with it."),
    ]);
    endEvent({ type: "sticker" });
    return;
  }

  await reply(event.replyToken, [
    textMsg("I didn't recognize that message type. Try text, a photo, video, audio, or a file."),
  ]);
  endEvent({ type: "unknown" });
}
