import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { verifyLineSignature } from "@/lib/line/verify";
import {
  Webhook,
  type LineEvent,
  type JoinEvent,
  type LeaveEvent,
  type MemberJoinedEvent,
  type MemberLeftEvent,
  type LineMessageEvent,
} from "@/lib/line/types";
import { replyOrPush, text as textMsg, showLoading } from "@/lib/line/client";
import { env } from "@/lib/env";
import { redis } from "@/lib/memory/redis";
import { appendTurn } from "@/lib/memory/history";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { registerUser, unregisterUser } from "@/lib/memory/user-registry";
import { checkRateLimit } from "@/lib/ratelimit";
import { classify, clearPending, getPending } from "@/lib/confirm";
import { executePendingAll } from "@/lib/pending-runner";
import { buildGate, passesGate } from "@/lib/gate";
import { isAllowed } from "@/lib/memory/allowlist";
import { isOnTrial, checkTrialDailyQuota, trialQuotaMessage, startTrial } from "@/lib/trial";
import { getSettings } from "@/lib/memory/settings";
import { t } from "@/lib/i18n";

import { maybeExtractFacts } from "@/lib/maybe-extract";
import { span, withTimeout } from "@/lib/timing";
import { markUserActive } from "@/lib/sweep";
import { isGroupEvent } from "@/lib/group";
import { logWarn, logError } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TIMEOUT_MS = 50_000;
const AFTER_BATCH_SIZE = 3;

type WebhookMode = "normal" | "stage_only";

