/**
 * Instant regex intent hint — zero latency, zero cost, zero network.
 * Returns a single intent string for high-confidence single-topic queries,
 * undefined otherwise. Callers use it to narrow the tool registry.
 *
 * Failure mode is always safe: undefined → all tools. Never excludes a
 * tool the user needs; only narrows when we're certain.
 */

// These are ONLY exact (or near-exact) casual utterances. Must have $ anchor
// so "morning briefing please" doesn't get swallowed as a greeting.
const CASUAL_TRIGGERS: RegExp[] = [
  /^\s*(hi+|hello|hey+|yo+|sup|howdy|hola)[\s!?.,]*$/i,
  /^\s*(what'?s\s*up|wassup|wazzup)[\s!?.,]*$/i,
  /^\s*(how are you|how you doing|how'?s it going|you good)[\s!?.,]*$/i,
  /^\s*(thanks?|thank you|ty|cheers|thx)[\s!?.,]*$/i,
  /^\s*(bye|goodbye|see ya|later|good\s*night|good\s*morning|good\s*evening)[\s!?.,]*$/i,
  /^\s*(ok|okay|got it|sure|alright|k|kk|yep|yup|nope|nah)[\s!?.,]*$/i,
  /^\s*(lol|lmao|haha|hehe|😂|😄)[\s!?.,]*$/i,
  /^\s*test[\s!?.,]*$/i,
  /^\s*nevermind[\s!?.,]*$/i,
];

const KEYWORD_MAP: Array<{ intent: string; patterns: RegExp[] }> = [
  {
    intent: "reminder",
    patterns: [
      // "remind me", "set a reminder", "set a recurring reminder", etc.
      /\b(remind\s+me|set\s+(a\s+)?(recurring\s+)?reminder|what\s+reminders?\s+(do\s+i\s+have|are\s+there)|cancel.*\breminder\b|delete.*\breminder\b|list\s+reminders?)\b/i,
    ],
  },
  {
    intent: "task",
    patterns: [
      /\b(add\s+(a\s+)?task|create\s+(a\s+)?task|new\s+task|my\s+tasks?|list\s+(my\s+)?tasks?|what\s+tasks?|complete\s+task|done\s+task|delete\s+task|everything\s+i\s+need\s+to\s+do|anything\s+left\s+to\s+do|overdue\s+tasks?|open\s+tasks?)\b/i,
    ],
  },
  {
    intent: "weather",
    patterns: [
      /\b(weather|forecast|temperature|humidity|rain(ing|fall)?|sunny|cloudy|umbrella|wind\s+speed)\b/i,
    ],
  },
  {
    intent: "finance",
    patterns: [
      // explicit financial queries only — require price/stock/quote suffix for tickers
      /\b(stock\s+price|stock\s+quote|share\s+price|crypto\s+price|bitcoin|ethereum)\b/i,
      /\b(eth|btc|sol|bnb|xrp|doge)\s+(price|value|worth)\b/i,
      /\b[A-Z]{2,5}\b\s+(price|stock|quote|shares?)\b/i,
      /\b(fx\s+rate|exchange\s+rate|currency\s+rate)\b/i,
    ],
  },
  {
    intent: "calendar",
    patterns: [
      // removed "what's on" — too ambiguous ("what's on Netflix")
      // removed standalone "upcoming" — too broad ("upcoming flights")
      /\b(my\s+calendar|check\s+(my\s+)?calendar|add\s+to\s+(my\s+)?calendar|calendar\s+event)\b/i,
      /\b(schedule\s+(a\s+)?(meeting|call|appointment|event)|reschedule\s+meeting|book\s+(a\s+)?(meeting|call|slot))\b/i,
      /\b(upcoming\s+(meeting|event|appointment|call)s?|what\s+(meeting|event)s?\s+(do\s+i\s+have|are\s+(there|scheduled)))\b/i,
      /\b(am\s+i\s+(free|busy|available)|when\s+am\s+i\s+free|find\s+(a\s+)?free\s+slot)\b/i,
    ],
  },
  {
    intent: "email",
    patterns: [
      /\b(email|gmail|draft\s+an?\s+email|send\s+an?\s+email|inbox|unread\s+(emails?|messages?)|reply\s+to)\b/i,
    ],
  },
  {
    intent: "memory",
    patterns: [
      /\b(what\s+do\s+you\s+remember|search\s+(my\s+)?memory|archived\s+memory|list\s+(my\s+)?memories)\b/i,
      // "remember X" only when it looks like storing a fact, not "remember to do X"
      /^\s*remember\s+(that|my|i|this)\b/i,
    ],
  },
  {
    intent: "lists",
    patterns: [
      /\b(grocery\s+list|shopping\s+list|packing\s+list|add\s+.{1,40}\s+to\s+(my\s+)?(grocery|shopping|packing)?\s*list|my\s+(grocery|shopping|packing|to.?do)\s+list)\b/i,
    ],
  },
  {
    intent: "settings",
    patterns: [
      /\b(set\s+(my\s+)?(timezone|location|language)|change\s+(my\s+)?(timezone|location|language)|my\s+timezone)\b/i,
    ],
  },
  {
    intent: "news",
    patterns: [
      // "breaking" alone is too broad — require "breaking news"
      /\b(breaking\s+news|latest\s+news|top\s+(headlines?|\d+\s+news)|current\s+events|what'?s\s+in\s+the\s+news)\b/i,
      /\b(news\s+(about|on|from|today|this\s+week))\b/i,
      // bare "news" or "headlines" is usually fine — short and specific
      /^\s*(news|headlines?)\b/i,
    ],
  },
  {
    intent: "search",
    patterns: [
      /\b(search\s+(for|the\s+web|online)|look\s+up|find\s+out|web\s+search|google\s+for)\b/i,
      /\b(what\s+(is|are|was|were)\s+the\s+(best|top|latest)|how\s+do\s+i\s+|why\s+(is|are|did|does)\s+|research\s+)\b/i,
    ],
  },
  {
    intent: "receipts",
    patterns: [
      /\b(scan\s+(a\s+|this\s+)?receipt|list\s+(my\s+)?receipts?|my\s+receipts?|track\s+(my\s+)?expenses?)\b/i,
    ],
  },
  {
    intent: "connect",
    patterns: [
      /\b(connect\s+(my\s+)?google|link\s+(my\s+)?google|google\s+account)\b/i,
    ],
  },
  {
    intent: "briefing",
    patterns: [
      /\b(morning\s+briefing|daily\s+briefing|evening\s+summary|my\s+briefing|get\s+(my\s+)?briefing)\b/i,
    ],
  },
  {
    intent: "media",
    patterns: [
      /\b(read\s+(this|the)\s+(document|pdf|file)|summarize\s+(this|the)\s+(document|pdf|file|image|photo)|ocr|extract\s+text)\b/i,
    ],
  },
];

/**
 * Returns a single intent string when we're confident it's a clear single-topic
 * query, or undefined when the query is ambiguous, multi-topic, or casual.
 *
 * undefined always means "use all tools" — never a failure mode.
 */
export function fastClassify(
  text: string,
  opts?: { hasStagedMedia?: boolean },
): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // Staged media reference → media tools (regardless of other content)
  if (
    opts?.hasStagedMedia &&
    /\b(this|that|the\s+(file|pdf|doc(?:ument)?|image|photo|picture|video|audio))\b/i.test(trimmed)
  ) {
    return "media";
  }

  // Exact casual utterances → no narrowing (gives all tools so follow-up
  // requests in the same message like "hi, what's the weather?" still work)
  if (CASUAL_TRIGGERS.some((re) => re.test(trimmed))) return undefined;

  const matched: string[] = [];
  for (const { intent, patterns } of KEYWORD_MAP) {
    if (patterns.some((re) => re.test(trimmed))) matched.push(intent);
  }

  // Single clear intent → narrow. Multiple or zero → all tools.
  return matched.length === 1 ? matched[0] : undefined;
}
