import { replyOrPush, text as textMsg, showLoading, type LineMessage } from "@/lib/line/client";
import { HELP_TEXT } from "@/lib/tools/help";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import { buildMorningBriefing } from "@/lib/llm/briefing";
import { buildEveningSummary } from "@/lib/llm/evening-summary";
import { getSettings } from "@/lib/memory/settings";
import { appendTurn } from "@/lib/memory/history";
import { briefingFlex, newsFlex, gmailResultsFlex, taskListFlex } from "@/lib/line/flex";
import { listTasks } from "@/lib/memory/tasks";

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

const helpTrigger = /^\/?(help|what can you do|capabilities)$/i;
const briefingTrigger =
  /\b(morning briefing|daily briefing|daily summary|morning brief)\b|^(give me|show me|what'?s|send me|can you give me|can you show me)?\s*(my\s*)?(morning|daily)\s*(briefing|summary|brief)[\s?!.]*$/i;
const eveningTrigger =
  /\b(evening summary|evening briefing|evening wrap.?up|nightly summary)\b|^(give me|show me|what'?s|send me)?\s*(my\s*)?(evening|nightly)\s*(summary|briefing|wrap.?up)[\s?!.]*$/i;
const tasksTrigger =
  /\b(my\s*)?(tasks?|todo|to-do|remaining\s+tasks?|open\s+tasks?)\b|what\s+do\s+i\s+need\s+to\s+do/i;

const SHORTCUTS: Shortcut[] = [
  {
    name: "help",
    match: (t) => helpTrigger.test(t),
    async run({ userId, replyToken }) {
      await replyOrPush(userId, replyToken, [textMsg(HELP_TEXT)]);
    },
  },
  {
    name: "connect-google",
    match: (t) => /^connect\s+google$/i.test(t),
    async run({ userId, replyToken }) {
      const url = await buildConnectUrl(userId).catch(() => null);
      const msg = url
        ? `Connect your Google account here (link expires in 10 min):\n${url}`
        : "Couldn't generate a connect link — make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.";
      await replyOrPush(userId, replyToken, [textMsg(msg)]);
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
      });
      const msgs: LineMessage[] = [briefingFlex("morning", briefing.text)];
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
      const summary = await buildEveningSummary(userId, { timezone: settings.timezone });
      const out = summary?.text ?? "Nothing to show in your evening summary right now.";
      await replyOrPush(userId, replyToken, [briefingFlex("evening", out)]);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: out, ts: Date.now() });
    },
  },
  {
    name: "my-tasks",
    match: (t) => tasksTrigger.test(t),
    async run({ userId, replyToken, userText }) {
      const tasks = await listTasks(userId, "open");
      const msgs: LineMessage[] = [];
      if (tasks.length === 0) {
        msgs.push(textMsg("You don't have any open tasks right now. 🎉"));
      } else {
        msgs.push(taskListFlex(tasks.map((t) => ({ id: t.id, title: t.title, done: Boolean(t.doneAt) }))));
      }
      await replyOrPush(userId, replyToken, msgs);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      const out = tasks.length === 0 ? "No open tasks." : tasks.map((t) => `• ${t.title}`).join("\n");
      await appendTurn(userId, { role: "assistant", content: out, ts: Date.now() });
    },
  },
];

/** Match the first shortcut and run it. Returns true if handled. */
export async function dispatchShortcut(ctx: Ctx): Promise<boolean> {
  for (const s of SHORTCUTS) {
    if (s.match(ctx.userText)) {
      await s.run(ctx);
      return true;
    }
  }
  return false;
}
