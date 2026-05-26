import { reply, text as textMsg, showLoading } from "@/lib/line/client";
import { HELP_TEXT } from "@/lib/tools/help";
import { buildConnectUrl } from "@/lib/tools/google-auth";
import { buildMorningBriefing } from "@/lib/llm/briefing";
import { buildEveningSummary } from "@/lib/llm/evening-summary";
import { getSettings } from "@/lib/memory/settings";
import { appendTurn } from "@/lib/memory/history";
import { briefingFlex } from "@/lib/line/flex";

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
  /\b(morning briefing|daily briefing|daily summary)\b|^(give me|show me|what'?s|send me)?\s*(my\s*)?(morning|daily)\s*(briefing|summary)[\s?!.]*$/i;
const eveningTrigger =
  /\b(evening summary|evening briefing|evening wrap.?up|nightly summary)\b|^(give me|show me|what'?s|send me)?\s*(my\s*)?(evening|nightly)\s*(summary|briefing|wrap.?up)[\s?!.]*$/i;

const SHORTCUTS: Shortcut[] = [
  {
    name: "help",
    match: (t) => helpTrigger.test(t),
    async run({ replyToken }) {
      await reply(replyToken, [textMsg(HELP_TEXT)]);
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
      await reply(replyToken, [textMsg(msg)]);
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
      });
      const out = briefing ?? "Nothing to show in your briefing right now.";
      await reply(replyToken, [briefingFlex("morning", out)]);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
      await appendTurn(userId, { role: "assistant", content: out, ts: Date.now() });
    },
  },
  {
    name: "evening-summary",
    match: (t) => eveningTrigger.test(t),
    async run({ userId, replyToken, userText }) {
      showLoading(userId, 25).catch(() => {});
      const settings = await getSettings(userId);
      const summary = await buildEveningSummary(userId, { timezone: settings.timezone });
      const out = summary ?? "Nothing to show in your evening summary right now.";
      await reply(replyToken, [briefingFlex("evening", out)]);
      await appendTurn(userId, { role: "user", content: userText, ts: Date.now() });
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
