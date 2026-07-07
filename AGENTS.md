# Lekha — repo guide for AI coding agents

A personal AI assistant living in LINE. **Private bot** (allowlist-gated with self-serve signup queue), per-user state, agentic tool use, proactive layer (morning briefings, pre-meeting alerts, evening summaries, task check-ins).

## Stack at a glance

| | |
|---|---|
| Runtime | Next.js 16.2.6 App Router on Vercel Functions (Node.js, Fluid Compute), region `sin1` |
| Language | TypeScript 6.0.3, strict, `noUncheckedIndexedAccess: true` |
| React | React 19.2.6 |
| Styling | Tailwind CSS 4.3.0, Framer Motion 12.40.0 |
| LLM | Vercel AI SDK v6 (`ai` 6.0.193) + `@ai-sdk/google` 3.0.80 |
| Chat model | `gemini-2.5-flash` (full Flash, paid tier preferred; free tier via `GEMINI_API_KEY_FREE`) |
| Extractor model | `gemini-2.5-flash-lite` (background extraction/summarization) |
| Embeddings | Gemini `text-embedding-004` (768 dims) |
| Memory / queues | Upstash Redis (Vercel Marketplace → `KV_*`; direct → `UPSTASH_REDIS_REST_*`) |
| Vector search | Upstash Vector — archive semantic search (substring fallback when unset) |
| Scheduled jobs | Upstash QStash (one-shot reminders, deferred emails, recurring schedules, cron sweep) |
| Web search | Tavily |
| Google APIs | `googleapis` 173.0.0 — Gmail, Calendar, Drive, People, Docs, Slides |
| Validation | Zod 4.4.3 |
| Tests | Vitest 4.1.8 (unit tests — no network, no Redis) |
| Payments | Stripe 22.2.0 (optional monthly/yearly subscriptions) |

## Quick commands

```bash
npm run dev          # next dev (Turbopack)
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm test             # vitest run (excludes chat.integration.test.ts)
npm run test:integration  # vitest run tests/chat.integration.test.ts
npm run test:watch   # vitest watch mode
npm run test:coverage # vitest with coverage
npm run lint         # eslint .
npx vercel deploy --prod --yes   # ship
npx vercel logs --no-follow --since 1h --no-branch --expand   # recent prod logs with full output
```

## Project layout

