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
import { buildPlacesFlex, type PlaceItem } from "@/lib/line/places-flex";
import { extractToolValue } from "@/lib/llm/agent";

type StepLike = {
  toolResults?: { toolName?: string; output?: unknown }[];
};

function looksLikeNewsRequest(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(news|headlines?|breaking|latest\s+news|current events|what'?s happening|top\s+\d+\s+news|finance news|stock news|market news|world news|today'?s news|news today)\b/i.test(
    lower,
  );
}

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
export function buildFlexFromToolResults(
  result: { steps?: StepLike[] },
  timezone?: string,
  opts?: { userText?: string },
): {
  messages: LineMessage[];
  suppressText: boolean;
} {
  const out: LineMessage[] = [];
  const seen = new Set<string>();
  let suppressText = false;
  const userText = opts?.userText ?? "";

  let renderFlexCount = 0;

  for (const step of result.steps ?? []) {
    for (const tr of step.toolResults ?? []) {
      if (!tr) continue;
      const toolName = tr.toolName ?? "";
      const v = extractToolValue(tr.output);
      if (!v || typeof v !== "object") continue;
      const value = v as Record<string, unknown>;
      if (value.ok === false) continue;

      // ── Model-generated Flex (render_flex) — allow multiple per turn ──
      if (toolName === "render_flex" && renderFlexCount < 3) {
        out.push({
          type: "flex",
          altText: String(value.altText ?? "Card"),
          contents: value.contents as object,
        } as LineMessage);
        renderFlexCount++;
        continue;
      }

      if (seen.has(toolName)) continue; // one Flex per tool per turn — avoid duplicates

      // ── Morning briefing ───────────────────────────────────────────────
      if (toolName === "get_morning_briefing" && value.briefingType === "morning") {
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

      // ── Evening summary ────────────────────────────────────────────────
      if (toolName === "get_evening_summary" && value.briefingType === "evening") {
        const text = String(value.text ?? "");
        const news = Array.isArray(value.news) ? value.news as Array<{ title: string; url: string; source: string }> : [];
        if (text) out.push(briefingFlex("evening", text));
        if (news.length > 0) out.push(newsFlex(news, "📰 Today's news"));
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
          dueAt: typeof t.dueAt === "number" ? t.dueAt : undefined,
        }));
        if (tasks.length > 0) {
          out.push(taskListFlex(tasks, { timezone }));
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
      if (
        (toolName === "list_upcoming_events" || toolName === "calendar_today" || toolName === "calendar_week") &&
        Array.isArray(value.events)
      ) {
        const events = (value.events as Array<Record<string, unknown>>).map((e) => ({
          id: String(e.id ?? ""),
          summary: String(e.summary ?? "(no title)"),
          start: String(e.start ?? ""),
          end: String(e.end ?? ""),
          location: (e.location as string | null) ?? null,
          htmlLink: (e.htmlLink as string | null) ?? null,
        }));
        if (events.length > 0) {
          out.push(calendarEventsFlex(events, timezone));
          seen.add(toolName);
        }
        continue;
      }

      // ── Place recommendations ─────────────────────────────────────────
      if (toolName === "suggest_places" && value.ok === true && Array.isArray(value.items)) {
        const items = (value.items as Array<Record<string, unknown>>).map<PlaceItem>((p) => ({
          name: String(p.name ?? ""),
          note: String(p.note ?? ""),
          mapsQuery: String(p.mapsQuery ?? ""),
        }));
        const title = String(value.title ?? "Places");
        if (items.length > 0) {
          out.push(buildPlacesFlex(title, items));
          seen.add(toolName);
        }
        continue;
      }

      // ── News search ───────────────────────────────────────────────────
      if (
        (toolName === "news_search" || toolName === "search_news") &&
        Array.isArray(value.stories ?? value.results)
      ) {
        // Guard against the model hallucinating a news query from stale history.
        // Only render the news carousel when the user actually asked for news.
        if (userText && !looksLikeNewsRequest(userText)) {
          console.warn("[agent-flex] news_search called for non-news request; suppressing carousel", {
            userText: userText.slice(0, 100),
          });
          seen.add(toolName);
          continue;
        }
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
  "get_evening_summary",
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

  return out;
}
