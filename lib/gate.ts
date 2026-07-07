import { env } from "@/lib/env";
import { isAllowed } from "@/lib/memory/allowlist";
import { isOnTrial } from "@/lib/trial";
import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { signupGateFlex } from "@/lib/line/flex";
import type { LineEvent } from "@/lib/line/types";

export type Gate = {
  /** Set of admin LINE user ids (parsed once per request). */
  admins: Set<string>;
  isAdmin: (id: string) => boolean;
};

/** Parse ADMIN_LINE_USER_ID (comma-separated) into a Set. */
export function buildGate(): Gate {
  const admins = new Set(
    (env().ADMIN_LINE_USER_ID ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return { admins, isAdmin: (id) => admins.has(id) };
}

/**
 * Access gate. Returns true if the event should proceed.
 * Admins, allowlisted users, and active free-trial users pass.
 * For rejected users, sends the paywall / free-trial Flex card.
 */
export async function passesGate(event: LineEvent, gate: Gate): Promise<boolean> {
  const userId = event.source?.userId;
  if (!userId) return false; // malformed event → deny

  if (gate.admins.size === 0) {
    console.error("[webhook] ADMIN_LINE_USER_ID is not configured; denying private bot access");
    if ("replyToken" in event && event.replyToken) {
      await replyOrPush(userId, event.replyToken, [
        textMsg("This private assistant is not configured yet. Ask the admin to set ADMIN_LINE_USER_ID."),
      ]);
    }
    return false;
  }

  if (gate.isAdmin(userId)) return true;
  if (await isAllowed(userId)) return true;
  if (await isOnTrial(userId)) return true;

  if ("replyToken" in event && event.replyToken) {
    await replyOrPush(userId, event.replyToken, [signupGateFlex(env().APP_BASE_URL)]);
  }
  return false;
}
