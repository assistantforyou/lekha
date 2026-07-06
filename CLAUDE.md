# Lekha — repo guide for Claude Code

A personal AI assistant living in LINE. **Private bot** (allowlist-gated), per-user state, agentic tool use, proactive layer.

## Stack at a glance

| | |
|---|---|
| Runtime | Next.js 16 App Router on Vercel Functions (Node.js, Fluid Compute) |
| Language | TypeScript, strict, `noUncheckedIndexedAccess` on |
| LLM | Vercel AI SDK v6 + `@ai-sdk/google` (Gemini 2.5 Flash, paid-first, free-key fallback only if paid is down) |
| Embeddings | Gemini `gemini-embedding-001` (truncated to 768 dims, L2-normalized) |
| Memory / queues | Upstash Redis (Marketplace integration → `KV_*` env vars) |
| Vector search | Upstash Vector — archive semantic search (substring fallback when unset) |
| Scheduled jobs | Upstash QStash (one-shot reminders, deferred emails, recurring schedules, cron sweep) |
| Web search | Tavily |
| Google APIs | `googleapis` SDK — Gmail send/read/modify, Calendar events/readonly, Drive, People (contacts) |
| Photo storage | User's Google Drive (free, default) → Vercel Blob fallback (`BLOB_READ_WRITE_TOKEN`, optional, WebP-compressed) — receipts only, for users without Google connected |
| Validation | Zod |

## Quick commands

```bash
npm run dev          # next dev (needs .env.local; pull via `vercel env pull`)
npm run build        # production build (turbopack)
npm run typecheck    # tsc --noEmit
npm test             # vitest (unit tests — no network, no Redis)
npx vercel deploy --prod --yes   # ship
npx vercel logs --no-follow --since 1h --no-branch --expand   # recent prod logs with full output
```

## Project layout

