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
import { removeFromTrial, isOnTrial } from "@/lib/trial";
import { redis } from "@/lib/memory/redis";
import { listAuditLog, type AuditEntry } from "@/lib/memory/audit-log";
import {
  addAllowedGroup,
  removeAllowedGroup,
  listAllowedGroups,
  listDiscoveredGroups,
  isTeamMember,
  getAdminGroupIds,
} from "@/lib/group-access";
import { createPromoCode, listPromoCodes, deletePromoCode } from "@/lib/promo-codes";
import { buildMorningBriefing } from "@/lib/llm/briefing";
import { buildEveningSummary } from "@/lib/llm/evening-summary";
import {
  briefingFlex,
  newsFlex,
  gmailResultsFlex,
  pendingUsersFlex,
  groupsListFlex,
} from "@/lib/line/flex";
import type { Gate } from "@/lib/gate";
import type { LineMessage } from "@/lib/line/client";

/** LINE user ids are `U` + 32 lowercase hex chars. Tighter than `U\w+`. */
const LINE_ID_RE = /U[a-f0-9]{32}/i;

/**
 * Handle an admin-only command. Returns true if a command was matched and replied.
 * Non-admins are silently skipped — `/myid` (which everyone can run) is handled separately.
 */
export async function handleAdminCommand(
  userId: string,
  gate: Gate,
  userText: string,
  replyToken: string,
): Promise<boolean> {
  if (!gate.isAdmin(userId)) return false;

  const addMatch = userText.match(new RegExp(`^/allow\\s+(${LINE_ID_RE.source})$`, "i"));
  if (addMatch) {
    const target = addMatch[1]!;
    await addToAllowlist(target);
    await removeFromTrial(target).catch(() => {});
    console.warn("[admin] /allow", { admin: userId, target });
    await replyOrPush(userId, replyToken, [textMsg(`✅ Added ${target} to the allowlist.`)]);
    return true;
  }

  const remMatch = userText.match(new RegExp(`^/remove\\s+(${LINE_ID_RE.source})$`, "i"));
  if (remMatch) {
    const target = remMatch[1]!;
    await removeFromAllowlist(target);
    console.warn("[admin] /remove", { admin: userId, target });
    await replyOrPush(userId, replyToken, [textMsg(`🗑 Removed ${target} from the allowlist.`)]);
    return true;
  }

  if (/^\/users$/i.test(userText)) {
    const list = await listAllUsers();
    if (!list.length) {
      await replyOrPush(userId, replyToken, [textMsg("Known users (0):\n\n(nobody yet)")]);
      console.warn("[admin] /users listed 0 users", { admin: userId });
      return true;
    }
    const entries = await Promise.all(
      list.map(async (id) => {
        const [p, allowed, onTrial, team] = await Promise.all([
          getProfile(id).catch(() => null),
          isAllowed(id),
          isOnTrial(id),
          isTeamMember(id),
        ]);
        const tags: string[] = [];
        if (gate.isAdmin(id)) tags.push("ADMIN");
        if (allowed) tags.push("allowed");
        if (onTrial) tags.push("trial");
        if (team) tags.push("team");
        const tagStr = tags.length ? ` [${tags.join(", ")}]` : "";
        const display = p?.displayName ? `${p.displayName} (${id})` : id;
        return `${display}${tagStr}`;
      }),
    );
    console.warn("[admin] /users listed users", { admin: userId, count: list.length });
    await replyOrPush(userId, replyToken, [textMsg(`Known users (${list.length}):\n\n${entries.join("\n")}`)]);
    return true;
  }

  if (/^\/pending$/i.test(userText)) {
    const list = await listPending();
    console.warn("[admin] /pending", { admin: userId, count: list.length });
    if (!list.length) {
      await replyOrPush(userId, replyToken, [textMsg("Pending queue is empty.")]);
      return true;
    }
    const rows = await Promise.all(
      list.map(async (id) => {
        const info = await getPendingInfo(id);
        return { userId: id, displayName: info?.displayName, requestedAt: info?.requestedAt ?? Date.now() };
      }),
    );
    const msgs: LineMessage[] = [pendingUsersFlex(rows)];
    if (list.length > 12) msgs.unshift(textMsg(`Pending queue: ${list.length} users (showing first 12)`));
    await replyOrPush(userId, replyToken, msgs);
    return true;
  }

  const approveMatch = userText.match(new RegExp(`^/approve\\s+(${LINE_ID_RE.source})$`, "i"));
  if (approveMatch) {
    const target = approveMatch[1]!;
    const alreadyAllowed = await isAllowed(target);
    const wasPending = await approvePending(target);
    await removeFromTrial(target).catch(() => {});
    const name = (await getProfile(target).catch(() => null))?.displayName ?? "";
    console.warn("[admin] /approve", { admin: userId, target, wasPending, alreadyAllowed });
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
    console.warn("[admin] /deny", { admin: userId, target, wasPending });
    await replyOrPush(userId, replyToken, [
      textMsg(wasPending ? `🗑 Removed ${target} from the pending queue.` : `⚠️ ${target} was not in the pending queue.`),
    ]);
    return true;
  }

  const allowGroupMatch = userText.match(/^\/allowgroup\s+([CR][a-zA-Z0-9]{20,})$/i);
  if (allowGroupMatch) {
    const groupId = allowGroupMatch[1]!;
    await addAllowedGroup(groupId);
    console.warn("[admin] /allowgroup", { admin: userId, groupId });
    await replyOrPush(userId, replyToken, [textMsg(`✅ Added ${groupId} to allowed groups.`)])
    return true;
  }

  const removeGroupMatch = userText.match(/^\/removegroup\s+([CR][a-zA-Z0-9]{20,})$/i);
  if (removeGroupMatch) {
    const groupId = removeGroupMatch[1]!;
    await removeAllowedGroup(groupId);
    console.warn("[admin] /removegroup", { admin: userId, groupId });
    await replyOrPush(userId, replyToken, [textMsg(`🗑 Removed ${groupId} from allowed groups.`)])
    return true;
  }

  if (/^\/groups$/i.test(userText)) {
    const [allowed, discovered] = await Promise.all([listAllowedGroups(), listDiscoveredGroups()]);
    const adminGroupIds = getAdminGroupIds();
    const allIds = Array.from(new Set([...adminGroupIds, ...allowed, ...discovered]));
    const rows = allIds.map((groupId) => ({
      groupId,
      allowed: allowed.includes(groupId) || adminGroupIds.has(groupId),
      admin: adminGroupIds.has(groupId),
    }));
    console.warn("[admin] /groups", { admin: userId, total: rows.length, allowed: allowed.length, discovered: discovered.length });
    await replyOrPush(userId, replyToken, [groupsListFlex(rows)]);
    return true;
  }

  const promoCreateMatch = userText.match(/^\/promo\s+create\s+(\S+)(?:\s+(allowed|team))?(?:\s+(\d+))?(?:\s+(\d+))?$/i);
  if (promoCreateMatch) {
    const code = promoCreateMatch[1]!;
    const grant = (promoCreateMatch[2] as "allowed" | "team") ?? "team";
    const uses = Math.max(1, Number(promoCreateMatch[3] ?? 100));
    const days = Math.max(1, Number(promoCreateMatch[4] ?? 30));
    const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
    await createPromoCode(code, grant, uses, expiresAt, userId);
    console.warn("[admin] /promo create", { admin: userId, code, grant, uses, days });
    await replyOrPush(userId, replyToken, [textMsg(`✅ Created promo code \`${code.toUpperCase()}\` → ${grant}, ${uses} use${uses === 1 ? "" : "s"}, expires in ${days} day${days === 1 ? "" : "s"}.`)]);
    return true;
  }

  if (/^\/promos$/i.test(userText)) {
    console.warn("[admin] /promos", { admin: userId });
    const promos = await listPromoCodes();
    if (!promos.length) {
      await replyOrPush(userId, replyToken, [textMsg("No promo codes yet.")]);
      return true;
    }
    const lines = promos.map((p) => {
      const exp = p.expiresAt ? new Date(p.expiresAt).toISOString().slice(0, 10) : "never";
      return `\`${p.code}\` → ${p.grant}, ${p.usesLeft} left, expires ${exp}`;
    });
    await replyOrPush(userId, replyToken, [textMsg(`Promo codes (${promos.length}):\n\n${lines.join("\n")}`)]);
    return true;
  }

  const promoDeleteMatch = userText.match(/^\/promo\s+delete\s+(\S+)$/i);
  if (promoDeleteMatch) {
    const code = promoDeleteMatch[1]!;
    await deletePromoCode(code);
    console.warn("[admin] /promo delete", { admin: userId, code });
    await replyOrPush(userId, replyToken, [textMsg(`🗑 Deleted promo code \`${code.toUpperCase()}\`.`)]);
    return true;
  }

  // ─── /status <id> ─── diagnostic command
  const statusMatch = userText.match(new RegExp(`^/status\\s+(${LINE_ID_RE.source})$`, "i"));
  if (statusMatch) {
    const target = statusMatch[1]!;
    console.warn("[admin] /status", { admin: userId, target });
    const [allowed, onTrial, registered, team, settings] = await Promise.all([
      isAllowed(target),
      isOnTrial(target),
      (async () => {
        const all = await listAllUsers();
        return all.includes(target);
      })(),
      isTeamMember(target),
      getSettings(target).catch(() => null),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const [locks, activeTs] = await Promise.all([
      Promise.all([
        redis().get(`pushlock:${target}:morning_briefing:${today}`),
        redis().get(`pushlock:${target}:evening_summary:${today}`),
        redis().get(`pushlock:${target}:task_check_in:${today}`),
      ]),
      redis().get(`active:${target}`),
    ]);
    const activeAgo = activeTs ? `${Math.round((Date.now() - Number(activeTs)) / 60000)}m ago` : "never";
    const profile = await getProfile(target).catch(() => null);
    const lines = [
      `📊 Status for ${profile?.displayName ?? target}`,
      ``,
      `Admin: ${gate.isAdmin(target) ? "✅ yes" : "❌ no"}`,
      `Allowed: ${allowed ? "✅ yes" : "❌ no"}`,
      `Trial: ${onTrial ? "✅ yes" : "❌ no"}`,
      `Team: ${team ? "✅ yes" : "❌ no"}`,
      `In sweep registry: ${registered ? "✅ yes" : "❌ no"}`,
      `=`,
      `Timezone: ${settings?.timezone ?? "(default)"}`,
      `Morning: ${settings?.morningBriefingTime ?? "(disabled)"}`,
      `Evening: ${settings?.eveningSummaryEnabled ? settings.eveningSummaryTime : "(disabled)"}`,
      `LINE pushes: ${settings?.briefingChannels?.line !== false ? "✅ enabled" : "❌ disabled"}`,
      ``,
      `Last morning: ${settings?.lastMorningBriefingTs ? new Date(settings.lastMorningBriefingTs).toLocaleString("en-US", { timeZone: settings.timezone }) : "never"}`,
      `Last evening: ${settings?.lastEveningSummaryTs ? new Date(settings.lastEveningSummaryTs).toLocaleString("en-US", { timeZone: settings.timezone }) : "never"}`,
      ``,
      `Locks today: morning=${locks[0] ? "🔒" : "🔓"} evening=${locks[1] ? "🔒" : "🔓"} checkin=${locks[2] ? "🔒" : "🔓"}`,
      `Last activity: ${activeAgo}`,
    ];
    await replyOrPush(userId, replyToken, [textMsg(lines.join("\n"))]);
    return true;
  }

  // ─── /audit <id> [n] ─── compliance trace: full per-turn tool-call log
  const auditMatch = userText.match(new RegExp(`^/audit\\s+(${LINE_ID_RE.source})(?:\\s+(\\d+))?$`, "i"));
  if (auditMatch) {
    const target = auditMatch[1]!;
    console.warn("[admin] /audit", { admin: userId, target, requested: auditMatch[2] });
    const count = Math.min(Math.max(Number(auditMatch[2] ?? 5), 1), 100);
    const entries = await listAuditLog(target, { limit: count });
    if (entries.length === 0) {
      await replyOrPush(userId, replyToken, [textMsg(`No audit entries for ${target}.`)]);
      return true;
    }
    await replyOrPush(userId, replyToken, [textMsg(formatAuditEntries(target, entries))]);
    return true;
  }

  // ─── /force-briefing <id> [morning|evening] ─── manual trigger
  const forceMatch = userText.match(new RegExp(`^/force-briefing\\s+(${LINE_ID_RE.source})(?:\\s+(morning|evening))?$`, "i"));
  if (forceMatch) {
    const target = forceMatch[1]!;
    const kind = (forceMatch[2] ?? "morning").toLowerCase() as "morning" | "evening";
    console.warn("[admin] /force-briefing", { admin: userId, target, kind });
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
          language: settings.language,
        });
        const msgs: LineMessage[] = [briefingFlex("morning", briefing.text, { language: settings.language })];
        if (briefing.news.length > 0) msgs.push(newsFlex(briefing.news, "📰 Today's news"));
        if (briefing.inbox && briefing.inbox.length > 0) {
          msgs.push(gmailResultsFlex(briefing.inbox.map((m) => ({ ...m, unread: true }))));
        }
        const ok = await replyOrPush(target, "", msgs);
        await replyOrPush(userId, replyToken, [textMsg(ok === "failed" ? `❌ Push failed for ${target}` : `✅ Morning briefing sent to ${target}.`)]);
      } else {
        const summary = await buildEveningSummary(target, {
          timezone: settings.timezone,
          briefingLanguage: settings.briefingLanguage,
          language: settings.language,
        });
        if (!summary) {
          await replyOrPush(userId, replyToken, [textMsg(`⚠️ No evening summary generated for ${target}.`)]);
          return true;
        }
        const msgs: LineMessage[] = [briefingFlex("evening", summary.text, { language: settings.language })];
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

/** Verbose, per-turn technical trace for `/audit` — one block per entry with
 *  full tool call inputs/outputs so a reported bug is traceable from the log
 *  alone. Truncates long JSON blobs to keep each entry scannable in LINE. */
function formatAuditEntries(target: string, entries: AuditEntry[]): string {
  const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);
  const blocks = entries.map((e, idx) => {
    const when = new Date(e.ts).toISOString();
    const lines = [
      `── #${idx + 1} • ${when} • ${e.durationMs ?? "?"}ms${e.traceId ? ` • trace=${e.traceId}` : ""}`,
      `hint: ${e.hint ?? "(none — full registry)"}`,
      `user: ${clip(e.userMessage, 300)}`,
    ];
    if (e.toolCalls.length === 0) {
      lines.push("tools: (none called)");
    } else {
      lines.push(`tools (${e.toolCalls.length}):`);
      for (const tc of e.toolCalls) {
        lines.push(
          `  • ${tc.toolName} [${tc.ok ? "ok" : "ERROR"}]`,
          `    in:  ${clip(JSON.stringify(tc.input), 200)}`,
          `    out: ${clip(JSON.stringify(tc.output), 200)}`,
        );
      }
    }
    if (e.error) lines.push(`error: ${clip(e.error, 300)}`);
    lines.push(`reply: ${clip(e.reply, 300)}`);
    return lines.join("\n");
  });
  return `📜 Audit trail for ${target} (${entries.length} entries, newest first)\n\n${blocks.join("\n\n")}`;
}

/** `/myid` — anyone can look up their own LINE userId (to request access).
 *  Sends the ID as plain text so it can be selected, copied, and pasted to an admin.
 */
export async function handleMyId(userId: string, userText: string, replyToken: string): Promise<boolean> {
  if (!/^\/myid$/i.test(userText)) return false;
  console.warn("[myid] replied", { userId });
  await replyOrPush(userId, replyToken, [textMsg(userId)]);
  return true;
}
