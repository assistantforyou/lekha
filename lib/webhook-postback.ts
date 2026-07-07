import { replyOrPush, text as textMsg, getProfile } from "@/lib/line/client";
import { parsePostbackData, curatedDemoAnswer } from "@/lib/line/flex";
import { handleSettingsPostback } from "@/lib/settings-menu";
import { isOnboarded, startOnboarding } from "@/lib/onboarding";
import { handleTutorialPostback } from "@/lib/tutorial";
import { loadFacts, displayOrder } from "@/lib/memory/facts";
import { clearPending, getPending } from "@/lib/confirm";
import { executePendingAll } from "@/lib/pending-runner";
import { completeTask, reopenTask, completeAllOpenTasks, listTasks } from "@/lib/memory/tasks";
import { appendTurn } from "@/lib/memory/history";
import { appendArchive } from "@/lib/memory/archive";
import { redis } from "@/lib/memory/redis";
import { withGoogleClient } from "@/lib/tools/with-google";
import { google } from "googleapis";
import type { LineEvent } from "@/lib/line/types";
import { buildGate } from "@/lib/gate";
import { approvePending, denyPending, isAllowed } from "@/lib/memory/allowlist";
import { isOnTrial, startTrial } from "@/lib/trial";

const GMAIL_MODIFY = "https://www.googleapis.com/auth/gmail.modify";

function archiveNote(userId: string, summary: string) {
  const now = Date.now();
  appendArchive(userId, { fromTs: now, toTs: now, summary }).catch(() => {});
}

type Ctx = {
  userId: string;
  replyToken: string;
  args: string[];
};

function mkReply(userId: string, replyToken: string) {
  return (text: string) => replyOrPush(userId, replyToken, [textMsg(text)]);
}

async function handleConfirm({ userId, replyToken, args }: Ctx): Promise<void> {
  const action = args[0];
  const reply = mkReply(userId, replyToken);
  if (action === "yes") {
    const pending = await getPending(userId);
    if (pending.length === 0) {
      await reply("Nothing pending to confirm.");
      return;
    }
    const result = await executePendingAll(userId, pending);
    await clearPending(userId);
    await reply(result);
    await appendTurn(userId, { role: "user", content: "(tapped Yes)", ts: Date.now() });
    await appendTurn(userId, { role: "assistant", content: result, ts: Date.now() });
    return;
  }
  if (action === "no") {
    const pending = await getPending(userId);
    await clearPending(userId);
    await reply(`Cancelled ${pending.length <= 1 ? "that" : `all ${pending.length}`}.`);
  }
}

async function handleTask({ userId, replyToken, args }: Ctx): Promise<void> {
  const action = args[0];
  const id = args[1];
  const reply = mkReply(userId, replyToken);
  if (action === "done" && id === "all") {
    const completed = await completeAllOpenTasks(userId);
    await reply(
      completed.length === 0
        ? "No open tasks to mark done."
        : `✓ Marked ${completed.length} task${completed.length === 1 ? "" : "s"} done.`,
    );
    return;
  }
  if (action === "done" && id) {
    const t = await completeTask(userId, id);
    await reply(t ? `✓ Done: ${t.title}` : "Couldn't find that task — it may have been deleted.");
    return;
  }
  if (action === "reopen" && id) {
    const t = await reopenTask(userId, id);
    await reply(t ? `Reopened: ${t.title}` : "Couldn't find that task — it may have been deleted.");
  }
}

