import { replyOrPush, text as textMsg, getProfile } from "@/lib/line/client";
import {
  addToAllowlist,
  removeFromAllowlist,
  listAllowed,
  listPending,
  getPendingInfo,
  approvePending,
  denyPending,
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

  if (/^\/pending$/i.test(userText)) {
    const list = await listPending();
    if (!list.length) {
      await replyOrPush(userId, replyToken, [textMsg("Pending queue is empty.")]);
      return true;
    }
    const entries = await Promise.all(
      list.map(async (id) => {
        const info = await getPendingInfo(id);
        const name = info?.displayName ? `${info.displayName} ` : "";
        return `${name}(${id}) — requested ${info ? new Date(info.requestedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "unknown"}`;
      }),
    );
    await replyOrPush(userId, replyToken, [textMsg(`Pending queue (${list.length}):\n\n${entries.join("\n")}`)]);
    return true;
  }

  const approveMatch = userText.match(new RegExp(`^/approve\\s+(${LINE_ID_RE.source})$`, "i"));
  if (approveMatch) {
    const target = approveMatch[1]!;
    const wasPending = await approvePending(target);
    const name = (await getProfile(target).catch(() => null))?.displayName ?? "";
    await replyOrPush(userId, replyToken, [
      textMsg(wasPending ? `✅ Approved ${name ? `${name} ` : ""}${target}. Welcome message sent.` : `⚠️ ${target} was not in the pending queue, but is now allowed.`),
    ]);
    // Send welcome message to the newly approved user.
    await replyOrPush(target, "", [
      textMsg(`Hi${name ? ` ${name}` : ""}! You're all set — welcome to Lekha 👋\n\nI can set reminders, search the web, look up stocks or weather, read photos, and more.\n\nType "help" to see everything I can do. To connect Google (Gmail, Calendar, Drive), type "connect google".`),
    ]);
    return true;
  }

  const denyMatch = userText.match(new RegExp(`^/deny\\s+(${LINE_ID_RE.source})$`, "i"));
  if (denyMatch) {
    const target = denyMatch[1]!;
    const wasPending = await denyPending(target);
    await replyOrPush(userId, replyToken, [
      textMsg(wasPending ? `🗑 Removed ${target} from the pending queue.` : `⚠️ ${target} was not in the pending queue.`),
    ]);
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
