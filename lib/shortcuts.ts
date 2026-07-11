import { replyOrPush, text as textMsg, showLoading, type LineMessage } from "@/lib/line/client";
import { HELP_TEXT } from "@/lib/tools/help";
import { helpFlex, googleConnectFlex, calendarEventsFlex, reminderListFlex } from "@/lib/line/flex";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import { buildMorningBriefing } from "@/lib/llm/briefing";
import { buildEveningSummary } from "@/lib/llm/evening-summary";
import { getSettings } from "@/lib/memory/settings";
import { appendTurn } from "@/lib/memory/history";
import { briefingFlex, newsFlex, gmailResultsFlex, taskListFlex } from "@/lib/line/flex";
import { listTasks } from "@/lib/memory/tasks";
import { handleSettingsCommand, getPendingSettingsPrompt } from "@/lib/settings-menu";
import { listReminders } from "@/lib/tools/reminders";
import { listCalendarToday } from "@/lib/tools/calendar";

type Ctx = {
  userId: string;
  replyToken: string;
  userText: string;
};

type Shortcut = {
  name: string;
  match: (text: string) => boolean;
  run: (ctx: Ctx) => Promise<void>;
};

const settingsTrigger = /^\/settings\b|^\/set\s|^\/remember\s/i;
const helpTrigger = /^\/?(help|what can you do|capabilities)$/i;
const briefingTrigger =
  /\b(morning briefing|daily briefing|daily summary|morning brief)\b|^(give me|show me|what'?s|send me|can you give me|can you show me)?\s*(my\s*)?(morning|daily)\s*(briefing|summary|brief)[\s?!.]*$/i;
const eveningTrigger =
  /\b(evening summary|evening briefing|evening wrap.?up|nightly summary)\b|^(give me|show me|what'?s|send me)?\s*(my\s*)?(evening|nightly)\s*(summary|briefing|wrap.?up)[\s?!.]*$/i;
export function isTaskQuery(t: string): boolean {
  const lower = t.toLowerCase().trim();
  // Reject clear add/create/delete/update intents so "add the following task" goes to the agent.
  if (/\b(add|create|new|set|make|write|save|delete|remove|cancel|update|edit|change)\b/.test(lower)) {
    return false;
  }
  return (
    /^\s*(my\s+)?(tasks?|todo|to-dos?)(\s+(list|please|now|today|tomorrow))?\s*[?.!]*$/i.test(lower) ||
    /\bwhat\s+(are\s+my|do\s+i\s+have)\s+(tasks?|todo)\b/i.test(lower) ||
    /\bwhat\s+tasks?\s+(do\s+i\s+have|left|remain)\b/i.test(lower) ||
    /\bshow\s+(me\s+)?my\s+(tasks?|todo)\b/i.test(lower) ||
    /\bmy\s+(remaining|open|pending|current)\s+(tasks?|todo)\b/i.test(lower) ||
    /\bwhat\s+do\s+i\s+(have|need)\s+to\s+do\b/i.test(lower)
  );
}

export function isReminderQuery(t: string): boolean {
  const lower = t.toLowerCase().trim();
  // Reject clear add/create/delete/update intents so "add a reminder" goes to the agent.
  if (/\b(add|create|new|set|make|write|save|delete|remove|cancel|update|edit|change)\b/.test(lower)) {
    return false;
  }
  return (
    /^\s*(my\s+)?(reminders?)(\s+(list|please|now|today|tomorrow))?\s*[?.!]*$/i.test(lower) ||
    /^\s*(list|show)\s+(my\s+)?reminders?\s*[?.!]*$/i.test(lower) ||
    /^\s*open\s+(my\s+)?reminders?\s*[?.!]*$/i.test(lower) ||
    /\bwhat\s+reminders?\s+(do\s+i\s+have|are\s+(there|scheduled)|left)\b/i.test(lower) ||
    /\bshow\s+(me\s+)?my\s+reminders?\b/i.test(lower) ||
    /\bmy\s+(open|pending|upcoming)\s+reminders?\b/i.test(lower)
  );
}

export function isCalendarQuery(t: string): boolean {
  const lower = t.toLowerCase().trim();
  // Reject clear add/create/delete/update intents. "schedule" is allowed as a
  // noun ("my schedule"), so we only reject it when it looks like a verb.
  if (/\b(add|create|new|set|make|write|save|delete|remove|cancel|update|edit|change)\b/.test(lower)) {
    return false;
  }
  if (/\bschedule\s+(a|an|the|my|our|this|that|next|tomorrow|today|for)\b/i.test(lower)) {
    return false;
  }
  return (
    /^\s*(what'?s\s+on\s+)?my\s+(calendar|schedule)(\s+(today|tomorrow|this\s+week|now|please))?\s*[?.!]*$/i.test(lower) ||
    /^\s*what'?s\s+on\s+(my\s+)?(calendar|schedule)\s*(today|tomorrow|this\s+week|now)?\s*[?.!]*$/i.test(lower) ||
    /^\s*show\s+(me\s+)?my\s+(calendar|schedule)\s*[?.!]*$/i.test(lower) ||
    /^\s*my\s+(calendar|schedule)\s+(today|tomorrow|this\s+week)\s*[?.!]*$/i.test(lower) ||
    /\b(anything|what)\s+on\s+(my\s+)?(calendar|schedule)\s*(today|tomorrow)?\b/i.test(lower)
  );
}

const SHORTCUTS: Shortcut[] = [
  {
    name: "settings",
    match: (t) => settingsTrigger.test(t),
    async run({ userId, replyToken, userText }) {
      await handleSettingsCommand(userId, replyToken, userText);
    },
  },
  {
    name: "help",
    match: (t) => helpTrigger.test(t),
    async run({ userId, replyToken, userText }) {
      const settings = await getSettings(userId).catch(() => null);
      await replyOrPush(userId, replyToken, [helpFlex({ language: settings?.language })]);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: HELP_TEXT, ts: Date.now() });
    },
  },
  {
    name: "connect-google",
    match: (t) =>
      /^connect\s+google(\s+(account|drive|calendar|email|mail))?$/i.test(t) ||
      /^link\s+my\s+google(\s+(account|drive|calendar|email|mail))?$/i.test(t) ||
      /^เชื่อมต่อ\s+google(\s+(ไดรฟ์|ปฏิทิน|อีเมล|บัญชี))?$/i.test(t),
    async run({ userId, replyToken }) {
      const [url, settings] = await Promise.all([
        buildConnectUrl(userId).catch(() => null),
        getSettings(userId).catch(() => null),
      ]);
      const msg = url
        ? googleConnectFlex(url, { language: settings?.language })
        : textMsg("Couldn't generate a connect link — make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.");
      await replyOrPush(userId, replyToken, [msg]);
    },
  },
  {
    name: "morning-briefing",
    match: (t) => briefingTrigger.test(t),
    async run({ userId, replyToken, userText }) {
      showLoading(userId, 25).catch(() => {});
      const settings = await getSettings(userId);
      const briefing = await buildMorningBriefing(userId, {
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
      await replyOrPush(userId, replyToken, msgs);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: briefing.text, ts: Date.now() });
    },
  },
  {
    name: "evening-summary",
    match: (t) => eveningTrigger.test(t),
    async run({ userId, replyToken, userText }) {
      showLoading(userId, 25).catch(() => {});
      const settings = await getSettings(userId);
      const summary = await buildEveningSummary(userId, {
        timezone: settings.timezone,
        briefingLanguage: settings.briefingLanguage,
        language: settings.language,
      });
      const out = summary?.text ?? "Nothing to show in your evening summary right now.";
      await replyOrPush(userId, replyToken, [briefingFlex("evening", out, { language: settings.language })]);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: out, ts: Date.now() });
    },
  },
  {
    name: "my-tasks",
    match: (t) => isTaskQuery(t),
    async run({ userId, replyToken, userText }) {
      const [tasks, settings] = await Promise.all([listTasks(userId, "open"), getSettings(userId)]);
      const msgs: LineMessage[] = [];
      if (tasks.length === 0) {
        msgs.push(textMsg("You don't have any open tasks right now. 🎉"));
      } else {
        msgs.push(
          taskListFlex(
            tasks.map((t) => ({ id: t.id, title: t.title, done: Boolean(t.doneAt), dueAt: t.dueAt })),
            { timezone: settings.timezone },
          ),
        );
      }
      await replyOrPush(userId, replyToken, msgs);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      const out =
        tasks.length === 0
          ? "No open tasks."
          : tasks.map((t) => `• ${t.title}${t.dueAt ? ` — due ${new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, month: "short", day: "numeric" }).format(new Date(t.dueAt))}` : ""}`).join("\n");
      await appendTurn(userId, { role: "assistant", content: out, ts: Date.now() });
    },
  },
  {
    name: "my-reminders",
    match: (t) => isReminderQuery(t),
    async run({ userId, replyToken, userText }) {
      const [reminders, settings] = await Promise.all([listReminders(userId).catch(() => []), getSettings(userId)]);
      const msgs: LineMessage[] = [];
      if (reminders.length === 0) {
        msgs.push(textMsg("You don't have any open reminders right now. 🎉"));
      } else {
        msgs.push(
          reminderListFlex(
            reminders.map((r) => ({ id: r.id, message: r.message, fireAt: r.fireAt })),
            { timezone: settings.timezone, language: settings.language },
          ),
        );
      }
      await replyOrPush(userId, replyToken, msgs);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      const out =
        reminders.length === 0
          ? "No open reminders."
          : reminders.map((r) => `• ${r.message} — ${new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(r.fireAt))}`).join("\n");
      await appendTurn(userId, { role: "assistant", content: out, ts: Date.now() });
    },
  },
  {
    name: "my-calendar",
    match: (t) => isCalendarQuery(t),
    async run({ userId, replyToken, userText }) {
      showLoading(userId, 25).catch(() => {});
      const settings = await getSettings(userId);
      const result = await listCalendarToday(userId).catch(() => ({ ok: true as const, events: [] }));
      if (result && typeof result === "object" && "need_google_auth" in result) {
        const url = await buildConnectUrl(userId).catch(() => null);
        const msg = url
          ? googleConnectFlex(url, { language: settings.language, reason: "Connect Google to see your calendar." })
          : textMsg("Couldn't generate a connect link — make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.");
        await replyOrPush(userId, replyToken, [msg]);
        await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
        await appendTurn(userId, { role: "assistant", content: "Google connection needed to view calendar.", ts: Date.now() });
        return;
      }
      const events = result && typeof result === "object" && "events" in result && Array.isArray(result.events)
        ? (result.events as Array<{ id: string; summary: string; start: string; end: string; location?: string | null; htmlLink?: string | null }>)
        : [];
      const msgs: LineMessage[] = [calendarEventsFlex(events, settings.timezone)];
      await replyOrPush(userId, replyToken, msgs);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      const out =
        events.length === 0
          ? "Nothing on the calendar today."
          : events.map((e) => `• ${e.summary} — ${new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(e.start))}`).join("\n");
      await appendTurn(userId, { role: "assistant", content: out, ts: Date.now() });
    },
  },
];

/** Match the first shortcut and run it. Returns true if handled. */
export async function dispatchShortcut(ctx: Ctx): Promise<boolean> {
  if (await getPendingSettingsPrompt(ctx.userId)) {
    await handleSettingsCommand(ctx.userId, ctx.replyToken, ctx.userText);
    return true;
  }

  for (const s of SHORTCUTS) {
    if (s.match(ctx.userText)) {
      await s.run(ctx);
      return true;
    }
  }
  return false;
}
