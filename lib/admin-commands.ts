import { replyOrPush, text as textMsg, getProfile } from "@/lib/line/client";
import {
  addToAllowlist,
  removeFromAllowlist,
  listAllowed,
} from "@/lib/memory/allowlist";

/** LINE user ids are `U` + 32 lowercase hex chars. Tighter than `U\w+`. */
const LINE_ID_RE = /U[a-f0-9]{32}/i;

/**
 * Handle an admin-only command. Returns true if a command was matched and replied.
 * Non-admins are silently skipped — `/myid` (which everyone can run) is handled separately.
 */
export async function handleAdminCommand(
  userId: string,
  isAdmin: boolean,
  userText: string,
  replyToken: string,
): Promise<boolean> {
  if (!isAdmin) return false;

  const addMatch = userText.match(new RegExp(`^/allow\\s+(${LINE_ID_RE.source})$`, "i"));
  if (addMatch) {
    await addToAllowlist(addMatch[1]!);
    await replyOrPush(userId, replyToken, [textMsg(`✅ Added ${addMatch[1]} to the allowlist.`)]);
    return true;
  }

  const remMatch = userText.match(new RegExp(`^/remove\\s+(${LINE_ID_RE.source})$`, "i"));
  if (remMatch) {
    await removeFromAllowlist(remMatch[1]!);
    await replyOrPush(userId, replyToken, [textMsg(`🗑 Removed ${remMatch[1]} from the allowlist.`)]);
    return true;
  }

  if (/^\/users$/i.test(userText)) {
    const list = await listAllowed();
    if (!list.length) {
      await replyOrPush(userId, replyToken, [textMsg("Allowed users (0):\n\n(nobody yet)")]);
      return true;
    }
    const entries = await Promise.all(
      list.map(async (id) => {
        const p = await getProfile(id).catch(() => null);
        return p?.displayName ? `${p.displayName} (${id})` : id;
      }),
    );
    await replyOrPush(userId, replyToken, [textMsg(`Allowed users (${list.length}):\n\n${entries.join("\n")}`)]);
    return true;
  }

  return false;
}

/** `/myid` — anyone can look up their own LINE userId (to request access). */
export async function handleMyId(userId: string, userText: string, replyToken: string): Promise<boolean> {
  if (!/^\/myid$/i.test(userText)) return false;
  await replyOrPush(userId, replyToken, [textMsg(`Your LINE ID:\n${userId}`)]);
  return true;
}
