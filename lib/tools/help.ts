import { z } from "zod";
import { tool } from "ai";

const HELP_TEXT = `Here's what I can do:

🤖 *How to talk to me*
- In a 1:1 chat: just send a message.
- In a group: mention me (@Lekha), say my name ("Lekha, …"), reply to my message, or use an admin slash command.

⚡ *Slash commands*
- /settings — open the settings menu
- /settings <section> — jump to a section (briefing, tools, persona, memory, facts, locale)
- /set <key> <value> — quick setting change (e.g. /set timezone Asia/Bangkok, /set language th, /set morning 07:30, /set morning off)
- /remember <fact> — save a fact to memory
- /tutorial — restart onboarding
- /promo <code> — redeem a free-access code
- /myid — get your LINE user ID
- /help — show this help

🧠 *Memory*
- "remember that I prefer espresso"
- "what do you know about me?"
- "forget that" / "update memory #3 to say…"
- "search my old conversations for X"

✅ *Tasks*
- "add a task to ship the cert PDF"
- "list my open tasks" / "mark task #3 done"

📋 *Lists* (grocery, packing, or any named list)
- "add milk to my grocery list"
- "show my packing list"
- "remove eggs from grocery list" / "clear the list"

⏰ *Reminders*
- "remind me in 5 min to stretch"
- "remind me every weekday at 8 AM to take vitamins"
- "list my reminders" / "cancel that 8 AM reminder"

📧 *Email & Inbox* (Google account needed)
- "email mom the receipt"
- "draft to bob@x.com cc'ing alice with the cert PDF attached"
- "summarize today's inbox"
- "reply to Bob's last email saying I'll be there"
- "send this on Monday at 9 AM"

📅 *Calendar* (Google account needed)
- "schedule lunch with Ana tomorrow at noon"
- "what's on my calendar today?"
- "any conflicts next week?"

📁 *Drive & Docs* (Google account needed)
- "search my Drive for Q3 report"
- "save this PDF to Drive" / "read me that doc"
- "create a Google Doc: meeting notes for today"
- "make a slide deck about our Q2 results"

📷 *Media* — photos, voice notes, PDFs, Word, Excel, PowerPoint
- Send any file → I hold it for ~30 min
- "what's in this photo?" — vision Q&A / OCR
- "transcribe this voice note"
- "summarize this document"
- "email all of those to Bob" — attaches staged files

🧾 *Receipts*
- Send a receipt photo → "scan this"
- "list my recent receipts"
- "search receipts for coffee last month"

🌐 *Search & Info*
- "search the web for X"
- "what's the weather in Bangkok?"
- "USD to THB rate" / "AAPL stock price" / "BTC price"
- "latest news on X"

📆 *Daily Briefing*
- "send me a morning briefing at 7 AM"
- "give me my briefing now"
- "send me an evening summary at 9 PM"

🔌 *Google Accounts*
- "connect my Google account"
- "list my Google accounts" / "use my work account"
`;

export function buildHelpTools() {
  return {
    show_help: tool({
      description:
        "Show the user a concise list of all current capabilities. Call this when the user asks 'what can you do', 'help', 'how do I…', '/help', or seems lost.",
      inputSchema: z.object({}),
      execute: async () => ({ help: HELP_TEXT }),
    }),
  };
}

export { HELP_TEXT };
