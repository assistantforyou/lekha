/**
 * Instant regex intent hint — zero latency, zero cost, zero network.
 * Returns a single intent string for single-topic queries. Callers use it
 * to narrow the tool registry.
 *
 * Coverage is intentionally broad: common phrasings for every major tool
 * surface are listed explicitly. When a query matches more than one intent,
 * we disambiguate by priority (more specific / user-facing intents win over
 * generic time markers like "recent"). If nothing matches, undefined → all
 * tools, which is always safe.
 */

type IntentEntry = { intent: string; priority: number; patterns: RegExp[] };

// Exact (or near-exact) casual utterances. Must have $ anchor so
// "morning briefing please" doesn't get swallowed as a greeting.
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

// Higher priority = preferred when multiple intents match. Concrete user
// actions (settings, connect, briefing, task, reminder, calendar, email)
// beat generic time markers (recent) and broad research verbs.
const KEYWORD_MAP: IntentEntry[] = [
  // ── Highest: explicit commands / account actions ──────────────────────
  {
    intent: "settings",
    priority: 100,
    patterns: [
      /^\s*\/(settings|set|remember)\b/i,
      /\b(set\s+(my\s+)?(timezone|location|language|locale|name)|change\s+(my\s+)?(timezone|location|language|locale|name)|my\s+(timezone|location|language|locale))\b/i,
      /\b(enable|disable|turn\s+(on|off))\s+(morning\s+briefing|evening\s+summary|task\s+check.in|briefings?|memory|reminders?|tools?)\b/i,
      /\b(update\s+my\s+(settings|preferences))\b/i,
    ],
  },
  {
    intent: "connect",
    priority: 95,
    patterns: [
      /\b(connect\s+(my\s+)?google(\s+(account|drive|calendar|email|mail))?|link\s+(my\s+)?google(\s+(account|drive|calendar|email|mail))?|google\s+accounts?|disconnect\s+google)\b/i,
      /\b(log\s+(in|into|on to)\s+google|sign\s+(in|into)\s+google)\b/i,
      // Thai connect-google phrases
      /(เชื่อมต่อ\s+google(\s+(ไดรฟ์|ปฏิทิน|อีเมล|บัญชี))?|เชื่อม\s+google|ลิงก์\s+google|บัญชี\s+google)/i,
    ],
  },
  {
    intent: "briefing",
    priority: 90,
    patterns: [
      /\b(morning\s+briefing|daily\s+briefing|daily\s+summary|morning\s+brief|evening\s+summary|evening\s+briefing|evening\s+wrap[- ]?up|nightly\s+summary|my\s+briefing|get\s+(my\s+)?briefing)\b/i,
      /^\s*(brief\s+me|give\s+me\s+(my\s+)?(briefing|summary))\s*[?.!]*$/i,
    ],
  },
  {
    intent: "weather",
    priority: 90,
    patterns: [
      /\b(weather|forecast|temperature|humidity|rain(ing|fall)?|sunny|cloudy|umbrella|wind\s+speed|heat\s+index|pollen)\b/i,
      /\b(will\s+it\s+rain|is\s+it\s+going\s+to\s+rain|do\s+i\s+need\s+an\s+umbrella)\b/i,
      // Thai weather phrases
      /(อากาศ|พยากรณ์อากาศ|ฝนตก|อุณหภูมิ|ร้อน|หนาว|ลมแรง)/,
    ],
  },

  // ── Core productivity ─────────────────────────────────────────────────
  {
    intent: "task",
    priority: 85,
    patterns: [
      /^\s*(my\s+)?(tasks?|todo|to-dos?)(\s+(list|please|now|today|tomorrow))?[\s?.!]*$/i,
      /^\s*(list|show)\s+(my\s+)?(tasks?|todo|to-dos?)[\s?.!]*$/i,
      /\b(add\s+.{0,40}\s+to\s+(my\s+)?(tasks?|todo)|add\s+(a\s+)?tasks?|create\s+(a\s+)?tasks?|new\s+tasks?)\b/i,
      /\b(mark\s+.{0,30}\s+as\s+(done|complete)|mark\s+(a\s+)?tasks?\s+(done|complete)|complete\s+.{0,30}\s+(tasks?|todo)|complete\s+(a\s+)?tasks?|finish\s+(a\s+)?tasks?)\b/i,
      /\b(delete\s+.{0,30}\s+(tasks?|todo)|delete\s+(a\s+)?(tasks?|todo)|remove\s+(a\s+)?(tasks?|todo))\b/i,
      /\bwhat\s+(are\s+my|do\s+i\s+have)\s+(tasks?|todo)\b/i,
      /\bwhat\s+tasks?\s+(do\s+i\s+have|left|remain|overdue)\b/i,
      /\bmy\s+(remaining|open|pending|current|overdue)\s+(tasks?|todo)\b/i,
      /\bwhat\s+do\s+i\s+(have|need)\s+to\s+do\b/i,
      /\b(show|list|everything|anything)\s+.*\b(i\s+need\s+to\s+do|left\s+to\s+do|to\s+do)\b/i,
      /\banything\s+left\s+to\s+do\b/i,
      // Thai task phrases
      /(งานของ(ฉัน|ผม|ดิฉัน)|รายการงาน|งานที่ต้องทำ|งานเหลือ|แสดงงาน|เพิ่มงาน|สร้างงาน|เสร็จงาน|ลบงาน)/,
    ],
  },
  {
    intent: "reminder",
    priority: 85,
    patterns: [
      /^\s*(my\s+)?(reminders?)(\s+(list|please|now|today|tomorrow))?[\s?.!]*$/i,
      /^\s*(list|show|open)\s+(my\s+)?reminders?[\s?.!]*$/i,
      /\b(remind\s+me|set\s+(a\s+)?(recurring\s+)?reminders?|what\s+reminders?\s+(do\s+i\s+have|are\s+(there|scheduled)|left)|cancel.*\breminders?\b|delete.*\breminders?\b)\b/i,
      /\bmy\s+(open|pending|upcoming)\s+reminders?\b/i,
      // Thai reminder phrases
      /(การแจ้งเตือนของ(ฉัน|ผม|ดิฉัน)|รายการแจ้งเตือน|แจ้งเตือนที่ต้องทำ|แจ้งเตือนค้าง|แสดงการแจ้งเตือน|เปิดการแจ้งเตือน|ตั้งการแจ้งเตือน|ลบการแจ้งเตือน)/,
    ],
  },
  {
    intent: "calendar",
    priority: 80,
    patterns: [
      /\bwhat'?s\s+on\s+(my\s+)?(calendar|schedule)\b/i,
      /^\s*(my\s+)?(calendar|schedule)(\s+(today|tomorrow|this\s+week|now|please))?[\s?.!]*$/i,
      /^\s*(show\s+(me\s+)?)?my\s+(calendar|schedule)[\s?.!]*$/i,
      /\b(my\s+calendar|check\s+(my\s+)?calendar|add\s+to\s+(my\s+)?calendar|calendar\s+events?)\b/i,
      /\b(schedule\s+(a\s+)?(meetings?|calls?|appointments?|events?)|reschedule\s+meetings?|book\s+(a\s+)?(meetings?|calls?|slots?)|move\s+(a\s+)?(meetings?|calls?|appointments?))\b/i,
      /\b(upcoming\s+(meeting|event|appointment|call)s?|what\s+(meeting|event|appointment|call)s?\s+(do\s+i\s+have|are\s+(there|scheduled)))\b/i,
      /\b(am\s+i\s+(free|busy|available)|when\s+am\s+i\s+free|find\s+(a\s+)?free\s+(slot|time)|what\s+time\s+am\s+i\s+free)\b/i,
      // Thai calendar phrases
      /(ปฏิทินของ(ฉัน|ผม|ดิฉัน)|ตารางงาน|ดูปฏิทิน|นัดหมาย|ประชุม|ว่างไหม|ตารางว่าง)/,
    ],
  },

  // ── Google Workspace ──────────────────────────────────────────────────
  {
    intent: "email",
    priority: 75,
    patterns: [
      /\b(emails?|gmail|inbox|unread\s+(emails?|messages?)|outlook\s+inbox)\b/i,
      /\b(draft\s+(an?\s+)?(email|reply)|write\s+(an?\s+)?email|compose\s+(an?\s+)?email)\b/i,
      /\b(send\s+(an?\s+)?email|send\s+(an?\s+)?reply|reply\s+(to\s+)?(an?\s+)?(email|message)|forward\s+(an?\s+)?(email|message))\b/i,
      /\b(email|e-mail|send|forward)\s+(this|that|the|it|me|us|him|her|them)\b/i,
      /\b(send|forward)\s+.{0,40}\s+(image|photo|picture|file|pdf|doc(?:ument)?)\b/i,
      /\b(search\s+(my\s+)?(gmail|inbox|emails?)|find\s+(an?\s+)?email)\b/i,
      // Thai email phrases
      /(อีเมล|จดหมาย|กล่องจดหมาย|ส่งอีเมล|เขียนอีเมล|ตอบอีเมล|ส่งต่ออีเมล|อ่านอีเมล)/,
    ],
  },
  {
    intent: "drive",
    priority: 75,
    patterns: [
      /\b(google\s+drive|my\s+drive|drive\s+files?|search\s+(my\s+)?drive|upload\s+.{0,30}\s+to\s+(my\s+)?drive|save\s+.{0,30}\s+to\s+(my\s+)?drive)\b/i,
      /\b(get\s+(a\s+)?link\s+(to\s+)?(a\s+)?drive\s+files?|share\s+(a\s+)?drive\s+files?)\b/i,
      // Thai drive phrases
      /(ไดรฟ์|google\s+ไดรฟ์|ไฟล์ในไดรฟ์|ค้นหาไดรฟ์|อัปโหลดไปไดรฟ์|ลิงก์ไดรฟ์)/,
    ],
  },
  {
    intent: "contacts",
    priority: 75,
    patterns: [
      /\b(my\s+contacts?|search\s+(my\s+)?contacts?|find\s+(a\s+)?contact|look\s+up\s+(a\s+)?contact)\b/i,
      /\b( contact\s+(info|details|information)|phone\s+number\s+for|email\s+for)\b/i,
    ],
  },

  // ── Other structured tools ────────────────────────────────────────────
  {
    intent: "receipts",
    priority: 75,
    patterns: [
      /\b(scan\s+(a\s+|this\s+)?receipt|list\s+(my\s+)?receipts?|my\s+receipts?|track\s+(my\s+)?expenses?|expense\s+report)\b/i,
      /\b(add\s+(a\s+)?receipt|save\s+(a\s+)?receipt|receipt\s+scanner)\b/i,
      // Thai receipt phrases
      /(สแกนใบเสร็จ|ใบเสร็จของ(ฉัน|ผม|ดิฉัน)|รายการใบเสร็จ|ค่าใช้จ่าย|ติดตามค่าใช้จ่าย)/,
    ],
  },
  {
    intent: "finance",
    priority: 70,
    patterns: [
      /\b(stock\s+(price|quote)|share\s+(price|quote)|crypto\s+(price|quote)|bitcoin|ethereum|cryptocurrency)\b/i,
      /\b(eth|btc|sol|bnb|xrp|doge|ada|dot|link|avax)\s+(price|value|worth)\b/i,
      /\bprice\s+of\s+(btc|eth|sol|bnb|xrp|doge|bitcoin|ethereum|solana|crypto)\b/i,
      /\b(btc|eth|sol|bnb|xrp|doge|ada|dot|link|avax)\s*\/\s*\w+\b/i,
      /\b[A-Z]{2,5}\s+(price|stock|quote|shares?)\b/,
      /\b(fx\s+rate|exchange\s+rate|currency\s+rate|forex|convert\s+\d+\s+\w{3}\s+to\s+\w{3})\b/i,
      /\b\d+\s+(USD|EUR|GBP|JPY|THB|CNY|KRW|SGD|HKD|AUD|CAD|CHF)\s+to\s+(USD|EUR|GBP|JPY|THB|CNY|KRW|SGD|HKD|AUD|CAD|CHF)\b/i,
      /(ราคาหุ้น|หุ้น|ราคาบิทคอยน์|ราคาเอธีเรียม|ค่าเงิน|แลกเปลี่ยน)/,
    ],
  },
  {
    intent: "lists",
    priority: 70,
    patterns: [
      /\b(grocery\s+list|shopping\s+list|packing\s+list|todo\s+list|wish\s+list)\b/i,
      /\b(add\s+.{1,40}\s+to\s+(my\s+)?(grocery|shopping|packing|todo|wish)?\s*list|my\s+(grocery|shopping|packing|todo|wish)\s+list)\b/i,
      /\b(list\s+(my\s+)?(groceries|shopping|packing)|show\s+(my\s+)?(grocery|shopping|packing)\s+list)\b/i,
      // Thai list phrases
      /(รายการซื้อของ|รายการของที่ต้องซื้อ|รายการจัดกระเป๋า|รายการของฉัน|เพิ่มในรายการ)/,
    ],
  },
  {
    intent: "memory",
    priority: 70,
    patterns: [
      /\b(what\s+do\s+you\s+remember|what\s+do\s+you\s+know\s+about\s+me|what\s+have\s+you\s+remembered)\b/i,
      /\b(search\s+(my\s+)?memor(y|ies)|archived\s+memor(y|ies)|list\s+(my\s+)?memories|my\s+memories)\b/i,
      /\b(remember\s+(that|my|i|this)|don'?t\s+forget\s+(that|this)|make\s+a\s+note\s+(that|of))\b/i,
      /\b(forget\s+(that|this)|delete\s+(that\s+)?memory|remove\s+(that\s+)?memory)\b/i,
      // Thai memory phrases
      /(ความจำ|จำว่า|อย่าลืม|สิ่งที่จำ|ค้นหาความจำ|ลบความจำ)/,
    ],
  },
  {
    intent: "places",
    priority: 65,
    patterns: [
      /\b(suggest\s+places?|recommend\s+(a\s+)?place|places\s+to\s+(eat|go|visit)|restaurants?\s+near\s+me?|cafes?\s+near\s+me?|hotels?\s+near\s+me?)\b/i,
      /\b(where\s+(can|should)\s+i\s+(eat|go|stay)|good\s+places?\s+to\s+(eat|go))\b/i,
    ],
  },
  {
    intent: "news",
    priority: 65,
    patterns: [
      /\b(breaking\s+news|latest\s+news|top\s+(headlines?|\d+\s+news)|current\s+events|what'?s\s+in\s+the\s+news|news\s+update)\b/i,
      /\b(news\s+(about|on|from|today|this\s+week|this\s+month|right\s+now))\b/i,
      /^\s*(news|headlines?)[\s?.!]*$/i,
      // Thai news phrases
      /(ข่าว|ข่าวสาร|ข่าววันนี้|ข่าวล่าสุด|headlines?)/,
    ],
  },

  // ── Stateless lookups ─────────────────────────────────────────────────
  {
    intent: "search",
    priority: 60,
    patterns: [
      /\b(search\s+(for|the\s+web|online)|look\s+up|find\s+out|web\s+search|google\s+for|look\s+into)\b/i,
      /\b(what\s+(is|are|was|were)\s+the\s+(best|top|latest|worst)|how\s+do\s+i\s+|how\s+to\s+|how\s+does\s+|why\s+(is|are|did|does)\s+|research\s+)\b/i,
      /\b(tell\s+me\s+about|explain\s+(to\s+me\s+)?(what|how|why)|what\s+is\s+.+\??)\b/i,
    ],
  },
  {
    intent: "media",
    priority: 50,
    patterns: [
      /\b(read\s+(this|the)\s+(document|pdf|file)|summarize\s+(this|the)\s+(document|pdf|file|image|photo)|ocr|extract\s+text)\b/i,
      /\b(transcribe|what\s+(did|does)\s+(he|she|they)\s+say|what\s+did\s+it\s+say|what'?s\s+(being\s+)?said|voice\s+(note|message)|audio\s+(message|clip))\b/i,
      /\b(describe\s+(this|the)\s+(image|photo|picture)|what('s|s|\s+is)\s+(in\s+)?(this|the)\s+(image|photo|picture))\b/i,
      /\b(scan\s+(this|the|a)\s+(image|photo|picture|document|pdf|file))\b/i,
    ],
  },

  // ── Lowest: generic time/current-event markers ────────────────────────
  {
    intent: "recent",
    priority: 10,
    patterns: [
      /\b(today|tonight|this\s+week|this\s+month|last\s+night|right\s+now|currently|just\s+(now|announced|released|dropped)|as\s+of\s+now)\b/i,
      /\b(latest|current|recent|breaking|live|real[- ]?time|upcoming|ongoing|now)\b/i,
      /\b(score|winner|election|hurricane|earthquake|tsunami|flight\s+status|airport\s+(open|closed)|stock\s+market|market\s+today)\b/i,
      /\b(202[4-9]|20[3-9]\d)\b/,
    ],
  },
];

/**
 * Returns the best intent string for the query, or undefined when the query
 * is ambiguous or casual. When multiple intents match, the highest-priority
 * intent wins. undefined always means "use all tools" — never a failure mode.
 */
export function fastClassify(
  text: string,
  opts?: { hasStagedMedia?: boolean },
): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  // Exact casual utterances → no narrowing (gives all tools so follow-up
  // requests in the same message like "hi, what's the weather?" still work)
  if (CASUAL_TRIGGERS.some((re) => re.test(trimmed))) return undefined;

  const matched: { intent: string; priority: number }[] = [];
  for (const { intent, priority, patterns } of KEYWORD_MAP) {
    if (patterns.some((re) => re.test(trimmed))) {
      matched.push({ intent, priority });
    }
  }

  const hasMediaReference =
    opts?.hasStagedMedia &&
    /\b(this|that|the\s+(file|pdf|doc(?:ument)?|image|photo|picture|video|audio))\b/i.test(trimmed);

  if (matched.length === 0) {
    // Staged media reference with no stronger intent → media tools.
    if (hasMediaReference) return "media";
    return undefined;
  }

  matched.sort((a, b) => b.priority - a.priority);

  const first = matched[0];
  const second = matched[1];
  if (!first) return undefined;

  // Two top intents tie → ambiguous, use all tools.
  if (second && first.priority === second.priority) {
    return undefined;
  }

  // A broad research/news match combined with a staged-media demonstrative
  // is almost always about the media itself.
  if (hasMediaReference && ["search", "news", "recent"].includes(first.intent)) {
    return "media";
  }

  return first.intent;
}