```
app/
├── api/
│   ├── line/webhook/route.ts               # main entrypoint: verify → parse → dispatch
│   ├── dev/chat/route.ts                   # bearer-protected testing endpoint — bypass LINE/allowlist/rate-limit
│   ├── oauth/google/callback/route.ts      # Google OAuth code exchange + auto-resume pending actions
│   ├── auth/line/{start,callback}/         # LINE Login web OAuth for signup
│   ├── auth/line/dashboard-{start,callback}/route.ts  # dashboard session auth via LINE Login
│   ├── reminders/{fire,relay}/route.ts     # QStash callbacks for one-shot/recurring reminders
│   ├── scheduled-email/fire/route.ts       # QStash callback for deferred email sends
│   ├── cron/sweep/route.ts                 # legacy QStash callback — forwards to runSweepForUser
│   ├── cron/sweep/fire/route.ts            # current QStash callback for master sweep + typed one-shots
│   ├── webhooks/stripe/route.ts            # Stripe checkout/subscription webhooks
│   ├── github/webhook/route.ts             # GitHub push/PR/issue/merge notifications
│   ├── github/line-webhook/route.ts        # recipient registration for GitHub notifications
│   ├── subscribe/route.ts                  # marketing email capture
│   ├── health/route.ts                     # dependency health check
│   ├── status/route.ts                     # human-readable Gemini tier status page
│   ├── dashboard/{me,settings,facts,connect-google,disconnect-google,test-line}/route.ts
│   └── report/{marketing,status,user}/route.ts
├── connect/[token]/page.tsx                # signed-token landing → Google consent
├── dashboard/page.tsx                      # auth-guarded dashboard UI
├── signup/                                 # marketing signup/pricing pages
├── report/                                 # internal status report pages
├── privacy/, terms/                        # legal pages
├── components/marketing/, components/ui/   # React components
└── layout.tsx, page.tsx                    # marketing landing page
lib/
├── env.ts                                  # zod env + redisCreds() (KV_* and UPSTASH_REDIS_REST_*)
├── errors.ts                               # GoogleAuthRequired, RateLimited, NeedsConfirmation
├── ratelimit.ts                            # per-user 500/hr sliding window
├── gate.ts                                 # allowlist + admin parsing
├── confirm.ts                              # pending action queue (atomic RPUSH)
├── pending-runner.ts                       # executePendingAll — runs queue on YES, logs sends
├── cron.ts                                 # QStash schedule helpers + local→UTC cron conversion
├── proactive-schedules.ts                  # schedule one-shot deadline/pre-meeting QStash jobs
├── sweep.ts                                # proactive sweep orchestration
├── fast-classify.ts                        # zero-latency regex intent hint → tool registry narrowing
├── admin-commands.ts                       # /allow /remove /users /pending /approve /deny /myid
├── shortcuts.ts                            # declarative LLM-bypass table
├── enrich-reply.ts                         # text + AgentHints → LineMessage
├── webhook-postback.ts                     # postback verb dispatch
├── format.ts                               # formatting helpers
├── fetch.ts                                # fetch wrappers
├── utils.ts                                # shared utilities (cn, etc.)
├── timing.ts                               # performance span/tick helpers
├── handlers/
│   ├── text.ts                             # text message → runAgent
│   ├── image.ts                            # image message → vision + staging
│   └── other-media.ts                      # video/audio/file staging + audio auto-transcription
├── line/
│   ├── verify.ts                           # HMAC-SHA256 signature verification
│   ├── client.ts                           # REST client for reply/push/loading
│   ├── types.ts                            # zod schemas for all LINE event types
│   ├── mime.ts                             # file mime-type helpers
│   ├── flex/                               # LINE Flex Message templates + parsePostbackData
│   ├── finance-flex.ts                     # finance result Flex cards
│   ├── places-flex.ts                      # places result Flex cards
│   └── weather-flex.ts                     # weather result Flex cards
├── llm/
│   ├── provider.ts                         # chatModel + extractorModel + embeddingModel — swap here
│   ├── prompts.ts                          # base personality + system prompt builder
│   ├── agent.ts                            # runAgent + helpers (shared by webhook + dev endpoint)
│   ├── agent-flex.ts                       # Flex Message builders from tool results
│   ├── action-labels.ts                    # deterministic fallback action triggers
│   ├── casual-reply.ts                     # small-talk / greeting handlers
│   ├── extract-facts.ts                    # background fact extraction + archive summarization
│   ├── render-drafts.ts                    # canonical verbatim draft block
│   ├── briefing.ts                         # morning briefing: weather/tasks/reminders/calendar/news/inbox
│   ├── evening-summary.ts                  # 9 PM evening summary
│   ├── preread-doc.ts                      # document pre-reading helper
│   └── health.ts                           # Gemini health/tier checks
├── memory/
│   ├── redis.ts                            # singleton Upstash client
│   ├── crypto.ts                           # AES-256-GCM + HMAC + safeEqual
│   ├── history.ts                          # rolling 35-turn history + summarization
│   ├── facts.ts                            # structured facts blob (categorized, LRU-capped 200)
│   ├── archive.ts                          # long-term compressed conversation chunks (200 max)
│   ├── profile.ts                          # display name + first-contact tracking
│   ├── recent-media.ts                     # staged LINE media list (RPUSH, 10 max, TTL 30 min)
│   ├── settings.ts                         # per-user tz/locale/loc/briefing prefs (versioned + migrations)
│   ├── tasks.ts                            # persistent open work items
│   ├── receipts.ts                         # receipt store (200 max, 1-year TTL, category-indexed)
│   ├── sent-log.ts                         # audit log (last 200, 6 month TTL)
│   ├── user-registry.ts                    # set of all known userIds for cron sweep
│   ├── doc-cache.ts                        # Google Doc plain-text cache
│   ├── allowlist.ts                        # private access control — Redis sets users:allowed / users:pending
│   └── search-cache.ts                     # archive search result cache
├── news-cache.ts                           # news result cache
└── tools/
    ├── index.ts                            # toolsForUser(userId) — async, declarative registry, env + OAuth + hint gated
    ├── help.ts                             # show_help text dump
    ├── settings.ts                         # get_my_settings + set_timezone/location/language + enable/disable prefs
    ├── morning-briefing.ts                 # get_morning_briefing tool
    ├── evening-summary.ts                  # get_evening_summary tool
    ├── memory.ts                           # remember/list/update/forget/clear + archive search
    ├── tasks.ts                            # CRUD on tasks
    ├── reminders.ts                        # set/list/cancel/set_recurring (one-shot via publish, recurring via schedule)
    ├── web-search.ts                       # Tavily
    ├── contacts.ts                         # contacts_search via Google People API
    ├── google-auth.ts                      # multi-account OAuth, encrypted tokens, scope check, atomic state
    ├── google-accounts.ts                  # list/connect/switch/disconnect Google accounts
    ├── with-google.ts                      # auth/api-disabled/quota error → structured marker
    ├── email.ts                            # draft_email + sendEmail (multi-recip, Drive + LINE attach, Gmail threading)
    ├── gmail-inbox.ts                      # gmail_search/read/summarize_recent + draft_gmail_reply
    ├── scheduled-email.ts                  # schedule_email/list/cancel — QStash-deferred sends
    ├── calendar.ts                         # draft + create + list_upcoming/today/week + find_free_time
    ├── drive.ts                            # search/list_recent/get_link/read_text/upload_recent_media
    ├── docs.ts                             # Google Docs create/edit + Slides create
    ├── media-ai.ts                         # transcribe/summarize_audio + ocr/summarize_image + summarize_document + summarize_video
    ├── receipts.ts                         # scan_receipt/list_receipts/search_receipts/delete_receipt
    ├── sent-history.ts                     # query the audit log
    ├── export.ts                           # JSON dump of all user data
    ├── weather.ts                          # weather — wttr.in primary, Open-Meteo fallback (both keyless)
    ├── finance.ts                          # fx rates, stock quotes, crypto prices — keyless, ~3s timeout
    ├── news.ts                             # news search via Tavily
    ├── lists.ts                            # named lists (grocery, packing, custom) — Redis-backed
    ├── places.ts                           # suggest_places — structured place cards
    ├── render-flex.ts                      # render_flex — model-generated LINE Flex cards
    └── staged-media.ts                     # list / clear LINE media staged for attach/upload
tests/
├── allowlist.test.ts
├── briefing-gate.test.ts
├── confirm.test.ts
├── cron.test.ts
├── crypto.test.ts
├── facts.test.ts
├── finance.test.ts
├── flex.test.ts
├── history.test.ts
├── routing.test.ts
├── search-cache.test.ts
└── verify.test.ts
marketing/
├── src/                                    # standalone Vite + React 18 marketing site
├── public/
├── index.html
├── package.json
└── vite.config.js
```

