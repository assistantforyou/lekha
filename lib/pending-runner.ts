import { GoogleAuthRequired, unwrapAuthRequired, errorMessage } from "@/lib/errors";
import { formatReconnectPrompt } from "@/lib/tools/google-auth";
import { sendEmail } from "@/lib/tools/email";
import { createCalendarEvent } from "@/lib/tools/calendar";
import { executeScheduleEmail } from "@/lib/tools/scheduled-email";
import type { PendingAction } from "@/lib/confirm";
import { logSent } from "@/lib/memory/sent-log";

/** Execute a queue of previously-confirmed pending actions in order. Returns user-facing reply. */
export async function executePendingAll(
  userId: string,
  actions: PendingAction[],
): Promise<string> {
  if (!actions.length) return "Nothing to confirm.";
  const lines: string[] = [];
  for (const action of actions) {
    lines.push(await executeOne(userId, action));
  }
  return lines.join("\n");
}

async function executeOne(userId: string, action: PendingAction): Promise<string> {
  if (action.kind === "send_email") {
    try {
      const r = await sendEmail(userId, action);
      const recipients = [
        ...action.to,
        ...(action.cc ?? []).map((c) => `cc:${c}`),
        ...(action.bcc ?? []).map((b) => `bcc:${b}`),
      ].join(", ");
      const att = action.attachments?.length
        ? ` with ${action.attachments.length} attachment(s)`
        : "";
      await logSent(userId, {
        kind: "email",
        summary: `${action.subject} → ${action.to.join(", ")}`,
        detail: {
          to: action.to,
          cc: action.cc,
          bcc: action.bcc,
          subject: action.subject,
          from: r.from,
          attachmentCount: (action.attachments?.length ?? 0) + (action.attachRecentMedia || action.attachRecentMediaIndexes?.length ? 1 : 0),
        },
      });
      return `✅ Sent to ${recipients} (from ${r.from})${att}.`;
    } catch (err) {
      if (unwrapAuthRequired(err)) {
        console.warn("[send] Google auth expired/revoked for user", userId, "—", errorMessage(err));
        return await formatReconnectPrompt(userId);
      }
      console.error("[send] failed", err);
      return `I couldn't send the email: ${errorMessage(err)}`;
    }
  }
  if (action.kind === "create_calendar_event") {
    try {
      const r = await createCalendarEvent(userId, action);
      await logSent(userId, {
        kind: "calendar_event",
        summary: action.summary,
        detail: {
          summary: action.summary,
          start: action.startISO,
          end: action.endISO,
          attendees: action.attendees,
          location: action.location,
          calendar: r.from,
          htmlLink: r.htmlLink,
        },
      });
      const intro = `✅ Added to ${r.from}'s calendar.`;
      const hint = `(open the link below while signed into Google as ${r.from} — otherwise Google will say "event not found")`;
      return r.htmlLink ? `${intro}\n${hint}\n${r.htmlLink}` : intro;
    } catch (err) {
      if (unwrapAuthRequired(err)) {
        console.warn("[calendar] Google auth expired/revoked for user", userId, "—", errorMessage(err));
        return await formatReconnectPrompt(userId);
      }
      console.error("[calendar] failed", err);
      return `I couldn't create the calendar event: ${errorMessage(err)}`;
    }
  }
  if (action.kind === "schedule_email") {
    try {
      const r = await executeScheduleEmail(userId, action);
      return `✅ Scheduled email "${action.subject}" for ${r.sendAt}.`;
    } catch (err) {
      if (unwrapAuthRequired(err)) {
        console.warn("[schedule_email] Google auth expired/revoked for user", userId, "—", errorMessage(err));
        return await formatReconnectPrompt(userId);
      }
      console.error("[schedule_email] failed", err);
      return `I couldn't schedule the email: ${errorMessage(err)}`;
    }
  }
  return "Done.";
}