async function handleEvent(
  event: LineEvent,
  gate: ReturnType<typeof buildGate>,
  mode: WebhookMode = "normal",
): Promise<boolean> {
  const traceId = `${event.source?.userId ?? "unknown"}_${Date.now().toString(36)}`;
  const endEvent = span("webhook:handleEvent", traceId);

  // Idempotency: drop duplicate webhook deliveries.
  if ("webhookEventId" in event && event.webhookEventId) {
    const seenKey = `seen:${event.webhookEventId}`;
    const set = await redis().set(seenKey, 1, { ex: 60 * 10, nx: true });
    if (set === null) {
      endEvent({ skipped: "duplicate" });
      return false;
    }
  }

  // Free trial button from the paywall.
  if (
    event.type === "postback" &&
    "postback" in event &&
    event.postback?.data === "trial:start" &&
    event.source?.userId
  ) {
    const trialUserId = event.source.userId;
    if (!(await isAllowed(trialUserId))) {
      const trialProfile = await getOrCreateProfile(trialUserId);
      const trialReplyToken = "replyToken" in event ? event.replyToken : "";
      await startTrial(trialUserId, trialReplyToken, trialProfile.displayName ?? "");
      endEvent({ type: "trial-start" });
      return true;
    }
  }

  if (event.type === "join") {
    const { handleJoin } = await import("@/lib/handlers/group-lifecycle");
    const r = await handleJoin(event as JoinEvent, gate);
    endEvent({ type: "join" });
    return r;
  }

  if (event.type === "leave") {
    const { handleLeave } = await import("@/lib/handlers/group-lifecycle");
    await handleLeave(event as LeaveEvent);
    endEvent({ type: "leave" });
    return true;
  }

  if (event.type === "memberJoined") {
    const { handleMemberJoined } = await import("@/lib/handlers/group-lifecycle");
    const r = await handleMemberJoined(event as MemberJoinedEvent, gate);
    endEvent({ type: "memberJoined" });
    return r;
  }

  if (event.type === "memberLeft") {
    const { handleMemberLeft } = await import("@/lib/handlers/group-lifecycle");
    await handleMemberLeft(event as MemberLeftEvent);
    endEvent({ type: "memberLeft" });
    return true;
  }

  if (!isGroupEvent(event) && !(await passesGate(event, gate))) {
    endEvent({ skipped: "allowlist" });
    return false;
  }

  // Mark user active for proactive-layer suppression (10-min window).
  const uid = event.source?.userId;
  if (uid) markUserActive(uid).catch((e) => logWarn("sweep", "markUserActive failed", { error: e }));

  if (event.type === "unfollow") {
    const userId = event.source?.userId;
    if (userId) unregisterUser(userId).catch((e) => logWarn("user-registry", "unregisterUser failed", { error: e }));
    return true;
  }

  if (event.type === "follow") {
    const userId = event.source?.userId;
    if (!userId || !("replyToken" in event)) {
      endEvent({ skipped: "no-user" });
      return false;
    }
    registerUser(userId).catch((e) => logWarn("user-registry", "registerUser failed", { error: e }));
    const endProfile = span("webhook:getOrCreateProfile", traceId);
    const profile = await getOrCreateProfile(userId);
    endProfile();
    const settings = await getSettings(userId);
    const name = profile.displayName && profile.displayName !== "friend" ? profile.displayName : "";
    const { isOnboarded, startOnboarding } = await import("@/lib/onboarding");
    if (!(await isOnboarded(userId))) {
      await startOnboarding(userId, event.replyToken, name);
    } else {
      const greeting =
        settings.language === "th"
          ? `สวัสดี${name ? ` ${name}` : ""}! ฉัน Lekha เลขาส่วนตัวของคุณ 👋\n\nฉันตั้งเตือน ค้นหาเว็บ เช็คราคาหุ้นและอากาศ อ่านรูปภาพ และอื่น ๆ ได้\n\nพิมพ์ "help" เพื่อดูทั้งหมดที่ฉันทำได้ หรือพิมพ์ "connect google" เพื่อเชื่อม Google (Gmail, Calendar, Drive)`
          : `Hi${name ? ` ${name}` : ""}! I'm Lekha, your personal assistant 👋\n\nI can set reminders, search the web, look up stocks or weather, read photos, and more.\n\nType "help" to see everything I can do. To connect Google (Gmail, Calendar, Drive), type "connect google".`;
      await replyOrPush(userId, event.replyToken, [textMsg(greeting)]);
    }
    endEvent({ type: "follow" });
    return true;
  }

  if (event.type === "postback") {
    const { handlePostback } = await import("@/lib/webhook-postback");
    const userId = event.source?.userId;
    if (userId) registerUser(userId).catch((e) => logWarn("user-registry", "registerUser failed", { error: e }));
    await handlePostback(event);
    endEvent({ type: "postback" });
    return true;
  }

  if (event.type !== "message") return false;

  const userId = event.source?.userId;
  if (!userId) {
    endEvent({ skipped: "no-user" });
    return false;
  }
  if (!("replyToken" in event) || !("message" in event)) {
    endEvent({ skipped: "no-reply-token" });
    return false;
  }
  const message = event.message;

  if (isGroupEvent(event)) {
    const { handleGroupMessage } = await import("@/lib/handlers/group-message");
    const r = await handleGroupMessage(event as LineMessageEvent, gate, traceId);
    endEvent({ type: "group-message" });
    return r;
  }

  // Pre-flight in parallel. registerUser adds user to the sweep registry (users:active:window sorted set).
  // NOTE: There are no per-user QStash schedules for briefings. The master sweep iterates all users.
  registerUser(userId).catch((e) => logWarn("user-registry", "registerUser failed", { error: e }));
  const endPreflight = span("webhook:prelight", traceId);
  const [rl, profile, pending] = await Promise.all([
    checkRateLimit(userId),
    getOrCreateProfile(userId),
    getPending(userId),
  ]);
  endPreflight({ rateLimited: !rl.ok, pending: pending.length });

  if (!rl.ok) {
    const settings = await getSettings(userId);
    await replyOrPush(userId, event.replyToken, [
      textMsg(t(settings.language, "rateLimitMessage", { sec: String(rl.retryAfterSec) })),
    ]);
    endEvent({ type: "rate-limited" });
    return true;
  }

  // Trial users get a daily message cap once onboarding is complete.
  if (await isOnTrial(userId)) {
    const { isOnboarded } = await import("@/lib/onboarding");
    const onboarded = await isOnboarded(userId);
    if (onboarded) {
      const settings = await getSettings(userId);
      const dq = await checkTrialDailyQuota(userId, settings.timezone);
      if (!dq.ok) {
        const lang = settings.language === "th" ? "th" : "en";
        await replyOrPush(userId, event.replyToken, [textMsg(trialQuotaMessage(lang, dq.resetsAt))]);
        endEvent({ type: "trial-quota-exceeded" });
        return true;
      }
    }
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
        await replyOrPush(userId, event.replyToken, [textMsg(result)]);
        await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
        await appendTurn(userId, { role: "assistant", content: result, ts: Date.now() });
        endEvent({ type: "pending-yes", actions: pending.length });
        return true;
      }
      if (decision === "no") {
        const settings = await getSettings(userId);
        await clearPending(userId);
        await replyOrPush(userId, event.replyToken, [
          textMsg(
            pending.length === 1
              ? t(settings.language, "pendingCancelledOne")
              : t(settings.language, "pendingCancelledMany", { count: String(pending.length) }),
          ),
        ]);
        endEvent({ type: "pending-no" });
        return true;
      }
      await clearPending(userId);
    }

    const { handleMyId, handleAdminCommand } = await import("@/lib/admin-commands");
    if (await handleMyId(userId, userText, event.replyToken)) {
      endEvent({ type: "myid" });
      return true;
    }
    if (await handleAdminCommand(userId, gate, userText, event.replyToken)) {
      endEvent({ type: "admin" });
      return true;
    }

    const { handlePromoCommand } = await import("@/lib/promo-codes");
    if (await handlePromoCommand(userId, userText, event.replyToken)) {
      endEvent({ type: "promo" });
      return true;
    }

    const { dispatchShortcut } = await import("@/lib/shortcuts");
    if (await dispatchShortcut({ userId, replyToken: event.replyToken, userText })) {
      endEvent({ type: "shortcut" });
      return true;
    }

    const { respondToText } = await import("@/lib/handlers/text");
    await respondToText(event.replyToken, userId, profile, userText, traceId);
    maybeExtractFacts(userId).catch((e) => logWarn("facts", "maybeExtractFacts failed", { error: e }));
    endEvent({ type: "text" });
    return true;
  }

  if (message.type === "image" && "id" in message && typeof message.id === "string") {
    const { respondToImage } = await import("@/lib/handlers/image");
    await respondToImage(event.replyToken, userId, profile, message.id, mode, traceId);
    if (mode !== "stage_only") maybeExtractFacts(userId).catch((e) => logWarn("facts", "maybeExtractFacts failed", { error: e }));
    endEvent({ type: mode === "stage_only" ? "image-stage" : "image" });
    return true;
  }

  if (
    (message.type === "video" || message.type === "audio" || message.type === "file") &&
    "id" in message &&
    typeof message.id === "string"
  ) {
    const { respondToOtherMedia } = await import("@/lib/handlers/other-media");
    await respondToOtherMedia(
      event.replyToken,
      userId,
      message.id,
      message.type,
      "fileName" in message && typeof message.fileName === "string" ? message.fileName : undefined,
      "fileSize" in message && typeof message.fileSize === "number" ? message.fileSize : undefined,
      "duration" in message && typeof message.duration === "number" ? message.duration : undefined,
      mode,
    );
    if (mode !== "stage_only") maybeExtractFacts(userId).catch((e) => logWarn("facts", "maybeExtractFacts failed", { error: e }));
    endEvent({ type: mode === "stage_only" ? `${message.type}-stage` : message.type });
    return true;
  }

  if (message.type === "sticker") {
    const settings = await getSettings(userId);
    await replyOrPush(userId, event.replyToken, [textMsg(t(settings.language, "stickerReply"))]);
    endEvent({ type: "sticker" });
    return true;
  }

  const settings = await getSettings(userId);
  await replyOrPush(userId, event.replyToken, [textMsg(t(settings.language, "unknownMessageType"))]);
  endEvent({ type: "unknown" });
  return true;
}

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

  const events = payload.events;
  const gate = buildGate();

  // Handle lightweight postback taps synchronously so the replyToken is used
  // immediately and the UI feels instant. Messages/follows still run after().
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (!event || event.type !== "postback") continue;
    try {
      const replied = await handleEvent(event, gate);
      if (!replied) {
        console.warn("[webhook] postback produced no reply", { userId: event.source?.userId });
      }
    } catch (err) {
      console.error("[webhook] postback handler crashed", err);
      const uid = event.source?.userId;
      const rt = "replyToken" in event ? event.replyToken : undefined;
      if (uid && rt) {
        const langSettings = await getSettings(uid).catch((e) => {
          logWarn("webhook", "getSettings failed in postback error fallback", { error: e });
          return null;
        });
        replyOrPush(uid, rt, [textMsg(t(langSettings?.language, "agentErrGeneric"))]).catch((e) =>
          logWarn("webhook", "error-reply fallback failed", { error: e }),
        );
      }
    }
  }

  // Respond 200 immediately; do all real work after the response.
  after(async () => {
    const jobs = events
      .map((event, i) => {
        if (!event || event.type === "postback") return null;
        // Media immediately followed by more media or by text in the same batch →
        // stage only; whatever handles the LAST event in the run sends the single
        // reply (either the text handler with all staged media in context, or the
        // final media item's own ack). Without this, sending N media in one go
        // produced N separate near-identical "Got your X" acks in a row.
        const nextEvent = events[i + 1];
        const nextContinuesBatch =
          nextEvent?.type === "message" &&
          "message" in nextEvent &&
          ["text", "image", "video", "audio", "file"].includes(nextEvent.message.type);
        const thisIsMedia =
          event.type === "message" &&
          "message" in event &&
          ["image", "video", "audio", "file"].includes(event.message.type);
        return { event, mode: thisIsMedia && nextContinuesBatch ? ("stage_only" as const) : ("normal" as const) };
      })
      .filter((j): j is { event: LineEvent; mode: WebhookMode } => j !== null);

    for (let i = 0; i < jobs.length; i += AFTER_BATCH_SIZE) {
      const batch = jobs.slice(i, i + AFTER_BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ event, mode }) => {
          try {
            const replied = await withTimeout(handleEvent(event, gate, mode), EVENT_TIMEOUT_MS);
            if (!replied) {
              console.warn("[webhook] event produced no reply", { type: event.type, userId: event.source?.userId });
            }
          } catch (err) {
            console.error("[webhook] event handler crashed", err);
            // Try to send a fallback error message if we have a userId and replyToken.
            const uid = event.source?.userId;
            const rt = "replyToken" in event ? event.replyToken : undefined;
            if (uid && rt) {
              const langSettings = await getSettings(uid).catch((e) => {
                logWarn("webhook", "getSettings failed in event error fallback", { error: e });
                return null;
              });
              replyOrPush(uid, rt, [textMsg(t(langSettings?.language, "agentErrGeneric"))]).catch((e) =>
                logWarn("webhook", "error-reply fallback failed", { error: e }),
              );
            }
          }
        }),
      );
    }
  });

  return NextResponse.json({ ok: true });
}
