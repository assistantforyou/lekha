# Phase 1 Architecture Audit — Lekha LINE Bot

**Scope:** Full codebase walkthrough of the Next.js App Router backend that powers the Lekha personal assistant in LINE.  
**Date:** 2026-07-07  
**Auditor:** Kimi Code CLI (read-only exploration)  
**Repo:** `/Users/jamesperenchio/Desktop/lekha`

This report maps the runtime architecture, execution graphs, active vs. legacy paths, and the boundary between the production Mastra-based agent and the legacy Vercel AI SDK agent.

---

## 1. Executive Summary

Lekha is a **private, allowlist-gated LINE bot** built on:

- **Next.js 16 App Router** (`app/api/**/*.ts`) on Vercel Functions (`nodejs`, `force-dynamic`).
- **LINE Messaging API** for inbound webhooks and outbound replies/pushes.
- **Google Gemini 2.5 Flash** via the Vercel AI SDK (`ai` + `@ai-sdk/google`).
- **Mastra** framework partially integrated (`mastra/` directory) — this is the **current production agent path**.
- **Custom Redis memory layer** built on Upstash Redis: history, facts, archive, documents, staged media, settings, audit log.
- **Upstash QStash** for one-shot reminders, pre-meeting alerts, scheduled emails, and the master proactive sweep.
- **Google Workspace APIs** (Gmail, Calendar, Drive, Docs, Slides, People) behind OAuth 2.0 with encrypted refresh tokens.
- **Stripe** for optional subscription lifecycle.
- **Upstash Vector** for semantic archive/document search, with substring fallback.

The most important architectural tension is the **dual agent path**: production text messages run through `mastra/run.ts` → `Agent.generate()`, while a legacy `lib/llm/agent.ts` that calls `generateText()` directly is still kept for evals and shared result-processing utilities.

---

## 2. Repository Layout at a Glance

```
app/api/                      # HTTP boundaries (30 route handlers)
  line/webhook/route.ts       # main LINE webhook entry point
  dev/chat/route.ts           # bearer-protected dev/testing endpoint
  cron/sweep/fire/route.ts    # QStash callback: master proactive sweep
  reminders/{fire,relay}/     # QStash callbacks for reminders
  scheduled-email/fire/       # QStash callback for deferred email
  oauth/google/callback/      # OAuth code exchange + auto-resume pending
  auth/line/...               # LINE Login for dashboard
  dashboard/...               # dashboard REST endpoints
  github/webhook/             # GitHub push/PR/issue/merge notifications
  webhooks/stripe/            # Stripe subscription events
  health/, status/, report/   # diagnostics

lib/
  handlers/                   # LINE event handlers
  llm/                        # prompts, provider, agent orchestration, result processing
  memory/                     # Redis-backed memory modules
  tools/                      # AI SDK tool registry (single source of truth)
  line/                       # LINE client, verify, flex templates
  sweep.ts                    # proactive master sweep
  confirm.ts + pending-runner.ts  # draft confirmation queue
  webhook-postback.ts         # LINE postback verb dispatcher
  shortcuts.ts                # LLM-bypass commands (help, connect google, briefing, etc.)
  settings-menu.ts            # /settings Flex menu + typed commands
  tutorial.ts                 # interactive onboarding tutorial
  admin-commands.ts           # /allow, /approve, /status, /force-briefing, etc.

mastra/
  index.ts                    # Mastra singleton export
  agents/lekha-agent.ts       # Mastra Agent definition
  run.ts                      # production runner (bridges into Mastra)
  tools/index.ts              # wraps lib/tools into Mastra tools
  tools/wrap-ai-tool.ts       # AI SDK → Mastra tool adapter
```

---

## 3. API Surface Inventory (30 Routes)

