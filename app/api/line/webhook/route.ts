import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { verifyLineSignature } from "@/lib/line/verify";
import { Webhook, type LineEvent } from "@/lib/line/types";
import {
  reply,
  showLoading,
  text as textMsg,
  withQuickReplies,
  getMessageContent,
  getProfile,
  type LineMessage,
} from "@/lib/line/client";
import { stripMarkdown, ACTION_LABELS, runAgent, withTimeout, AgentTimeoutError, unwrap } from "@/lib/llm/agent";
import { env } from "@/lib/env";
import { redis } from "@/lib/memory/redis";
import { appendTurn, loadHistory, turnCounter, historyForPrompt } from "@/lib/memory/history";
import { loadFacts, factsToPromptBlock } from "@/lib/memory/facts";
import { getOrCreateProfile } from "@/lib/memory/profile";
import {
  isAllowed,
  addToAllowlist,
  removeFromAllowlist,
  listAllowed,
  isPending,
  addToPending,
  listPending,
  getPendingInfo,
  approvePending,
  denyPending,
  shouldNotifyAdminOfPending,
} from "@/lib/memory/allowlist";
import { push as linePush } from "@/lib/line/client";
import { confirmCancelFlex } from "@/lib/line/flex";
import { chatModel } from "@/lib/llm/provider";
import { buildSystemPrompt } from "@/lib/llm/prompts";
import { buildMorningBriefing } from "@/lib/llm/briefing";
import { buildEveningSummary } from "@/lib/llm/evening-summary";
import { extractAndMergeFacts } from "@/lib/llm/extract-facts";
import { toolsForUser } from "@/lib/tools";
import { GoogleAuthRequired, NeedsConfirmation, RateLimited } from "@/lib/errors";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { classify, clearPending, getPending } from "@/lib/confirm";
import { listAccounts } from "@/lib/tools/google-auth";
import { renderDraftsBlock } from "@/lib/llm/render-drafts";
import { executePendingAll } from "@/lib/pending-runner";
import { appendRecentMedia, listRecentMedia } from "@/lib/memory/recent-media";
import { registerUser } from "@/lib/memory/user-registry";
import { getSettings } from "@/lib/memory/settings";
import { logSent } from "@/lib/memory/sent-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enrich a plain reply string with LINE Quick Reply buttons when the context warrants it:
 * - Draft confirmations → YES / No tap-buttons
 * - Multi-account selection prompts → one button per connected account (max 4)
 */
