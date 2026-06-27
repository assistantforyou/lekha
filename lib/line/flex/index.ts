export { confirmCancelFlex } from "./confirm-cancel";
export { taskListFlex, type TaskRow } from "./task-list";
export { signupGateFlex } from "./signup-gate";
export { listItemsFlex } from "./list-items";
export { gmailResultsFlex, type GmailRow } from "./gmail-results";
export { calendarEventsFlex, type CalendarEventRow } from "./calendar-events";
export { briefingFlex } from "./briefing";
export { newsFlex, type NewsRow } from "./news";
export { taskCheckinFlex, type CheckInRow } from "./task-checkin";
export { pendingUsersFlex, type PendingUserRow } from "./pending-users";
export { helpFlex, curatedAnswer, HELP_EXAMPLES, type HelpExample } from "./help";

/**
 * Parse a LINE postback `data` payload. Convention:
 *   <verb>[:<arg>[:<arg>...]]
 * Postback `data` is capped at 300 chars by LINE — keep payloads short
 * (use IDs, not full content).
 *
 * Examples:
 *   "confirm:yes"             → { verb: "confirm", args: ["yes"] }
 *   "task:done:t_abc"         → { verb: "task", args: ["done", "t_abc"] }
 *   "reminder:cancel:r_xyz"   → { verb: "reminder", args: ["cancel", "r_xyz"] }
 */
export function parsePostbackData(data: string): { verb: string; args: string[] } {
  const parts = data.split(":");
  return { verb: parts[0] ?? "", args: parts.slice(1) };
}
