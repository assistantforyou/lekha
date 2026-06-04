# Lekha — repo guide for AI coding agents

A personal AI assistant living in LINE. **Private bot** (allowlist-gated with self-serve signup queue), per-user state, agentic tool use, proactive layer (morning briefings, pre-meeting alerts, evening summaries).

## Stack at a glance

| | |
|---|---|
| Runtime | Next.js 16 App Router on Vercel Functions (Node.js, Fluid Compute) |
| Language | TypeScript, strict, `noUncheckedIndexedAccess` on |
| LLM | Vercel AI SDK v6 + `@ai-sdk/google` (Gemini 2.5 Flash Lite primary, Flash for extraction) |
| Embeddings | Gemini `text-embedding-004` (768 dims) |
| Memory / queues | Upstash Redis (Marketplace integration → `KV_*` env vars) |
| Vector search | Upstash Vector — archive semantic search (substring fallback when unset) |
| Scheduled jobs | Upstash QStash (one-shot reminders, deferred emails, recurring schedules, cron sweep) |
| Web search | Tavily |
| Google APIs | `googleapis` SDK — Gmail send/read/modify, Calendar events/readonly, Drive, People (contacts), Docs, Slides |
| Validation | Zod |
| Tests | Vitest (unit tests — no network, no Redis) |
| Payments | Stripe (optional — monthly/yearly subscriptions) |

## Quick commands

```bash
npm run dev          # next dev (needs .env.local; pull via `vercel env pull`)
npm run build        # production build (turbopack)
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run test:watch   # vitest
npm run lint         # eslint .
npx vercel deploy --prod --yes   # ship
npx vercel logs --no-follow --since 1h --no-branch --expand   # recent prod logs with full output
```

## Project layout