function enrichReply(replyText: string, activeEmail: string | null, allEmails: string[]): LineMessage {
  // Draft confirmation: prefer Flex bubble (tap-to-confirm via postback).
  // The text path remains the altText fallback for old LINE clients.
  if (replyText.includes("Reply YES to")) {
    return confirmCancelFlex(replyText);
  }
  if (/which google account/i.test(replyText) && allEmails.length > 1) {
    return withQuickReplies(
      replyText,
      allEmails.slice(0, 4).map((e) => ({ label: e.split("@")[0]!, text: e })),
    );
  }
  // Connect-google prompt
  if (/connect google/i.test(replyText) && !activeEmail) {
    return withQuickReplies(replyText, [{ label: "Connect Google", text: "connect google" }]);
  }
  return textMsg(replyText);
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

  // Respond 200 immediately; do all real work after the response.
  after(async () => {
    const events = payload.events;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) continue;
      // If this is an image event immediately followed by a text event in the same batch,
      // skip the image-only response — the text handler will receive the image via staged
      // media and respond to both together in one turn.
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
        await handleEvent(event, thisIsImage && nextIsText ? "stage_only" : "normal");
      } catch (err) {
        console.error("[webhook] event handler crashed", err);
      }
    }
  });

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineEvent, mode: "normal" | "stage_only" = "normal"): Promise<void> {
  // Idempotency: drop duplicate webhook deliveries.
  if ("webhookEventId" in event && event.webhookEventId) {
    const seenKey = `seen:${event.webhookEventId}`;
    const set = await redis().set(seenKey, 1, { ex: 60 * 10, nx: true });
    if (set === null) return;
  }

  // Allowlist gate — runs for every event type before any other logic.
  // Admins always pass. Everyone else must be on the allowlist.
  const adminIds = new Set(
    (env().ADMIN_LINE_USER_ID ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  );
  const isAdmin = (id: string) => adminIds.has(id);
  const eventUserId = event.source?.userId;
  if (eventUserId && adminIds.size > 0 && !isAdmin(eventUserId)) {
    const allowed = await isAllowed(eventUserId);
    if (!allowed) {
      // Self-serve queue: add to pending and tell the user.
      const already = await isPending(eventUserId);
      const requestText =
        event.type === "message" && "message" in event && event.message.type === "text" && "text" in event.message
          ? String(event.message.text).slice(0, 240)
          : "";
      let displayName = "";
      try {
        const p = await getProfile(eventUserId);
        displayName = p?.displayName ?? "";
      } catch {
        // best-effort; if LINE profile API is unavailable we still queue them
      }
      if (!already) {
        await addToPending(eventUserId, {
          displayName,
          requestedAt: Date.now(),
          message: requestText || undefined,
        });
      }
      const replyMsg = already
        ? "⏳ Your access request is still pending review. The admin will get back to you soon."
        : `👋 You've been added to the approval queue. The admin will review your request shortly — you'll get a message when you're approved.\n\nYour LINE ID:\n${eventUserId}`;
      if ("replyToken" in event && event.replyToken) {
        await reply(event.replyToken, [textMsg(replyMsg)]);
      }
      // Notify admins (rate-limited per requesting user to avoid spam).
      if (adminIds.size > 0 && (await shouldNotifyAdminOfPending(eventUserId))) {
        const adminNote =
          `🔔 New access request${displayName ? ` from ${displayName}` : ""}` +
          `\nLINE ID: ${eventUserId}` +
          (requestText ? `\nFirst message: ${requestText}` : "") +
          `\n\nReply with: /approve ${eventUserId}  or  /deny ${eventUserId}`;
        for (const adminId of adminIds) {
          linePush(adminId, [textMsg(adminNote)]).catch(() => {});
        }
      }
      return;
    }
  }

  if (event.type === "follow") {
    const userId = event.source?.userId;
    if (!userId || !("replyToken" in event)) return;
    const profile = await getOrCreateProfile(userId);
    const name = profile.displayName && profile.displayName !== "friend" ? ` ${profile.displayName}` : "";
    const connectUrl = await buildConnectUrl(userId).catch(() => null);
    await reply(event.replyToken, [
      textMsg(
        `Hi${name}! I'm Lekha, your personal assistant 👋\n\nI can set reminders, search the web, look up stocks or weather, read photos, and more.\n\nType "help" to see everything I can do. To connect Google (Gmail, Calendar, Drive), type "connect google".`,
      ),
    ]);
    return;
  }

  // Postback (Flex Message button taps). Route by verb prefix. Idempotent
  // per webhook event via the seen:{eventId} dedup already done above.
  if (event.type === "postback" && "postback" in event) {
    const pbUserId = event.source?.userId;
    if (!pbUserId || !("replyToken" in event) || !event.replyToken) return;
    const { parsePostbackData } = await import("@/lib/line/flex");
    const { verb, args } = parsePostbackData(event.postback.data);

    if (verb === "confirm") {
      const decision = args[0];
      const pending = await getPending(pbUserId);
      if (decision === "yes") {
        if (pending.length === 0) {
          await reply(event.replyToken, [textMsg("Nothing pending — that confirm was stale.")]);
          return;
        }
        await showLoading(pbUserId, 25);
        const result = await executePendingAll(pbUserId, pending);
        await clearPending(pbUserId);
        await reply(event.replyToken, [textMsg(result)]);
        await appendTurn(pbUserId, { role: "user", content: "[confirm:yes]", ts: Date.now() });
        await appendTurn(pbUserId, { role: "assistant", content: result, ts: Date.now() });
        return;
      }
      if (decision === "no") {
        await clearPending(pbUserId);
        await reply(event.replyToken, [
          textMsg(`Cancelled ${pending.length === 1 ? "that" : `all ${pending.length}`}.`),
        ]);
        return;
      }
    }

    if (verb === "task") {
      const [op, taskId] = args;
      if (!taskId || (op !== "done" && op !== "reopen")) {
        await reply(event.replyToken, [textMsg("Couldn't parse that task action.")]);
        return;
      }
      const { completeTask, reopenTask } = await import("@/lib/memory/tasks");
      const updated = op === "done" ? await completeTask(pbUserId, taskId) : await reopenTask(pbUserId, taskId);
      if (!updated) {
        await reply(event.replyToken, [textMsg("That task doesn't exist anymore.")]);
        return;
      }
      const verbWord = op === "done" ? "completed" : "reopened";
      await reply(event.replyToken, [textMsg(`✓ ${verbWord}: ${updated.title}`)]);
      return;
    }

    // Unknown postback verbs fall through silently — future templates
    // (reminder:cancel, draft:edit) wire in here.
    console.warn("[webhook] unhandled postback", { verb, args });
    return;
  }

  if (event.type !== "message") return;

  const userId = event.source?.userId;
  if (!userId) return;
  if (!("replyToken" in event) || !("message" in event)) return;
  const message = event.message;

  // Run all independent setup in parallel: rate limit, profile, pending queue.
  // registerUser is fire-and-forget — cron sweep needs it but nothing here depends on it.
  registerUser(userId).catch(() => {});
  const [rl, profile, pending] = await Promise.all([
    checkRateLimit(userId),
    getOrCreateProfile(userId),
    getPending(userId),
  ]);

  if (!rl.ok) {
    await reply(event.replyToken, [
      textMsg(`Easy there — give me a sec. Try again in ~${rl.retryAfterSec}s.`),
    ]);
    return;
  }

  // Handle text messages (with confirmation routing).
  if (message.type === "text" && "text" in message && typeof message.text === "string") {
    const userText = message.text.trim();

    if (pending.length > 0) {
      const decision = classify(userText);
      if (decision === "yes") {
        await showLoading(userId, 25);
        const result = await executePendingAll(userId, pending);
        await clearPending(userId);
        await reply(event.replyToken, [textMsg(result)]);
        await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
        await appendTurn(userId, { role: "assistant", content: result, ts: Date.now() });
        return;
      }
      if (decision === "no") {
        await clearPending(userId);
        await reply(event.replyToken, [
          textMsg(`Cancelled ${pending.length === 1 ? "that" : `all ${pending.length}`}.`),
        ]);
        return;
      }
      // Otherwise: discard the pending list and let the model handle the new instruction.
      await clearPending(userId);
    }

    // /myid — lets anyone look up their own LINE userId (needed to request allowlist access).
    if (/^\/myid$/i.test(userText)) {
      await reply(event.replyToken, [textMsg(`Your LINE ID:\n${userId}`)]);
      return;
    }

    // Admin-only management commands.
    if (isAdmin(userId)) {
      const addMatch = userText.match(/^\/allow\s+(U\w+)$/i);
      const remMatch = userText.match(/^\/remove\s+(U\w+)$/i);
      const approveMatch = userText.match(/^\/approve\s+(U\w+)$/i);
      const denyMatch = userText.match(/^\/deny\s+(U\w+)$/i);
      if (addMatch) {
        await addToAllowlist(addMatch[1]!);
        await reply(event.replyToken, [textMsg(`✅ Added ${addMatch[1]} to the allowlist.`)]);
        return;
      }
      if (remMatch) {
        await removeFromAllowlist(remMatch[1]!);
        await reply(event.replyToken, [textMsg(`🗑 Removed ${remMatch[1]} from the allowlist.`)]);
        return;
      }
      if (approveMatch) {
        const target = approveMatch[1]!;
        const wasPending = await approvePending(target);
        // Welcome the newly approved user.
        linePush(target, [
          textMsg(
            `🎉 You're in! I'm Lekha, your personal assistant. Type "help" to see what I can do.`,
          ),
        ]).catch(() => {});
        await reply(event.replyToken, [
          textMsg(wasPending ? `✅ Approved ${target}.` : `✅ Added ${target} to the allowlist (was not pending).`),
        ]);
        return;
      }
      if (denyMatch) {
        const target = denyMatch[1]!;
        const wasPending = await denyPending(target);
        await reply(event.replyToken, [
          textMsg(wasPending ? `🚫 Denied ${target}.` : `${target} was not in pending.`),
        ]);
        return;
      }
      if (/^\/pending$/i.test(userText)) {
        const list = await listPending();
        if (!list.length) {
          await reply(event.replyToken, [textMsg("Pending requests (0):\n\n(nobody pending)")]);
          return;
        }
        const entries = await Promise.all(
          list.map(async (id) => {
            const info = await getPendingInfo(id);
            if (!info) return id;
            const ago = Math.round((Date.now() - info.requestedAt) / 60_000);
            const name = info.displayName ? `${info.displayName} ` : "";
            const msg = info.message ? `\n  ↳ "${info.message.slice(0, 100)}"` : "";
            return `${name}(${id}) — ${ago}m ago${msg}`;
          }),
        );
        await reply(event.replyToken, [
          textMsg(
            `Pending requests (${list.length}):\n\n${entries.join("\n")}\n\nReply: /approve <id> or /deny <id>`,
          ),
        ]);
        return;
      }
      if (/^\/users$/i.test(userText)) {
        const list = await listAllowed();
        if (!list.length) {
          await reply(event.replyToken, [textMsg("Allowed users (0):\n\n(nobody yet)")]);
          return;
        }
        const entries = await Promise.all(
          list.map(async (id) => {
            const p = await getProfile(id).catch(() => null);
            return p?.displayName ? `${p.displayName} (${id})` : id;
          }),
        );
        await reply(event.replyToken, [textMsg(`Allowed users (${list.length}):\n\n${entries.join("\n")}`)]);
        return;
      }
    }

    // Shortcut: help command never needs an LLM call.
    const helpTrigger = /^\/?(help|what can you do|capabilities)$/i;
    if (helpTrigger.test(userText)) {
      const { HELP_TEXT } = await import("@/lib/tools/help");
      await reply(event.replyToken, [textMsg(HELP_TEXT)]);
      return;
    }

    // Shortcut: "connect google" generates the OAuth URL without hitting the LLM.
    if (/^connect\s+google$/i.test(userText)) {
      const url = await buildConnectUrl(userId).catch(() => null);
      const msg = url
        ? `Connect your Google account here (link expires in 10 min):\n${url}`
        : "Couldn't generate a connect link — make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.";
      await reply(event.replyToken, [textMsg(msg)]);
      return;
    }

    // Shortcut: morning briefing — bypass LLM entirely, call builder directly.
    // Loose pattern catches typos ("brifing", "breifing") and short forms ("my briefing").
    if (/\b(morning briefing|daily briefing|daily summary)\b/i.test(userText) ||
        /^(give me|show me|what'?s|send me)?\s*(my\s*)?(morning|daily)\s*(briefing|summary)[\s?!.]*$/i.test(userText) ||
        /^(give me|show me|send me|what'?s)?\s*my\s*br[a-z]{0,6}(?:ing)?[\s?!.]*$/i.test(userText)) {
      showLoading(userId, 25).catch(() => {});
      const settings = await getSettings(userId);
      const briefing = await buildMorningBriefing(userId, {
        timezone: settings.timezone,
        location: settings.location,
        includeInbox: settings.inboxBriefingEnabled,
      });
      const out = briefing ?? "Nothing to show in your briefing right now.";
      await reply(event.replyToken, [textMsg(out)]);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: out, ts: Date.now() });
      return;
    }

    // Shortcut: evening summary — bypass LLM entirely, call builder directly.
    if (/\b(evening summary|evening briefing|evening wrap.?up|nightly summary)\b/i.test(userText) ||
        /^(give me|show me|what'?s|send me)?\s*(my\s*)?(evening|nightly)\s*(summary|briefing|wrap.?up)[\s?!.]*$/i.test(userText)) {
      showLoading(userId, 25).catch(() => {});
      const settings = await getSettings(userId);
      const summary = await buildEveningSummary(userId, { timezone: settings.timezone });
      const out = summary ?? "Nothing to show in your evening summary right now.";
      await reply(event.replyToken, [textMsg(out)]);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: out, ts: Date.now() });
      return;
    }

    await respondToText(event.replyToken, userId, profile, userText);
    return;
  }

  // Image messages → multimodal turn (Gemini sees it AND we stash it for attach).
  if (message.type === "image" && "id" in message && typeof message.id === "string") {
    await respondToImage(event.replyToken, userId, profile, message.id, mode);
    return;
  }

  // Video / audio / file → stash for attachment, agent loop handles the response.
  if (
    (message.type === "video" || message.type === "audio" || message.type === "file") &&
    "id" in message &&
    typeof message.id === "string"
  ) {
    await respondToOtherMedia(
      event.replyToken,
      userId,
      profile,
      message.id,
      message.type,
      "fileName" in message && typeof message.fileName === "string" ? message.fileName : undefined,
      "fileSize" in message && typeof message.fileSize === "number" ? message.fileSize : undefined,
      "duration" in message && typeof message.duration === "number" ? message.duration : undefined,
    );
    return;
  }

  if (message.type === "sticker") {
    await reply(event.replyToken, [textMsg("Cute sticker. Send me text, a photo, or a file if you'd like me to do something with it.")]);
    return;
  }

  await reply(event.replyToken, [
    textMsg("I didn't recognize that message type. Try text, a photo, video, audio, or a file."),
  ]);
}