| # | Route | Purpose | Caller |
|---|-------|---------|--------|
| 1 | `app/api/line/webhook/route.ts` | LINE webhook entry point | LINE Platform |
| 2 | `app/api/dev/chat/route.ts` | Dev/text+image test endpoint | Internal/dev |
| 3 | `app/api/cron/sweep/route.ts` | Legacy sweep endpoint (forwards to `lib/sweep.ts`) | QStash / manual |
| 4 | `app/api/cron/sweep/fire/route.ts` | Current sweep endpoint | QStash schedule |
| 5 | `app/api/reminders/fire/route.ts` | Fire one-shot/recurring reminder | QStash |
| 6 | `app/api/reminders/relay/route.ts` | Long-delay reminder relay chain | QStash |
| 7 | `app/api/scheduled-email/fire/route.ts` | Deferred email send | QStash |
| 8 | `app/api/oauth/google/callback/route.ts` | Google OAuth callback | Google OAuth |
| 9 | `app/api/auth/line/start/route.ts` | LINE Login web start | Dashboard |
| 10 | `app/api/auth/line/callback/route.ts` | LINE Login web callback | LINE Login |
| 11 | `app/api/auth/line/dashboard-start/route.ts` | Dashboard session auth start | Dashboard |
| 12 | `app/api/auth/line/dashboard-callback/route.ts` | Dashboard session auth callback | LINE Login |
| 13 | `app/api/dashboard/me/route.ts` | Current user profile | Dashboard UI |
| 14 | `app/api/dashboard/settings/route.ts` | Settings CRUD | Dashboard UI |
| 15 | `app/api/dashboard/facts/route.ts` | Facts CRUD | Dashboard UI |
| 16 | `app/api/dashboard/connect-google/route.ts` | Connect Google from dashboard | Dashboard UI |
| 17 | `app/api/dashboard/disconnect-google/route.ts` | Disconnect Google account | Dashboard UI |
| 18 | `app/api/dashboard/test-line/route.ts` | Test LINE push | Dashboard UI |
| 19 | `app/api/github/webhook/route.ts` | GitHub repo event notifications | GitHub |
| 20 | `app/api/github/line-webhook/route.ts` | Register GitHub → LINE recipient | LINE |
| 21 | `app/api/webhooks/stripe/route.ts` | Stripe checkout/subscription events | Stripe |
| 22 | `app/api/subscribe/route.ts` | Marketing email capture | Landing page |
| 23 | `app/api/health/route.ts` | Dependency health check | Monitoring |
| 24 | `app/api/status/route.ts` | Human-readable Gemini tier status | Humans |
| 25 | `app/api/report/marketing/route.ts` | Internal marketing report | Internal |
| 26 | `app/api/report/status/route.ts` | Internal status report | Internal |
| 27 | `app/api/report/user/route.ts` | Per-user diagnostic report | Internal |
| 28 | `app/api/admin/test-push/route.ts` | Admin test push | Admin |
| 29 | `app/api/report/marketing/route.ts` *(duplicate listing)* | — | — |
| 30 | `app/api/...` misc dashboard/connect routes | — | — |

> Note: `report/*`, `subscribe`, `status`, `admin/test-push` are low-traffic diagnostic/marketing endpoints; all are present and wired but invoked manually or by internal dashboards.

---

## 4. Execution Graphs

### 4.1 LINE Webhook — Text Message

```
LINE Platform
    │ POST /api/line/webhook
    ▼
verifyLineSignature(raw, sig, LINE_CHANNEL_SECRET)
    │
    ▼
Webhook.parse(payload)  →  for each event
    │
    ├─ postback events  → handle synchronously
    │
    └─ other events     → respond 200, then after() async loop
         │
         ▼
    handleEvent(event, gate, mode)
         │
         ├─ dedup via seen:{webhookEventId} (10 min NX)
         │
         ├─ trial:start postback
         │
         ├─ join / leave / memberJoined / memberLeft
         │
         ├─ allowlist gate (passesGate)
         │
         ├─ follow → onboarding / greeting
         │
         ├─ postback → handlePostback()
         │
         └─ message
              │
              ├─ group? → handleGroupMessage()
              │
              └─ 1:1 text
                   │
                   ├─ rate-limit check
                   ├─ trial quota check
                   ├─ pending classification (yes/no)
                   ├─ /myid, /admin, /promo commands
                   ├─ shortcuts dispatch (help, connect google, briefing, tasks, settings)
                   │
                   └─ respondToText(replyToken, userId, profile, userText, traceId)
                        │
                        ├─ handleTutorialText() (if in onboarding)
                        ├─ listRecentMedia(userId)
                        ├─ fastClassify(userText, { hasStagedMedia })
                        ├─ parallel load: facts, accounts, settings
                        │
                        └─ runMastraAgent(messages, opts)
                             │
                             ├─ buildSystemPrompt(facts, profile, settings)
                             ├─ toolsForUser(userId, { hint, userHasGoogle, disabledCategories, hasStagedMedia })
                             │       └─ REGISTRY filtered by env/category/hint
                             ├─ buildLekhaTools(ctx) → wrapAiTool() each tool
                             ├─ mastra.getAgent("lekha").generate(..., maxSteps: 8)
                             │       └─ Mastra Agent with Upstash Memory + Gemini 2.5 Flash
                             │
                             └─ processResult() / formatProcessed()
                                  │
                                  ├─ detect auth/disabled/api errors
                                  ├─ renderDraftsBlock() for pending drafts
                                  ├─ buildFlexFromToolResults() / buildDraftFlexCards()
                                  └─ enrichReply()
                                       │
                                       ▼
                                  replyOrPush(to, replyToken, messages, onQuoteTokens)
                                       │
                                       ├─ try reply(replyToken, ...)
                                       └─ fallback push(to, ...)
                        │
                        └─ appendTurn(userId, user/assistant)  (history.ts)
                             └─ maybeExtractFacts(userId) fire-and-forget
```

**Key files & lines:**

