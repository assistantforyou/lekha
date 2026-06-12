# Lekha (เลขา)

> A personal secretary for everyone who lives on their phone.

---

## The idea

Your phone is already full of apps that know pieces of you. Gmail knows your email. Calendar knows your schedule. LINE knows who you talk to. Drive knows your files. None of them talk to each other. None of them remember what matters to you. None of them take initiative.

Lekha is a single AI secretary that lives inside LINE and ties everything together. She reads your email, checks your calendar, tracks your tasks, remembers your preferences, and pushes you what you need before you ask.

She is warm, competent, and Thai — the kind of secretary who says ค่ะ and gets it done without being asked twice.

## What she does

### She wakes up before you do
Every morning at the user's chosen time, Lekha pushes a briefing: weather, today's calendar, open tasks, unread Gmail, and the news. Not a wall of text. A single, scannable message.

### She closes your day
At 9 PM local time, she sends an evening summary: what got done, what's left, tomorrow's prep, and a quick news read.

### She handles the boring stuff
- **Reminders** with 3-hour and 1-hour warnings
- **Pre-meeting alerts** at 1 day, 1 hour, and 15 minutes
- **Task deadline warnings** 24 hours before
- **Scheduled emails** that fire exactly when the user wants

### She connects your tools
Gmail, Calendar, Drive, Contacts, Docs, Slides. Multiple Google accounts at once. Users can connect work Gmail and personal Gmail and switch between them.

### She remembers
Not just conversation history. Structured facts, archive search with embeddings, and long-term memory that survives across weeks and months.

### She sees and hears
Receipts, PDFs, photos, voice memos — she reads them, summarizes them, extracts data from them, and acts on what she finds.

## Why LINE

LINE is where people in Thailand already are. It is the default place for messages, groups, calls, and daily life. Putting Lekha inside LINE means users don't need to download another app or change their behavior. They just add a friend and start talking.

## The model

Lekha is a subscription product: ฿599/month or ฿5,990/year, with a 7-day free trial. Billing runs through Stripe. Access is allowlist-gated — subscribed users and admin-approved accounts only.

The infrastructure is lean: Vercel Functions, Upstash Redis/Vector/QStash, and Google's Gemini API. Most third-party services run on free tiers today.

## Where this goes

1. **Voice mode** — hands-free interaction inside LINE
2. **WhatsApp** — same assistant, second platform
3. **Team tier** — shared calendars, delegated tasks, admin controls
4. **iOS/Android app** — a direct home for users who want one
5. **More integrations** — Notion, Slack, and other tools users already rely on

## Why now

AI is finally good enough to be a real assistant. But most AI products are either generic chatbots with no memory, or enterprise tools that require IT teams to set up. Lekha sits in the middle: personal, private, connected, and proactive — inside the app people already use.

## Who built this

James Perenchio and Panupol Thepyasuwan. We built Lekha because we wanted it ourselves.

---

Production: `https://lekha-iota.vercel.app`
