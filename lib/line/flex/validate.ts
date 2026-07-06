import type { LineMessage, FlexMessage } from "@/lib/line/client";

const MAX_ALT_TEXT = 400;
const MAX_POSTBACK_DATA = 300;
const MAX_CAROUSEL_BUBBLES = 10;

function stripMarkdown(s: string): string {
  return s.replace(/[*_#`\[\]()>\-]/g, "").trim();
}

function sanitizePostbackData(data: unknown): string | undefined {
  if (typeof data !== "string") return undefined;
  return data.slice(0, MAX_POSTBACK_DATA);
}

/**
 * Recursively sanitize a Flex contents object in place:
 * - Clamp postback data to 300 chars.
 * - Clamp text node lengths to a sane limit.
 * - Limit carousel to 10 bubbles.
 * Returns validation errors (non-empty means the structure may still be unsafe).
 */
function sanitizeContents(contents: Record<string, unknown>, errors: string[]): void {
  if (!contents || typeof contents !== "object") return;

  const type = String((contents as Record<string, unknown>).type ?? "");

  if (type === "carousel") {
    const arr = (contents as Record<string, unknown>).contents;
    if (!Array.isArray(arr)) {
      errors.push("carousel.contents must be an array");
    } else {
      if (arr.length > MAX_CAROUSEL_BUBBLES) {
        (contents as Record<string, unknown>).contents = arr.slice(0, MAX_CAROUSEL_BUBBLES);
        errors.push(`carousel truncated to ${MAX_CAROUSEL_BUBBLES} bubbles`);
      }
      for (const child of (contents as Record<string, unknown>).contents as unknown[]) {
        if (child && typeof child === "object") sanitizeContents(child as Record<string, unknown>, errors);
      }
    }
    return;
  }

  if (type === "bubble") {
    for (const key of ["header", "hero", "body", "footer"]) {
      const child = (contents as Record<string, unknown>)[key];
      if (child && typeof child === "object") sanitizeContents(child as Record<string, unknown>, errors);
    }
    return;
  }

  if (type === "box") {
    // LINE rejects `wrap` on box components; it's only valid on text elements.
    if ("wrap" in contents) {
      delete (contents as Record<string, unknown>).wrap;
      errors.push("removed invalid 'wrap' from box");
    }
    const arr = (contents as Record<string, unknown>).contents;
    if (!Array.isArray(arr)) {
      errors.push("box.contents must be an array");
    } else {
      for (const child of arr) {
        if (child && typeof child === "object") sanitizeContents(child as Record<string, unknown>, errors);
      }
    }
    return;
  }

  if (type === "button") {
    const action = (contents as Record<string, unknown>).action;
    if (action && typeof action === "object") {
      const a = action as Record<string, unknown>;
      if (a.type === "postback") {
        const cleaned = sanitizePostbackData(a.data);
        if (cleaned === undefined) {
          errors.push("postback action missing data");
        } else {
          a.data = cleaned;
        }
      }
    }
    return;
  }

  if (type === "text") {
    const text = (contents as Record<string, unknown>).text;
    if (typeof text === "string" && text.length > 5000) {
      (contents as Record<string, unknown>).text = text.slice(0, 5000);
      errors.push("text node truncated");
    }
  }
}

export type FlexValidation = {
  ok: boolean;
  message: FlexMessage;
  errors: string[];
  fallbackText: string;
};

/**
 * Validate and sanitize a Flex Message. Returns the sanitized message plus any
 * non-fatal warnings. If the top-level structure is invalid, ok=false and the
 * caller should fall back to fallbackText.
 */
export function validateFlexMessage(msg: unknown): FlexValidation {
  const errors: string[] = [];
  const fallbackText = "Card";

  if (!msg || typeof msg !== "object") {
    return { ok: false, message: textFallback(fallbackText), errors: ["not an object"], fallbackText };
  }

  const m = msg as Record<string, unknown>;
  if (m.type !== "flex") {
    return { ok: false, message: textFallback(fallbackText), errors: ["type is not flex"], fallbackText };
  }

  let altText = typeof m.altText === "string" ? stripMarkdown(m.altText).trim() : "";
  if (!altText) {
    altText = "Card";
    errors.push("altText was empty; using default");
  }
  if (altText.length > MAX_ALT_TEXT) {
    altText = altText.slice(0, MAX_ALT_TEXT);
    errors.push("altText truncated");
  }

  const contents = m.contents;
  if (!contents || typeof contents !== "object") {
    return { ok: false, message: textFallback(altText), errors: ["contents missing"], fallbackText: altText };
  }

  const c = contents as Record<string, unknown>;
  const topType = String(c.type ?? "");
  if (topType !== "bubble" && topType !== "carousel") {
    return { ok: false, message: textFallback(altText), errors: [`top-level type is ${topType || "missing"}`], fallbackText: altText };
  }

  sanitizeContents(c, errors);

  const sanitized: FlexMessage = {
    type: "flex",
    altText,
    contents: c as object,
  };

  return { ok: true, message: sanitized, errors, fallbackText: altText };
}

function textFallback(altText: string): FlexMessage {
  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: altText, wrap: true }],
      },
    },
  };
}

/**
 * Validate every Flex Message in a list, returning the sanitized list and any
 * warnings. Invalid Flex Messages are replaced with a plain text fallback.
 */
export function sanitizeFlexMessages(messages: LineMessage[]): { messages: LineMessage[]; warnings: string[] } {
  const out: LineMessage[] = [];
  const warnings: string[] = [];
  for (const msg of messages) {
    if (msg.type === "flex") {
      const v = validateFlexMessage(msg);
      out.push(v.message);
      if (v.errors.length) warnings.push(v.errors.join("; "));
    } else {
      out.push(msg);
    }
  }
  return { messages: out, warnings };
}