- `app/api/line/webhook/route.ts:46-122` — signature verification, sync postback handling, `after()` dispatch.
- `app/api/line/webhook/route.ts:125-381` — `handleEvent` dispatcher.
- `app/api/line/webhook/route.ts:286-340` — 1:1 text path (pending, admin, shortcuts, `respondToText`).
- `lib/handlers/text.ts:1-180` — text handler.
- `lib/handlers/text.ts:102` — `runMastraAgent(...)` call.
- `mastra/run.ts:92` — `runMastraAgent()` entry.
- `mastra/agents/lekha-agent.ts:1-90` — Mastra Agent definition.
- `lib/llm/agent.ts:320` — legacy `runAgent()` kept for evals.
- `lib/tools/index.ts:1-260` — declarative tool registry.
- `mastra/tools/index.ts:1-60` — bridge to Mastra tools.
- `mastra/tools/wrap-ai-tool.ts:1-40` — AI SDK → Mastra adapter.
- `lib/llm/render-drafts.ts:1-120` — draft block rendering.
- `lib/enrich-reply.ts:1-120` — final reply enrichment.
- `lib/line/client.ts:1-200` — LINE reply/push client.

### 4.2 LINE Webhook — Image / Other Media

```
LINE Platform
    │
    ▼
handleEvent()
    │
    ├─ image → respondToImage(replyToken, userId, profile, messageId, mode, traceId)
    │             ├─ stage media in recent-media list (RPUSH + LTRIM + TTL)
    │             ├─ if mode !== "stage_only":
    │             │   ├─ fetch image bytes via getMessageContent()
    │             │   ├─ maybe run vision (media-ai)
    │             │   └─ replyOrPush()
    │             └─ appendTurn()
    │
    └─ video/audio/file → respondToOtherMedia(...)
                          ├─ stage media
                          ├─ audio → auto-transcribe + index document
                          └─ if normal mode: summarize/transcribe + reply
```

**Key files:**

- `lib/handlers/image.ts` — image staging + vision.
- `lib/handlers/other-media.ts` — video/audio/file staging + transcription.
- `lib/memory/recent-media.ts` — staged media list (30 min TTL, max 10).
- `lib/tools/media-ai.ts` — transcription/summarization tools.
- `lib/memory/documents.ts` — indexed uploaded docs/audio transcripts.

### 4.3 Postback (Flex Button Taps)

```
LINE Platform
    │
    ▼
handleEvent()  →  synchronous path
    │
    ▼
handlePostback(event)
    │
    ├─ parsePostbackData(data) → verb + args
    │
    └─ HANDLERS[verb]
         ├─ confirm  → executePendingAll() / clearPending()
         ├─ task     → complete/reopen task
         ├─ checkin  → task check-in response
         ├─ gmail    → quick Gmail actions
         ├─ list     → named list CRUD
         ├─ event    → calendar event actions
         ├─ pending  → pending action preview
         ├─ group    → group settings
         ├─ settings → handleSettingsPostback()
         ├─ tutorial → handleTutorialPostback()
         ├─ trial    → trial start
         └─ help-demo→ help demo
```

**Key files:**

- `lib/webhook-postback.ts` — dispatcher.
- `lib/line/flex/index.ts` — Flex template exports + `parsePostbackData()`.
- `lib/settings-menu.ts` — settings postback/text handler.
- `lib/tutorial.ts` — onboarding tutorial postback/text handler.
- `lib/confirm.ts` + `lib/pending-runner.ts` — confirmation queue.

### 4.4 Proactive Layer (Master Sweep)

```
QStash schedule every 15 min
    │ POST /api/cron/sweep/fire
    ▼
verify QStash signature
    │
    ▼
runSweepForAll()
    │
    ├─ load users:active set
    ├─ for each userId:
    │   ├─ claimPushLock(pushlock:{userId}:{type}:{YYYY-MM-DD}, 5-min TTL)
    │   ├─ shouldFireBriefingNow()  → buildMorningBriefing()  → push
    │   ├─ shouldFireEveningSummaryNow() → buildEveningSummary() → push
    │   ├─ shouldFireTaskCheckIn()  → task check-in → push
    │   └─ preMeetingAlerts / deadlineAlerts already scheduled as one-shots
    │
    └─ cleanup stale locks
```

**Key files:**

- `app/api/cron/sweep/fire/route.ts` — current sweep endpoint.
- `app/api/cron/sweep/route.ts` — legacy endpoint (forwards to `lib/sweep.ts`).
- `lib/sweep.ts` — sweep orchestration.
- `lib/llm/briefing.ts` — morning briefing builder.
- `lib/llm/evening-summary.ts` — evening summary builder.
- `lib/proactive-schedules.ts` — one-shot pre-meeting / deadline scheduling.

### 4.5 Reminder Scheduling & Firing