## Key architectural decisions (do NOT undo without thinking)

### 1. Tool errors are RETURNED, not thrown
The AI SDK v6 catches exceptions in `tool({ execute })` and feeds the error back to the model as a tool result, which the model paraphrases (badly). For control-flow that the orchestrator MUST react to (Google auth required, API not enabled, generic API failures), use `withGoogleClient()` which returns structured `{ ok: false, need_google_auth | google_api_disabled | google_error, … }`. The orchestrator scans tool results post-hoc in `runAgent` and OVERRIDES the model's reply.

### 2. Pending actions are an atomic queue
`appendPending` uses `RPUSH` because the model often emits multiple `draft_*` calls in one parallel-tool-use step. Read-modify-write would race (last write wins, one action lost). Same for `recent-media` staging — also `RPUSH` capped via `LTRIM`.

### 3. Canonical draft rendering, not model paraphrasing
After `generateText`, `runAgent` collects all `draft_email` / `draft_calendar_event` / `schedule_email` tool calls and builds a verbatim block via `renderDraftsBlock`. Source of truth = tool args.

### 4. Auto-resume after OAuth
`/api/oauth/google/callback` executes pending actions immediately after a successful exchange and pushes the result. No "try again."

### 5. Per-user multi-account Google
Tokens at `google:tokens:{userId}:{email}`, accounts blob at `google:accounts:{userId}` with `activeEmail`. `getGoogleClient(userId, email?, requiredScopes?)` → throws GoogleAuthRequired if scopes missing (forces re-consent). Tools accept optional `fromEmail` to override active account per-call.

