import { classifyIntent } from "../lib/intent";

const cases = [
  { text: "hi", expect: "casual" },
  { text: "thanks!", expect: "casual" },
  { text: "show me everything I need to do", expect: "task" },
  { text: "I need to buy milk tomorrow", expect: "task" },
  { text: "what's the weather in Bangkok", expect: "weather" },
  { text: "NVDA stock price", expect: "finance" },
  { text: "why did semiconductors drop last night", expect: "search" },
  { text: "top 5 finance news today", expect: "news" },
  { text: "remind me to call mom at 6pm", expect: "reminder" },
  { text: "remember I like Thai iced tea", expect: "memory" },
  { text: "what do you remember about my preferences", expect: "memory" },
  { text: "STOP SENDING ME ARTICLES BRO", expect: "casual" },
  { text: "show me the unicorn emoji", expect: "casual" },
  { text: "test", expect: "casual" },
  { text: "anything left to do?", expect: "task" },
  { text: "สวัสดี", expect: "casual" },
  { text: "มีงานอะไรเหลือบ้าง", expect: "task" },
  { text: "อากาศกรุงเทพเป็นยังไง", expect: "weather" },
  { text: "run this code for me: console.log(1)", expect: "fallback" },
  { text: "calculate 12345 * 67890", expect: "fallback" },
  { text: "what's the latest on Tesla?", expect: "news" },
  { text: "scan this receipt", expect: "receipts" },
  { text: "add eggs to grocery list", expect: "lists" },
  { text: "set my timezone to Asia/Tokyo", expect: "settings" },
  { text: "finance news", expect: "news" },
  { text: "what is finance", expect: "search" },
  { text: "mark buy milk as done", expect: "task" },
  { text: "what tasks are overdue", expect: "task" },
];

async function main() {
  let passed = 0;
  for (const c of cases) {
    const result = await classifyIntent(c.text);
    const ok = result.primary === c.expect;
    if (ok) passed++;
    console.log(`${ok ? "✅" : "❌"} "${c.text}" → ${result.primary} (expected ${c.expect}) ${result.confidence} ${result.isMulti ? "multi" : ""}`);
  }
  console.log(`\n${passed}/${cases.length} passed`);
}

main().catch(console.error);