```
User says "remind me in 30 min"
    │
    ▼
set_reminder tool (lib/tools/reminders.ts)
    │
    ├─ short delay (≤ ~7 days):
    │   ├─ publish 3h warning (if applicable)
    │   ├─ publish 1h warning (if applicable)
    │   └─ publish final reminder to /api/reminders/fire
    │
    └─ long delay (> 7 days):
        └─ publish relay to /api/reminders/relay, which re-chains until close

QStash fires /api/reminders/fire
    │
    ├─ verify signature
    ├─ consumeReminder(userId, id) (GETDEL)
    └─ replyOrPush(userId, "", textMsg(message))
```

**Key files:**

- `lib/tools/reminders.ts` — scheduling tools.
- `app/api/reminders/fire/route.ts` — final fire endpoint.
- `app/api/reminders/relay/route.ts` — long-delay relay endpoint.
- `lib/cron.ts` — local→UTC cron conversion.

### 4.6 Google OAuth + Auto-Resume Pending Actions

```
User types "connect google"
    │
    ▼
shortcut dispatch → buildConnectUrl(userId)
    │
    ├─ HMAC(userId + expiresAt) signed token
    ├─ Redis marker oauth:connect_link:{sig} (10 min, then 90 s grace for double-request)
    └─ /connect/{token} landing page

User clicks → Google consent
    │
    ▼
/api/oauth/google/callback?code=...&state=...
    │
    ├─ completeOAuth(code, state)
    │   ├─ getdel oauth:state:{state}
    │   ├─ exchange code
    │   ├─ discover email
    │   ├─ encrypt + store tokens at google:tokens:{userId}:{email}
    │   └─ update google:accounts:{userId}
    │
    ├─ notify user "Google connected"
    └─ executePendingAll(userId, pending)  → auto-send drafts created before auth
```

**Key files:**

- `lib/tools/google-auth.ts` — OAuth helpers, token storage, account switching.
- `app/connect/[token]/page.tsx` — signed-token landing page.
- `app/api/oauth/google/callback/route.ts` — OAuth callback.
- `lib/pending-runner.ts` — executes pending drafts.

---

## 5. Handler Inventory (Active vs. Legacy/Eval)

| Handler | File | Called By | Status |
|---------|------|-----------|--------|
| `respondToText` | `lib/handlers/text.ts` | `app/api/line/webhook/route.ts:337`, `lib/handlers/group-message.ts:20` | **Active production** |
| `respondToImage` | `lib/handlers/image.ts` | `app/api/line/webhook/route.ts:344` | **Active production** |
| `respondToOtherMedia` | `lib/handlers/other-media.ts` | `app/api/line/webhook/route.ts:355` | **Active production** |
| `handleGroupMessage` | `lib/handlers/group-message.ts` | `app/api/line/webhook/route.ts:246` | **Active production** |
| `handleJoin`, `handleLeave`, `handleMemberJoined`, `handleMemberLeft` | `lib/handlers/group-lifecycle.ts` | `app/api/line/webhook/route.ts:160-182` | **Active production** |

No separate `follow`/`unfollow` handler files exist; those are handled inline in `app/api/line/webhook/route.ts:193-222`.

---

## 6. Agent Orchestration — Dual Paths

### 6.1 Production Path (Mastra)

```
lib/handlers/text.ts:102
    │
    ▼
runMastraAgent(messages, opts)  [mastra/run.ts:92]
    │
    ├─ RequestContext populated with userId, hint, settings, accounts
    ├─ buildSystemPrompt(...)
    ├─ toolsForUser(ctx.userId, { ... })  [lib/tools/index.ts]
    ├─ buildLekhaTools(ctx)  [mastra/tools/index.ts]
    │       └─ wrapAiTool(name, aiTool)  [mastra/tools/wrap-ai-tool.ts]
    ├─ mastra.getAgent("lekha").generate(messages, { instructions, context, requestContext, memory, maxSteps: 8 })
    │       └─ lekhaAgent  [mastra/agents/lekha-agent.ts]
    │
    └─ processResult(adaptedResult, ...)  [lib/llm/agent.ts]
            └─ formatProcessed(...) → final text + hints
```

**Mastra Agent configuration (`mastra/agents/lekha-agent.ts`):**

- `model: googleClient()("gemini-2.5-flash")`
- `memory: createMemory()` — UpstashStore + UpstashVector + Gemini embeddings
- `maxRetries: 3`
- `requestContextSchema: lekhaRequestContextSchema`
- `tools: async ({ requestContext }) => buildLekhaTools(requestContext.all)`

### 6.2 Legacy Path (Direct AI SDK)

```
lib/llm/agent.ts:320
    │
    ▼
runAgent(userId, profile, facts, messages, traceId, opts)
    │
    ├─ buildSystemPrompt(...)
    ├─ toolsForUser(userId, { ... })  [same registry]
    ├─ generateText({ model, system, messages, tools, stopWhen: stepCountIs(8), onStepFinish })
    │       └─ Vercel AI SDK direct
    └─ processResult(result, ...)
```

**Callers of legacy `runAgent`:**

