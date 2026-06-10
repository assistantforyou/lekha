import { env } from "@/lib/env";
import { span } from "@/lib/timing";

const API = "https://api.line.me/v2/bot";
const DATA_API = "https://api-data.line.me/v2/bot";

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

/**
 * Reply to a message using a one-shot reply token (~1min validity).
 * Falls back silently if expired/used; caller should switch to push.
 */
export async function reply(replyToken: string, messages: LineMessage[]): Promise<boolean> {
  const end = span("line:reply");
  const r = await fetchWithTimeout(`${API}/message/reply`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ replyToken, messages }),
  });
  end({ ok: r.ok, status: r.status, messages: messages.length });
  if (!r.ok) {
    console.warn("[line] reply failed", r.status, await safeText(r));
    return false;
  }
  return true;
}

/**
 * Push a message to a user (counts against monthly quota on free plan).
 */
export async function push(to: string, messages: LineMessage[]): Promise<boolean> {
  const end = span("line:push");
  const r = await fetchWithTimeout(`${API}/message/push`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ to, messages }),
  });
  end({ ok: r.ok, status: r.status, messages: messages.length });
  if (!r.ok) {
    console.warn("[line] push failed", r.status, await safeText(r));
    return false;
  }
  return true;
}

/**
 * Reply if the token is fresh, else push. Returns the method used.
 */
export async function replyOrPush(
  to: string,
  replyToken: string | undefined,
  messages: LineMessage[],
): Promise<"reply" | "push" | "failed"> {
  if (replyToken) {
    const ok = await reply(replyToken, messages);
    if (ok) return "reply";
  }
  const ok = await push(to, messages);
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

export async function getMessageContent(messageId: string): Promise<{
  bytes: Uint8Array;
  contentType: string;
}> {
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
  const buf = new Uint8Array(await r.arrayBuffer());
  end({ ok: true, sizeBytes: buf.byteLength, contentType: ct });
  return { bytes: buf, contentType: ct };
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