### 6. Per-user state isolation
Everything in Redis is keyed by LINE `userId`. There is no global state besides env. Adding a tool? Per-user-bind via `buildXxxTools(userId)`.

### 7. Webhook responds 200 immediately
Handler uses `after(async () => …)` so LINE doesn't time out / retry. Real work happens after response. Webhook events de-duped via `seen:{webhookEventId}` 10-min keys.

### 8. Webhook + QStash signature verify before any work
`verifyLineSignature` runs first, on the raw body, before JSON parsing. Same for QStash `Receiver.verify()` on the cron sweep, reminder fire, scheduled-email fire, and reminder relay routes.

### 9. Tokens encrypted at rest
OAuth tokens AES-256-GCM with `TOKEN_ENCRYPTION_KEY` (64 hex chars). `OAUTH_STATE_SECRET` HMACs connect-link tokens. State nonces and connect-link tokens are atomically consumed via `GETDEL` (single-use).

### 10. Rate limit per user
Upstash sliding window, **500/hr/user**. Paid Gemini RPM absorbs the burst; the cap exists to bound LINE push quota cost and provide an abuse circuit-breaker at 100+ user scale.

### 11. Settings injected into every system prompt
Timezone, location, language, connected Google accounts, staged media — all live in the system prompt so the model behaves correctly without needing to call lookup tools. Settings use versioning + migration: `CURRENT_VERSION = 7` in `lib/memory/settings.ts` defines the schema. When a new schema is deployed, `applyMigrations()` runs on read and writes back once, never overriding explicit user choices tracked in `userConfigured` array.

### 12. Long-term memory via Upstash Vector (with substring fallback)
Every fact-extraction cycle (every `memoryCompactAt` turns, default 10) writes a 2–4 sentence chunk summary to `archive`. The summary is also embedded via Gemini `text-embedding-004` (768 dims) and upserted to Upstash Vector with metadata `{ userId, archiveId, ts, summary }`. `search_archived_memory` embeds the query and runs a top-K similarity search filtered by `userId`. If `UPSTASH_VECTOR_REST_*` env vars aren't set, or any vector op fails, the search falls back to substring match against the Redis-stored summaries.

Uploaded documents and audio transcripts are indexed separately (`lib/memory/documents.ts`) so the full content remains searchable long after the ~30 min LINE staged-media window closes. Documents are indexed on first read; voice memos are transcribed and indexed automatically on arrival. `search_documents` searches across both kinds.

### 13. Proactive layer via master sweep
A single QStash schedule hits `/api/cron/sweep` every 15 min (legacy endpoint; forwards to `lib/sweep.ts` `runSweepForUser`). The current endpoint is `/api/cron/sweep/fire`. It iterates `users:active` set and decides per-user whether to push (morning briefing window check, evening summary window check, task check-in window check). **There are no per-user QStash schedules for briefings/summaries.**

Idempotency is via `claimPushLock()` (`pushlock:{userId}:{type}:{YYYY-MM-DD}` with 5-min TTL), not per-event Redis keys. Pre-meeting alerts and task deadline warnings are scheduled as one-shot QStash messages at event/task creation time — the sweep does NOT scan calendars for upcoming events.