- `eval/engine/runner.ts:72`
- `eval/layer2/*.test.ts` (tool-selection, draft-rendering, conversation-state, fallback)
- `PERFORMANCE.md:213` (documentation snippet)
- `README.md:136` (diagram)

**Status:** Legacy path is **eval-only and documentation-only**. It is not invoked by the production webhook. However, `lib/llm/agent.ts` is still imported by `mastra/run.ts` for `processResult` / `formatProcessed` / `adaptMastraStep`, so the file is **not dead**.

### 6.3 Direct AI SDK Call Sites Outside the Agent

| File | Function / Call | Purpose |
|------|-----------------|---------|
| `lib/llm/agent.ts` | `generateText()` | Legacy agent turn |
| `lib/llm/extract-facts.ts` | `generateText()` | Background fact extraction |
| `lib/llm/preread-doc.ts` | `generateText()` | Document pre-reading |
| `lib/llm/casual-reply.ts` | `generateText()` | Small-talk fallback |
| `lib/memory/history.ts` | `generateText()` | Adaptive history summarization |
| `lib/memory/embeddings.ts` | `embed()` | Text embedding |
| `lib/tools/media-ai.ts` | `generateText()` | Audio/image/document summarization |
| `lib/tools/receipts.ts` | `generateObject()` | Receipt parsing |
| `lib/document-intelligence.ts` | `generateObject()` | Document intelligence |
| `app/api/health/route.ts` | `generateText()` | Gemini health check |
| `app/api/status/route.ts` | `generateText()` | Tier status check |

---

## 7. Tool Registry

### 7.1 Single Source of Truth

`lib/tools/index.ts` defines a declarative `REGISTRY` of tool builders. Each entry specifies:

- `build(userId)` — returns AI SDK `tool()` records.
- `needs` — env/prerequisite flags: `"tavily"`, `"qstash"`, `"google_user_connected"`, etc.
- `category` — for user-disabled categories: `email`, `calendar`, `tasks`, `reminders`, `drive`, etc.
- `hints` — fastClassify intent hints: `reminder`, `weather`, `task`, `email`, `calendar`, `media`, etc.

Tools are **cached per user** in an in-memory LRU with a composite key:

```ts
`v6:${userId}:${disabledKey}:${googleKey}:${stagedKey}:${hintKey}`
```

`toolsForUser()` is called by:

- `mastra/tools/index.ts` to wrap tools for Mastra.
- `lib/llm/agent.ts` legacy path.
- Evals that instantiate `runAgent`.

### 7.2 Tool Categories

| Category | Representative Tools | File |
|----------|----------------------|------|
| Core / Help | `show_help` | `lib/tools/help.ts` |
| Settings | `get_my_settings`, `set_timezone`, `set_language`, ... | `lib/tools/settings.ts` |
| Tasks | `add_task`, `add_tasks`, `list_tasks`, `complete_task`, ... | `lib/tools/tasks.ts` |
| Reminders | `set_reminder`, `set_recurring_reminder`, `list_reminders`, `cancel_reminder` | `lib/tools/reminders.ts` |
| Email | `draft_email` | `lib/tools/email.ts` |
| Gmail | `gmail_search`, `gmail_read`, `summarize_recent`, `draft_gmail_reply` | `lib/tools/gmail-inbox.ts` |
| Calendar | `draft_calendar_event`, `search_calendar_events`, `update_calendar_event`, `delete_calendar_event`, `list_upcoming_events`, `calendar_today`, `calendar_week`, `calendar_find_free_time` | `lib/tools/calendar.ts` |
| Drive / Docs | `drive_search`, `drive_list_recent`, `drive_get_link`, `drive_read_text`, `upload_recent_media`, `create_google_doc`, `edit_google_doc`, `create_google_slides` | `lib/tools/drive.ts`, `lib/tools/docs.ts` |
| Media AI | `transcribe_audio`, `summarize_audio`, `ocr_image`, `summarize_image`, `summarize_document`, `summarize_video` | `lib/tools/media-ai.ts` |
| Memory | `remember`, `list_memory`, `update_memory`, `forget`, `clear_memory`, `search_archived_memory` | `lib/tools/memory.ts` |
| Documents | `search_documents` | `lib/memory/documents.ts` |
| Web Search | `web_search` | `lib/tools/web-search.ts` |
| News | `news_search` | `lib/tools/news.ts` |
| Weather | `weather` | `lib/tools/weather.ts` |
| Finance | `fx_rate`, `stock_quote`, `crypto_price` | `lib/tools/finance.ts` |
| Contacts | `contacts_search` | `lib/tools/contacts.ts` |
| Receipts | `scan_receipt`, `list_receipts`, `search_receipts`, `delete_receipt` | `lib/tools/receipts.ts` |
| Lists | `create_list`, `add_list_item`, ... | `lib/tools/lists.ts` |
| Places | `suggest_places` | `lib/tools/places.ts` |
| Scheduled Email | `schedule_email`, `list_scheduled_emails`, `cancel_scheduled_email` | `lib/tools/scheduled-email.ts` |
| Sent History | `query_sent_history` | `lib/tools/sent-history.ts` |
| Export | `export_my_data` | `lib/tools/export.ts` |
| Morning / Evening | `get_morning_briefing`, `get_evening_summary` | `lib/tools/morning-briefing.ts`, `lib/tools/evening-summary.ts` |
| Staged Media | `list_staged_media`, `clear_staged_media` | `lib/tools/staged-media.ts` |
| Render Flex | `render_flex` | `lib/tools/render-flex.ts` |

