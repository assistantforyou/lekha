import type { LineMessage } from "@/lib/line/client";
import {
  taskListFlex,
  type TaskRow,
  listItemsFlex,
  gmailResultsFlex,
  calendarEventsFlex,
  newsFlex,
  briefingFlex,
} from "@/lib/line/flex";
import { extractToolValue } from "@/lib/llm/agent";

type StepLike = {
  toolResults?: { toolName?: string; output?: unknown }[];
};

/** Strip markdown / extraction artifacts from a Tavily content snippet. */
function cleanSnippet(s: string): string {
  return s
    .replace(/^#+\s*/gm, "")        // strip leading # headers
    .replace(/\*{1,2}/g, "")        // strip * **
    .replace(/\s*\|\s*\S+\s*$/g, "") // strip trailing "| SourceName"
    .replace(/\n+/g, " ")           // collapse newlines
    .replace(/\s{2,}/g, " ")        // collapse whitespace
    .trim()
    .slice(0, 140);
}

/**
 * Walk every tool result emitted by the agent and convert list-style outputs
 * into Flex bubbles/carousels. Kept separate from runAgent so the mapping
 * table doesn't bloat the main orchestrator.
 *
 * Also returns `suppressText: true` for tools whose Flex IS the full reply
 * (morning briefing, news search) so the caller can omit the model's text blob.
 */
export function buildFlexFromToolResults(result: { steps?: StepLike[] }): {
  messages: LineMessage[];
  suppressText: boolean;
} {
  const out: LineMessage[] = [];
  const seen = new Set<string>();
  let suppressText = false;

  for (const step of result.steps ?? []) {
    for (const tr of step.toolResults ?? []) {
      if (!tr) continue;
      const toolName = tr.toolName ?? "";
      if (seen.has(toolName)) continue; // one Flex per tool per turn — avoid duplicates
      const v = extractToolValue(tr.output);
      if (!v || typeof v !== "object") continue;
      const value = v as Record<string, unknown>;
      if (value.ok === false) continue;

      // ── Morning briefing ───────────────────────────────────────────────
      if (toolName === "get_morning_briefing" && value.briefingType === "morning") {
        if (value.empty) continue; // Nothing to show
        const text = String(value.text ?? "");
        const news = Array.isArray(value.news) ? value.news as Array<{ title: string; url: string; source: string }> : [];
        const inbox = Array.isArray(value.inbox) ? value.inbox as Array<{ id: string; from: string; subject: string; snippet: string }> : [];
        if (text) out.push(briefingFlex("morning", text));
        if (news.length > 0) out.push(newsFlex(news, "📰 Today's news"));
        if (inbox.length > 0) out.push(gmailResultsFlex(inbox.map((m) => ({ ...m, unread: true }))));
        suppressText = true;
        seen.add(toolName);
        continue;
      }

      // ── Task list ──────────────────────────────────────────────────────
      if (toolName === "list_tasks" && Array.isArray(value.tasks)) {
        const tasks = (value.tasks as Array<Record<string, unknown>>).map<TaskRow>((t) => ({
          id: String(t.id ?? ""),
          title: String(t.title ?? ""),
          done: Boolean(t.doneAt),
        }));
        if (tasks.length > 0) {
          out.push(taskListFlex(tasks));
          seen.add(toolName);
        }
        continue;
      }

      // ── Named list ────────────────────────────────────────────────────
      if (toolName === "list_items" && Array.isArray(value.items)) {
        const items = (value.items as unknown[]).map((s) => String(s));
        const listName = String(value.list ?? "list");
        if (items.length > 0) {
          out.push(listItemsFlex(listName, items));
          seen.add(toolName);
        }
        continue;
      }

      // ── Gmail search ──────────────────────────────────────────────────
      if (toolName === "gmail_search" && Array.isArray(value.messages)) {
        const msgs = (value.messages as Array<Record<string, unknown>>).map((m) => ({
          id: String(m.id ?? ""),
          from: String(m.from ?? ""),
          subject: String(m.subject ?? "(no subject)"),
          snippet: String(m.snippet ?? ""),
          unread: Boolean(m.unread),
          date: String(m.date ?? ""),
        }));
        if (msgs.length > 0) {
          out.push(gmailResultsFlex(msgs));
          seen.add(toolName);
        }
        continue;
      }

      // ── Calendar events ───────────────────────────────────────────────
      if (toolName === "list_upcoming_events" && Array.isArray(value.events)) {
        const events = (value.events as Array<Record<string, unknown>>).map((e) => ({
          id: String(e.id ?? ""),
          summary: String(e.summary ?? "(no title)"),
          start: String(e.start ?? ""),
          end: String(e.end ?? ""),
          location: (e.location as string | null) ?? null,
          htmlLink: (e.htmlLink as string | null) ?? null,
        }));
        if (events.length > 0) {
          out.push(calendarEventsFlex(events));
          seen.add(toolName);
        }
        continue;
      }

      // ── News search ───────────────────────────────────────────────────
      if (
        (toolName === "news_search" || toolName === "search_news") &&
        Array.isArray(value.stories ?? value.results)
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = ((value.stories ?? value.results) as any[]) ?? [];
        const stories = raw
          .map((s) => ({
            title: String(s.title ?? ""),
            url: String(s.url ?? ""),
            snippet: cleanSnippet(String(s.snippet ?? s.content ?? "")),
            source: s.source ? String(s.source) : undefined,
          }))
          .filter((s) => s.url && s.title);
        if (stories.length > 0) {
          out.push(newsFlex(stories));
          suppressText = true;
          seen.add(toolName);
        }
        continue;
      }
    }
  }

  // LINE allows max 5 messages per reply — cap to be safe (text + up to 4 Flex).
  return { messages: out.slice(0, 4), suppressText };
}

const ACTION_TOOLS = new Set([
  "add_task",
  "complete_task",
  "reopen_task",
  "delete_task",
  "complete_all_open_tasks",
  "remember",
  "forget_memory",
  "set_reminder",
  "cancel_reminder",
  "set_recurring_reminder",
  "schedule_email",
]);

const DISPLAY_TOOLS = new Set([
  "list_tasks",
  "gmail_search",
  "news_search",
  "search_news",
  "list_upcoming_events",
  "get_morning_briefing",
]);

/**
 * Build a short "what next?" quick-reply rail based on what tools just ran.
 * Returns at most 4 suggestions — LINE allows up to 13 but more than 4 looks
 * like a wall.
 *
 * When the model is asking a clarifying question (no display/action tool ran,
 * text ends with ?) we add YES/NO so the user can tap instead of type.
 */
export function buildFollowUps(
  toolNames: string[],
  ctx: { confirmDraft: boolean; modelText?: string },
): { label: string; text: string }[] {
  if (ctx.confirmDraft) return []; // confirm Flex already drives the next step
  const names = new Set(toolNames);
  const out: { label: string; text: string }[] = [];
  const push = (label: string, text: string) => {
    if (out.find((b) => b.label === label)) return;
    if (out.length < 4) out.push({ label, text });
  };

  if (names.has("list_tasks")) {
    push("Add task", "add a task");
    push("Clear done", "delete all completed tasks");
  }
  if (names.has("gmail_search")) {
    push("Reply to first", "reply to the first email");
    push("Show unread", "show me my unread emails");
  }
  if (names.has("list_upcoming_events") || names.has("calendar_today")) {
    push("Tomorrow?", "what's on my calendar tomorrow");
    push("Add event", "add a calendar event");
  }
  if (names.has("list_items")) {
    push("Add item", "add to this list");
    push("Clear list", "clear this list");
  }
  if (names.has("weather") || names.has("get_weather")) {
    push("Tomorrow?", "weather tomorrow");
    push("This week?", "weather this week");
  }
  if (names.has("news_search") || names.has("search_news")) {
    push("More like this", "show me more news on this");
  }
  if (names.has("get_morning_briefing")) {
    push("What's on my calendar?", "what's on my calendar today");
    push("Check my inbox", "summarize my recent unread email");
  }

  // After any state-changing action, offer a generic "what's next" prompt.
  if (out.length === 0 && toolNames.some((t) => ACTION_TOOLS.has(t))) {
    push("What's next?", "what should I do next");
  }

  // When model is asking a clarifying question (no display/action tool ran),
  // add YES/NO quick replies so user can tap instead of type.
  const isAskingQuestion =
    ctx.modelText &&
    ctx.modelText.includes("?") &&
    !toolNames.some((t) => DISPLAY_TOOLS.has(t) || ACTION_TOOLS.has(t));
  if (isAskingQuestion && out.length === 0) {
    push("Yes", "yes");
    push("No, cancel", "no");
  }

  return out;
}
