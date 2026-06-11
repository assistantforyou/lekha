# Lekha (เลขา)

> The personal assistant we wished we had.

---

## Why this exists

We were tired of apps that don't talk to each other. LINE for messaging. Gmail for email. Google Calendar for scheduling. A separate app for tasks. Another for reminders. Nothing connects them. Nothing remembers what matters to you.

So we built Lekha — a single AI secretary that lives inside LINE, knows your preferences, connects your tools, and handles the boring stuff before you have to think about it.

She speaks Thai like a local (ค่ะ and all). She remembers you prefer espresso. She warns you about meetings before they happen. She reads the receipts you photograph. She drafts emails from your own Gmail with real attachments.

Most chatbots wait for you to message them. Lekha **pushes** — morning briefings, evening summaries, task check-ins, meeting alerts. She initiates.

---

## What Lekha does

### Your day, handled

- **Morning briefing** — Wakes you up with weather, today's calendar, open tasks, unread Gmail, and news. All in one message.
- **Evening summary** — Wraps up what you got done, what's left, tomorrow's prep, and a quick news read.
- **Task check-in** — Nudges you about open tasks before you wind down.
- **Pre-meeting alerts** — Warns you 1 day, 1 hour, and 15 minutes before calendar events.

### Your tools, connected

- **Gmail** — Search, read, summarize unread, draft replies, send emails with attachments from LINE or Drive.
- **Calendar** — Check today's schedule, create events, find free time, reschedule, delete.
- **Drive** — Search files, upload from LINE, read document text.
- **Contacts** — Search people, save new contacts.
- **Docs & Slides** — Create and edit Google Docs and Slides.

**Multi-account support** — Work Gmail + personal Gmail, both connected. Switch anytime.

### Your memory, preserved

- **Facts** — "Remember I prefer espresso" → stored forever, referenced automatically.
- **History** — Rolling 20-turn conversation memory.
- **Archive** — Long-term compressed chunks with semantic search. Ask "what did we discuss about that bird project?" and she finds it.

### Your tasks and reminders

- **Tasks** — Persistent open work items with due dates. Complete them via text or tap-to-act buttons.
- **Reminders** — One-shot or recurring. 3-hour and 1-hour warnings before they fire.
- **Scheduled emails** — "Send this Monday at 9 AM" → sends exactly then.

### Your documents, understood

- **Receipts** — Photograph a receipt, she extracts merchant, date, total, items, category.
- **PDFs** — Summarize or extract text from any document.
- **Photos** — OCR on images, describe what's in them.
- **Voice memos** — Transcribe audio to text.

### Your world, searched

- **Web search** — Real-time search via Tavily, with source citations.
- **News** — Current events for briefings or on-demand queries.
- **Stocks, crypto, FX** — Live prices with sources.
- **Weather** — Local forecast, rain chance, highs and lows.

---

## How she works

Lekha is built on **Gemini 2.5 Flash Lite** through the Vercel AI SDK. She decides which tools to call, in what order, with what arguments — sometimes 3–5 parallel calls in a single turn.

She runs serverless on **Vercel Functions**, stores memory in **Upstash Redis**, schedules proactive pushes via **Upstash QStash**, and searches long-term memory with **Upstash Vector** (768-dimensional embeddings).

Her tokens are **encrypted at rest** (AES-256-GCM). Her OAuth tokens are tied to your account, isolated from everyone else. She's private by default — allowlist-gated, not open to the public.

---

## What's next

### Soon
- **Voice mode** — Send voice messages, get voice-like replies. Hands-free Lekha.
- **Thai optimization** — Better Thai parsing, more natural ค่ะ usage, local date/time formatting.
- **Dashboard** — Web settings page for users who prefer clicking to typing.

### Next
- **WhatsApp** — Same Lekha, different platform. Large parts of the stack transfer directly.
- **iOS/Android app** — Direct app for users who want it outside messaging platforms.
- **Team tier** — Shared calendars, delegated tasks, admin controls for small teams.

### Later
- **Notion & Slack** — Expand beyond Google Workspace.
- **Local LLM option** — Privacy-first users can run smaller models locally.
- **Agent marketplace** — Custom tools users can build and share.

---

## Who built this

**James Perenchio** — Product & engineering  
**Panupol Thepyasuwan** — Business & operations

We own this bot. We run it. We use it every day. We built it because we needed it.

---

## Try it

Add the LINE Official Account and say "hi."

Production: `https://lekha-iota.vercel.app`
