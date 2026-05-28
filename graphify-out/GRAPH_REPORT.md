# Graph Report - lekha  (2026-05-28)

## Corpus Check
- 517 files · ~5,526,287 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 986 nodes · 1965 edges · 61 communities (48 shown, 13 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ffc4c5f6`
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
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]

## God Nodes (most connected - your core abstractions)
1. `redis()` - 87 edges
2. `Audit: Inventory` - 59 edges
3. `env` - 32 edges
4. `runAgent()` - 22 edges
5. `handleEvent()` - 22 edges
6. `loadFacts()` - 22 edges
7. `Key architectural decisions (do NOT undo without thinking)` - 21 edges
8. `reply()` - 20 edges
9. `Lekha` - 20 edges
10. `text()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `redis()`  [EXTRACTED]
  app/api/auth/line/start/route.ts → lib/memory/redis.ts
- `GET()` --calls--> `redis()`  [EXTRACTED]
  app/api/auth/line/callback/route.ts → lib/memory/redis.ts
- `POST()` --calls--> `runAgent()`  [EXTRACTED]
  app/api/dev/chat/route.ts → lib/llm/agent.ts
- `POST()` --calls--> `loadFacts()`  [EXTRACTED]
  app/api/dev/chat/route.ts → lib/memory/facts.ts
- `POST()` --calls--> `getOrCreateProfile()`  [EXTRACTED]
  app/api/dev/chat/route.ts → lib/memory/profile.ts

## Communities (61 total, 13 thin omitted)

### Community 1 - "Community 1"
Cohesion: 0.11
Nodes (33): parsePostbackData(), taskCheckinFlex(), handlePostback(), push(), buildMorningBriefing(), fetchNews(), fetchWeather(), NewsStory (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (70): briefingFlex(), CalendarEventRow, calendarEventsFlex(), confirmCancelFlex(), gmailResultsFlex(), GmailRow, listItemsFlex(), newsFlex() (+62 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (15): buildFinanceTools(), buildGoogleAccountTools(), buildHelpTools(), Builder, Entry, Need, REGISTRY, buildMemoryTools() (+7 more)

### Community 4 - "Community 4"
Cohesion: 0.16
Nodes (25): respondToImage(), ACTION_LABELS, AgentResult, AgentTimeoutError, extractToolValue(), buildFlexFromToolResults(), buildFollowUps(), formatProcessed() (+17 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (59): app/ directory, Audit: Inventory, Duplicate / near-duplicate logic, Files not imported anywhere (dead code), lib/confirm.ts, lib/cron.ts, lib/env.ts, lib/errors.ts (+51 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (31): addToAllowlist(), addToPending(), adminNotifKey(), approvePending(), denyPending(), getPendingInfo(), isAllowed(), isPending() (+23 more)

### Community 7 - "Community 7"
Cohesion: 0.04
Nodes (47): dependencies, ai, @ai-sdk/google, class-variance-authority, clsx, framer-motion, googleapis, lucide-react (+39 more)

### Community 8 - "Community 8"
Cohesion: 0.04
Nodes (47): A. Drive files, A new LLM provider, A new pending-action type, A new tool, Adding new capabilities, Architecture, Attachment system, B. LINE-staged media (multi-file batching) (+39 more)

### Community 9 - "Community 9"
Cohesion: 0.15
Nodes (25): ExtractedFact, Schema, appendFact(), clearFacts(), displayOrder(), Fact, FACT_CATEGORIES, FactCategory (+17 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (37): 10. Rate limit per user, 11. Settings injected into every system prompt, 12. Long-term memory via Upstash Vector (with substring fallback), 13. Proactive layer via QStash schedule, 14. Email body is base64-encoded, 15. Private allowlist + self-serve pending queue, 16. Single LLM provider — Gemini 2.5 Flash Lite (paid), 60s timeout, 17. Orchestrator-level error relay enforcement (+29 more)

### Community 11 - "Community 11"
Cohesion: 0.05
Nodes (20): BASE_PRICING, BUILTFOR, CAPABILITIES, CHAT_SCRIPTS, CMD_EVENTS, CMD_OPS, CMD_TASKS, CURRENCY_LABEL (+12 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (20): App(), BASE_PRICING, BUILTFOR, CAPABILITIES, CHAT_SCRIPTS, CMD_EVENTS, CMD_OPS, CMD_TASKS (+12 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (20): countTokens(), DUMMY, DUMMY_HEX64, envFile, GContent, GFunctionDecl, GPart, GSchema (+12 more)

### Community 14 - "Community 14"
Cohesion: 0.19
Nodes (21): hasGoogleOAuth(), ConnectPage(), Account, AccountsBlob, accountsKey(), addAccount(), completeOAuth(), connectLinkKey() (+13 more)

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (16): GET(), escapeHtml(), htmlPage(), AFFIRMATIVE, AffirmDecision, appendPending(), clearPending(), CreateCalendarEventAction (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.09
Nodes (22): Audit: Test Plan, CI — `.github/workflows/ci.yml`, code:typescript (import { defineConfig } from "vitest/config";), code:json ("scripts": {), code:yaml (name: CI), Coverage targets (not enforced, but aim for), Mocking strategy, P0 — `lib/line/verify.ts` (+14 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (13): GoogleAuthRequired, NeedsConfirmation, RateLimited, buildContactsTools(), PersonShape, READ_SCOPES, WRITE_SCOPES, buildDocsTools() (+5 more)

### Community 18 - "Community 18"
Cohesion: 0.10
Nodes (20): 10. Tell LINE about the webhook, 11. Proactive cron sweep (LIVE — completed), 12. Smoke test from your phone, 1. Generate your encryption keys, 2. LINE channel access token, 3. Google Cloud — OAuth + APIs, 4. Tavily (web search), 5. Gemini API key (under the same Google account that owns the Cloud project!) (+12 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (11): clearRecentMedia(), key(), listRecentMedia(), MediaKind, RecentMedia, buildDriveTools(), DriveFileLite, buildMediaAiTools() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.12
Nodes (15): AudioMessage, FileMessage, FollowEvent, ImageMessage, Message, MessageEvent, OtherEvent, OtherMessage (+7 more)

### Community 22 - "Community 22"
Cohesion: 0.13
Nodes (14): dependencies, react, react-dom, devDependencies, vite, @vitejs/plugin-react, name, private (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.29
Nodes (7): errMsg(), executeOne(), unwrapAuthRequired(), buildCalendarTools(), createCalendarEvent(), buildConnectUrl(), guardGoogleApiCall()

### Community 24 - "Community 24"
Cohesion: 0.17
Nodes (11): Bug registry summary, Documentation accuracy, Executive summary, Fixed in this session, Lekha — Full-Scale Audit: Final Report, Open bugs (not fixed — see `audit/05-bugs-and-gaps.md` for full detail), Recommendations (top 5 by impact), Security posture (+3 more)

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (13): Body, POST(), logSent(), buildEmailTools(), buildRawMime(), chunkBase64(), defaultFilename(), encodeHeader() (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.20
Nodes (9): Audit: Security, Cryptography, Dependency vulnerabilities (npm audit), Information leakage, Injection vectors, OAuth and token security, Request authenticity and authorization, Security controls not in place (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.36
Nodes (7): cn(), Reveal(), RevealProps, Button(), ButtonProps, buttonVariants, buttonVariantsForLink()

### Community 28 - "Community 28"
Cohesion: 0.33
Nodes (8): decrypt(), encrypt(), hmac(), key(), safeEqual(), blob, buf, s

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (9): Decisions (overrides to CLAUDE.md), Env vars added, Gemini call timeout vs agent loop budget, Manual prereqs (James to do), Migration strategy, Open PRs to watch for conflicts, Operation Tune-Up — Architecture Plan, Rollback plan (+1 more)

### Community 30 - "Community 30"
Cohesion: 0.20
Nodes (9): Blocked / questions for James, CLAUDE.md updates pending, code:bash (# Confirm in LINE: send "yo" first to verify the bot still w), Done, Files touched (summary), Handoff / smoke test plan, In progress, Operation Tune-Up — TODO (+1 more)

### Community 31 - "Community 31"
Cohesion: 0.22
Nodes (8): `app/api/cron/sweep/route.ts`, `app/api/health/route.ts`, `app/api/line/webhook/route.ts`, `app/api/oauth/google/callback/route.ts`, `app/api/reminders/fire/route.ts`, `app/api/scheduled-email/fire/route.ts`, Audit: Route Handlers, Summary of structural issues

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (7): Audit: Bugs and Gaps, Bug count by priority, Documentation gaps (not code bugs), P0 — Fix before any production traffic, P1 — Fix this week, P2 — Fix this sprint, P3 — Fix when convenient

### Community 50 - "Community 50"
Cohesion: 0.18
Nodes (16): Body, POST(), maybeExtractFacts(), extractAndMergeFacts(), estimateTokens(), hashTurns(), historyForPrompt(), key() (+8 more)

### Community 51 - "Community 51"
Cohesion: 0.21
Nodes (11): GET(), env, EnvShape, redisCreds(), GET(), buildScheduledEmailTools(), consumeScheduledEmail(), qstash() (+3 more)

### Community 52 - "Community 52"
Cohesion: 0.27
Nodes (10): Body, POST(), hasQStash(), envHas(), buildReminderTools(), consumeReminder(), qstash(), reminderKey() (+2 more)

### Community 53 - "Community 53"
Cohesion: 0.26
Nodes (9): applyMigrations(), DEFAULTS, getSettings(), key(), MIGRATIONS, StoredSettings, updateSettings(), UserSettings (+1 more)

### Community 54 - "Community 54"
Cohesion: 0.40
Nodes (9): hasUpstashVector(), embeddingModel(), appendArchive(), ArchivedSummary, embedText(), key(), listArchive(), searchArchive() (+1 more)

### Community 55 - "Community 55"
Cohesion: 0.39
Nodes (6): cancelSchedule(), localTimeToUtcCron(), qstash(), scheduleOneShot(), scheduleRecurring(), result

### Community 56 - "Community 56"
Cohesion: 0.36
Nodes (5): key(), listSent(), SentEntry, buildExportTools(), buildSentHistoryTools()

### Community 57 - "Community 57"
Cohesion: 0.47
Nodes (4): buildListTools(), getListItems(), listKey(), normalizeName()

### Community 58 - "Community 58"
Cohesion: 0.40
Nodes (3): buildWeatherTools(), tryOpenMeteo(), wmoDesc()

### Community 59 - "Community 59"
Cohesion: 0.67
Nodes (3): fmtDate(), fmtRange(), ToolCall

### Community 60 - "Community 60"
Cohesion: 0.50
Nodes (3): NEITHER_CASES, NO_CASES, YES_CASES

## Knowledge Gaps
- **444 isolated node(s):** `Body`, `StepLike`, `ACTION_TOOLS`, `DISPLAY_TOOLS`, `ACTION_LABELS` (+439 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `redis()` connect `Community 6` to `Community 1`, `Community 2`, `Community 9`, `Community 14`, `Community 15`, `Community 50`, `Community 51`, `Community 52`, `Community 20`, `Community 54`, `Community 23`, `Community 53`, `Community 57`, `Community 56`, `Community 25`?**
  _High betweenness centrality (0.066) - this node is a cross-community bridge._
- **Why does `env` connect `Community 51` to `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 14`, `Community 50`, `Community 52`, `Community 54`, `Community 55`, `Community 25`, `Community 28`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `loadFacts()` connect `Community 9` to `Community 2`, `Community 4`, `Community 6`, `Community 13`, `Community 50`, `Community 56`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `Body`, `StepLike`, `ACTION_TOOLS` to the rest of the system?**
  _444 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11074197120708748 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0507048180096781 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11428571428571428 - nodes in this community are weakly interconnected._