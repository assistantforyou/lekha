/**
 * Instant regex-based intent classifier — no model call, no latency.
 * Returns a narrow intent for clear single-topic queries; undefined otherwise.
 * Callers use the result to filter the tool registry to a focused subset.
 */

const CASUAL_TRIGGERS = [
  /^\s*(hi|hello|hey|yo|sup|what'?s up|howdy|hola)\s*[^,]*(how are you|how you doing|what's good)?\s*$/i,
  /^\s*(thanks?|thank you|ty|cheers)\b/i,
  /^\s*(bye|goodbye|see ya|later|night|good night|morning|good morning|evening|good evening)\b/i,
  /^\s*test\s*$/i,
  /^\s*ok\s*$/i,
  /^\s*got it\s*$/i,
  /^\s*nevermind\s*$/i,
];

const KEYWORD_MAP: Array<{ intent: string; patterns: RegExp[] }> = [
  { intent: "task",     patterns: [/\b(add\s+a?\s*task|create\s+a?\s*task|new\s+task|my\s+tasks?|list\s+my\s+tasks?|what\s+tasks?|complete.*task|done.*task|delete.*task|everything\s+i\s+need\s+to\s+do|anything\s+left\s+to\s+do|overdue|open\s+tasks?)\b/i, /\bi\s+need\s+to\s+\w+/i] },
  { intent: "reminder", patterns: [/\b(remind\s+me|set\s+a?\s*reminder|what\s+reminders|cancel.*reminder|delete.*reminder)\b/i] },
  { intent: "weather",  patterns: [/\b(weather|forecast|temperature|rain|sunny|umbrella)\b/i] },
  { intent: "finance",  patterns: [/\b(stock\s+price|stock\s+quote|\b[A-Z]{2,5}\b\s+(price|stock|quote)|crypto\s+price|bitcoin|ethereum|eth\b|btc\b|sol\b|fx\s+rate|exchange rate)\b/i] },
  { intent: "calendar", patterns: [/\b(calendar|schedule|meeting|event|upcoming|what'?s on|free time|busy)\b/i] },
  { intent: "email",    patterns: [/\b(email|gmail|draft\s+an?\s*email|send\s+an?\s*email|inbox|unread|reply to)\b/i] },
  { intent: "memory",   patterns: [/\b(remember|memories|what\s+do\s+you\s+remember|forget|search\s+memory|archived memory)\b/i] },
  { intent: "lists",    patterns: [/\b(grocery|packing|shopping list|add.*to.*list|my\s+list)\b/i] },
  { intent: "settings", patterns: [/\b(set\s+my\s+timezone|change\s+my\s+timezone|set\s+timezone|timezone|set\s+my\s+language|set\s+location)\b/i] },
  { intent: "news",     patterns: [/\b(news|headlines?|breaking|top\s+\d+\s+news|latest\s+news|current events|what'?s happening)\b/i] },
  { intent: "search",   patterns: [/\b(search|look up|find out|what happened|why did|how does|research)\b/i] },
  { intent: "receipts", patterns: [/\b(receipt|scan\s+receipt|list\s+receipts|expenses?)\b/i] },
  { intent: "connect",  patterns: [/\b(connect\s+google|link\s+google|google\s+account)\b/i] },
  { intent: "briefing", patterns: [/\b(morning briefing|daily briefing|evening summary)\b/i] },
];

/**
 * Returns a narrow intent string for high-confidence single-topic queries,
 * or undefined when the query is multi-topic, casual, or ambiguous.
 */
export function fastClassify(
  text: string,
  opts?: { hasStagedMedia?: boolean },
): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // Media reference with staged content → media tools
  if (opts?.hasStagedMedia && /\b(this|that|it|the\s+(file|pdf|doc|document|image|photo|picture|video))\b/i.test(trimmed)) {
    return "media";
  }

  // Pure casual → no narrowing (give all tools so mixed "hi + real request" works)
  if (CASUAL_TRIGGERS.some((re) => re.test(trimmed))) return undefined;

  const matched: string[] = [];
  for (const { intent, patterns } of KEYWORD_MAP) {
    if (patterns.some((re) => re.test(trimmed))) matched.push(intent);
  }

  // Single clear intent → narrow
  if (matched.length === 1) return matched[0];

  // Multiple or zero → give all tools
  return undefined;
}
