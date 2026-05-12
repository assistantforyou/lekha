import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { type ModelMessage } from "ai";
import { verifyLineSignature } from "@/lib/line/verify";
import { Webhook, type LineEvent } from "@/lib/line/types";
import {
  reply,
  showLoading,
  text as textMsg,
  getMessageContent,
  getProfile,
} from "@/lib/line/client";
import { env } from "@/lib/env";
import { redis } from "@/lib/memory/redis";
import { appendTurn, loadHistory, turnCounter } from "@/lib/memory/history";
import { loadFacts } from "@/lib/memory/facts";
import { getOrCreateProfile } from "@/lib/memory/profile";
import { isAllowed, addToAllowlist, removeFromAllowlist, listAllowed } from "@/lib/memory/allowlist";
import { extractAndMergeFacts } from "@/lib/llm/extract-facts";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { classify, clearPending, getPending } from "@/lib/confirm";
import { executePendingAll } from "@/lib/pending-runner";
import { appendRecentMedia } from "@/lib/memory/recent-media";
import { registerUser } from "@/lib/memory/user-registry";
import { logSent } from "@/lib/memory/sent-log";
import { runAgent } from "@/lib/agent";

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
    for (const event of payload.events) {
      try {
        await handleEvent(event);
      } catch (err) {
        console.error("[webhook] event handler crashed", err);
      }
    }
  });

  return NextResponse.json({ ok: true });
}

async function handleEvent(event: LineEvent): Promise<void> {
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
      if ("replyToken" in event && event.replyToken) {
        await reply(event.replyToken, [
          textMsg(`This is a private assistant.\n\nYour LINE ID:\n${eventUserId}\n\nSend this to the admin to request access.`),
        ]);
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

    await respondToText(event.replyToken, userId, profile, userText);
    return;
  }

  // Image messages → multimodal turn (Gemini sees it AND we stash it for attach).
  if (message.type === "image" && "id" in message && typeof message.id === "string") {
    await respondToImage(event.replyToken, userId, profile, message.id);
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
  showLoading(userId, 60).catch(() => {});  // fire-and-forget; LLM doesn't wait for LINE ack
  const [history, facts] = await Promise.all([loadHistory(userId), loadFacts(userId)]);
  console.log("[webhook] preload done", { ms: Date.now() - t0 });
  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: userText },
  ];

  const replyText = await runAgent(userId, profile, facts, messages);
  await reply(replyToken, [textMsg(replyText)]);

  await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });

  await maybeExtractFacts(userId);
}

async function respondToImage(
  replyToken: string,
  userId: string,
  profile: { displayName: string },
  messageId: string,
): Promise<void> {
  const t0 = Date.now();
  showLoading(userId, 60).catch(() => {});
  let imagePart: { type: "image"; image: Uint8Array; mediaType: string };
  try {
    const { bytes, contentType } = await getMessageContent(messageId);
    imagePart = { type: "image", image: bytes, mediaType: contentType };
    await appendRecentMedia(userId, {
      kind: "image",
      messageId,
      contentType,
      sizeBytes: bytes.byteLength,
      ts: Date.now(),
    });
  } catch (err) {
    console.warn("[webhook] image fetch failed", err);
    await reply(replyToken, [textMsg("I couldn't load that image — can you resend it?")]);
    return;
  }

  const [history, facts] = await Promise.all([loadHistory(userId), loadFacts(userId)]);
  console.log("[webhook] preload done", { ms: Date.now() - t0 });
  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((t) => ({ role: t.role, content: t.content })),
    {
      role: "user",
      content: [
        { type: "text", text: "(image)" },
        imagePart,
      ],
    },
  ];

  const replyText = await runAgent(userId, profile, facts, messages);
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
  await showLoading(userId, 60);

  // We don't fetch the bytes now — just record the LINE pointer + metadata.
  // Bytes are pulled at send time (cheap, avoids burning Redis on big files).
  // To get the contentType we'd need to HEAD-request LINE; do a lightweight
  // probe so the model can tell the user.
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
    // Drain the body to free the underlying socket — fetch() will leak it otherwise.
    await head.body?.cancel().catch(() => {});
    if (ct) contentType = ct;
  } catch {
    // best effort
  }

  await appendRecentMedia(userId, {
    kind,
    messageId,
    contentType,
    fileName,
    sizeBytes: fileSize,
    durationMs,
    ts: Date.now(),
  });

  const isZip =
    contentType === "application/zip" ||
    fileName?.toLowerCase().endsWith(".zip") ||
    fileName?.toLowerCase().endsWith(".gz") ||
    fileName?.toLowerCase().endsWith(".tar");
  const description = [
    `(User just sent a ${kind} via LINE.`,
    fileName ? ` Filename: "${fileName}".` : "",
    fileSize ? ` Size: ~${(fileSize / 1024).toFixed(0)} KB.` : "",
    durationMs ? ` Duration: ${(durationMs / 1000).toFixed(1)}s.` : "",
    ` Mime: ${contentType}.`,
    isZip
      ? " NOTE: This is a ZIP/archive file. It is staged for email attachment via attach_recent_media, but you CANNOT open, extract, or read its contents. Tell the user this explicitly.)"
      : " It's staged for attachment via attach_recent_media on draft_email if they want it sent somewhere.)",
  ].join("");

  const history = await loadHistory(userId);
  const facts = await loadFacts(userId);
  const messages: ModelMessage[] = [
    ...history.map<ModelMessage>((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: description },
  ];

  const replyText = await runAgent(userId, profile, facts, messages);
  await reply(replyToken, [textMsg(replyText)]);

  await appendTurn(userId, {
    role: "user",
    content: `[sent a ${kind}${fileName ? `: ${fileName}` : ""}]`,
    ts: Date.now(),
  });
  await appendTurn(userId, { role: "assistant", content: replyText, ts: Date.now() });
  await maybeExtractFacts(userId);
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
