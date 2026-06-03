import { replyOrPush, text as textMsg, getProfile } from "@/lib/line/client";
import {
  addToAllowlist,
  removeFromAllowlist,
  listAllowed,
  listPending,
  getPendingInfo,
  approvePending,
  denyPending,
  isAllowed,
} from "@/lib/memory/allowlist";
import { getSettings } from "@/lib/memory/settings";
import { listAllUsers } from "@/lib/memory/user-registry";
import { redis } from "@/lib/memory/redis";
import { buildMorningBriefing } from "@/lib/llm/briefing";
import { buildEveningSummary } from "@/lib/llm/evening-summary";
import { briefingFlex, newsFlex, gmailResultsFlex } from "@/lib/line/flex";
import type { LineMessage } from "@/lib/line/client";

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
    const alreadyAllowed = await isAllowed(target);
    const wasPending = await approvePending(target);
    const name = (await getProfile(target).catch(() => null))?.displayName ?? "";
    await replyOrPush(userId, replyToken, [
      textMsg(wasPending ? `✅ Approved ${name ? `${name} ` : ""}${target}. Welcome message sent.` : `⚠️ ${target} was not in the pending queue, but is now allowed.`),
    ]);
    if (!alreadyAllowed) {
      await replyOrPush(target, "", [
        textMsg(`Hi${name ? ` ${name}` : ""}! You're all set — welcome to Lekha 👋\n\nI can set reminders, search the web, look up stocks or weather, read photos, and more.\n\nType "help" to see everything I can do. To connect Google (Gmail, Calendar, Drive), type "connect google".`),
      ]);
    }
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

  // ─── /status <id> ─── diagnostic command
  const statusMatch = userText.match(new RegExp(`^/status\\s+(${LINE_ID_RE.source})$`, "i"));
  if (statusMatch) {
    const target = statusMatch[1]!;
    const [allowed, registered, settings] = await Promise.all([
      isAllowed(target),
      (async () => {
        const all = await listAllUsers();
        return all.includes(target);
      })(),
      getSettings(target).catch(() => null),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const locks = await Promise.all([
      redis().get(`pushlock:${target}:morning_briefing:${today}`),
      redis().get(`pushlock:${target}:evening_summary:${today}`),
      redis().get(`pushlock:${target}:task_check_in:${today}`),
    ]);
    const profile = await getProfile(target).catch(() => null);
    const lines = [
      `📊 Status for ${profile?.displayName ?? target}`,
      ``,
      `Allowed: ${allowed ? "✅ yes" : "❌ no"}`,
      `In sweep registry: ${registered ? "✅ yes" : "❌ no"}`,
      ``,
      `Timezone: ${settings?.timezone ?? "(default)"}`,
      `Morning: ${settings?.morningBriefingTime ?? "(disabled)"}`,
      `Evening: ${settings?.eveningSummaryEnabled ? settings.eveningSummaryTime : "(disabled)"}`,
      `LINE pushes: ${settings?.briefingChannels?.line !== false ? "✅ enabled" : "❌ disabled"}`,
      ``,
      `Last morning: ${settings?.lastMorningBriefingTs ? new Date(settings.lastMorningBriefingTs).toLocaleString("en-US", { timeZone: settings.timezone }) : "never"}`,
      `Last evening: ${settings?.lastEveningSummaryTs ? new Date(settings.lastEveningSummaryTs).toLocaleString("en-US", { timeZone: settings.timezone }) : "never"}`,
      ``,
      `Locks today: morning=${locks[0] ? "🔒" : "🔓"} evening=${locks[1] ? "🔒" : "🔓"} checkin=${locks[2] ? "🔒" : "🔓"}`,
    ];
    await replyOrPush(userId, replyToken, [textMsg(lines.join("\n"))]);
    return true;
  }

  // ─── /force-briefing <id> [morning|evening] ─── manual trigger
  const forceMatch = userText.match(new RegExp(`^/force-briefing\\s+(${LINE_ID_RE.source})(?:\\s+(morning|evening))?$`, "i"));
  if (forceMatch) {
    const target = forceMatch[1]!;
    const kind = (forceMatch[2] ?? "morning").toLowerCase() as "morning" | "evening";
    if (!(await isAllowed(target))) {
      await replyOrPush(userId, replyToken, [textMsg(`❌ ${target} is not allowed.`)]);
      return true;
    }
    const settings = await getSettings(target);
    try {
      if (kind === "morning") {
        const briefing = await buildMorningBriefing(target, {
          timezone: settings.timezone,
          location: settings.location,
          includeInbox: settings.inboxBriefingEnabled,
          briefingTopics: settings.briefingTopics,
          briefingTopicSources: settings.briefingTopicSources,
          briefingLength: settings.briefingLength,
          briefingLanguage: settings.briefingLanguage,
        });
        const msgs: LineMessage[] = [briefingFlex("morning", briefing.text)];
        if (briefing.news.length > 0) msgs.push(newsFlex(briefing.news, "📰 Today's news"));
        if (briefing.inbox && briefing.inbox.length > 0) {
          msgs.push(gmailResultsFlex(briefing.inbox.map((m) => ({ ...m, unread: true }))));
        }
        const ok = await replyOrPush(target, "", msgs);
        await replyOrPush(userId, replyToken, [textMsg(ok === "failed" ? `❌ Push failed for ${target}` : `✅ Morning briefing sent to ${target}.`)]);
      } else {
        const summary = await buildEveningSummary(target, { timezone: settings.timezone });
        if (!summary) {
          await replyOrPush(userId, replyToken, [textMsg(`⚠️ No evening summary generated for ${target}.`)]);
          return true;
        }
        const msgs: LineMessage[] = [briefingFlex("evening", summary.text)];
        if (summary.news.length > 0) msgs.push(newsFlex(summary.news, "📰 Evening news"));
        const ok = await replyOrPush(target, "", msgs);
        await replyOrPush(userId, replyToken, [textMsg(ok === "failed" ? `❌ Push failed for ${target}` : `✅ Evening summary sent to ${target}.`)]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await replyOrPush(userId, replyToken, [textMsg(`❌ Failed: ${msg.slice(0, 200)}`)]);
    }
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
