# Graph Report - lekha  (2026-06-01)

## Corpus Check
- 167 files · ~2,892,437 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1522 nodes · 2838 edges · 86 communities (79 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6866bcb0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 94|Community 94]]

## God Nodes (most connected - your core abstractions)
1. `redis()` - 99 edges
2. `Audit: Inventory` - 60 edges
3. `env` - 37 edges
4. `getSettings()` - 28 edges
5. `runAgent()` - 26 edges
6. `handleEvent()` - 25 edges
7. `loadFacts()` - 24 edges
8. `span()` - 23 edges
9. `reply()` - 22 edges
10. `listTasks()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `TweakColor()` --calls--> `key()`  [INFERRED]
  dashboard/project/tweaks-panel.jsx → lib/memory/settings.ts
- `TweakColor()` --calls--> `key()`  [INFERRED]
  dashboard/project/uploads/LEKHA-handoff (2)/project/tweaks-panel.jsx → lib/memory/settings.ts
- `POST()` --calls--> `push()`  [EXTRACTED]
  app/api/dev/chat/route.ts → lib/line/client.ts
- `POST()` --calls--> `executePendingAll()`  [EXTRACTED]
  app/api/dev/chat/route.ts → lib/pending-runner.ts
- `POST()` --calls--> `loadFacts()`  [EXTRACTED]
  app/api/dev/chat/route.ts → lib/memory/facts.ts

## Communities (86 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (27): briefingFlex(), parseSections(), Section, CalendarEventRow, calendarEventsFlex(), gmailResultsFlex(), GmailRow, parsePostbackData() (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.53
Nodes (5): getProfile(), getOrCreateProfile(), isFirstContact(), key(), Profile

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (34): fetchJSON(), key(), listSent(), logSent(), SentEntry, buildEveningSummaryTool(), buildExportTools(), buildFinanceTools() (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (16): SendEmailAction, buildContactsTools(), PersonShape, READ_SCOPES, WRITE_SCOPES, buildDocsTools(), buildDriveTools(), DriveFileLite (+8 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (59): app/ directory, Audit: Inventory, Duplicate / near-duplicate logic, Files not imported anywhere (dead code), lib/confirm.ts, lib/cron.ts, lib/env.ts, lib/errors.ts (+51 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (33): GET(), GET(), addToAllowlist(), addToPending(), adminNotifKey(), approvePending(), denyPending(), getPendingInfo() (+25 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (47): dependencies, ai, @ai-sdk/google, class-variance-authority, clsx, framer-motion, googleapis, lucide-react (+39 more)

### Community 8 - "Community 8"
Cohesion: 0.04
Nodes (47): A. Drive files, A new LLM provider, A new pending-action type, A new tool, Adding new capabilities, Architecture, Attachment system, B. LINE-staged media (multi-file batching) (+39 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (34): hasUpstashVector(), ExtractedFact, Schema, embeddingModel(), appendArchive(), ArchivedSummary, embedText(), key() (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.10
Nodes (21): 10. Rate limit per user, 11. Settings injected into every system prompt, 12. Long-term memory via Upstash Vector (with substring fallback), 13. Proactive layer via QStash schedule, 14. Email body is base64-encoded, 15. Private allowlist + self-serve pending queue, 16. Single LLM provider — Gemini 2.5 Flash Lite (paid), 60s timeout, 17. Orchestrator-level error relay enforcement (+13 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (20): BASE_PRICING, BUILTFOR, CAPABILITIES, CHAT_SCRIPTS, CMD_EVENTS, CMD_OPS, CMD_TASKS, CURRENCY_LABEL (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (21): App(), BASE_PRICING, BUILTFOR, CAPABILITIES, CHAT_SCRIPTS, CMD_EVENTS, CMD_OPS, CMD_TASKS (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (18): 10. Rate limit per user, 11. Settings injected into every system prompt, 12. Long-term memory via summarization, not vectors, 13. Proactive layer via QStash schedule, 14. Email body is base64-encoded, 15. Private allowlist — `ADMIN_LINE_USER_ID` + `users:allowed` Redis set, 16. Single LLM — Gemini only, 17. Orchestrator-level error relay enforcement (+10 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (30): hasGoogleOAuth(), decrypt(), encrypt(), hmac(), key(), safeEqual(), blob, buf (+22 more)

### Community 15 - "Community 15"
Cohesion: 0.12
Nodes (15): AudioMessage, FileMessage, FollowEvent, ImageMessage, Message, MessageEvent, OtherEvent, OtherMessage (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (22): Audit: Test Plan, CI — `.github/workflows/ci.yml`, code:typescript (import { defineConfig } from "vitest/config";), code:json ("scripts": {), code:yaml (name: CI), Coverage targets (not enforced, but aim for), Mocking strategy, P0 — `lib/line/verify.ts` (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.09
Nodes (5): App(), SAMPLE_BRIEFS, TWEAK_DEFAULTS, VIEWS, useTweaks()

### Community 18 - "Community 18"
Cohesion: 0.09
Nodes (20): 10. Tell LINE about the webhook, 11. Proactive cron sweep (LIVE — completed), 12. Smoke test from your phone, 1. Generate your encryption keys, 2. LINE channel access token, 3. Google Cloud — OAuth + APIs, 4. Tavily (web search), 5. Gemini API key (under the same Google account that owns the Cloud project!) (+12 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.27
Nodes (11): buildEmailTools(), buildRawMime(), chunkBase64(), defaultFilename(), encodeHeader(), escapeMimeHeaderValue(), fetchDriveFile(), FetchedAttachment (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.10
Nodes (21): 10. Rate limit per user, 11. Settings injected into every system prompt, 12. Long-term memory via Upstash Vector (with substring fallback), 13. Proactive layer via QStash schedule, 14. Email body is base64-encoded, 15. Private allowlist + self-serve pending queue, 16. Single LLM provider — Gemini 2.5 Flash Lite (paid), 60s timeout, 17. Orchestrator-level error relay enforcement (+13 more)

### Community 22 - "Community 22"
Cohesion: 0.17
Nodes (14): dependencies, react, react-dom, devDependencies, vite, @vitejs/plugin-react, name, private (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (5): DashboardPage(), getSession(), GET(), GET(), POST()

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (11): Bug registry summary, Documentation accuracy, Executive summary, Fixed in this session, Lekha — Full-Scale Audit: Final Report, Open bugs (not fixed — see `audit/05-bugs-and-gaps.md` for full detail), Recommendations (top 5 by impact), Security posture (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (16): Adding a new pending-action type, Adding a new tool, Claude bot access (testing without LINE), code:bash (npm run dev          # next dev (needs .env.local; pull via ), code:block2 (app/), code:bash (curl -s -X POST https://lekha-iota.vercel.app/api/dev/chat \), Collaboration, Conventions (+8 more)

### Community 26 - "Community 26"
Cohesion: 0.18
Nodes (9): Audit: Security, Cryptography, Dependency vulnerabilities (npm audit), Information leakage, Injection vectors, OAuth and token security, Request authenticity and authorization, Security controls not in place (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.36
Nodes (7): cn(), Reveal(), RevealProps, Button(), ButtonProps, buttonVariants, buttonVariantsForLink()

### Community 28 - "Community 28"
Cohesion: 0.08
Nodes (7): I, NAV_SECTIONS, State, TOOLS, TOPICS, TWEAK_DEFAULTS, VIEWS

### Community 29 - "Community 29"
Cohesion: 0.10
Nodes (18): Decisions (overrides to CLAUDE.md), Env vars added, Gemini call timeout vs agent loop budget, Manual prereqs (James to do), Migration strategy, Open PRs to watch for conflicts, Operation Tune-Up — Architecture Plan, Rollback plan (+10 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (9): Blocked / questions for James, CLAUDE.md updates pending, code:bash (# Confirm in LINE: send "yo" first to verify the bot still w), Done, Files touched (summary), Handoff / smoke test plan, In progress, Operation Tune-Up — TODO (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.20
Nodes (8): `app/api/cron/sweep/route.ts`, `app/api/health/route.ts`, `app/api/line/webhook/route.ts`, `app/api/oauth/google/callback/route.ts`, `app/api/reminders/fire/route.ts`, `app/api/scheduled-email/fire/route.ts`, Audit: Route Handlers, Summary of structural issues

### Community 32 - "Community 32"
Cohesion: 0.22
Nodes (7): Audit: Bugs and Gaps, Bug count by priority, Documentation gaps (not code bugs), P0 — Fix before any production traffic, P1 — Fix this week, P2 — Fix this sprint, P3 — Fix when convenient

### Community 38 - "Community 38"
Cohesion: 0.13
Nodes (6): CONNECTIONS, DEFAULT_STATE, I, NAV_SECTIONS, TOOLS, TOPICS

### Community 41 - "Community 41"
Cohesion: 0.50
Nodes (3): config, config, config

### Community 42 - "Community 42"
Cohesion: 0.50
Nodes (3): config, config, config

### Community 43 - "Community 43"
Cohesion: 0.50
Nodes (3): config, config, config

### Community 44 - "Community 44"
Cohesion: 0.12
Nodes (16): Adding a new pending-action type, Adding a new tool, Claude bot access (testing without LINE), code:bash (npm run dev          # next dev (needs .env.local; pull via ), code:block2 (app/), code:bash (curl -s -X POST https://lekha-iota.vercel.app/api/dev/chat \), Collaboration, Conventions (+8 more)

### Community 45 - "Community 45"
Cohesion: 0.57
Nodes (5): GET(), secret(), sessionCookieOpts(), signSession(), verifySession()

### Community 46 - "Community 46"
Cohesion: 0.06
Nodes (21): App(), BASE_PRICING, BUILTFOR, CAPABILITIES, CHAT_SCRIPTS, CMD_EVENTS, CMD_OPS, CMD_TASKS (+13 more)

### Community 48 - "Community 48"
Cohesion: 0.18
Nodes (11): 10. `googleapis` package bloats server bundle, 11. No provider-level timeout on Gemini, 1. `generateText` is the single dominant cost (~70–95% of total time), 2. No `replyOrPush` fallback on expired replyToken, 3. Tool execution happens sequentially inside `generateText`, 8. Sequential `appendTurn` ×2, 9. `toolsForUser` re-evaluates env gates on every request, Identified Bottlenecks (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.10
Nodes (21): 10. Rate limit per user, 11. Settings injected into every system prompt, 12. Long-term memory via Upstash Vector (with substring fallback), 13. Proactive layer via QStash schedule, 14. Email body is base64-encoded, 15. Private allowlist + self-serve pending queue, 16. Single LLM provider — Gemini 2.5 Flash Lite (paid), 60s timeout, 17. Orchestrator-level error relay enforcement (+13 more)

### Community 53 - "Community 53"
Cohesion: 0.40
Nodes (5): 4. Redundant `listAccounts` / `listRecentMedia` fetch, 5. History summarization blocks on cache miss, 6. `maxRetries: 3` on `generateText` can burn time on transient failures, 7. Background fact extraction consumes quota every 10 turns, P1 — Significant (adds 100ms–3s)

### Community 54 - "Community 54"
Cohesion: 0.13
Nodes (6): CONNECTIONS, DEFAULT_STATE, I, NAV_SECTIONS, TOOLS, TOPICS

### Community 55 - "Community 55"
Cohesion: 0.22
Nodes (22): cancelTaskDeadlineWarning(), scheduleTaskDeadlineWarning(), archiveNote(), Ctx, handleCheckin(), handleConfirm(), handleEvent(), handleFallback() (+14 more)

### Community 56 - "Community 56"
Cohesion: 0.25
Nodes (17): handleAdminCommand(), handleMyId(), classify(), buildGate(), Gate, passesAllowlist(), executePendingAll(), checkRateLimit() (+9 more)

### Community 58 - "Community 58"
Cohesion: 0.11
Nodes (18): Adding a new pending-action type, Adding a new tool, code:bash (npm run dev          # next dev (needs .env.local; pull via ), code:block2 (app/), code:bash (npm test             # single run), code:bash (curl -s -X POST https://lekha-iota.vercel.app/api/dev/chat \), code:bash (curl -XPOST https://YOUR-VERCEL-URL/api/cron/sweep \), Collaboration (+10 more)

### Community 59 - "Community 59"
Cohesion: 0.20
Nodes (9): code:ts (// text.ts), code:ts (await reply(replyToken, messages); // silently fails if toke), code:ts (await replyOrPush(userId, replyToken, messages); // falls ba), Immediate Wins (Low Effort, High Impact), R1. Pass pre-loaded data into `runAgent` — saves 20–60ms per request, R2. Use `replyOrPush` instead of `reply` in handlers — prevents silent failures, R3. Reduce `AGENT_TIMEOUT_MS` from 60s to 20s — fail fast, retry via push, R4. Add `maxRetries: 1` instead of `3` — reduce retry burn (+1 more)

### Community 60 - "Community 60"
Cohesion: 0.25
Nodes (8): code:block4 (┌───────────────────────────────────────────────────────────), code:block5 (┌───────────────────────────────────────────────────────────), Monitoring Checklist, Performance Analysis & Tuning Guide, Pipeline Breakdown, Quick Wins Summary, Where Time Goes (Image Message), Where Time Goes (Typical Text Message)

### Community 63 - "Community 63"
Cohesion: 0.29
Nodes (7): Big Bets (High Effort, High Impact), code:json ("googleapis": "^144.0.0"), code:json ("@googleapis/gmail": "^12.0.0",), R10. Add a fast-path for common queries, R11. Move to Vercel AI SDK v7 with `streamText` + tool streaming, R12. Cache common tool results, R9. Replace `googleapis` with scoped `@googleapis/*` packages

### Community 64 - "Community 64"
Cohesion: 0.29
Nodes (7): code:bash (# Local dev), code:json ({"_timing":true,"traceId":"Uxxabc_123","label":"agent:genera), code:block3 ({"_timing":true,"traceId":"Uabc_123","label":"webhook:prelig), Enabling, Example: A Typical Text Request, Reading the Logs, Timing Logs (Zero-Overhead)

### Community 65 - "Community 65"
Cohesion: 0.29
Nodes (3): SAMPLE_BRIEFS, TWEAK_DEFAULTS, VIEWS

### Community 66 - "Community 66"
Cohesion: 0.33
Nodes (6): code:ts (const cacheKey = `tools:${userId}:${hashAccounts(accounts)}`), Medium Effort, High Impact, R5. Cache `toolsForUser` result per user, R6. Pre-compute history summary in background, R7. Bundle media download with preflight, R8. Add streaming response for long tasks

### Community 67 - "Community 67"
Cohesion: 0.29
Nodes (5): verifyLineSignature(), body, sig, valid, POST()

### Community 68 - "Community 68"
Cohesion: 0.05
Nodes (90): Body, convertHeicToJpeg(), detectImageMediaType(), POST(), respondToImage(), respondToText(), stripMarkdown(), maybeExtractFacts() (+82 more)

### Community 69 - "Community 69"
Cohesion: 0.16
Nodes (12): TweakColor(), TweakColor(), POST(), runSweepForUser(), applyMigrations(), DEFAULTS, key(), MIGRATIONS (+4 more)

### Community 70 - "Community 70"
Cohesion: 0.40
Nodes (4): About the design files, Bundle contents, CODING AGENTS: READ THIS FIRST, What you should do — IMPORTANT

### Community 71 - "Community 71"
Cohesion: 0.40
Nodes (4): About the design files, Bundle contents, CODING AGENTS: READ THIS FIRST, What you should do — IMPORTANT

### Community 72 - "Community 72"
Cohesion: 0.43
Nodes (6): assert_contains(), assert_not_contains(), fail, pass, run_test(), test-runtime.sh script

### Community 73 - "Community 73"
Cohesion: 0.70
Nodes (4): chat(), check(), run(), uuid()

### Community 74 - "Community 74"
Cohesion: 0.14
Nodes (14): Adding a new pending-action type, Adding a new tool, code:bash (npm run dev          # next dev (needs .env.local; pull via ), code:block2 (app/), Collaboration, Conventions, Cron sweep setup, Gotchas (lessons learned the hard way) (+6 more)

### Community 76 - "Community 76"
Cohesion: 0.06
Nodes (73): Body, POST(), Body, POST(), Body, cancelSchedule(), localTimeToUtcCron(), qstash() (+65 more)

### Community 78 - "Community 78"
Cohesion: 0.18
Nodes (11): 10. `googleapis` package bloats server bundle, 11. No provider-level timeout on Gemini, 1. `generateText` is the single dominant cost (~70–95% of total time), 2. No `replyOrPush` fallback on expired replyToken, 3. Tool execution happens sequentially inside `generateText`, 8. Sequential `appendTurn` ×2, 9. `toolsForUser` re-evaluates env gates on every request, Identified Bottlenecks (+3 more)

### Community 79 - "Community 79"
Cohesion: 0.20
Nodes (9): code:block4 (┌───────────────────────────────────────────────────────────), code:block5 (┌───────────────────────────────────────────────────────────), Deferred (big bets), Monitoring Checklist, Performance Analysis & Tuning Guide, Pipeline Breakdown, Quick Wins Summary, Where Time Goes (Image Message) (+1 more)

### Community 80 - "Community 80"
Cohesion: 0.22
Nodes (9): code:ts (// lib/handlers/text.ts), code:ts (export const AGENT_TIMEOUT_MS = 20_000;), code:ts (generateText({), Immediate Wins (Low Effort, High Impact), ✅ R1. Pass pre-loaded data into `runAgent` — saves 20–60ms per request, ✅ R2. Use `replyOrPush` instead of `reply` in handlers — prevents silent failures, ✅ R3. Reduce `AGENT_TIMEOUT_MS` from 60s to 20s — fail fast, ✅ R4. Add `maxRetries: 1` instead of `3` — reduce retry burn (+1 more)

### Community 81 - "Community 81"
Cohesion: 0.17
Nodes (12): confirmCancelFlex(), enrichReply(), Ctx, Shortcut, SHORTCUTS, clamp(), LineMessage, QuickReplyItem (+4 more)

### Community 82 - "Community 82"
Cohesion: 0.25
Nodes (8): Big Bets (High Effort, High Impact), code:json ("googleapis": "^144.0.0"), code:json ("@googleapis/gmail": "^12.0.0",), code:ts (const weatherCache = new Map<string, { result: unknown; ts: ), R10. Add a fast-path for common queries, R11. Move to Vercel AI SDK v7 with `streamText` + tool streaming, ✅ R12. Cache common tool results, R9. Replace `googleapis` with scoped `@googleapis/*` packages

### Community 84 - "Community 84"
Cohesion: 0.13
Nodes (18): GET(), escapeHtml(), htmlPage(), AFFIRMATIVE, AffirmDecision, appendPending(), clearPending(), CreateCalendarEventAction (+10 more)

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (7): code:bash (# Local dev), code:json ({"_timing":true,"traceId":"Uxxabc_123","label":"agent:genera), code:block3 ({"_timing":true,"traceId":"Uabc_123","label":"webhook:prelig), Enabling, Example: A Typical Text Request, Reading the Logs, Timing Logs (Zero-Overhead)

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (7): code:ts (const staged = await listRecentMedia(userId);), code:ts (const toolCache = new Map<string, { tools: ToolSet; ts: numb), Medium Effort, High Impact, ✅ R5. Cache `toolsForUser` result per user, R6. Pre-compute history summary in background, ✅ R7. Bundle media download with preflight, R8. Add "Working on it..." push for long operations

### Community 88 - "Community 88"
Cohesion: 0.40
Nodes (5): 4. Redundant `listAccounts` / `listRecentMedia` fetch, 5. History summarization blocks on cache miss, 6. `maxRetries: 1` on `generateText` — retry burn reduced (R4), 7. Background fact extraction consumes quota every 10 turns, P1 — Significant (adds 100ms–3s)

### Community 91 - "Community 91"
Cohesion: 0.71
Nodes (5): respondToOtherMedia(), defaultMimeForKind(), guessMimeFromFilename(), isArchive(), isReadableDoc()

### Community 94 - "Community 94"
Cohesion: 0.23
Nodes (9): errorMessage(), GoogleAuthRequired, NeedsConfirmation, RateLimited, unwrapAuthRequired(), unwrapCause(), executeOne(), createCalendarEvent() (+1 more)

## Knowledge Gaps
- **662 isolated node(s):** `Body`, `Body`, `ProcessedResult`, `AgentResult`, `PLACEHOLDER_REPLIES` (+657 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `redis()` connect `Community 6` to `Community 1`, `Community 3`, `Community 68`, `Community 69`, `Community 9`, `Community 76`, `Community 45`, `Community 14`, `Community 84`, `Community 55`, `Community 56`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `key()` connect `Community 69` to `Community 68`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `env` connect `Community 76` to `Community 3`, `Community 68`, `Community 6`, `Community 9`, `Community 45`, `Community 14`, `Community 81`, `Community 56`, `Community 91`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `Body`, `Body`, `ProcessedResult` to the rest of the system?**
  _662 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10384615384615385 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05939716312056738 - nodes in this community are weakly interconnected._