### 7.3 Error-Handling Contract

Per `AGENTS.md` Decision #1, tools **return** structured `{ ok: false, error, ... }` objects rather than throwing for control-flow errors. `withGoogleClient()` returns markers like `need_google_auth`, `google_api_disabled`, `google_error`. The orchestrator (`processResult`/`formatProcessed`) scans tool results post-hoc and overrides the model reply if the model failed to relay the real error.

---

## 8. Memory Architecture — Dual Layer

### 8.1 Custom Redis Memory (Fully Operational)

| Module | Key Pattern | Purpose |
|--------|-------------|---------|
| `lib/memory/history.ts` | `history:{userId}` | Rolling 35-turn conversation history with adaptive summarization |
| `lib/memory/facts.ts` | `user:{userId}:facts:v2` | Structured facts (categories, priority, confidence), max 500 |
| `lib/memory/archive.ts` | `archive:{userId}:{archiveId}` + vector index | Long-term compressed conversation summaries |
| `lib/memory/documents.ts` | `documents:{userId}` | Indexed uploaded documents and audio transcripts |
| `lib/memory/recent-media.ts` | `recent-media:{userId}` | Staged LINE media list (max 10, 30 min TTL) |
| `lib/memory/settings.ts` | `user:{userId}:settings:v7` | Per-user settings (schema v7 with migrations) |
| `lib/memory/profile.ts` | `profile:{userId}` | Display name, first-contact tracking |
| `lib/memory/tasks.ts` | `tasks:{userId}` | Persistent task store |
| `lib/memory/receipts.ts` | `receipts:{userId}` | Receipt store (200 max, 1-year TTL) |
| `lib/memory/sent-log.ts` | `sent:{userId}` | Audit log of sent messages (200 max, 6-month TTL) |
| `lib/memory/audit-log.ts` | `audit:{userId}` | Compliance audit trail (5000 max, 1-year TTL) |
| `lib/memory/user-registry.ts` | `users:active` | All known userIds for cron sweep |
| `lib/memory/redis.ts` | — | Singleton Upstash Redis client |
| `lib/memory/embeddings.ts` | `embed:gemini-embedding-001:{sha1}` | Embedding cache |
| `lib/memory/search-cache.ts` | — | Archive search result cache |

### 8.2 Mastra Memory (Configured Parallel Layer)

In `mastra/agents/lekha-agent.ts`:

```ts
memory: createMemory()
```

`createMemory()` uses:

- `UpstashStore` for message storage.
- `UpstashVector` for vector search.
- Gemini `text-embedding-004` (768 dims, cosine) via the Mastra embedder.

**Observation:** This Mastra Memory layer is configured and active, but the production handlers also manage their own Redis history/facts/archive. The two layers coexist; the custom Redis layer is the authoritative one for prompt building and fact injection today. Mastra Memory may be used internally by the Mastra `Agent.generate()` for its own working memory. This is a potential source of duplication or drift and should be reconciled in a future phase.

---

## 9. Output Pipeline

```
Agent.generate() returns text + toolResults + toolCalls
    │
    ▼
processResult(result, activeEmail, successfulCalls, tz, lang)
    │
    ├─ collect draft_email / draft_calendar_event / schedule_email tool calls
    ├─ build verbatim draft block via renderDraftsBlock()
    ├─ scan for { ok: false } errors → inject error text if model omitted it
    ├─ buildFlexFromToolResults() for high-signal results (tasks, weather, finance, etc.)
    └─ formatProcessed() returns { text, hints, toolCalls, historyText }
         │
         ▼
enrichReply(finalText, hints, profile, settings, opts)
    │
    ├─ wrap plain text in Flex bubble
    ├─ append Flex cards from tool results
    ├─ add quick replies / postback buttons for pending confirmations
    └─ returns LineMessage[]
         │
         ▼
replyOrPush(to, replyToken, messages, onQuoteTokens)
    │
    ├─ try LINE reply(replyToken, ...)
    └─ fallback LINE push(to, ...)
```

**Key files:**

- `lib/llm/agent.ts` — `processResult()` / `formatProcessed()`.
- `lib/llm/render-drafts.ts` — draft block rendering.
- `lib/llm/agent-flex.ts` — Flex builders from tool results.
- `lib/enrich-reply.ts` — final message enrichment.
- `lib/line/client.ts` — `replyOrPush()`.

