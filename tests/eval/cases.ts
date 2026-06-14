export type EvalCase = {
  name: string;
  userText: string;
  shouldCall?: string[];
  shouldNotCall?: string[];
  notes?: string;
};

export const EVAL_CASES: EvalCase[] = [
  // Normal / happy path
  { name: "greeting", userText: "hi", shouldNotCall: ["list_tasks", "news_search", "web_search"], notes: "casual → no tools" },
  { name: "thanks", userText: "thanks!", shouldNotCall: ["list_tasks", "news_search"], notes: "casual → no tools" },
  { name: "task list", userText: "show me everything I need to do", shouldCall: ["list_tasks"], notes: "fresh task list" },
  { name: "task add", userText: "I need to buy milk tomorrow", shouldCall: ["add_task"], notes: "create task" },
  { name: "weather", userText: "what's the weather in Bangkok", shouldCall: ["weather"], notes: "weather lookup" },
  { name: "finance stock", userText: "NVDA stock price", shouldCall: ["stock_price"], notes: "finance" },
  { name: "web search", userText: "why did semiconductors drop last night", shouldCall: ["web_search"], shouldNotCall: ["news_search"], notes: "search vs news disambiguation" },
  { name: "news explicit", userText: "top 5 finance news today", shouldCall: ["news_search"], shouldNotCall: ["web_search"], notes: "news intent" },
  { name: "reminder", userText: "remind me to call mom at 6pm", shouldCall: ["set_reminder"], notes: "reminder" },
  { name: "memory remember", userText: "remember I like Thai iced tea", shouldCall: ["remember"], notes: "memory" },
  { name: "memory recall", userText: "what do you remember about my preferences", shouldCall: ["list_memories"], notes: "recall memories" },

  // Edge / weirdo cases
  { name: "stop articles", userText: "STOP SENDING ME ARTICLES BRO", shouldNotCall: ["news_search", "web_search"], notes: "complaint, not news" },
  { name: "emoji request", userText: "show me the unicorn emoji", shouldNotCall: ["news_search", "web_search"], notes: "emoji, not search" },
  { name: "empty test", userText: "test", shouldNotCall: ["news_search", "web_search"], notes: "test message" },
  { name: "vague task word", userText: "anything left to do?", shouldCall: ["list_tasks"], notes: "task query" },
  { name: "thai greeting", userText: "สวัสดี", shouldNotCall: ["list_tasks", "news_search"], notes: "Thai casual" },
  { name: "thai task list", userText: "มีงานอะไรเหลือบ้าง", shouldCall: ["list_tasks"], notes: "Thai task query" },
  { name: "thai weather", userText: "อากาศกรุงเทพเป็นยังไง", shouldCall: ["weather"], notes: "Thai weather" },
  { name: "hallucination bait code", userText: "run this code for me: console.log(1)", shouldNotCall: ["draft_email", "send_email"], notes: "should not run arbitrary code" },
  { name: "hallucination bait math", userText: "calculate 12345 * 67890", shouldNotCall: ["web_search", "news_search"], notes: "can answer directly or use calculator, but not news" },
  { name: "ambiguous news-ish", userText: "what's the latest on Tesla?", shouldCall: ["news_search"], shouldNotCall: ["web_search"], notes: "current events → news" },
  { name: "receipt mention", userText: "scan this receipt", shouldCall: ["scan_receipt"], notes: "receipt" },
  { name: "lists", userText: "add eggs to grocery list", shouldCall: ["add_to_list"], notes: "named list" },
  { name: "settings", userText: "set my timezone to Asia/Tokyo", shouldCall: ["set_timezone"], notes: "settings" },
  { name: "news guard", userText: "finance news", shouldCall: ["news_search"], shouldNotCall: ["web_search"], notes: "explicit news" },
  { name: "not news", userText: "what is finance", shouldNotCall: ["news_search"], notes: "definition, not current events" },
  { name: "task complete", userText: "mark buy milk as done", shouldCall: ["complete_task"], notes: "complete task" },
  { name: "overdue", userText: "what tasks are overdue", shouldCall: ["list_tasks"], notes: "overdue task query" },

  // Media / staged files (dev chat endpoint can't actually stage files, so these
  // verify the classifier + tool registry don't block media tools when the prompt
  // references a staged file).
  { name: "summarize this PDF", userText: "summarize this PDF", shouldCall: ["summarize_document"], notes: "PDF summary request" },
  { name: "tell me about this file", userText: "what can you tell me about this", shouldCall: ["summarize_document", "summarize_image", "ocr_image"], shouldNotCall: ["web_search"], notes: "ambiguous reference to staged file" },
];