### 14. Email body is base64-encoded
For Thai/UTF-8 fidelity. `Content-Transfer-Encoding: base64` on the text body part. Some MTAs corrupt non-ASCII under `7bit`.

### 15. Private allowlist + self-serve pending queue
The bot is private by default. Every event hits the gate before any other logic. Admin (`ADMIN_LINE_USER_ID`, comma-separated for multiple) always passes. Others must be in the `users:allowed` Redis set.

**Self-serve signup:** non-allowed, non-admin users are silently added to `users:pending` (set) with profile metadata at `pending:{userId}` hash. They receive a friendly "you're in the queue" reply. The admin is push-notified about new requests, rate-limited 1/min/user.

**Admin commands:** `/allow <id>`, `/remove <id>`, `/users` (direct allowlist), `/pending` (list queue), `/approve <id>` (move pending→allowed + send welcome), `/deny <id>` (remove from pending). Anyone can `/myid` to get their own LINE userId.

### 16. Single LLM provider — Gemini 2.5 Flash, 30s timeout
No cascade, no fallback. We use full Flash (not Flash Lite) for agentic tool use because Flash Lite blanked/panicked under the full tool registry. Paid tier RPM (1,000+) absorbs the agentic turn burst. On Gemini outage the bot returns an error — that tradeoff is intentional for a personal bot. `AGENT_TIMEOUT_MS` is 30s — fail-fast for real hangs without burning function time. `stepCountIs(8)` caps total reasoning steps to prevent runaway loops.

