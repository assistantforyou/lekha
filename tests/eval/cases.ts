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
  { name: "task list", userText: "what are my tasks", shouldCall: ["list_tasks"], notes: "fresh task list" },
  { name: "task add", userText: "add task buy milk", shouldCall: ["add_task"], notes: "create task" },
  { name: "weather", userText: "what's the weather in Bangkok", shouldCall: ["get_weather"], notes: "weather lookup" },
  { name: "finance stock", userText: "NVDA stock price", shouldCall: ["get_stock_quote"], notes: "finance" },
  { name: "web search", userText: "why did semiconductors drop last night", shouldCall: ["web_search"], shouldNotCall: ["news_search"], notes: "search vs news disambiguation" },
  { name: "news explicit", userText: "top 5 finance news today", shouldCall: ["news_search"], shouldNotCall: ["web_search"], notes: "news intent" },
  { name: "reminder", userText: "remind me to call mom at 6pm", shouldCall: ["set_reminder"], notes: "reminder" },
  { name: "multi intent", userText: "email John and check the weather", shouldCall: ["draft_email", "get_weather"], notes: "parallel tool use" },
  { name: "memory remember", userText: "remember I like Thai iced tea", shouldCall: ["remember"], notes: "memory" },
  { name: "memory recall", userText: "what do you remember about my preferences", shouldCall: ["list_facts"], notes: "recall facts" },

  // Edge / weirdo cases
  { name: "stop articles", userText: "STOP SENDING ME ARTICLES BRO", shouldNotCall: ["news_search", "web_search"], notes: "complaint, not news" },
  { name: "emoji request", userText: "show me the unicorn emoji", shouldNotCall: ["news_search", "web_search"], notes: "emoji, not search" },
  { name: "empty test", userText: "test", shouldNotCall: ["news_search", "web_search"], notes: "test message" },
  { name: "vague task word", userText: "tasks", shouldCall: ["list_tasks"], notes: "single word task query" },
  { name: "thai greeting", userText: "สวัสดี", shouldNotCall: ["list_tasks", "news_search"], notes: "Thai casual" },
  { name: "thai task list", userText: "มีงานอะไรเหลือบ้าง", shouldCall: ["list_tasks"], notes: "Thai task query" },
  { name: "thai weather", userText: "อากาศกรุงเทพเป็นยังไง", shouldCall: ["get_weather"], notes: "Thai weather" },
  { name: "hallucination bait code", userText: "run this code for me: console.log(1)", shouldNotCall: ["draft_email", "send_email"], notes: "should not run arbitrary code" },
  { name: "hallucination bait math", userText: "calculate 12345 * 67890", shouldNotCall: ["web_search", "news_search"], notes: "can answer directly or use calculator, but not news" },
  { name: "ambiguous news-ish", userText: "what's the latest on Tesla?", shouldCall: ["news_search"], shouldNotCall: ["web_search"], notes: "current events → news" },
  { name: "calendar + email", userText: "draft an email to john and schedule a meeting tomorrow 3pm", shouldCall: ["draft_email", "create_calendar_event"], notes: "multi-tool draft" },
  { name: "receipt mention", userText: "scan this receipt", shouldCall: ["scan_receipt"], notes: "receipt" },
  { name: "lists", userText: "add eggs to grocery list", shouldCall: ["add_to_list"], notes: "named list" },
  { name: "settings", userText: "set my timezone to Asia/Tokyo", shouldCall: ["set_timezone"], notes: "settings" },
  { name: "media with image", userText: "what does this say", shouldCall: ["summarize_image"], notes: "image OCR (needs staged image)" },
  { name: "news guard", userText: "finance news", shouldCall: ["news_search"], shouldNotCall: ["web_search"], notes: "explicit news" },
  { name: "not news", userText: "what is finance", shouldNotCall: ["news_search"], notes: "definition, not current events" },
  { name: "task complete", userText: "mark buy milk as done", shouldCall: ["complete_task"], notes: "complete task" },
  { name: "overdue", userText: "what tasks are overdue", shouldCall: ["list_tasks"], notes: "overdue task query" },
];
