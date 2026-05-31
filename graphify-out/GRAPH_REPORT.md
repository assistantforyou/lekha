# Graph Report - lekha  (2026-05-31)

## Corpus Check
- 168 files · ~2,827,515 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1519 nodes · 2841 edges · 83 communities (75 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `035f44c6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
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
- [[_COMMUNITY_Community 57|Community 57]]
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
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 88|Community 88]]

## God Nodes (most connected - your core abstractions)
1. `redis()` - 98 edges
2. `Audit: Inventory` - 60 edges
3. `env` - 37 edges
4. `getSettings()` - 30 edges
5. `handleEvent()` - 25 edges
6. `runAgent()` - 25 edges
7. `loadFacts()` - 24 edges
8. `span()` - 23 edges
9. `listTasks()` - 22 edges
10. `reply()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `TweakColor()` --calls--> `key()`  [INFERRED]
  dashboard/project/tweaks-panel.jsx → lib/memory/settings.ts
- `TweakColor()` --calls--> `key()`  [INFERRED]
  dashboard/project/uploads/LEKHA-handoff (2)/project/tweaks-panel.jsx → lib/memory/settings.ts
- `POST()` --calls--> `getSettings()`  [EXTRACTED]
  app/api/cron/sweep/fire/route.ts → lib/memory/settings.ts
- `POST()` --calls--> `getSettings()`  [EXTRACTED]
  app/api/dev/chat/route.ts → lib/memory/settings.ts
- `main()` --calls--> `getSettings()`  [EXTRACTED]
  scripts/measure-prompt.ts → lib/memory/settings.ts

## Communities (83 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (25): briefingFlex(), parseSections(), Section, CalendarEventRow, calendarEventsFlex(), gmailResultsFlex(), GmailRow, listItemsFlex() (+17 more)

### Community 1 - "Community 1"
Cohesion: 0.16
Nodes (14): GET(), escapeHtml(), htmlPage(), AFFIRMATIVE, AffirmDecision, appendPending(), clearPending(), getPending() (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (79): Body, POST(), respondToImage(), respondToText(), stripMarkdown(), maybeExtractFacts(), AgentTimeoutError, genTraceId() (+71 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (37): fetchJSON(), key(), listSent(), logSent(), SentEntry, buildContactsTools(), PersonShape, READ_SCOPES (+29 more)

### Community 4 - "Community 4"
Cohesion: 0.20
Nodes (13): PendingAction, errorMessage(), GoogleAuthRequired, NeedsConfirmation, RateLimited, unwrapAuthRequired(), unwrapCause(), executeOne() (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (59): app/ directory, Audit: Inventory, Duplicate / near-duplicate logic, Files not imported anywhere (dead code), lib/confirm.ts, lib/cron.ts, lib/env.ts, lib/errors.ts (+51 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (43): GET(), GET(), redisCreds(), getProfile(), addToAllowlist(), addToPending(), adminNotifKey(), approvePending() (+35 more)

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
Cohesion: 0.20
Nodes (20): ConnectPage(), Account, AccountsBlob, accountsKey(), addAccount(), completeOAuth(), connectLinkKey(), getGoogleClient() (+12 more)

### Community 15 - "Community 15"
Cohesion: 0.21
Nodes (8): CreateCalendarEventAction, buildCalendarTools(), ApiDisabledResult, AuthRequiredResult, classifyGoogleError(), GoogleErrorResult, withGoogleClient(), withTimeout()

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
Cohesion: 0.09
Nodes (33): fetchCachedNews(), NewsStory, AgendaItem, BriefingInboxItem, BriefingNewsItem, BriefingResult, buildAgenda(), buildMorningBriefing() (+25 more)

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
Cohesion: 0.25
Nodes (17): Body, POST(), Body, POST(), Body, POST(), taskCheckinFlex(), hasQStash() (+9 more)

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
Cohesion: 0.16
Nodes (17): cancelSchedule(), localTimeToUtcCron(), qstash(), scheduleOneShot(), scheduleRecurring(), env, EnvShape, hasGoogleOAuth() (+9 more)

### Community 54 - "Community 54"
Cohesion: 0.13
Nodes (6): CONNECTIONS, DEFAULT_STATE, I, NAV_SECTIONS, TOOLS, TOPICS

### Community 55 - "Community 55"
Cohesion: 0.22
Nodes (24): parsePostbackData(), cancelTaskDeadlineWarning(), scheduleTaskDeadlineWarning(), archiveNote(), Ctx, handleCheckin(), handleConfirm(), handleEvent() (+16 more)

### Community 56 - "Community 56"
Cohesion: 0.33
Nodes (8): decrypt(), encrypt(), hmac(), key(), safeEqual(), blob, buf, s

### Community 57 - "Community 57"
Cohesion: 0.40
Nodes (5): 4. Redundant `listAccounts` / `listRecentMedia` fetch, 5. History summarization blocks on cache miss, 6. `maxRetries: 3` on `generateText` can burn time on transient failures, 7. Background fact extraction consumes quota every 10 turns, P1 — Significant (adds 100ms–3s)

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

### Community 68 - "Community 68"
Cohesion: 0.06
Nodes (50): signupGateFlex(), respondToOtherMedia(), handleAdminCommand(), handleMyId(), classify(), buildGate(), Gate, passesAllowlist() (+42 more)

### Community 69 - "Community 69"
Cohesion: 0.07
Nodes (27): GET(), DashboardPage(), TweakColor(), TweakColor(), getSession(), secret(), sessionCookieOpts(), signSession() (+19 more)

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
Cohesion: 0.20
Nodes (14): confirmCancelFlex(), enrichReply(), authHeaders(), clamp(), fetchWithTimeout(), LineMessage, push(), QuickReplyItem (+6 more)

### Community 78 - "Community 78"
Cohesion: 0.18
Nodes (11): 10. `googleapis` package bloats server bundle, 11. No provider-level timeout on Gemini, 1. `generateText` is the single dominant cost (~70–95% of total time), 2. No `replyOrPush` fallback on expired replyToken, 3. Tool execution happens sequentially inside `generateText`, 8. Sequential `appendTurn` ×2, 9. `toolsForUser` re-evaluates env gates on every request, Identified Bottlenecks (+3 more)

### Community 79 - "Community 79"
Cohesion: 0.20
Nodes (9): code:block4 (┌───────────────────────────────────────────────────────────), code:block5 (┌───────────────────────────────────────────────────────────), Deferred (big bets), Monitoring Checklist, Performance Analysis & Tuning Guide, Pipeline Breakdown, Quick Wins Summary, Where Time Goes (Image Message) (+1 more)

### Community 80 - "Community 80"
Cohesion: 0.22
Nodes (9): code:ts (// lib/handlers/text.ts), code:ts (export const AGENT_TIMEOUT_MS = 20_000;), code:ts (generateText({), Immediate Wins (Low Effort, High Impact), ✅ R1. Pass pre-loaded data into `runAgent` — saves 20–60ms per request, ✅ R2. Use `replyOrPush` instead of `reply` in handlers — prevents silent failures, ✅ R3. Reduce `AGENT_TIMEOUT_MS` from 60s to 20s — fail fast, ✅ R4. Add `maxRetries: 1` instead of `3` — reduce retry burn (+1 more)

### Community 82 - "Community 82"
Cohesion: 0.25
Nodes (8): Big Bets (High Effort, High Impact), code:json ("googleapis": "^144.0.0"), code:json ("@googleapis/gmail": "^12.0.0",), code:ts (const weatherCache = new Map<string, { result: unknown; ts: ), R10. Add a fast-path for common queries, R11. Move to Vercel AI SDK v7 with `streamText` + tool streaming, ✅ R12. Cache common tool results, R9. Replace `googleapis` with scoped `@googleapis/*` packages

### Community 85 - "Community 85"
Cohesion: 0.29
Nodes (7): code:bash (# Local dev), code:json ({"_timing":true,"traceId":"Uxxabc_123","label":"agent:genera), code:block3 ({"_timing":true,"traceId":"Uabc_123","label":"webhook:prelig), Enabling, Example: A Typical Text Request, Reading the Logs, Timing Logs (Zero-Overhead)

### Community 86 - "Community 86"
Cohesion: 0.29
Nodes (7): code:ts (const staged = await listRecentMedia(userId);), code:ts (const toolCache = new Map<string, { tools: ToolSet; ts: numb), Medium Effort, High Impact, ✅ R5. Cache `toolsForUser` result per user, R6. Pre-compute history summary in background, ✅ R7. Bundle media download with preflight, R8. Add "Working on it..." push for long operations

### Community 88 - "Community 88"
Cohesion: 0.40
Nodes (5): 4. Redundant `listAccounts` / `listRecentMedia` fetch, 5. History summarization blocks on cache miss, 6. `maxRetries: 1` on `generateText` — retry burn reduced (R4), 7. Background fact extraction consumes quota every 10 turns, P1 — Significant (adds 100ms–3s)

## Knowledge Gaps
- **662 isolated node(s):** `DEFAULTS`, `StoredSettings`, `MIGRATIONS`, `client`, `Body` (+657 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `redis()` connect `Community 6` to `Community 1`, `Community 2`, `Community 3`, `Community 68`, `Community 69`, `Community 4`, `Community 9`, `Community 45`, `Community 14`, `Community 23`, `Community 53`, `Community 55`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `env` connect `Community 53` to `Community 2`, `Community 3`, `Community 68`, `Community 69`, `Community 6`, `Community 9`, `Community 76`, `Community 45`, `Community 14`, `Community 23`, `Community 56`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `DEFAULTS`, `StoredSettings`, `MIGRATIONS` to the rest of the system?**
  _662 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.052922139729678276 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05333333333333334 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.03278688524590164 - nodes in this community are weakly interconnected._