async function handleCheckin({ userId, replyToken, args }: Ctx): Promise<void> {
  const action = args[0];
  const id = args[1];
  const dateStr = new Date().toISOString().slice(0, 10);
  const reply = mkReply(userId, replyToken);
  if (action === "done" && id === "all") {
    const completed = await completeAllOpenTasks(userId);
    if (completed.length > 0) {
      archiveNote(
        userId,
        `Bulk check-in completed ${completed.length} task(s) on ${dateStr}: ${completed.map((t) => `"${t.title}"`).join(", ")}`,
      );
    }
    await reply(
      completed.length === 0
        ? "All clear — no open tasks! 🎉"
        : `✓ Marked ${completed.length} task${completed.length === 1 ? "" : "s"} done. Nice work!`,
    );
    return;
  }
  if (action === "done" && id) {
    const t = await completeTask(userId, id);
    if (t) archiveNote(userId, `Task completed via check-in: "${t.title}" (${dateStr})`);
    await reply(t ? `✓ Done: ${t.title}` : "Couldn't find that task — may have already been removed.");
    return;
  }
  if (action === "skip" && id) {
    const tasks = await listTasks(userId, "all");
    const t = tasks.find((task) => task.id === id);
    if (t) archiveNote(userId, `Task not completed at check-in: "${t.title}" (${dateStr}) — still open`);
    await reply(t ? `Got it — "${t.title}" stays on your list.` : "Noted.");
  }
}

async function handleGmail({ userId, replyToken, args }: Ctx): Promise<void> {
  const action = args[0];
  const msgId = args[1];
  const reply = mkReply(userId, replyToken);
  if (action === "archive" && msgId) {
    const result = await withGoogleClient(userId, undefined, [GMAIL_MODIFY], async ({ client }) => {
      const gmail = google.gmail({ version: "v1", auth: client });
      await gmail.users.messages.modify({
        userId: "me",
        id: msgId,
        requestBody: { removeLabelIds: ["INBOX"] },
      });
      return { ok: true as const };
    });
    if (result && typeof result === "object" && "ok" in result && result.ok) {
      await reply("Archived.");
    } else {
      await reply("Couldn't archive — try reconnecting Google.");
    }
    return;
  }
  if (action === "reply" && msgId) {
    await appendTurn(userId, {
      role: "user",
      content: `I want to reply to email message id ${msgId}. Please draft a reply.`,
      ts: Date.now(),
    });
    await reply("What would you like to say in the reply? I'll draft it for you.");
  }
}

async function handleList({ userId, replyToken, args }: Ctx): Promise<void> {
  const action = args[0];
  const listName = args[1];
  const idxStr = args[2];
  const reply = mkReply(userId, replyToken);
  if (action === "rm" && listName && idxStr !== undefined) {
    const idx = parseInt(idxStr, 10);
    if (!Number.isFinite(idx)) {
      await reply("Couldn't remove that item — bad index.");
      return;
    }
    const k = `lists:${userId}:${listName.toLowerCase().trim()}`;
    const items = await redis().lrange<string>(k, 0, -1);
    const item = items[idx];
    if (!item) {
      await reply("That item isn't on the list any more.");
      return;
    }
    await redis().lrem(k, 1, item);
    await reply(`Removed "${item}" from ${listName}.`);
  }
}

async function handleEvent({ userId, replyToken, args }: Ctx): Promise<void> {
  const action = args[0];
  const eventId = args[1];
  const reply = mkReply(userId, replyToken);
  if (action === "remind" && eventId) {
    await appendTurn(userId, {
      role: "user",
      content: `Set a reminder for the calendar event with id ${eventId}. Look it up and set a 1-hour reminder before it starts.`,
      ts: Date.now(),
    });
    await reply("On it — I'll set a 1-hour reminder for that event. One sec…");
  }
}

const LINE_ID_RE = /^U[a-f0-9]{32}$/i;

async function handlePending({ userId, replyToken, args }: Ctx): Promise<void> {
  const reply = mkReply(userId, replyToken);
  const gate = buildGate();
  if (!gate.isAdmin(userId)) {
    await reply("Admin only.");
    return;
  }
  const action = args[0];
  const targetId = args[1];
  if (!targetId || !LINE_ID_RE.test(targetId)) {
    await reply("Invalid user ID.");
    return;
  }
  if (action === "allow") {
    await approvePending(targetId);
    const profile = await getProfile(targetId).catch(() => null);
    const name = profile?.displayName ?? "";
    if (!(await isOnboarded(targetId))) {
      await startOnboarding(targetId, "", name);
    } else {
      await replyOrPush(targetId, "", [
        textMsg(
          `Hi${name ? ` ${name}` : ""}! You're all set — welcome to Lekha 👋\n\nI can set reminders, search the web, look up stocks or weather, read photos, and more.\n\nType "help" to see everything I can do. To connect Google (Gmail, Calendar, Drive), type "connect google".`,
        ),
      ]);
    }
    await reply(`✅ Approved${name ? ` ${name}` : ""}.`);
    return;
  }
  if (action === "deny") {
    await denyPending(targetId);
    const profile = await getProfile(targetId).catch(() => null);
    const name = profile?.displayName ?? targetId.slice(0, 10);
    await reply(`🗑 Denied ${name}.`);
  }
}

