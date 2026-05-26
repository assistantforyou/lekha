import { reply, text as textMsg } from "@/lib/line/client";
import { parsePostbackData } from "@/lib/line/flex";
import { clearPending, getPending } from "@/lib/confirm";
import { executePendingAll } from "@/lib/pending-runner";
import { completeTask, reopenTask, completeAllOpenTasks, listTasks } from "@/lib/memory/tasks";
import { appendTurn } from "@/lib/memory/history";
import type { LineEvent } from "@/lib/line/types";

/**
 * Handle a LINE postback (Flex/QR button tap). Routes by verb prefix.
 * Convention: `<verb>[:<arg>[:<arg>...]]` — see lib/line/flex/index.ts.
 *
 * Many verbs (gmail:*, list:rm, event:remind, drive:*, contact:*) are
 * recognized but currently route to a "type to confirm" prompt so the agent
 * can pick up the intent — implementing each as a direct postback handler
 * would duplicate tool logic. The two foundational verbs (confirm:*, task:*)
 * act directly.
 */
export async function handlePostback(event: LineEvent): Promise<void> {
  if (event.type !== "postback") return;
  if (!("replyToken" in event) || !event.replyToken) return;
  if (!("postback" in event)) return;
  const userId = event.source?.userId;
  if (!userId) return;
  const data = event.postback.data ?? "";
  const { verb, args } = parsePostbackData(data);

  // confirm:yes / confirm:no — drain or clear the pending action queue.
  if (verb === "confirm") {
    const action = args[0];
    if (action === "yes") {
      const pending = await getPending(userId);
      if (pending.length === 0) {
        await reply(event.replyToken, [textMsg("Nothing pending to confirm.")]);
        return;
      }
      const result = await executePendingAll(userId, pending);
      await clearPending(userId);
      await reply(event.replyToken, [textMsg(result)]);
      await appendTurn(userId, { role: "user", content: "(tapped Yes)", ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: result, ts: Date.now() });
      return;
    }
    if (action === "no") {
      const pending = await getPending(userId);
      await clearPending(userId);
      await reply(event.replyToken, [
        textMsg(`Cancelled ${pending.length <= 1 ? "that" : `all ${pending.length}`}.`),
      ]);
      return;
    }
  }

  // task:done:<id> / task:reopen:<id> / task:done:all
  if (verb === "task") {
    const action = args[0];
    const id = args[1];
    if (action === "done" && id === "all") {
      const completed = await completeAllOpenTasks(userId);
      await reply(event.replyToken, [
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
      await reply(event.replyToken, [
        textMsg(t ? `✓ Done: ${t.title}` : "Couldn't find that task — it may have been deleted."),
      ]);
      return;
    }
    if (action === "reopen" && id) {
      const t = await reopenTask(userId, id);
      await reply(event.replyToken, [
        textMsg(t ? `Reopened: ${t.title}` : "Couldn't find that task — it may have been deleted."),
      ]);
      return;
    }
  }

  // checkin:done:<id> / checkin:skip:<id> / checkin:done:all
  if (verb === "checkin") {
    const action = args[0];
    const id = args[1];
    if (action === "done" && id === "all") {
      const completed = await completeAllOpenTasks(userId);
      await reply(event.replyToken, [
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
      await reply(event.replyToken, [
        textMsg(t ? `✓ Done: ${t.title}` : "Couldn't find that task — may have already been removed."),
      ]);
      return;
    }
    if (action === "skip" && id) {
      // "Not yet" — keep the task open. Nothing to do except acknowledge.
      const tasks = await listTasks(userId, "all");
      const t = tasks.find((task) => task.id === id);
      await reply(event.replyToken, [
        textMsg(t ? `Got it — "${t.title}" stays on your list.` : "Noted."),
      ]);
      return;
    }
  }

  // Verbs whose handlers need agent/tool context — for now acknowledge politely
  // and tell the user to type the equivalent action. Future work: dispatch
  // directly to the corresponding tool.
  if (verb === "gmail" || verb === "drive" || verb === "event" || verb === "list" || verb === "contact" || verb === "sent") {
    await reply(event.replyToken, [
      textMsg(
        "Got it — that quick-action isn't wired up yet. Type what you want and I'll do it (e.g. \"archive that email\", \"remind me about that event 1h before\").",
      ),
    ]);
    return;
  }

  console.warn("[postback] unhandled verb", { verb, args });
  await reply(event.replyToken, [textMsg("I didn't understand that button. Try typing your request instead.")]);
}