```
app/
├── api/
│   ├── line/webhook/route.ts          # thin entrypoint: verify → parse → dispatch
│   ├── dev/chat/route.ts              # Claude testing endpoint — bypass LINE, POST {userId,text}
│   ├── auth/line/{start,callback}/    # LINE Login web OAuth
│   ├── oauth/google/callback/route.ts # OAuth code exchange + auto-resume pending
│   ├── reminders/fire/route.ts        # QStash callback for one-shot/recurring reminders
│   ├── scheduled-email/fire/route.ts  # QStash callback for deferred email sends
│   ├── cron/sweep/route.ts            # QStash callback every 15 min — proactive layer
│   ├── cron/sweep/fire/route.ts       # manual cron trigger (bearer auth)
│   ├── webhooks/stripe/route.ts       # Stripe webhook handler
│   ├── subscribe/route.ts             # marketing email capture
│   └── health/route.ts
├── connect/[token]/page.tsx           # signed-token landing → Google consent
├── signup/                            # marketing signup pages
├── components/marketing/, components/ui/
└── layout.tsx, page.tsx               # marketing landing page
lib/
├── env.ts                             # zod env + redisCreds() (KV_* and UPSTASH_REDIS_REST_*)
├── errors.ts                          # GoogleAuthRequired, RateLimited, NeedsConfirmation
├── ratelimit.ts                       # per-user 500/hr sliding window
├── gate.ts                            # allowlist + admin parsing
├── confirm.ts                         # pending action queue (atomic RPUSH)
├── pending-runner.ts                  # executePendingAll — runs queue on YES, logs sends
├── cron.ts                            # QStash schedule helpers + local→UTC cron conversion
├── utils.ts                           # shared utilities (cn, etc.)
├── timing.ts                          # performance span/tick helpers
├── shortcuts.ts                       # declarative LLM-bypass table
├── enrich-reply.ts                    # text + AgentHints → LineMessage
├── admin-commands.ts                  # /allow /remove /users /pending /approve /deny /myid
├── sweep.ts                           # proactive sweep orchestration
├── line/
│   ├── verify.ts                      # HMAC-SHA256 signature verification
│   ├── client.ts                      # REST client for reply/push/loading
│   ├── types.ts                       # zod schemas for all LINE event types
│   ├── mime.ts                        # file mime-type helpers
│   └── flex/                          # LINE Flex Message templates + postback parser
├── llm/
│   ├── provider.ts                    # chatModel + extractorModel + embeddingModel — swap here
│   ├── prompts.ts                     # base personality + system prompt builder
│   ├── agent.ts                       # runAgent + helpers (shared by webhook + dev endpoint)
│   ├── agent-flex.ts                  # Flex Message builders from tool results
│   ├── extract-facts.ts               # background fact extraction + archive summarization
│   ├── render-drafts.ts               # canonical verbatim draft block
│   ├── briefing.ts                    # morning briefing: weather/tasks/reminders/calendar/news/inbox
│   └── evening-summary.ts             # 9 PM evening summary
├── memory/
│   ├── redis.ts                       # singleton Upstash client
│   ├── crypto.ts                      # AES-256-GCM + HMAC + safeEqual
│   ├── history.ts                     # rolling 20-msg history + turn counter (TTL 90d)
│   ├── facts.ts                       # structured facts blob (categorized, LRU-capped 200)
│   ├── archive.ts                     # long-term compressed conversation chunks (200 max)
│   ├── profile.ts                     # display name + first-contact tracking
│   ├── recent-media.ts                # staged LINE media list (RPUSH, 10 max, TTL 30 min)
│   ├── settings.ts                    # per-user tz/locale/loc/briefing prefs (versioned + migrations)
│   ├── tasks.ts                       # persistent open work items
│   ├── receipts.ts                    # receipt store (200 max, 1-year TTL, category-indexed)
│   ├── sent-log.ts                    # audit log (last 200, 6 month TTL)
│   ├── user-registry.ts               # set of all known userIds for cron sweep
│   └── allowlist.ts                   # private access control — Redis set `users:allowed`
└── tools/
    ├── index.ts                       # toolsForUser(userId) — async, declarative registry, env + per-user OAuth gated
    ├── help.ts                        # show_help text dump
    ├── settings.ts                    # set_timezone/location/language/morning_briefing/pre_meeting + evening_summary
    ├── morning-briefing.ts            # get_morning_briefing tool
    ├── evening-summary.ts             # get_evening_summary tool
    ├── memory.ts                      # remember/list/update/forget/clear + archive search
    ├── tasks.ts                       # CRUD on tasks
    ├── reminders.ts                   # set/list/cancel/set_recurring (one-shot via publish, recurring via schedule)
    ├── web-search.ts                  # Tavily
    ├── contacts.ts                    # contacts_search via Google People API
    ├── google-auth.ts                 # multi-account OAuth, encrypted tokens, scope check, atomic state
    ├── google-accounts.ts             # list/connect/switch/disconnect Google accounts
    ├── with-google.ts                 # auth/api-disabled/quota error → structured marker
    ├── email.ts                       # draft_email + sendEmail (multi-recip, Drive + LINE attach, Gmail threading)
    ├── gmail-inbox.ts                 # gmail_search/read/summarize_recent + draft_gmail_reply
    ├── scheduled-email.ts             # schedule_email/list/cancel — QStash-deferred sends
    ├── calendar.ts                    # draft + create + list_upcoming
    ├── drive.ts                       # search/list_recent/get_link/read_text/upload_recent_media
    ├── media-ai.ts                    # transcribe/summarize_audio + ocr/summarize_image + summarize_document
    ├── receipts.ts                    # scan_receipt/list_receipts/search_receipts/delete_receipt
    ├── sent-history.ts                # query the audit log
    ├── export.ts                      # JSON dump of all user data
    ├── weather.ts                     # weather — wttr.in primary, Open-Meteo fallback (both keyless)
    ├── finance.ts                     # fx rates, stock quotes, crypto prices — keyless, ~3s timeout
    ├── news.ts                        # news search via Tavily
    ├── lists.ts                       # named lists (grocery, packing, custom) — 7 CRUD tools, Redis-backed
    ├── docs.ts                        # Google Docs create/edit + Slides create with structured slides
    └── staged-media.ts                # list / clear LINE media staged for attach/upload
tests/
├── allowlist.test.ts
├── briefing-gate.test.ts
├── confirm.test.ts
├── cron.test.ts
├── crypto.test.ts
├── facts.test.ts
├── flex.test.ts
├── history.test.ts
└── verify.test.ts
marketing/
├── src/                               # standalone Vite React marketing site
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
After `generateText`, `runAgent` collects all `draft_email` / `draft_calendar_event` tool calls and builds a verbatim block via `renderDraftsBlock`. Source of truth = tool args.

### 4. Auto-resume after OAuth
`/api/oauth/google/callback` executes pending actions immediately after a successful exchange and pushes the result. No "try again."

### 5. Per-user multi-account Google
Tokens at `google:tokens:{userId}:{email}`, accounts blob at `google:accounts:{userId}` with `activeEmail`. `getGoogleClient(userId, email?, requiredScopes?)` → throws GoogleAuthRequired if scopes missing (forces re-consent). Tools accept optional `fromEmail` to override active account per-call.

### 6. Per-user state isolation
Everything in Redis is keyed by LINE `userId`. There is no global state besides env. Adding a tool? Per-user-bind via `buildXxxTools(userId)`.

### 7. Webhook responds 200 immediately
Handler uses `after(async () => …)` so LINE doesn't time out / retry. Real work happens after response. Webhook events de-duped via `seen:{webhookEventId}` 10-min keys.

### 8. Webhook + QStash signature verify before any work
`verifyLineSignature` runs first, on the raw body, before JSON parsing. Same for QStash `Receiver.verify()` on the cron sweep, reminder fire, and scheduled-email fire routes.

### 9. Tokens encrypted at rest
OAuth tokens AES-256-GCM with `TOKEN_ENCRYPTION_KEY` (32-byte hex). `OAUTH_STATE_SECRET` HMACs connect-link tokens. State nonces and connect-link tokens are atomically consumed via `GETDEL` (single-use).

### 10. Rate limit per user
Upstash sliding window, **500/hr/user**. Paid Gemini RPM absorbs the burst; the cap exists to bound LINE push quota cost and provide an abuse circuit-breaker at 100+ user scale.

### 11. Settings injected into every system prompt
Timezone, location, language, connected Google accounts, staged media — all live in the system prompt so the model behaves correctly without needing to call lookup tools. Settings use versioning + migration: `CURRENT_VERSION` in `lib/memory/settings.ts` defines the schema. When a new schema is deployed, `applyMigrations()` runs on read and writes back once, never overriding explicit user choices tracked in `userConfigured` array.

### 12. Long-term memory via Upstash Vector (with substring fallback)
Every fact-extraction cycle (every 10 turns) writes a 2–4 sentence chunk summary to `archive`. The summary is also embedded via Gemini `text-embedding-004` (768 dims) and upserted to Upstash Vector with metadata `{ userId, archiveId, ts, summary }`. `search_archived_memory` embeds the query and runs a top-K similarity search filtered by `userId`. If `UPSTASH_VECTOR_REST_*` env vars aren't set, or any vector op fails, the search falls back to substring match against the Redis-stored summaries.

### 13. Proactive layer via master sweep
A single QStash schedule hits `/api/cron/sweep` every 15 min (legacy endpoint; forwards to `lib/sweep.ts` `runSweepForUser`). Iterates `users:active` set, decides per-user whether to push (morning briefing window check, evening summary window check, task check-in window check). **There are no per-user QStash schedules for briefings/summaries.**

Idempotency is via `claimPushLock()` (`pushlock:{userId}:{type}:{YYYY-MM-DD}` with 5-min TTL), not per-event Redis keys. Pre-meeting alerts and task deadline warnings are scheduled as one-shot QStash messages at event/task creation time — the sweep does NOT scan calendars for upcoming events.

### 14. Email body is base64-encoded
For Thai/UTF-8 fidelity. `Content-Transfer-Encoding: base64` on the text body part. Some MTAs corrupt non-ASCII under `7bit`.

### 15. Private allowlist + self-serve pending queue
The bot is private by default. Every event hits the gate before any other logic. Admin (`ADMIN_LINE_USER_ID`, comma-separated for multiple) always passes. Others must be in the `users:allowed` Redis set.

**Self-serve signup:** non-allowed, non-admin users are silently added to `users:pending` (set) with profile metadata at `pending:{userId}` hash. They receive a friendly "you're in the queue" reply. The admin is push-notified about new requests, rate-limited 1/min/user.

**Admin commands:** `/allow <id>`, `/remove <id>`, `/users` (direct allowlist), `/pending` (list queue), `/approve <id>` (move pending→allowed + send welcome), `/deny <id>` (remove from pending). Anyone can `/myid` to get their own LINE userId.

### 16. Single LLM provider — Gemini 2.5 Flash Lite (paid), 60s timeout
No cascade, no fallback. Paid tier RPM (1,000+) absorbs the agentic turn burst. On Gemini outage the bot returns an error — that tradeoff is intentional for a personal bot. `AGENT_TIMEOUT_MS` is 20s — fail-fast for real hangs without burning function time. `stepCountIs(8)` caps total reasoning steps to prevent runaway loops.

### 17. Orchestrator-level error relay enforcement
After `generateText`, `runAgent` scans all tool results for `{ ok: false, error: "..." }`. If the model soft-apologized instead of relaying the actual error (detected by checking whether the error text appears in the model's response), the orchestrator overrides the reply with the real error. This prevents models from hiding API failures behind generic apologies.

### 18. Conditional tool registry (per-user OAuth gating)
`toolsForUser(userId)` is async and gates Google-dependent tools on whether THIS user has actually connected a Google account. Saves ~2K tokens per request for users without OAuth. The connect-account tools remain registered even without a connection so the model can guide the user through linking. The system prompt stays static (preserves Gemini implicit caching). Cached per-user for 5 minutes.

### 19. Structured facts (categorized, LRU-capped) + token-bounded history
Facts are stored at `user:{userId}:facts:v2` as JSON with shape `{ facts: Fact[], updatedAt }`. Each `Fact` has `id`, `category` (preferences|people|habits|deadlines|context|health|work|other), `content`, `createdAt`, `updatedAt`, optional `confidence`. Cap at 200 facts/user with LRU eviction by `updatedAt`.

History uses a rolling 20 turns in Redis but `historyForPrompt` summarizes the oldest 10 turns into a ~200-token block via the extractor model if the rolling history exceeds ~3000 tokens (chars/4 heuristic). Summary is cached by content hash for 7 days.

### 20. LINE Flex Messages + postback routing
Draft confirmations, task lists, and other high-signal interactions render as Flex bubbles with tap-to-act postback buttons. Module: `lib/line/flex/` (one file per template + `index.ts` + `parsePostbackData` helper). Templates always include a meaningful `altText` so old LINE clients still see something useful.

Postback `data` is parsed by verb prefix (`verb:arg:arg…`, capped at 300 chars by LINE). Current routes:
- `confirm:yes` / `confirm:no` → `executePendingAll` / `clearPending`
- `task:done:<id>` / `task:reopen:<id>` → `completeTask` / `reopenTask`

Idempotency relies on the existing `seen:{webhookEventId}` dedup.

## Conventions

- **No comments unless explaining a non-obvious WHY.**
- **Strict TS, `noUncheckedIndexedAccess`.** Array element access returns `T | undefined`.
- **Zod for everything at boundaries.**
- **Prefer `lib/` for pure logic, `app/api/*/route.ts` for HTTP boundaries.** Don't export non-handler functions from route files.
- **Logging:** `console.warn` / `console.error` with a `[module]` prefix (`[reminder]`, `[oauth]`, `[google]`, `[sweep]`, `[briefing]`).

## Adding a new tool

1. Create `lib/tools/your-tool.ts`. Export `buildYourTools(userId)` returning `tool({ description, inputSchema, execute })` records.
2. Wrap any Google call in `withGoogleClient(userId, fromEmail, [scopes], async ({client}) => …)`.
3. Register in `lib/tools/index.ts` (env-gated if needed).
4. If it produces something the user must approve, write through `appendPending` and add a renderer in `lib/llm/render-drafts.ts`.
5. Update `lib/llm/prompts.ts` so the model knows about it.

## Adding a new pending-action type

1. Add a variant to `PendingAction` in `lib/confirm.ts`.
2. Add a case in `executeOne` inside `lib/pending-runner.ts` (and `logSent` for the audit trail).
3. Render it in `lib/llm/render-drafts.ts`.

## Swapping the LLM

`lib/llm/provider.ts` only.

## Gotchas (lessons learned the hard way)

- **AI SDK v6 swallows tool exceptions** — must use structured returns for control flow.
- **Parallel tool calls in one step race** — atomic Redis ops mandatory.
- **Gemini paid tier** — billing must be enabled on the Google Cloud project tied to `GEMINI_API_KEY`. Free tier RPM (10–30) is too low for agentic turns.
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
- **Gemini timeout at 20s** (`AGENT_TIMEOUT_MS` in `lib/llm/provider.ts`) — fail-fast for real hangs. Most healthy requests finish in 1–3s.
- **Pre-flight parallelization** — `checkRateLimit`, `getOrCreateProfile`, `getPending` run in parallel. `showLoading` (LINE API) is fire-and-forget. Saves ~400ms per request vs. sequential awaits.
- **wttr.in is unreliable** — it's a personal project, goes down without warning (HTTP 500). Always have Open-Meteo as fallback. Both are keyless.
- **Upstash Vector index must be dim 768, cosine** to match Gemini `text-embedding-004`. Mismatch surfaces as silent upsert failures.
- **LINE postback `data` capped at 300 chars** — pass IDs, never full content.
- **LINE Flex Messages require `altText`** — without it the API call fails.

## Testing

Tests are Vitest, run in Node environment, no network, no Redis:

```bash
npm test             # single run
npm run test:watch   # watch mode
npm run test:coverage # with coverage
```

Current test files cover: allowlist gating, briefing-fire logic, confirm/pending queue, cron schedule helpers, crypto (AES/HMAC), fact storage, Flex Message templates, history rolling window, and LINE signature verification.

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

The proactive layer (morning briefings, pre-meeting alerts, evening summaries) needs a QStash schedule pointing at `/api/cron/sweep` every 15 min. See SETUP.md step 11. Without it, proactive features are silent (everything else still works).

Manual trigger (uses `OAUTH_STATE_SECRET` as bearer):
```bash
curl -XPOST https://YOUR-VERCEL-URL/api/cron/sweep \
  -H "Authorization: Bearer $OAUTH_STATE_SECRET"
```

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