### 17. Orchestrator-level error relay enforcement
After `generateText`, `runAgent` scans all tool results for `{ ok: false, error: "..." }`. If the model soft-apologized instead of relaying the actual error (detected by checking whether the error text appears in the model's response), the orchestrator overrides the reply with the real error. This prevents models from hiding API failures behind generic apologies.

### 18. Conditional tool registry (per-user OAuth gating + intent narrowing)
`toolsForUser(userId)` returns a registry gated on env/user prerequisites (OAuth connected, service configured, user-disabled categories, staged media). On top of that, `lib/fast-classify.ts` runs instant regex matching on every user message and passes an optional `hint` to `toolsForUser`. Entries tagged with `hints: [...]` are only built when the hint matches; entries with no `hints` field are **universal** (always included). `web_search` is universal so any wrong narrowing still has a search fallback.

- `hint="reminder"` → ~12 tools | `hint="weather"` → ~8 | `hint="task"` → ~12 | `hint="recent"` → search/web/news tools
- `hint="email"` → ~20 | `hint=undefined` → ~50+ tools (all eligible tools)

Failure mode is always safe: `undefined` → all tools. The classifier never causes a tool to be missing — it only narrows when certain. Do NOT re-add an LLM-based intent classifier; the previous implementation caused hard failures when the LLM mis-classified a query.

### 19. Structured facts (categorized, LRU-capped) + token-bounded history
Facts are stored at `user:{userId}:facts:v2` as JSON with shape `{ facts: Fact[], updatedAt }`. Each `Fact` has `id`, `category` (preferences|people|habits|deadlines|context|health|work|other), `content`, `createdAt`, `updatedAt`, optional `confidence`. Cap at **500 facts/user** with LRU eviction by `updatedAt`. Reads are selective (only the needed recent facts are deserialized for prompt injection). Content capped at 1000 chars.

History uses a rolling **35 turns** in Redis. `historyForPrompt` summarizes the oldest chunk to ~200 tokens via the extractor model if the rolling history exceeds ~3000 tokens (script-weighted heuristic). Summary is cached by SHA1 content hash for **30 days** and also accumulated into `history:running_summary:{userId}`. Placeholder assistant replies are filtered out before storage and before prompt building.

Facts support an optional `priority` field. Higher-priority facts (e.g., markers for uploaded documents or voice memos) are injected into the prompt before regular facts, within the same per-hint fact limit. This gives uploaded content prominence without shrinking the general conversation fact budget.

### 20. LINE Flex Messages + postback routing
Draft confirmations, task lists, and other high-signal interactions render as Flex bubbles with tap-to-act postback buttons. Module: `lib/line/flex/` (one file per template + `index.ts` + `parsePostbackData` helper + `validate.ts` for runtime sanitization). Templates always include a meaningful `altText` so old LINE clients still see something useful. Model-generated Flex via `render_flex` is schema-validated and sanitized before it reaches LINE (altText clamped, postback data ≤ 300 chars, carousel capped at 10 bubbles, markdown stripped from altText); invalid cards fall back to a plain text bubble.

Postback `data` is parsed by verb prefix (`verb:arg:arg…`, capped at 300 chars by LINE). Current routes:
- `confirm:yes` / `confirm:no` → `executePendingAll` / `clearPending`
- `task:done:<id>` / `task:reopen:<id>` → `completeTask` / `reopenTask`

Idempotency relies on the existing `seen:{webhookEventId}` dedup.

### 21. Group chat support
LINE groups/rooms are first-class conversation targets but do not pollute the 1:1 experience:

- The bot only replies in groups when explicitly invoked (mention `@Lekha`, name invocation, or reply to a recent bot message).
- Group conversation context is stored separately under `group:{groupId}:history` / `room:{roomId}:history`, capped at 50 messages, with a 30-day TTL.
- Only the recent 20 group messages are injected into the prompt, so long groups stay cheap.
- Speaker display names are cached per group for one day via the LINE group/room member profile API.
- Personal state (history, facts, settings, tasks, reminders) remains keyed by the invoking user's `userId`.
- Group access is gated by `hasGroupAccess({ userId, groupId, gate })`, which checks: admin → `groups:allowed` → `ADMIN_GROUP_IDS` env → `users:team` Team subscription. This separates billing from feature logic.
- Group lifecycle events (`join`, `leave`, `memberJoined`, `memberLeft`) are handled in the webhook; an admin adding the bot auto-authorises the group.

## Conventions

- **No comments unless explaining a non-obvious WHY.**
- **Strict TS, `noUncheckedIndexedAccess`.** Array element access returns `T | undefined`.
- **Zod for everything at boundaries.**
- **Prefer `lib/` for pure logic, `app/api/*/route.ts` for HTTP boundaries.** Don't export non-handler functions from route files.
- **Logging:** `console.warn` / `console.error` with a `[module]` prefix (`[reminder]`, `[oauth]`, `[google]`, `[sweep]`, `[briefing]`, `[webhook]`, `[agent]`).
- **Module-prefixed file naming** where appropriate; shared helpers live in `lib/` root.

## Adding a new tool

1. Create `lib/tools/your-tool.ts`. Export `buildYourTools(userId)` returning `tool({ description, inputSchema, execute })` records.
2. Wrap any Google call in `withGoogleClient(userId, fromEmail, [scopes], async ({client}) => …)`.
3. Register in `lib/tools/index.ts` (env-gated if needed). Add `hints: [...]` to limit when it's included — omit for universal tools. If you add a new intent, also add a pattern to `lib/fast-classify.ts`.
4. If it produces something the user must approve, write through `appendPending` and add a renderer in `lib/llm/render-drafts.ts`.
5. Update `lib/llm/prompts.ts` so the model knows about it.

## Adding a new pending-action type

1. Add a variant to `PendingAction` in `lib/confirm.ts`.
2. Add a case in `executeOne` inside `lib/pending-runner.ts` (and `logSent` for the audit trail).
3. Render it in `lib/llm/render-drafts.ts`.

## LINE settings menu & onboarding

- **Settings command:** Typing `=settings=` in LINE opens a rich, LLM-free Flex menu. Users can toggle briefings, tools, persona, memory, facts, language, location, and timezone via `postback` buttons. The menu is built in `lib/line/flex/settings.ts` and handled in `lib/settings-menu.ts`.
- **Typed settings commands:** Users can also type `=set <key> <value>` (e.g. `=set timezone Asia/Tokyo`, `=set language th`, `=set morning off`) or `=remember <fact>` to edit settings without invoking the LLM.
- **Postback verbs:** `settings:main`, `settings:section:<name>`, `settings:set:<key>:<value>`, `settings:toggle:<target>:off`, `settings:facts:del:<id>`.
- **Onboarding:** New users (follow event or admin approval) receive a one-time welcome push with a "Start setup" button. Tapping it starts an interactive tutorial (`lib/tutorial.ts`) that walks through each settings section one by one: Language & Location → Briefings → Tools → Persona → Memory. Each step explains what the setting does and lets the user choose. Postback verbs are `tutorial:start`, `tutorial:set:<key>:<value>`, `tutorial:next`, `tutorial:back`. Users can restart the tutorial anytime by typing `=tutorial`. Onboarding state is stored at `user:{userId}:onboarded`; tutorial progress is stored at `user:{userId}:tutorial:step`.

## Swapping the LLM

`lib/llm/provider.ts` only.

## Gotchas (lessons learned the hard way)

- **AI SDK v6 swallows tool exceptions** — must use structured returns for control flow.
- **Parallel tool calls in one step race** — atomic Redis ops mandatory.
- **Gemini paid tier** — billing must be enabled on the Google Cloud project tied to `GEMINI_API_KEY`. Free tier RPM (10–30) is too low for agentic turns; paid tier (1,000+ RPM) absorbs the burst.
- **`HARM_CATEGORY_*` thresholds**: use `BLOCK_NONE` not `OFF`. Skip `CIVIC_INTEGRITY` (rejected on some variants).
- **Vercel Marketplace's Upstash Redis injects `KV_*`** not `UPSTASH_REDIS_REST_*`.
- **OAuth refresh tokens are tied to client_id** — swap projects → `invalid_grant`. Detected and translated to need-reauth.
- **Google Cloud projects belong to the account that created them.** `roles/resourcemanager.projectMover` is the WRONG role to request from the access-denied page; switch accounts in the Cloud Console UI.
- **OAuth consent screen Testing mode** restricts to listed test users.
- **Each Google API must be enabled separately** — Drive ≠ Gmail ≠ Calendar ≠ People.
- **Calendar event htmlLinks require being signed in as the calendar's account.** "Could not find the requested event" = wrong account in browser.
- **LINE replyToken expires in ~1 minute and is single-use.** Long async work → push.
- **LINE doesn't bundle a caption with media.** Recent-media staging spans messages within 30-min TTL.
- **`Content-Transfer-Encoding: 7bit` is invalid for UTF-8 bodies** (Thai, emoji). Use base64.
- **OAuth state nonce + connect-link token must be atomically consumed** (GETDEL) — non-atomic GET+DEL has a replay window.
- **Gemini timeout at 30s** (`AGENT_TIMEOUT_MS` in `lib/llm/provider.ts`) — fail-fast for real hangs. Most healthy requests finish in 1–3s.
- **Pre-flight parallelization** — `checkRateLimit`, `getOrCreateProfile`, `getPending` run in parallel. `showLoading` (LINE API) is fire-and-forget. Saves ~400ms per request vs. sequential awaits.
- **wttr.in is unreliable** — it's a personal project, goes down without warning (HTTP 500). Always have Open-Meteo as fallback. Both are keyless.
- **Upstash Vector index must be dim 768, cosine** to match Gemini `text-embedding-004`. Mismatch surfaces as silent upsert failures.
- **LINE postback `data` capped at 300 chars** — pass IDs, never full content.
- **LINE Flex Messages require `altText`** — without it the API call fails.

## Testing

Tests are Vitest, run in Node environment, no network, no Redis:

```bash
npm test             # single run (excludes integration chat test)
npm run test:integration  # integration chat test only
npm run test:watch   # watch mode
npm run test:coverage # with coverage
```

Current test files cover: allowlist gating, briefing-fire logic, confirm/pending queue, cron schedule helpers, crypto (AES/HMAC), fact storage, finance formatting, Flex Message templates, history rolling window, prompt routing/shortcuts, archive search cache, and LINE signature verification.

Redis is mocked in-memory via `vi.mock("@/lib/memory/redis", …)` where needed. `env.ts` is mocked where needed. CI runs `npm run typecheck` → `npm run build` → `npm test` with stub env values.

## Dev chat endpoint (testing without LINE)

A direct testing channel into the production bot via `/api/dev/chat`:

```bash
curl -s -X POST https://lekha-iota.vercel.app/api/dev/chat \
  -H "Content-Type: application/json" \
  -H "x-dev-secret: $DEV_CHAT_SECRET" \
  -d '{"userId":"YOUR_LINE_USER_ID","text":"your message"}' \
  --max-time 60
```

Requires `DEV_CHAT_SECRET` env var. Runs the full agent (same history, tools, facts as a real LINE message), pushes the reply to the user's LINE chat, and returns `{ reply: "..." }` as JSON. No rate limiting, no allowlist check — dev use only.

## Cron sweep setup

The proactive layer (morning briefings, pre-meeting alerts, evening summaries, task check-ins) needs a QStash schedule pointing at `/api/cron/sweep` every 15 min. See SETUP.md step 11. Without it, proactive features are silent (everything else still works).

Manual trigger (uses `OAUTH_STATE_SECRET` as bearer):
```bash
curl -XPOST https://YOUR-VERCEL-URL/api/cron/sweep \
  -H "Authorization: Bearer $OAUTH_STATE_SECRET"
```

## Security considerations

| Concern | Defense |
|---|---|
| LINE webhook spoofing | HMAC-SHA256 verification of `X-Line-Signature` against raw body, timing-safe compare, BEFORE any work |
| QStash callback spoofing | `Upstash-Signature` verified via `@upstash/qstash` Receiver |
| OAuth state CSRF / replay | Signed (HMAC) connect-link tokens, server-side nonce in Redis with 10-min TTL, single-use GETDEL |
| Refresh tokens at rest | AES-256-GCM with `TOKEN_ENCRYPTION_KEY` (64 hex chars) |
| LLM identity jailbreak | `userId` is bound from the verified webhook, never from tool args. Tools use that bound `userId` to fetch tokens |
| Abuse / quota burn | Per-user sliding-window rate limit (500/hr) via `@upstash/ratelimit` |
| Webhook replay | Each event de-duped by `webhookEventId` for 10 min |
| Confirmation gate | Drafts are queued, executed only on explicit YES — bot won't send the wrong email even if it misreads intent |
| Headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` on all routes |

## Collaboration

Two developers (James + Claude Code), one repo (`assistantforyou/lekha`), one Vercel project, one production LINE bot. No staging environment — all changes go straight to prod.

**Production:** `https://lekha-iota.vercel.app`

**Workflow:**
- Claude Code works on feature branches and opens PRs; James reviews and merges
- Always `git pull origin main` before starting work
- Vercel auto-deploys on every merge to `main`
- No force pushes to main

**For a developer without a Vercel account or GitHub connector:**
1. Clone: `git clone https://github.com/assistantforyou/lekha.git`
2. Set git credentials using the shared PAT: `git remote set-url origin https://assistantforyou:<PAT>@github.com/assistantforyou/lekha.git`
3. Get `.env.local` from the other developer (contains all secrets — do not commit this file)
4. `npm install && npm run dev` to run locally (no LINE events hit localhost; use typecheck to validate changes)
5. `npm run typecheck` before pushing — Vercel build will fail on TS errors
6. Push: `git add -A && git commit -m "..." && git push origin main`

**Shared infrastructure (coordinate before changing):**
- Vercel env vars (owner's account only)
- Upstash Redis keys and QStash schedules
- LINE channel webhook URL and credentials
- Google Cloud OAuth credentials
