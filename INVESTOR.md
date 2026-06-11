# Lekha (เลขา) — Investor Brief

> **Your personal AI chief of staff, living in LINE.**

---

## The problem

Knowledge workers in Asia spend 2–3 hours daily context-switching between apps — LINE, Gmail, Calendar, Drive, weather, news, task lists. Nothing talks to anything else. Reminders get buried. Meetings get missed. The "personal assistant" market is either enterprise-only (expensive, rigid) or consumer chatbots (forgettable, no integrations).

## What Lekha does

Lekha is a **private AI assistant** that lives inside LINE, the dominant messaging app in Thailand, Japan, Taiwan, and Indonesia. Users message it like a friend. It remembers everything, handles tasks proactively, and connects to the tools they already use.

### Core capabilities

| Feature | What the user experiences |
|---|---|
| **Morning briefing** | 7 AM push: weather, today's calendar, open tasks, unread Gmail, news — all in one message |
| **Evening summary** | 9 PM wrap-up: what got done, what's left, tomorrow's prep |
| **Smart reminders** | "Remind me in 3 hours to call mom" → push at exactly the right time, with 3h and 1h warnings |
| **Recurring reminders** | "Remind me every weekday at 8am to take vitamins" → cron-scheduled via QStash |
| **Pre-meeting alerts** | Auto-detects calendar events and warns 1 day / 1 hour / 15 min before |
| **Email drafting & sending** | "Email mom the receipt" → looks up contacts, drafts, user says YES, sends from their Gmail with real attachments |
| **Calendar management** | "Schedule lunch with Ana tomorrow at noon" → drafts event, user confirms, creates in Google Calendar |
| **Memory** | "Remember I prefer espresso" → stored forever, referenced in future replies |
| **Task management** | Persistent open work items with due dates, check-ins, and Flex Message carousels |
| **Document intelligence** | OCR on photos, transcription on voice memos, summarization on PDFs |
| **Web search & news** | Real-time search via Tavily, cached news for briefings |

### Proactive, not just reactive

Most chatbots wait for the user to message first. Lekha **pushes**:
- Morning briefings at the user's local time
- Pre-meeting alerts before events
- Task deadline warnings
- Evening summaries

This creates **daily active engagement** rather than sporadic usage.

## Market

- **LINE**: 200M+ monthly active users across Asia (94M in Japan, 54M in Thailand)
- **Target**: Busy professionals, executives, entrepreneurs who value time and privacy
- **Model**: Private-by-default (allowlist-gated), subscription revenue

## Business model

- **Free tier**: Core chat, memory, tasks, web search
- **Paid tier** (monthly/yearly via Stripe): Google integrations (Gmail, Calendar, Drive, Contacts), proactive briefings, pre-meeting alerts, scheduled emails, document intelligence
- **Unit economics**: Serverless on Vercel (~$0 when idle), Gemini Flash Lite at $0.10/M input tokens, Upstash Redis/Vector free tier covers early scale

## Competitive moat

1. **LINE-native**: Competitors are web apps or standalone apps. Lekha lives where users already are.
2. **Multi-account Google**: Users can connect multiple Gmail/Calendar accounts and switch between them — a real pain point for professionals with work + personal accounts.
3. **Per-user state isolation**: Every user has their own encrypted memory, history, facts, tasks, archive. No data mixing.
4. **Agentic tool use**: The LLM decides which tools to call, in what order, with what arguments. It can chain 3–5 tool calls in a single turn (search contacts → draft email → attach file → send).
5. **Proactive layer**: The 15-minute cron sweep + QStash one-shots create a system that initiates, not just responds.

## Technical architecture

| Layer | Technology |
|---|---|
| Runtime | Next.js 16 App Router on Vercel Functions (Node.js, Fluid Compute) |
| AI | Google Gemini 2.5 Flash Lite via Vercel AI SDK v6 |
| Embeddings | Gemini text-embedding-004 → Upstash Vector (768d, cosine) |
| Memory / queues | Upstash Redis (per-user keys, TTL-managed) |
| Scheduled jobs | Upstash QStash (one-shots, recurring crons) |
| Web search | Tavily |
| Google APIs | Gmail, Calendar, Drive, People, Docs, Slides |
| Payments | Stripe subscriptions |
| Language | TypeScript, strict, Zod-validated |

## Current status

- **Live**: Production deployment at `https://lekha-iota.vercel.app`
- **Users**: Active user base with daily engagement (morning briefings, task management, email sending)
- **Integrations**: Full Google OAuth pipeline, multi-account support, Gmail threading, Drive upload, Calendar CRUD
- **Payments**: Stripe subscription flow complete, webhook handling for cancellations
- **Infrastructure**: QStash schedules active, Redis-backed state, vector search for long-term memory

## What makes this hard to copy

- **LINE integration**: HMAC-SHA256 signature verification, Flex Message templates, postback routing, media staging — all LINE-specific complexity
- **Google OAuth multi-account**: Token encryption at rest (AES-256-GCM), scope checking, refresh token handling, automatic re-auth on scope changes
- **Proactive orchestration**: Timezone-aware cron conversion, per-user scheduling windows, deduplication locks, push-failure safety
- **Memory system**: Rolling history (20 turns), structured facts (LRU-capped 200), archive chunks with semantic search — three-tier memory that actually works

## The ask

We're raising to scale beyond the current user base and build:
1. **Team/enterprise tier**: Shared calendars, delegated tasks, admin dashboards
2. **Voice mode**: Hands-free interaction via LINE voice messages
3. **Local language dominance**: Thai-first, then Japanese and Indonesian
4. **AI agent marketplace**: Custom tools users can build and share

---

**Contact**: James Perenchio
**Demo**: Add the LINE Official Account and say "hi"