async function respondToText(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  userText: string,
): Promise<void> {
  const t0 = Date.now();
  const tick = (label: string, extra?: Record<string, unknown>) =>
    console.warn(`[timing] ${label}`, { ms: Date.now() - t0, ...(extra ?? {}) });
  tick("respondToText:start", { textLen: userText.length });
  showLoading(userId, 60).catch(() => {});  // fire-and-forget; LLM doesn't wait for LINE ack
  const [historyMsgs, facts, staged, accounts] = await Promise.all([
    historyForPrompt(userId),
    loadFacts(userId),
    listRecentMedia(userId),
    listAccounts(userId),
  ]);
  tick("preload:done", {
    historyTurns: historyMsgs.length,
    factsCount: facts.facts.length,
    stagedCount: staged.length,
    googleAccounts: accounts.accounts.length,
  });

  // If a fresh image was just staged (< 30s ago, e.g. sent in same batch),
  // bundle its bytes directly into the message so the model sees both at once.
  const freshImage = staged.find(
    (m) => m.kind === "image" && Date.now() - m.ts < 30_000,
  );
  let userContent: ModelMessage["content"];
  if (freshImage) {
    try {
      const { bytes, contentType } = await getMessageContent(freshImage.messageId);
      userContent = [
        { type: "image", image: bytes, mediaType: contentType },
        { type: "text", text: userText },
      ];
      tick("image:fetched", { bytes: bytes.byteLength });
    } catch {
      // Couldn't fetch the image — fall back to text-only
      userContent = userText;
    }
  } else {
    userContent = userText;
  }

  const messages: ModelMessage[] = [
    ...historyMsgs,
    { role: "user", content: userContent },
  ];

  tick("agent:start");
  const replyText = await runAgent(userId, profile, facts, messages);
  tick("agent:done", { replyLen: replyText.length });
  await reply(replyToken, [enrichReply(replyText, accounts.activeEmail, accounts.accounts.map((a) => a.email))]);
  tick("reply:sent");

  await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
  tick("history:appended");

  await maybeExtractFacts(userId);
  tick("facts:maybeExtracted");
}