```
app/
├── api/
│   ├── line/webhook/route.ts          # thin entrypoint: verify → parse → dispatch (logic in lib/webhook/)
│   ├── dev/chat/route.ts              # Claude testing endpoint — bypass LINE, POST {userId,text}
│   ├── oauth/google/callback/route.ts # OAuth code exchange + auto-resume pending
│   ├── reminders/fire/route.ts        # QStash callback for one-shot/recurring reminders
│   ├── scheduled-email/fire/route.ts  # QStash callback for deferred email sends
│   ├── cron/sweep/route.ts            # QStash callback every 15 min — proactive layer
│   ├── subscribe/route.ts             # marketing email capture
│   └── health/route.ts
├── connect/[token]/page.tsx           # signed-token landing → Google consent
├── components/
│   ├── marketing/reveal.tsx           # scroll-reveal animation
│   ├── marketing/tracked-link.tsx     # outbound link tracker
│   └── ui/button.tsx
└── layout.tsx, page.tsx               # page.tsx = marketing landing page
lib/
├── env.ts                             # zod env + redisCreds() (KV_* and UPSTASH_REDIS_REST_*)
├── errors.ts                          # GoogleAuthRequired, RateLimited, NeedsConfirmation
├── ratelimit.ts                       # per-user 30/hr sliding window
├── confirm.ts                         # pending action queue (atomic RPUSH)
├── pending-runner.ts                  # executePendingAll — runs queue on YES, logs sends
├── cron.ts                            # QStash schedule helpers + local→UTC cron conversion
├── fast-classify.ts                   # zero-latency regex intent hint → toolsForUser narrowing (decision #21)
├── utils.ts                           # shared utilities (cn, etc.)
├── line/{verify,client,types,mime}.ts # HMAC, REST client, zod schemas, file-mime helpers
├── webhook/                           # webhook orchestration split from app/api/line/webhook/route.ts
│   ├── gate.ts                        # allowlist + admin parsing (decision #15)
│   ├── admin-commands.ts              # /allow /remove /users /myid
│   ├── shortcuts.ts                   # declarative LLM-bypass table (help/connect google/briefings)
│   ├── enrich-reply.ts                # text + AgentHints → LineMessage (replaces regex-on-model-text)
│   ├── maybe-extract.ts               # every-10-turn fact extraction trigger
│   └── handlers/{text,image,other-media}.ts
├── llm/
│   ├── provider.ts                    # chatModel + extractorModel — swap here for new LLMs
│   ├── prompts.ts                     # base personality + system prompt builder
│   ├── agent.ts                       # runAgent + helpers (shared by webhook + dev endpoint)
│   ├── extract-facts.ts               # background fact extraction + archive summarization
│   ├── render-drafts.ts               # canonical verbatim draft block
│   ├── briefing.ts                    # builds morning briefing: weather/tasks/reminders/calendar/news/inbox
│   └── evening-summary.ts             # builds 9 PM evening summary — tasks, next 5 calendar events, news via Tavily
├── memory/
│   ├── redis.ts                       # singleton Upstash client
│   ├── crypto.ts                      # AES-256-GCM + HMAC + safeEqual
│   ├── history.ts                     # rolling 20-msg history + turn counter (TTL 90d)
│   ├── facts.ts                       # extracted facts blob + edit/delete/clear
│   ├── archive.ts                     # long-term compressed conversation chunks (200 max)
│   ├── profile.ts                     # display name + first-contact tracking
│   ├── recent-media.ts                # staged LINE media list (RPUSH, 10 max, TTL 30 min)
│   ├── settings.ts                    # per-user tz/locale/loc/briefing prefs
│   ├── tasks.ts                       # persistent open work items
│   ├── receipts.ts                    # receipt store (200 max, 1-year TTL, category-indexed)
│   ├── sent-log.ts                    # audit log (last 200, 6 month TTL)
│   ├── user-registry.ts               # set of all known userIds for cron sweep
│   └── allowlist.ts                   # private access control — Redis set `users:allowed`
└── tools/
    ├── index.ts                       # toolsForUser(userId) — async, declarative registry, env + OAuth + hint gated (decision #21)
    ├── help.ts                        # show_help text dump
    ├── settings.ts                    # 12 tools: get_my_settings + set_timezone/location/language + enable/disable_* prefs
    ├── morning-briefing.ts            # get_morning_briefing tool (calls lib/llm/briefing.ts)
    ├── evening-summary.ts             # get_evening_summary tool (calls lib/llm/evening-summary.ts)
    ├── memory.ts                      # remember/list/update/forget/clear + archive search
    ├── tasks.ts                       # 8 CRUD tools on tasks
    ├── reminders.ts                   # set/list/cancel/set_recurring (one-shot via publish, recurring via schedule)
    ├── web-search.ts                  # Tavily — universal tool, always registered
    ├── contacts.ts                    # contacts_search via Google People API
    ├── google-auth.ts                 # multi-account OAuth, encrypted tokens, scope check, atomic state
    ├── google-accounts.ts             # list/connect/switch/disconnect Google accounts
    ├── with-google.ts                 # auth/api-disabled/quota error → structured marker
    ├── email.ts                       # draft_email (multi-recip, Drive + LINE attach, Gmail threading)
    ├── gmail-inbox.ts                 # gmail_search/read/summarize_recent/draft_gmail_reply + archive/trash/mark_read/apply_label
    ├── scheduled-email.ts             # schedule_email/list/cancel — QStash-deferred sends
    ├── calendar.ts                    # 8 tools: draft/search/update/delete/list_upcoming/today/week/find_free_time
    ├── drive.ts                       # search/list_recent/get_link/read_text/upload_recent_media/create_folder/delete/move/rename/share
    ├── media-ai.ts                    # ocr/summarize_image + summarize/read_document — staged-media only
    ├── receipts.ts                    # scan_receipt/list_receipts/search_receipts/delete_receipt — staged-media only; backs up the photo to Drive ("Lekha Receipts" folder) or, if Google isn't connected, Vercel Blob (WebP-compressed)
    ├── sent-history.ts                # query the audit log
    ├── export.ts                      # JSON dump of all user data
    ├── weather.ts                     # weather — wttr.in primary, Open-Meteo fallback (both keyless)
    ├── finance.ts                     # fx rates, stock quotes, crypto prices — keyless, ~3s timeout
    ├── news.ts                        # news search via Tavily
    ├── lists.ts                       # named lists (grocery, packing, custom) — 8 CRUD tools, Redis-backed
    ├── render-flex.ts                 # render_flex — model-generated LINE Flex cards
    ├── places.ts                      # suggest_places — structured place cards with Google Maps buttons
    └── staged-media.ts                # list / clear LINE media staged for attach/upload
tests/
├── briefing-gate.test.ts              # shouldFireBriefingNow logic
├── confirm.test.ts                    # pending action queue
├── cron.test.ts                       # cron schedule helpers
├── crypto.test.ts                     # AES-256-GCM + HMAC
└── verify.test.ts                     # LINE signature verification
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
OAuth tokens AES-256-GCM with `TOKEN_ENCRYPTION_KEY` (32-byte hex). `OAUTH_STATE_SECRET` HMACs connect-link tokens. State nonces and connect-link tokens are now atomically consumed via `GETDEL` (single-use).

### 10. Rate limit per user
Upstash sliding window, **500/hr/user**. Paid Gemini RPM absorbs the burst at this rate; the cap exists to bound LINE push quota cost and provide an abuse circuit-breaker at 100+ user scale. Raised from 30/hr after the paid-tier migration made the original (free-quota) justification obsolete.

### 11. Settings injected into every system prompt
Timezone, location, language, connected Google accounts, staged media — all live in the system prompt so the model behaves correctly without needing to call lookup tools. Settings default to: 7 AM morning briefing, 1d/1h/15m pre-meeting reminders, 9 PM evening summary, inbox briefing enabled.

Settings use versioning + migration: `CURRENT_VERSION` in `lib/memory/settings.ts` defines the schema. When a new schema is deployed, `applyMigrations()` runs on read and writes back once, never overriding explicit user choices tracked in `userConfigured` array.

### 12. Long-term memory via Upstash Vector (with substring fallback)
Every fact-extraction cycle (every 10 turns) writes a 2–4 sentence chunk summary to `archive`. The summary is also embedded via Gemini `gemini-embedding-001` (truncated to 768 dims via `outputDimensionality`, L2-normalized manually since only the native 3072-dim output is auto-normalized) and upserted to Upstash Vector with metadata `{ userId, archiveId, ts, summary }`. `search_archived_memory` embeds the query and runs a top-K similarity search filtered by `userId`. If `UPSTASH_VECTOR_REST_*` env vars aren't set, or any vector op fails, the search falls back to substring match against the Redis-stored summaries. At 100+ users with growing archives, semantic search materially beats substring on questions like "what did we discuss about that bird-themed project".

**Note:** `text-embedding-004` (the original model this was built against) was retired by Google at some point — every embed call was silently 404ing and falling back to substring for an unknown period before this was caught (2026-07-06). Embed failures only `console.warn`, so this kind of outage produces no user-visible error — if semantic recall feels off, check runtime logs for `[archive] embed failed` before assuming the query itself is the problem.

### 13. Proactive layer via master sweep
A single QStash schedule hits `/api/cron/sweep` every 15 min (legacy endpoint; forwards to `lib/sweep.ts` `runSweepForUser`). Iterates `users:active` set, decides per-user whether to push (morning briefing window check, evening summary window check, task check-in window check). **There are no per-user QStash schedules for briefings/summaries.**

Idempotency is via `claimPushLock()` (`pushlock:{userId}:{type}:{YYYY-MM-DD}` with 5-min TTL), not per-event Redis keys. Pre-meeting alerts and task deadline warnings are scheduled as one-shot QStash messages at event/task creation time — the sweep does NOT scan calendars for upcoming events.

### 14. Email body is base64-encoded
For Thai/UTF-8 fidelity. `Content-Transfer-Encoding: base64` on the text body part. Some MTAs corrupt non-ASCII under `7bit`.

### 15. Private allowlist + self-serve pending queue
The bot is private by default. Every event hits the gate before any other logic. Admin (env var `ADMIN_LINE_USER_ID`, comma-separated for multiple) always passes. Others must be in the `users:allowed` Redis set.

**Self-serve signup:** non-allowed, non-admin users are silently added to `users:pending` (set) with profile metadata at `pending:{userId}` hash (`displayName`, `requestedAt`, optional first message). They receive a friendly "you're in the queue" reply instead of a wall. The admin is push-notified about new requests, rate-limited 1/min/user via `pending_notif:{userId}` NX+TTL key to avoid notification spam.

**Admin commands:** `/allow <id>`, `/remove <id>`, `/users` (direct allowlist), `/pending` (list queue), `/approve <id>` (move pending→allowed + send welcome message), `/deny <id>` (remove from pending), `/status <id>` (diagnostic snapshot), `/force-briefing <id> [morning|evening]` (manual trigger), `/audit <id> [n]` (compliance trace — see decision #22). Anyone can `/myid` to get their own LINE userId.

### 16. Single LLM provider — Gemini 2.5 Flash (paid), 55s timeout
`runAgent` calls Gemini directly with the full tool registry. We moved off Flash Lite because it blanked/panicked on agentic tool use; full Flash handles the same workload reliably. Paid tier RPM (1,000+) absorbs the agentic turn burst. `AGENT_TIMEOUT_MS` is 55s, giving multi-step turns room without burning function time on real hangs (multi-step tool turns routinely take 30-45s). `stepCountIs(8)` caps total reasoning steps to prevent runaway loops.

**Tier order is paid-first, free-as-emergency-fallback-only** (`tiersToTry` in `lib/llm/agent.ts`; `chatModel()` in `lib/llm/provider.ts` mirrors this for non-agentic single-call paths — image analysis, media-ai, preread-doc, health check). This used to be free-first as a cost-saving attempt, but production logs (2026-07-06) showed the free tier's RPM (10-30) is essentially always exhausted under real agentic-turn volume — `[tier] free→paid (quota)` fired on effectively every single logged turn, each one burning 16-19s retrying a call that was never going to succeed before falling back to the paid tier that actually works. Zero cost savings, pure latency tax, on nearly every user-facing reply. Reordered so paid — the tier that's actually reliable — is tried first; free only gets used if paid itself is down. On a full outage (both tiers down) the bot still returns an error rather than degrading further — that part of the original tradeoff stands.

### 18. Conditional tool registry (per-user OAuth gating + intent narrowing)
`toolsForUser(userId)` is async and gates Google-dependent tools (email, calendar, drive, gmail-inbox, scheduled-email, contacts) on whether THIS user has actually connected a Google account (`listAccounts(userId).accounts.length > 0`). Non-Google users get ~20 tools instead of ~82. The connect-account tools remain registered for all users so the model can guide linking. See decision #21 for per-request narrowing on top of this.

### 19. Structured facts (categorized, LRU-capped) + token-bounded history
Facts are stored at `user:{userId}:facts:v2` as a JSON value with shape `{ facts: Fact[], updatedAt }`. Each `Fact` has `id`, `category` (preferences|people|habits|deadlines|context|health|work|other), `content`, `createdAt`, `updatedAt`, optional `confidence`. Cap at 200 facts/user with LRU eviction by `updatedAt`. `factsToPromptBlock` groups by category for prompt scanability. Extractor (`lib/llm/extract-facts.ts`) emits structured output via `generateObject` with category + confidence per fact.

History uses a rolling 20 turns in Redis but `historyForPrompt` is the call site: if the rolling history exceeds ~3000 tokens (chars/4 heuristic), it summarizes the oldest 10 turns into a ~200-token block via the extractor model and prepends it. Summary is cached by content hash for 7 days.

### 20. LINE Flex Messages + postback routing
Draft confirmations, task lists, and other high-signal interactions render as Flex bubbles with tap-to-act postback buttons. Module: `lib/line/flex/` (one file per template + `index.ts` + `parsePostbackData` helper). Templates always include a meaningful `altText` so old LINE clients still see something useful.

Postback `data` is parsed by verb prefix (`verb:arg:arg…`, capped at 300 chars by LINE). Current routes (`app/api/line/webhook/route.ts` postback branch):
- `confirm:yes` / `confirm:no` → `executePendingAll` / `clearPending`
- `task:done:<id>` / `task:reopen:<id>` → `completeTask` / `reopenTask`

Future verbs (`draft:send:<idx>`, `reminder:cancel:<id>`) wire into the same branch. Idempotency relies on the existing `seen:{webhookEventId}` dedup. Per-template snapshot tests in `tests/flex.test.ts`.

### 21. Regex intent hint — zero-latency tool narrowing
`lib/fast-classify.ts` runs instant regex matching on every user message before `toolsForUser`. It returns a single intent string (`"reminder"`, `"weather"`, `"task"`, etc.) for high-confidence single-topic queries, or `undefined` for anything ambiguous, multi-topic, or casual.

`toolsForUser` accepts an optional `hint` and filters the registry: entries tagged with `hints: [...]` are only built when the hint matches; entries with no `hints` field are **universal** (always included). `web_search` is universal so any wrong narrowing always has a search fallback.

**Tool counts (Google-connected user, no staged media):**
- `hint="reminder"` → ~12 tools | `hint="weather"` → ~8 | `hint="task"` → ~12
- `hint="email"` → ~20 | `hint=undefined` → ~82 (all tools)

**Failure mode is always safe**: `undefined` → all tools. The classifier never causes a tool to be missing — it only narrows when certain.

**Do not re-add an LLM-based intent classifier.** The previous implementation caused hard failures when the LLM mis-classified a query (wrong label → wrong tool set → blank response). The regex approach with safe fallback is strictly more reliable.

### 17. Orchestrator-level error relay enforcement
After `generateText`, `runAgent` scans all tool results for `{ ok: false, error: "..." }`. If the model soft-apologized instead of relaying the actual error (detected by checking whether the error text appears in the model's response), the orchestrator overrides the reply with the real error. This prevents models from hiding API failures behind generic apologies.

### 22. Per-user compliance audit log
`lib/memory/audit-log.ts` (`audit:{userId}`, RPUSH-capped at 5000 entries, 1-year TTL — matches the receipts retention window) records one `AuditEntry` per agent turn: full user message text, the `fastClassify` hint that was active, every tool call's name/input/output verbatim (not redacted — this is a compliance/debug trail, not a user-facing feature), success/error status per tool, the final reply, and total duration. Written from both the success and error paths of `runAgent` (`lib/llm/agent.ts`), fire-and-forget (`.catch(console.error)`) so a Redis hiccup never blocks the user's reply.

Admin-only retrieval via `/audit <userId> [n]` (`lib/admin-commands.ts`, default 5 / max 15 entries) — dumps a verbose per-turn trace (tool name, truncated input/output JSON, hint, duration, error) so a reported bug is traceable from the log alone. This is how the Drive-upload-under-`media`-hint bug (tools silently absent from the registry, not a model hallucination) would be diagnosed without needing to reproduce it live.

**Gotcha this log exists to catch:** `fastClassify`'s staged-media early-return (`"this"/"that"/"the file"` → `hint="media"`) fires on phrasing that isn't actually media-only, e.g. "upload **this** to my drive" — narrowing away tools whose `hints` don't include `"media"` even though the request needs them. When adding a new hint-gated tool that can plausibly be invoked in the same breath as a staged-media reference, include `"media"` in its `hints` array (see `buildDriveTools` in `lib/tools/index.ts`).

## Conventions

- **No comments unless explaining a non-obvious WHY.**
- **Strict TS, `noUncheckedIndexedAccess`.** Array element access returns `T | undefined`.
- **Zod for everything at boundaries.**
- **Prefer `lib/` for pure logic, `app/api/*/route.ts` for HTTP boundaries.** Don't export non-handler functions from route files.
- **Logging:** `console.warn` / `console.error` with a `[module]` prefix (`[reminder]`, `[oauth]`, `[google]`, `[sweep]`, `[briefing]`).

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

## Swapping the LLM
`lib/llm/provider.ts` only.

## Gotchas (lessons learned the hard way)

- **82 tools causes Gemini to blank on focused queries** — sending the full registry for a simple "remind me to X" causes the model to return empty text with no tool calls. `fast-classify.ts` narrows the registry to ~10–20 tools for clear single-intent queries. Do NOT remove this; do NOT replace it with an LLM classifier (been there — wrong labels silently break tool access).
- **AI SDK v6 swallows tool exceptions** — must use structured returns for control flow.
- **Parallel tool calls in one step race** — atomic Redis ops mandatory.
- **Gemini paid tier** — billing must be enabled on the Google Cloud project tied to `GEMINI_API_KEY`. Free tier RPM (10–30) is too low for agentic turns; paid tier (1,000+ RPM) absorbs the burst.
- **Vercel Blob's Hobby (free) tier isn't metered/billed** — exceeding the included usage just pauses Blob access for 30 days, it does not charge you. Safe to use for the receipts-photo fallback without spend-management guardrails.
- **`sharp` is a native addon** — Vercel's own `next/image` optimizer uses it, so it's well-supported on their Node.js runtime, but hasn't been explicitly verified end-to-end in this project yet. If receipt photos silently fail to reach Blob storage, check for a `sharp`-related error first.
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
- **Gemini timeout at 55s** (`AGENT_TIMEOUT_MS` in `lib/llm/provider.ts`). Full Flash reasons a bit longer than Flash Lite, and multi-step tool turns routinely take 30-45s; 55s gives them room while still fail-fast-ing real hangs. Image-only `generateText` calls use the same constant. Note `withTimeout`'s `Promise.race` doesn't actually cancel the losing call — a reported timeout can still complete server-side moments later, so a user retrying a timed-out non-idempotent action (e.g. send email) could in theory duplicate it.
- **Pre-flight parallelization** — `checkRateLimit`, `getOrCreateProfile`, `getPending` run in parallel. `showLoading` (LINE API) is fire-and-forget. Saves ~400ms per request vs. sequential awaits.
- **wttr.in is unreliable** — it's a personal project, goes down without warning (HTTP 500). Always have Open-Meteo as fallback. Both are keyless.
- **Upstash Vector index must be dim 768, cosine** to match Gemini `gemini-embedding-001` truncated via `outputDimensionality: 768`. Mismatch surfaces as silent upsert failures — as does any embedding-model 404/rename, which is exactly what happened when `text-embedding-004` was retired (see decision #12).
- **LINE postback `data` capped at 300 chars** — pass IDs, never full content.
- **LINE Flex Messages require `altText`** — without it the API call fails.

## Claude bot access (testing without LINE)

Claude Code has a direct testing channel into the production bot via `/api/dev/chat`. This lets Claude send messages to the bot, read the reply, and have a full back-and-forth conversation without going through LINE at all.

**Credentials (stored in `.env.local`, never commit):**
- `DEV_CHAT_SECRET` — bearer secret for the endpoint
- `DEV_LINE_USER_ID` — James's LINE userId (`U9b7215b2294a271c8c1d70be910a77cb`)
- `APP_BASE_URL` — `https://lekha-iota.vercel.app`

**How to use:**
```bash
curl -s -X POST https://lekha-iota.vercel.app/api/dev/chat \
  -H "Content-Type: application/json" \
  -H "x-dev-secret: $(grep DEV_CHAT_SECRET .env.local | cut -d= -f2)" \
  -d "{\"userId\":\"$(grep DEV_LINE_USER_ID .env.local | cut -d= -f2)\",\"text\":\"your message here\"}" \
  --max-time 60
```

**What it does:** Runs the full agent (same history, tools, facts as a real LINE message), pushes the reply to James's LINE chat, and returns `{ reply: "..." }` as JSON. Replies are visible in LINE in real time.

**Endpoint details (`app/api/dev/chat/route.ts`):**
- Auth: `x-dev-secret` header must match `DEV_CHAT_SECRET` env var (503 if env var unset, 401 if wrong)
- Body: `{ userId: string, text: string }`
- Returns: `{ reply: string }`
- Uses `runAgent` from `lib/llm/agent.ts` — same core as the webhook
- Fires fact extraction every 10 turns (same cadence as webhook)
- No rate limiting, no allowlist check — dev use only

**Known quirk:** Gemini sometimes returns empty text (`(…)`) when a tool returns structured JSON (empty array, settings object). This also happens in the real webhook. Weather, briefing, and conversational replies work consistently.

## Manual smoke tests
See README.md "Manual smoke tests" — covers settings, tasks, contacts, gmail inbox, OCR/voice/PDF, scheduled email, sent history, briefing.

## Cron sweep setup
The proactive layer (morning briefings, pre-meeting alerts, evening summaries) requires a live QStash schedule pointing at `/api/cron/sweep` every 15 min. This is live as of this session (schedule ID `scd_7n4QEk86a7ENn6fghPQagcw2TRNS`). See SETUP.md step 11 for details.

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