async function handleHelpDemo({ userId, replyToken, args }: Ctx): Promise<void> {
  const id = args[0];
  const reply = mkReply(userId, replyToken);
  if (!id) {
    await reply("I didn't understand that demo button.");
    return;
  }

  if (id === "memory") {
    const facts = await loadFacts(userId);
    const ordered = displayOrder(facts.facts);
    if (ordered.length === 0) {
      await reply("I don't have anything stored about you yet. Tell me something — a preference, a routine, an important person — and I'll remember it.");
      return;
    }
    const lines = ordered.slice(0, 10).map((f) => `• ${f.content}`);
    await reply(`Here's what I actually remember about you:\n${lines.join("\n")}\n\nYou can add more anytime by just telling me.`);
    return;
  }

  const answer = curatedDemoAnswer(id);
  await reply(answer ?? "Try typing your request and I'll do it for real.");
}

async function handleFallback({ userId, replyToken }: Ctx): Promise<void> {
  await mkReply(userId, replyToken)("Type what you want and I'll do it (e.g. \"share that file\", \"email that contact\").");
}

async function handleSettings({ userId, replyToken, args }: Ctx): Promise<void> {
  await handleSettingsPostback(userId, replyToken, args);
}

async function handleTutorial({ userId, replyToken, args }: Ctx): Promise<void> {
  await handleTutorialPostback(userId, replyToken, args);
}

async function handleTrial({ userId, replyToken, args }: Ctx): Promise<void> {
  const action = args[0];
  if (action !== "start") {
    await mkReply(userId, replyToken)("Tap the free trial button to start.");
    return;
  }
  if (await isAllowed(userId)) {
    await mkReply(userId, replyToken)("You're already subscribed. Enjoy unlimited messages!");
    return;
  }
  if (await isOnTrial(userId)) {
    await mkReply(userId, replyToken)("Your free trial is already active. Type /tutorial to restart setup.");
    return;
  }
  await startTrial(userId, replyToken);
}

const HANDLERS: Record<string, ((ctx: Ctx) => Promise<void>) | undefined> = {
  confirm: handleConfirm,
  settings: handleSettings,
  tutorial: handleTutorial,
  trial: handleTrial,
  task: handleTask,
  checkin: handleCheckin,
  gmail: handleGmail,
  list: handleList,
  event: handleEvent,
  pending: handlePending,
  "help-demo": handleHelpDemo,
  drive: handleFallback,
  contact: handleFallback,
  sent: handleFallback,
};

/**
 * Handle a LINE postback (Flex/QR button tap). Routes by verb prefix.
 * Convention: `<verb>[:<arg>[:<arg>...]]` — see lib/line/flex/index.ts.
 */
export async function handlePostback(event: LineEvent): Promise<void> {
  if (event.type !== "postback") return;
  if (!("replyToken" in event) || !event.replyToken) return;
  if (!("postback" in event)) return;
  const userId = event.source?.userId;
  if (!userId) return;
  const data = event.postback.data ?? "";
  const { verb, args } = parsePostbackData(data);

  console.warn("[postback] routing", { userId, verb, args: args.join(":"), hasReplyToken: !!event.replyToken });
  const handler = HANDLERS[verb];
  if (handler) {
    await handler({ userId, replyToken: event.replyToken, args });
  } else {
    console.warn("[postback] unhandled verb", { verb, args });
    await mkReply(userId, event.replyToken)("I didn't understand that button. Try typing your request instead.");
  }
}
