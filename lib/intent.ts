import { z } from "zod";
import { generateObject } from "ai";
import { classifierModel } from "@/lib/llm/provider";
import { withTimeout, AgentTimeoutError } from "@/lib/timing";

export const INTENTS = [
  "casual",
  "help",
  "task",
  "reminder",
  "news",
  "search",
  "weather",
  "finance",
  "calendar",
  "email",
  "drive",
  "contacts",
  "memory",
  "lists",
  "receipts",
  "settings",
  "connect",
  "media",
  "briefing",
  "multi",
  "fallback",
] as const;

export type Intent = (typeof INTENTS)[number];

export type IntentResult = {
  primary: Intent;
  secondary?: Intent;
  isMulti: boolean;
  confidence: "high" | "low";
};

const IntentEnum = z.enum(INTENTS as unknown as [string, ...string[]]);
const IntentSchema = z.object({
  primary: IntentEnum.transform((v) => v as Intent),
  secondary: IntentEnum.optional().transform((v) => (v ? (v as Intent) : undefined)),
  isMulti: z.boolean(),
  confidence: z.enum(["high", "low"]),
});

const CASUAL_TRIGGERS = [
  /^\s*(hi|hello|hey|yo|sup|what'?s up|howdy|hola)\b/i,
  /^\s*(thanks?|thank you|ty|cheers)\b/i,
  /^\s*(bye|goodbye|see ya|later|night|good night|morning|good morning|evening|good evening)\b/i,
  /^\s*test\s*$/i,
  /^\s*ok\s*$/i,
  /^\s*got it\s*$/i,
  /^\s*nevermind\s*$/i,
  /^\s*stop\s+(sending|it|that)/i,
  /\b(unicorn\s+emoji|show me.*emoji|send me.*emoji)\b/i,
  /^\s*\.\.\.\s*$/,
];

const INTENT_KEYWORDS: Partial<Record<Intent, RegExp[]>> = {
  help: [/\b(help|what can you do|capabilities|what do you do)\b/i],
  task: [/\b(add\s+a?\s*task|create\s+a?\s*task|new\s+task|my\s+tasks?|list\s+my\s+tasks?|what\s+tasks?|complete.*task|done.*task|delete.*task)\b/i],
  reminder: [/\b(remind\s+me|set\s+a?\s*reminder|what\s+reminders|cancel.*reminder|delete.*reminder)\b/i],
  news: [/\b(news|headlines?|breaking|top\s+\d+\s+news|latest\s+news|current events|what'?s happening|finance news|stock news|market news|world news|today'?s news|news today)\b/i],
  weather: [/\b(weather|forecast|temperature|rain|sunny)\b/i],
  finance: [/\b(stock\s+price|stock\s+quote|\b[A-Z]{1,5}\b\s+(price|stock|quote)|crypto\s+price|bitcoin|ethereum|fx\s+rate|exchange rate)\b/i],
  calendar: [/\b(calendar|schedule|meeting|event|upcoming|what'?s on|free time|busy)\b/i],
  email: [/\b(email|gmail|draft\s+an?\s*email|send\s+an?\s*email|inbox|unread|reply to)\b/i],
  drive: [/\b(drive|google drive|upload|list recent files|search drive)\b/i],
  contacts: [/\b(contacts?|who\s+do\s+i\s+know|do\s+i\s+have.*email)\b/i],
  memory: [/\b(remember|memories|what\s+do\s+you\s+remember|forget|search\s+memory|archived memory)\b/i],
  lists: [/\b(list|grocery|packing|shopping|to-do list|todo list)\b/i],
  receipts: [/\b(receipt|scan\s+receipt|list\s+receipts|expenses?)\b/i],
  settings: [/\b(timezone|language|location|task check-in)\b/i],
  briefing: [/\b(morning briefing|daily briefing|evening summary|evening briefing|daily summary)\b/i],
  connect: [/\b(connect\s+google|link\s+google|google\s+account)\b/i],
  media: [/\b(read\s+this|summarize\s+this|analyze\s+this|ocr|what\s+does\s+this\s+say|what'?s\s+this|what\s+is\s+this)\b/i],
};

export function fastClassify(userText: string, hasImage?: boolean): IntentResult | null {
  const text = userText.trim();
  if (!text) {
    return hasImage
      ? { primary: "media", isMulti: false, confidence: "high" }
      : { primary: "casual", isMulti: false, confidence: "high" };
  }

  for (const re of CASUAL_TRIGGERS) {
    if (re.test(text)) {
      return { primary: "casual", isMulti: false, confidence: "high" };
    }
  }

  if (/\b(connect\s+google|link\s+google)\b/i.test(text)) {
    return { primary: "connect", isMulti: false, confidence: "high" };
  }

  const matched: Intent[] = [];
  for (const [intent, regexes] of Object.entries(INTENT_KEYWORDS)) {
    if (regexes?.some((re) => re.test(text))) {
      matched.push(intent as Intent);
    }
  }

  // If only one clear intent, use it. Otherwise fall through to LLM.
  if (matched.length === 1) {
    return { primary: matched[0]!, isMulti: false, confidence: "high" };
  }
  if (matched.length > 1) {
    // Heuristic: if two intents and one contains "and"/","/";", treat as multi.
    const multiMarkers = /\b(and|also|plus)\b|[,;]/i;
    return {
      primary: "multi",
      secondary: matched[0],
      isMulti: multiMarkers.test(text),
      confidence: multiMarkers.test(text) ? "high" : "low",
    };
  }

  return null;
}

const CLASSIFICATION_PROMPT = `Classify the user's intent for a personal assistant bot. Respond with the intent JSON.

Available intents:
- casual: greetings, thanks, test, emoji requests, jokes, small talk, complaints with no task ("stop sending me articles")
- help: "help", "what can you do"
- task: add/complete/list/delete tasks
- reminder: set/list/cancel reminders
- news: explicit news/current events requests. Includes "what's the latest on Tesla?", "top 10 finance news", "breaking news". Choose this over search when the user is asking for current events.
- search: general web search/research ("why did semiconductors drop last night", "what is Y")
- weather: weather requests
- finance: stock/crypto/FX prices
- calendar: calendar events
- email: emails/Gmail
- drive: Google Drive
- contacts: contacts
- memory: remember/forget/list memories
- lists: named lists (grocery, packing)
- receipts: receipt scanning/listing
- settings: timezone, language, briefing preferences
- connect: "connect google"
- media: analyze a photo/document
- briefing: morning briefing or evening summary
- multi: multiple distinct requests in one message (e.g. "email John and check the weather")
- fallback: uncertain

Rules:
1. If the message is clearly about current events/latest developments, choose "news" not "search".
2. If the message contains two or more distinct tasks, choose "multi".
3. If the message is just conversational, choose "casual".
4. If the user sent an image and the text is short or ambiguous, choose "media".
5. Be conservative with "multi"; only use it when there are genuinely separate requests.

Examples:
- "test" → casual
- "Show me the unicorn emoji" → casual
- "STOP SENDING ME ARTICLES BRO" → casual
- "what's the latest on Tesla?" → news
- "search for the top 10 news in finance" → news
- "why did semiconductors drop last night" → search
- "email John and check the weather" → multi
- "remind me to call mom and add buy milk to my tasks" → multi
- "add a task" → task
- "what tasks do I have" → task
`;

const CLASSIFY_TIMEOUT_MS = 3_000;

export async function classifyIntent(
  userText: string,
  opts?: { hasImage?: boolean },
): Promise<IntentResult> {
  const fast = fastClassify(userText, opts?.hasImage);
  if (fast && fast.confidence === "high") {
    return fast;
  }

  try {
    const result = await withTimeout(
      generateObject({
        model: classifierModel(),
        schema: IntentSchema,
        system: CLASSIFICATION_PROMPT,
        prompt: `User: ${userText}${opts?.hasImage ? "\n[User also sent an image]" : ""}`,
      }),
      CLASSIFY_TIMEOUT_MS,
    );

    const obj = result.object;
    return {
      primary: obj.primary,
      secondary: obj.secondary,
      isMulti: obj.isMulti,
      confidence: obj.confidence,
    };
  } catch (err) {
    if (err instanceof AgentTimeoutError) {
      console.warn("[intent] classification timed out; falling back", { userText: userText.slice(0, 100) });
    } else {
      console.warn("[intent] classification failed; falling back", err);
    }
    // Fall back to fast result (possibly low confidence) or generic fallback.
    return fast ?? { primary: "fallback", isMulti: false, confidence: "low" };
  }
}