async function respondToImage(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  messageId: string,
  mode: "normal" | "stage_only" = "normal",
): Promise<void> {
  const t0 = Date.now();
  let imageBytes: Uint8Array;
  let imageContentType: string;
  try {
    const { bytes, contentType } = await getMessageContent(messageId);
    imageBytes = bytes;
    imageContentType = contentType;
    await appendRecentMedia(userId, {
      kind: "image",
      messageId,
      contentType,
      sizeBytes: bytes.byteLength,
      ts: Date.now(),
    });
  } catch (err) {
    console.warn("[webhook] image fetch failed", err);
    if (mode === "normal") {
      await reply(replyToken, [textMsg("I couldn't load that image — can you resend it?")]);
    }
    return;
  }

  // stage_only: a text message follows in the same batch, so skip responding here.
  // The text handler will pick up the staged image and respond to both together.
  if (mode === "stage_only") return;

  showLoading(userId, 60).catch(() => {});
  const [history, facts, settings] = await Promise.all([
    loadHistory(userId),
    loadFacts(userId),
    getSettings(userId),
  ]);
  console.log("[webhook] image preload done", { ms: Date.now() - t0 });

  // Use generateText directly (no tools) so Gemini just looks at the image bytes
  // and responds in plain text. Passing through runAgent triggers summarize_image /
  // ocr_image tool calls which then return empty model text → "(…)".
  const imagePart = { type: "image" as const, image: imageBytes, mediaType: imageContentType };
  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((t) => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content: [
        imagePart,
        { type: "text", text: "What do you see? If there's text, extract it. If it's a photo or document, describe it. Reply naturally and helpfully." },
      ],
    },
  ];

  let replyText: string;
  try {
    const result = await withTimeout(
      generateText({
        model: chatModel(),
        system: buildSystemPrompt(factsToPromptBlock(facts), profile, settings),
        messages,
        maxRetries: 3,
        providerOptions: {
          google: {
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
          },
        },
      }),
      60_000,
    );
    replyText = stripMarkdown(result.text?.trim() || "Hmm, I couldn't read that image. Can you try sending it again?");
  } catch (err) {
    console.warn("[webhook] image generateText failed", err);
    replyText = "Couldn't analyze that image. Try resending it?";
  }

  await reply(replyToken, [textMsg(replyText)]);
  await appendTurn(userId, { role: "user", content: "[sent an image]", ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
  await maybeExtractFacts(userId);
}

async function respondToOtherMedia(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  messageId: string,
  kind: "video" | "audio" | "file",
  fileName: string | undefined,
  fileSize: number | undefined,
  durationMs: number | undefined,
): Promise<void> {
  // We don't fetch the bytes now — just record the LINE pointer + metadata.
  // Bytes are pulled at send time (cheap, avoids burning Redis on big files).
  // To get the contentType we'd need to HEAD-request LINE; do a lightweight
  // probe so the model can tell the user.
  const tMedia0 = Date.now();
  let contentType = guessMimeFromFilename(fileName) ?? defaultMimeForKind(kind);
  try {
    const head = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}`, Range: "bytes=0-0" },
      },
    );
    const ct = head.headers.get("content-type");
    await head.body?.cancel().catch(() => {});
    if (ct) contentType = ct;
    console.warn("[timing/media] head-probed", { ms: Date.now() - tMedia0, contentType, kind, fileName });
  } catch (err) {
    console.warn("[timing/media] head-probe-failed", { ms: Date.now() - tMedia0, err: String(err).slice(0, 200) });
  }

  try {
    await appendRecentMedia(userId, {
      kind,
      messageId,
      contentType,
      fileName,
      sizeBytes: fileSize,
      durationMs,
      ts: Date.now(),
    });
    console.warn("[timing/media] staged", { ms: Date.now() - tMedia0, kind, fileName, contentType });
  } catch (err) {
    console.error("[timing/media] stage-failed", { err: err instanceof Error ? err.message : String(err) });
    throw err;
  }

  const isZip =
    contentType === "application/zip" ||
    fileName?.toLowerCase().endsWith(".zip") ||
    fileName?.toLowerCase().endsWith(".gz") ||
    fileName?.toLowerCase().endsWith(".tar");
  const isReadableDoc =
    !isZip && (
      contentType === "application/pdf" ||
      /\.(pdf|docx?|xlsx?|pptx?|txt|csv|md|rtf)$/i.test(fileName ?? "") ||
      contentType.startsWith("text/")
    );

  // Don't call runAgent here — just ack and stage. The file is now in Redis
  // before any concurrent text-message handler runs, eliminating the race.
  // Auto-summarizing here caused 3-minute hangs (no timeout on the inner
  // generateText) and duplicate responses when the user immediately follows up.
  const ack = isZip
    ? `Got your zip file${fileName ? ` (${fileName})` : ""} — I can attach it to emails but I can't open or extract the contents.`
    : isReadableDoc
    ? `Got your document${fileName ? ` (${fileName})` : ""} — what would you like to know about it?`
    : kind === "audio"
    ? `Got your voice memo — want me to transcribe or summarize it?`
    : `Got your ${kind}${fileName ? ` (${fileName})` : ""} — it's ready. What would you like to do with it?`;

  await reply(replyToken, [textMsg(ack)]);
  await appendTurn(userId, {
    role: "user",
    content: `[sent a ${kind}${fileName ? `: ${fileName}` : ""}]`,
    ts: Date.now(),
  });
  await appendTurn(userId, { role: "assistant", content: ack, ts: Date.now() });
}

function guessMimeFromFilename(name: string | undefined): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return null;
}

function defaultMimeForKind(kind: "video" | "audio" | "file"): string {
  if (kind === "video") return "video/mp4";
  if (kind === "audio") return "audio/m4a";
  return "application/octet-stream";
}

async function maybeExtractFacts(userId: string): Promise<void> {
  const n = await turnCounter(userId);
  if (n % 10 !== 0) return;
  const history = await loadHistory(userId);
  // Fire-and-forget — don't block reply.
  extractAndMergeFacts(userId, history).catch((err) =>
    console.warn("[facts] background extract failed", err),
  );
}
