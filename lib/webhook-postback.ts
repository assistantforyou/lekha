import { replyOrPush, text as textMsg } from "@/lib/line/client";
import { parsePostbackData } from "@/lib/line/flex";
import { clearPending, getPending } from "@/lib/confirm";
import { executePendingAll } from "@/lib/pending-runner";
import { completeTask, reopenTask, completeAllOpenTasks, listTasks } from "@/lib/memory/tasks";
import { appendTurn } from "@/lib/memory/history";
import { appendArchive } from "@/lib/memory/archive";
import { redis } from "@/lib/memory/redis";
import { withGoogleClient } from "@/lib/tools/with-google";
import { google } from "googleapis";
import type { LineEvent } from "@/lib/line/types";

const GMAIL_MODIFY = "https://www.googleapis.com/auth/gmail.modify";

function archiveNote(userId: string, summary: string) {
  const now = Date.now();
  appendArchive(userId, { fromTs: now, toTs: now, summary }).catch(() => {});
}

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

  // ── confirm:yes / confirm:no ──────────────────────────────────────────
  if (verb === "confirm") {
    const action = args[0];
    if (action === "yes") {
      const pending = await getPending(userId);
      if (pending.length === 0) {
        await replyOrPush(userId, event.replyToken, [textMsg("Nothing pending to confirm.")]);
        return;
      }
      const result = await executePendingAll(userId, pending);
      await clearPending(userId);
      await replyOrPush(userId, event.replyToken, [textMsg(result)]);
      await appendTurn(userId, { role: "user", content: "(tapped Yes)", ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: result, ts: Date.now() });
      return;
    }
    if (action === "no") {
      const pending = await getPending(userId);
      await clearPending(userId);
      await replyOrPush(userId, event.replyToken, [
        textMsg(`Cancelled ${pending.length <= 1 ? "that" : `all ${pending.length}`}.`),
      ]);
      return;
    }
  }

  // ── task:done:<id> / task:reopen:<id> / task:done:all ─────────────────
  if (verb === "task") {
    const action = args[0];
    const id = args[1];
    if (action === "done" && id === "all") {
      const completed = await completeAllOpenTasks(userId);
      await replyOrPush(userId, event.replyToken, [
        textMsg(
          completed.length === 0
            ? "No open tasks to mark done."
            : `✓ Marked ${completed.length} task${completed.length === 1 ? "" : "s"} done.`,
        ),
      ]);
      return;
    }
    if (action === "done" && id) {
      const t = await completeTask(userId, id);
      await replyOrPush(userId, event.replyToken, [
        textMsg(t ? `✓ Done: ${t.title}` : "Couldn't find that task — it may have been deleted."),
      ]);
      return;
    }
    if (action === "reopen" && id) {
      const t = await reopenTask(userId, id);
      await replyOrPush(userId, event.replyToken, [
        textMsg(t ? `Reopened: ${t.title}` : "Couldn't find that task — it may have been deleted."),
      ]);
      return;
    }
  }

  // ── checkin:done:<id> / checkin:skip:<id> / checkin:done:all ──────────
  if (verb === "checkin") {
    const action = args[0];
    const id = args[1];
    const dateStr = new Date().toISOString().slice(0, 10);
    if (action === "done" && id === "all") {
      const completed = await completeAllOpenTasks(userId);
      if (completed.length > 0) {
        archiveNote(
          userId,
          `Bulk check-in completed ${completed.length} task(s) on ${dateStr}: ${completed.map((t) => `"${t.title}"`).join(", ")}`,
        );
      }
      await replyOrPush(userId, event.replyToken, [
        textMsg(
          completed.length === 0
            ? "All clear — no open tasks! 🎉"
            : `✓ Marked ${completed.length} task${completed.length === 1 ? "" : "s"} done. Nice work!`,
        ),
      ]);
      return;
    }
    if (action === "done" && id) {
      const t = await completeTask(userId, id);
      if (t) archiveNote(userId, `Task completed via check-in: "${t.title}" (${dateStr})`);
      await replyOrPush(userId, event.replyToken, [
        textMsg(t ? `✓ Done: ${t.title}` : "Couldn't find that task — may have already been removed."),
      ]);
      return;
    }
    if (action === "skip" && id) {
      const tasks = await listTasks(userId, "all");
      const t = tasks.find((task) => task.id === id);
      if (t) archiveNote(userId, `Task not completed at check-in: "${t.title}" (${dateStr}) — still open`);
      await replyOrPush(userId, event.replyToken, [
        textMsg(t ? `Got it — "${t.title}" stays on your list.` : "Noted."),
      ]);
      return;
    }
  }

  // ── gmail:archive:<msgId> ─────────────────────────────────────────────
  if (verb === "gmail") {
    const action = args[0];
    const msgId = args[1];
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
        await replyOrPush(userId, event.replyToken, [textMsg("Archived.")]);
      } else {
        await replyOrPush(userId, event.replyToken, [textMsg("Couldn't archive — try reconnecting Google.")]);
      }
      return;
    }
    if (action === "reply" && msgId) {
      // Seed the conversation so the agent knows which thread to reply to.
      await appendTurn(userId, {
        role: "user",
        content: `I want to reply to email message id ${msgId}. Please draft a reply.`,
        ts: Date.now(),
      });
      await replyOrPush(userId, event.replyToken, [
        textMsg("What would you like to say in the reply? I'll draft it for you."),
      ]);
      return;
    }
  }

  // ── list:rm:<listName>:<itemIdx> ──────────────────────────────────────
  if (verb === "list") {
    const action = args[0];
    const listName = args[1];
    const idxStr = args[2];
    if (action === "rm" && listName && idxStr !== undefined) {
      const idx = parseInt(idxStr, 10);
      if (!Number.isFinite(idx)) {
        await replyOrPush(userId, event.replyToken, [textMsg("Couldn't remove that item — bad index.")]);
        return;
      }
      const k = `lists:${userId}:${listName.toLowerCase().trim()}`;
      const items = await redis().lrange<string>(k, 0, -1);
      const item = items[idx];
      if (!item) {
        await replyOrPush(userId, event.replyToken, [textMsg("That item isn't on the list any more.")]);
        return;
      }
      await redis().lrem(k, 1, item);
      await replyOrPush(userId, event.replyToken, [textMsg(`Removed "${item}" from ${listName}.`)]);
      return;
    }
  }

  // ── event:remind:<eventId> ────────────────────────────────────────────
  // We don't have event details in the postback — surface a prompt so the
  // agent can pull the event and schedule the reminder with proper context.
  if (verb === "event") {
    const action = args[0];
    const eventId = args[1];
    if (action === "remind" && eventId) {
      await appendTurn(userId, {
        role: "user",
        content: `Set a reminder for the calendar event with id ${eventId}. Look it up and set a 1-hour reminder before it starts.`,
        ts: Date.now(),
      });
      await replyOrPush(userId, event.replyToken, [
        textMsg("On it — I'll set a 1-hour reminder for that event. One sec…"),
      ]);
      return;
    }
  }

  // ── drive, contact, sent — not yet directly wired ─────────────────────
  if (verb === "drive" || verb === "contact" || verb === "sent") {
    await replyOrPush(userId, event.replyToken, [
      textMsg("Type what you want and I'll do it (e.g. \"share that file\", \"email that contact\")."),
    ]);
    return;
  }

  console.warn("[postback] unhandled verb", { verb, args });
  await replyOrPush(userId, event.replyToken, [textMsg("I didn't understand that button. Try typing your request instead.")]);
}
