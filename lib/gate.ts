import { env } from "@/lib/env";
import { isAllowed } from "@/lib/memory/allowlist";
import { reply, text as textMsg } from "@/lib/line/client";
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
 * Allowlist gate (decision #15). Returns true if the event should proceed.
 * For rejected users, sends a friendly reply with their LINE id.
 */
export async function passesAllowlist(event: LineEvent, gate: Gate): Promise<boolean> {
  const userId = event.source?.userId;
  if (!userId) return true; // no user → let downstream decide

  if (gate.admins.size === 0) {
    console.error("[webhook] ADMIN_LINE_USER_ID is not configured; denying private bot access");
    if ("replyToken" in event && event.replyToken) {
      await reply(event.replyToken, [
        textMsg("This private assistant is not configured yet. Ask the admin to set ADMIN_LINE_USER_ID."),
      ]);
    }
    return false;
  }

  if (gate.isAdmin(userId)) return true;

  if (await isAllowed(userId)) return true;

  if ("replyToken" in event && event.replyToken) {
    await reply(event.replyToken, [signupGateFlex(env().APP_BASE_URL)]);
  }
  return false;
}