---

## 10. Scheduled Jobs Architecture

| Job Type | Scheduler | Endpoint | Notes |
|----------|-----------|----------|-------|
| Recurring master sweep | QStash schedule → `/api/cron/sweep/fire` | `app/api/cron/sweep/fire/route.ts` | Every 15 min; iterates `users:active`; decides morning/evening/check-in pushes per user via push locks |
| One-shot reminder | `set_reminder` tool publishes to `/api/reminders/fire` | `app/api/reminders/fire/route.ts` | 3h/1h warnings + final; GETDEL consumes reminder |
| Long-delay reminder | `set_reminder` tool publishes relay chain | `app/api/reminders/relay/route.ts` | Re-chains at QStash max delay boundary |
| Recurring reminder | `set_recurring_reminder` tool creates QStash schedule | `app/api/reminders/fire/route.ts` | UTC cron converted from local time |
| Pre-meeting alert | `schedulePreMeetingAlerts()` at event creation/update | `app/api/reminders/fire/route.ts` | One-shot messages |
| Scheduled email | `schedule_email` tool publishes to `/api/scheduled-email/fire` | `app/api/scheduled-email/fire/route.ts` | Deferred email send |

**Idempotency:**

- `seen:{webhookEventId}` for LINE webhook dedup (10 min).
- `pushlock:{userId}:{type}:{YYYY-MM-DD}` for proactive pushes (5-min TTL).
- OAuth state nonces and connect-link tokens are single-use via `GETDEL` (with 90 s grace for connect-link double-request).

---

## 11. Security & Isolation Highlights

- **LINE webhook spoofing:** HMAC-SHA256 verification before any work (`lib/line/verify.ts`).
- **QStash spoofing:** `@upstash/qstash` Receiver signature verification on all callback routes.
- **OAuth CSRF/replay:** Signed connect-link tokens + single-use Redis nonces.
- **Tokens at rest:** AES-256-GCM encrypted with `TOKEN_ENCRYPTION_KEY`.
- **User isolation:** All Redis keys are scoped by LINE `userId`.
- **Rate limit:** 500/hr/user sliding window via `@upstash/ratelimit`.
- **Allowlist:** Private bot; admin always passes; others need `users:allowed`.
- **Confirmation gate:** Drafts are queued; executed only on explicit YES.
- **Group access:** Separate `groups:allowed` set + admin group IDs.

---

## 12. Active vs. Potentially Dead / Low-Traffic Code

### Active and Critical

- `app/api/line/webhook/route.ts`
- `lib/handlers/{text,image,other-media,group-message,group-lifecycle}.ts`
- `lib/llm/{prompts.ts,provider.ts,agent.ts}` (agent.ts is shared for result processing)
- `mastra/{index.ts,agents/lekha-agent.ts,run.ts,tools/index.ts,tools/wrap-ai-tool.ts}`
- `lib/tools/index.ts` + all `lib/tools/*.ts`
- `lib/memory/{redis.ts,history.ts,facts.ts,archive.ts,documents.ts,settings.ts,recent-media.ts,tasks.ts,audit-log.ts}`
- `lib/{confirm.ts,pending-runner.ts,sweep.ts,webhook-postback.ts,enrich-reply.ts,shortcuts.ts,settings-menu.ts,tutorial.ts,admin-commands.ts,group.ts,group-access.ts}`

### Legacy but Still Imported

- `lib/llm/agent.ts` — legacy `runAgent()` is eval-only, but `processResult()`/`formatProcessed()`/`adaptMastraStep()` are used by the Mastra path.

### Low-Traffic / Diagnostic

- `app/api/report/{marketing,status,user}/route.ts`
- `app/api/subscribe/route.ts`
- `app/api/status/route.ts`
- `app/api/admin/test-push/route.ts`
- `app/api/health/route.ts`

These are not dead; they are manually or internally triggered.

### Unclear / Should Verify Usage

- `app/api/cron/sweep/route.ts` (legacy) — still present and may be referenced by an old QStash schedule.
- `mastra/agents/lekha-agent.ts` Mastra Memory layer — verify whether it is actually storing/retrieving data or only configured.

---

## 13. Key Findings & Recommendations

1. **Dual agent paths need reconciliation.** Production uses Mastra; legacy `runAgent()` is kept for evals. Consider migrating evals to `runMastraAgent()` or clearly separating legacy utilities from the production orchestrator.
2. **Dual memory layers need reconciliation.** Custom Redis memory is authoritative; Mastra Memory is configured but may duplicate effort. Decide whether to migrate fully to Mastra Memory or disable it.
3. **Legacy sweep endpoint.** `/api/cron/sweep` forwards to the same logic; ensure the QStash schedule points to `/api/cron/sweep/fire` and the legacy route can be deprecated.
4. **Eval parity.** Evals use `runAgent()` directly with the same `toolsForUser()` registry but a different orchestrator. Results may not fully predict production Mastra behavior.
5. **Tool registry is the single source of truth.** This is a strong design; keep it central when adding new tools.
6. **Pending confirmation queue is robust.** RPUSH + RPOP + postback confirm is correct for parallel tool-call drafts.
7. **Error-return pattern is consistent.** Most tools return `{ ok, error }`; maintain this contract.
8. **Group chat gating is explicit.** `shouldRespondInGroup` uses mention, name invocation, or reply-to-bot-quote; good isolation.

