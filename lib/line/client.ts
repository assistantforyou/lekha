import { env } from "@/lib/env";
import { span } from "@/lib/timing";
import { sanitizeFlexMessages } from "@/lib/line/flex/validate";

const API = "https://api.line.me/v2/bot";
const DATA_API = "https://api-data.line.me/v2/bot";

// LINE message content is immutable; cache fetches for a short window to avoid
// re-downloading the same image/PDF when multiple tools use it in one turn.
import { LruMap } from "@/lib/lru-cache";

const contentCache = new LruMap<string, { promise: Promise<{ bytes: Uint8Array; contentType: string }>; ts: number }>(100);
const CONTENT_CACHE_TTL_MS = 2 * 60 * 1000;

function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 15000, ...rest } = init;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...rest, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

type QuickReplyItem = {
  type: "action";
  action: { type: "message"; label: string; text: string };
};

// Flex Message envelope. `contents` is the bubble/carousel JSON tree —
// kept as `unknown` here because the LINE Flex schema is enormous and
// each template module owns its own typed builder.
export type FlexMessage = {
  type: "flex";
  altText: string;
  contents: unknown;
  quickReply?: { items: QuickReplyItem[] };
};

export type LineMessage = FlexMessage;

/** Build a clean Flex bubble that wraps plain text. No branded header — the user already knows who they're talking to. */
function textBubble(body: string): FlexMessage {
  const t = body.slice(0, 5000).trim() || "…";
  return {
    type: "flex",
    altText: t.slice(0, 400),
    contents: {
      type: "bubble",
      size: "mega",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        paddingAll: "16px",
        contents: [
          {
            type: "text",
            text: t,
            wrap: true,
            size: "sm",
            color: "#333333",
          },
        ],
      },
    },
  };
}

/** Attach tap-buttons above the LINE keyboard. Up to 13 buttons, disappear after tapping. */
export function withQuickReplies(
  replyText: string,
  buttons: { label: string; text: string }[],
): LineMessage {
  const bubble = textBubble(replyText);
  return {
    ...bubble,
    quickReply: {
      items: buttons
        .slice(0, 13)
        .map((b) => ({ type: "action" as const, action: { type: "message" as const, ...b } })),
    },
  };
}

function authHeaders() {
  return {
    Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function extractQuoteTokens(r: Response, bodyText: string): string[] {
  try {
    if (!r.ok) return [];
    const json = JSON.parse(bodyText) as { sentMessages?: { id: string; quoteToken: string }[] };
    return json.sentMessages?.map((m) => m.quoteToken).filter(Boolean) ?? [];
  } catch {
    return [];
  }
}

/**
 * Reply to a message using a one-shot reply token (~1min validity).
 * Falls back silently if expired/used; caller should switch to push.
 * Optionally returns the quote tokens of sent messages via onQuoteTokens.
 */
export async function reply(
  replyToken: string,
  messages: LineMessage[],
  onQuoteTokens?: (tokens: string[]) => void,
): Promise<boolean> {
  const end = span("line:reply");
  const { messages: safeMessages, warnings } = sanitizeFlexMessages(messages);
  if (warnings.length) console.warn("[line] flex validation warnings", warnings);
  const r = await fetchWithTimeout(`${API}/message/reply`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ replyToken, messages: safeMessages }),
  });
  const text = await safeText(r);
  end({ ok: r.ok, status: r.status, messages: safeMessages.length });
  if (onQuoteTokens) {
    const tokens = extractQuoteTokens(r, text);
    if (tokens.length) onQuoteTokens(tokens);
  }
  if (!r.ok) {
    console.warn("[line] reply failed", r.status, text);
    return false;
  }
  return true;
}

/**
 * Push a message to a user (counts against monthly quota on free plan).
 * Retries up to 2 times on transient 5xx/network errors with exponential backoff.
 * Optionally returns the quote tokens of sent messages via onQuoteTokens.
 */
