# Lekha (เลขา)

> A personal AI secretary that lives in your LINE chat.

---

## What it is

Lekha is a private AI assistant built for LINE, the dominant messaging app in Thailand, Japan, Taiwan, and Indonesia. Users message it like a friend — it remembers everything, handles tasks proactively, and connects to the tools they already use.

The name "Lekha" (เลขา) is Thai for "secretary." The bot's personality is warm, professional, and quietly competent — a lady secretary who gets things done without needing to be asked twice.

## What it does

### Reactive (user asks, bot delivers)

| User says | Bot does |
|---|---|
| "Remind me in 30 min to call mom" | Schedules reminder with 3h and 1h pre-warnings |
| "Email Bob the PDF I just sent" | Looks up contacts, drafts email with real attachment, waits for YES |
| "What's on my calendar today?" | Reads Google Calendar, lists events in local time |
| "Schedule lunch with Ana tomorrow at noon" | Checks for conflicts, drafts event, creates on YES |
| "Remember I prefer espresso" | Stores as durable fact, referenced in future replies |
| "Read this receipt" | OCR → merchant, date, total, items, category |
| "Summarize this PDF" | Full text extraction + bullet summary |
| "What's NVDA at?" | Real-time stock price with source citation |
| "Search the web for Bangkok weather tomorrow" | Tavily search → answer with source |

### Proactive (bot pushes without being asked)

- **Morning briefing** (user-configured time): weather, today's calendar, open tasks, unread Gmail, news — pushed to LINE
- **Evening summary** (9 PM): what got done, what's left, tomorrow's prep, news
- **Task check-in** (30 min before evening): open tasks as a tap-to-act Flex carousel
- **Pre-meeting alerts** (1 day / 1 hour / 15 min before): heads-up with event time
- **Task deadline warnings** (24h before): "Heads up: X is due tomorrow"
- **Scheduled emails**: user says "send this Monday at 9 AM" → fires exactly then

### Integrations

Full Google Workspace suite via OAuth:
- Gmail (search, read, summarize, draft replies, send with attachments)
- Calendar (list, create, update, delete, find free time)
- Drive (search, upload, read text)
- Contacts (search, save new contacts)
- Docs & Slides (create, edit)

**Multi-account support:** Users can connect multiple Gmail accounts (work + personal) and switch between them.

## Business model

- **Subscription via Stripe:** ฿599/month or ฿5,990/year (save 17%)
- **7-day free trial** on signup
- **Allowlist-gated:** Private bot — only subscribed users + admin-approved accounts get access
- Self-serve signup through LINE → Stripe Checkout → immediate access

## Architecture

| Layer | Technology |
|---|---|
| Runtime | Next.js 16 App Router on Vercel Functions (Node.js, Fluid Compute) |
| AI | Google Gemini 2.5 Flash Lite via Vercel AI SDK v6 |
| Memory | Upstash Redis (per-user keys, TTL-managed) |
| Long-term memory | Upstash Vector (768d embeddings, cosine similarity) + compressed archive chunks |
| Scheduling | Upstash QStash (one-shots for reminders, recurring cron for master sweep) |
| Web search | Tavily |
| Payments | Stripe subscriptions + webhooks |
| Language | TypeScript, strict mode, Zod-validated |

## What makes it hard to copy

1. **LINE-native complexity:** HMAC-SHA256 signature verification, Flex Message templates, postback routing, media staging, 300-char postback data limits, 5,000-char message limits — all handled.

2. **Agentic tool use:** The LLM decides which tools to call, in what order, with what arguments. A single user request can trigger 3–5 parallel tool calls (e.g., search contacts + draft email + attach file + set reminder).

3. **Multi-account Google OAuth:** Token encryption at rest (AES-256-GCM), scope checking, refresh token handling, automatic re-auth on scope changes. Most integrations handle one account; Lekha handles many.

4. **Three-tier memory:**
   - Rolling 20-turn conversation history
   - Structured facts (200 max, LRU-capped, categorized)
   - Archive chunks with semantic search (vector embeddings + substring fallback)

5. **Proactive orchestration:** Timezone-aware cron conversion, per-user scheduling windows, atomic deduplication locks, push-failure safety nets.

## Current state

- **Live:** Production deployment at `https://lekha-iota.vercel.app`
- **Stripe:** Checkout, subscription webhooks, cancellation handling all wired
- **Google OAuth:** Full pipeline with multi-account support
- **LINE:** Official Account active, webhook verified
- **Admin tooling:** `/status`, `/force-briefing`, `/allow`, `/users` commands for production diagnostics

## Historical note on architecture evolution

An early version stored per-user QStash schedule IDs in user settings (for individual briefing schedules). This was abandoned in favor of a single master sweep that iterates all users every 15 minutes. The migration is preserved as a no-op to maintain settings version stability.

---

**Contact:** James Perenchio
**Production:** `https://lekha-iota.vercel.app`