---

## 14. File-to-Line Reference Index

| Concept | Primary File | Key Lines |
|---------|--------------|-----------|
| Webhook entry | `app/api/line/webhook/route.ts` | 46-122 (POST), 125-381 (handleEvent) |
| Signature verify | `lib/line/verify.ts` | — |
| Text handler | `lib/handlers/text.ts` | 1-180, especially 102 (`runMastraAgent`) |
| Image handler | `lib/handlers/image.ts` | — |
| Other media handler | `lib/handlers/other-media.ts` | — |
| Group message handler | `lib/handlers/group-message.ts` | 1-150 |
| Group lifecycle | `lib/handlers/group-lifecycle.ts` | — |
| Mastra runner | `mastra/run.ts` | 92-180 |
| Mastra agent | `mastra/agents/lekha-agent.ts` | 1-90 |
| Mastra tool bridge | `mastra/tools/index.ts` | 1-60 |
| AI SDK → Mastra adapter | `mastra/tools/wrap-ai-tool.ts` | 1-40 |
| Legacy agent | `lib/llm/agent.ts` | 320-420 (`runAgent`) |
| Result processing | `lib/llm/agent.ts` | processResult / formatProcessed |
| System prompt | `lib/llm/prompts.ts` | `buildSystemPrompt()` |
| Provider config | `lib/llm/provider.ts` | `chatModelForTier()`, `AGENT_TIMEOUT_MS` |
| Tool registry | `lib/tools/index.ts` | REGISTRY, `toolsForUser()` |
| Tasks | `lib/tools/tasks.ts` | 59-251 (`buildTaskTools`) |
| Email | `lib/tools/email.ts` | 14-190 (`buildEmailTools`, `sendEmail`) |
| Calendar | `lib/tools/calendar.ts` | 55-411 (`buildCalendarTools`, `createCalendarEvent`) |
| Reminders | `lib/tools/reminders.ts` | 110-305 (`buildReminderTools`) |
| Google auth | `lib/tools/google-auth.ts` | 54-312 (OAuth, accounts, token storage) |
| Pending queue | `lib/confirm.ts` | `appendPending`, `getPending`, `classify` |
| Pending execution | `lib/pending-runner.ts` | `executePendingAll`, `executeOne` |
| Postback dispatcher | `lib/webhook-postback.ts` | `handlePostback()` |
| Shortcuts | `lib/shortcuts.ts` | 47-152 (`SHORTCUTS`, `dispatchShortcut`) |
| Settings menu | `lib/settings-menu.ts` | 41-467 (`handleSettingsPostback`, `handleSettingsCommand`) |
| Tutorial | `lib/tutorial.ts` | 517-871 (step management, postback/text handling) |
| Admin commands | `lib/admin-commands.ts` | 45-333 (`handleAdminCommand`) |
| History | `lib/memory/history.ts` | `appendTurn`, `historyForPrompt`, `summarizeOldest` |
| Facts | `lib/memory/facts.ts` | `loadFacts`, `factsToPromptBlock` |
| Archive | `lib/memory/archive.ts` | `appendArchive`, `searchArchive` |
| Documents | `lib/memory/documents.ts` | index/search uploaded docs |
| Embeddings | `lib/memory/embeddings.ts` | `embedText()` |
| Recent media | `lib/memory/recent-media.ts` | staging list |
| Settings | `lib/memory/settings.ts` | schema v7, migrations |
| Audit log | `lib/memory/audit-log.ts` | `appendAuditEntry`, `listAuditLog` |
| Morning briefing | `lib/llm/briefing.ts` | `buildMorningBriefing()` |
| Evening summary | `lib/llm/evening-summary.ts` | `buildEveningSummary()` |
| Master sweep | `lib/sweep.ts` | `runSweepForAll()` |
| Sweep endpoint (current) | `app/api/cron/sweep/fire/route.ts` | — |
| Sweep endpoint (legacy) | `app/api/cron/sweep/route.ts` | — |
| Reminder fire | `app/api/reminders/fire/route.ts` | — |
| Reminder relay | `app/api/reminders/relay/route.ts` | — |
| Scheduled email fire | `app/api/scheduled-email/fire/route.ts` | — |
| OAuth callback | `app/api/oauth/google/callback/route.ts` | — |
| LINE client | `lib/line/client.ts` | `replyOrPush()`, `text()`, `flex()` |

---

*End of Phase 1 Architecture Audit.*