export async function push(
  to: string,
  messages: LineMessage[],
  onQuoteTokens?: (tokens: string[]) => void,
): Promise<boolean> {
  const { messages: safeMessages, warnings } = sanitizeFlexMessages(messages);
  if (warnings.length) console.warn("[line] flex validation warnings", warnings);
  const body = JSON.stringify({ to, messages: safeMessages });
  for (let attempt = 0; attempt < 3; attempt++) {
    const end = span("line:push");
    const r = await fetchWithTimeout(`${API}/message/push`, {
      method: "POST",
      headers: authHeaders(),
      body,
    });
    const text = await safeText(r);
    end({ ok: r.ok, status: r.status, messages: safeMessages.length, attempt });
    if (onQuoteTokens) {
      const tokens = extractQuoteTokens(r, text);
      if (tokens.length) onQuoteTokens(tokens);
    }
    if (r.ok) return true;
    const status = r.status;
    // Don't retry on 4xx (bad request, auth, rate-limit) — only 5xx/network
    if (status < 500 || attempt === 2) {
      console.warn("[line] push failed", status, text);
      return false;
    }
    console.warn(`[line] push transient error ${status}, retrying (attempt ${attempt + 1})`, text);
    await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
  }
  return false;
}

/**
 * Reply if the token is fresh, else push. Returns the method used.
 * Optionally captures the quote tokens of sent messages.
 */
export async function replyOrPush(
  to: string,
  replyToken: string | undefined,
  messages: LineMessage[],
  onQuoteTokens?: (tokens: string[]) => void,
): Promise<"reply" | "push" | "failed"> {
  if (replyToken) {
    const ok = await reply(replyToken, messages, onQuoteTokens);
    if (ok) return "reply";
  }
  const ok = await push(to, messages, onQuoteTokens);
  return ok ? "push" : "failed";
}

/**
 * Show a typing indicator to the user for up to ~20s while we work.
 */
export async function showLoading(chatId: string, seconds = 20): Promise<void> {
  await fetchWithTimeout(`${API}/chat/loading/start`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ chatId, loadingSeconds: clamp(seconds, 5, 60) }),
  }).catch(() => {});
}

/**
 * Fetch the binary content of an image/audio/video message.
 */
const MAX_MEDIA_BYTES = 20 * 1024 * 1024; // 20 MB

export async function getMessageContent(
  messageId: string,
  userId?: string,
): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> {
  const cacheKey = userId ? `${userId}:${messageId}` : messageId;
  if (!userId) {
    console.warn("[line] getMessageContent called without userId — cross-user cache isolation not guaranteed");
  }
  const now = Date.now();
  const cached = contentCache.get(cacheKey);
  if (cached && now - cached.ts < CONTENT_CACHE_TTL_MS) {
    return cached.promise;
  }

  const promise = (async () => {
    const end = span("line:getMessageContent");
    const r = await fetchWithTimeout(`${DATA_API}/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (!r.ok) {
      end({ ok: false, status: r.status });
      throw new Error(`getMessageContent ${r.status}`);
    }
    const ct = r.headers.get("content-type") ?? "application/octet-stream";
    const cl = r.headers.get("content-length");
    if (cl && Number(cl) > MAX_MEDIA_BYTES) {
      end({ ok: false, tooLarge: true, sizeBytes: Number(cl) });
      throw new Error(`File too large (${(Number(cl) / 1024 / 1024).toFixed(1)} MB). Max ${MAX_MEDIA_BYTES / 1024 / 1024} MB.`);
    }
    const arrayBuf = await r.arrayBuffer();
    if (arrayBuf.byteLength > MAX_MEDIA_BYTES) {
      end({ ok: false, tooLarge: true, sizeBytes: arrayBuf.byteLength });
      throw new Error(`File too large (${(arrayBuf.byteLength / 1024 / 1024).toFixed(1)} MB). Max ${MAX_MEDIA_BYTES / 1024 / 1024} MB.`);
    }
    const buf = new Uint8Array(arrayBuf);
    end({ ok: true, sizeBytes: buf.byteLength, contentType: ct });
    return { bytes: buf, contentType: ct };
  })();

  contentCache.set(cacheKey, { promise, ts: now });
  return promise;
}

/**
 * Get a user's display name (best effort).
 */
export async function getProfile(userId: string): Promise<{ displayName: string } | null> {
  const r = await fetchWithTimeout(`${API}/profile/${userId}`, {
    headers: { Authorization: `Bearer ${env().LINE_CHANNEL_ACCESS_TOKEN}` },
  });
  if (!r.ok) return null;
  return (await r.json()) as { displayName: string };
}

/**
 * Wrap plain text in a Flex bubble. Every message Lekha sends is a Flex Message.
 */
export function text(s: string): LineMessage {
  return textBubble(s);
}

/** Build a raw Flex Message from a pre-built bubble/carousel contents object. */
export function flex(altText: string, contents: unknown): FlexMessage {
  return { type: "flex", altText: altText.slice(0, 400), contents };
}

async function safeText(r: Response): Promise<string> {
  try {
    return await r.text();
  } catch {
    return "";
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(n, hi));
}
