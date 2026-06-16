# Codebase Audit — Lekha Architecture & Subsystem Review

This document reviews every major subsystem, identifies issues, and assigns severity, root cause, recommended fix, and estimated effort. File and line references are from the repository as of the audit date.

---

## 1. API Layer

### 1.1 LINE webhook (`app/api/line/webhook/route.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Critical | Hardcoded `FREETRIAL100` bypasses allowlist with no per-user limit. | `route.ts:100-125` | Move to env/R Redis flag; one-use per user; rate-limit attempts. | 4h |
| High | `passesAllowlist` runs before `checkRateLimit`, so non-allowed users can trigger unlimited gate replies. | `route.ts:127` | Move lightweight rate limit before gate; separate bucket for unknown users. | 2h |
| High | Pending queue read→execute→delete is not atomic across requests. | `route.ts:206-229` | Use Lua script to pop all pending actions atomically, or add per-user processing lock. | 6h |
| Medium | `after()` block crash outside per-event `try/catch` becomes unhandled rejection. | `route.ts:45-80` | Wrap each event in `try/catch`; log and continue. | 2h |
| Medium | Image+text bundling only checks `events[i+1]`, missing staggered media. | `route.ts:53-63` | Stage all recent media within a short window, then process once. | 4h |
| Medium | Any non-yes/no text clears pending queue. | `route.ts:228` | Only clear on explicit cancellation; preserve drafts unless user says "cancel". | 2h |

### 1.2 Dev chat endpoint (`app/api/dev/chat/route.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Critical | Bypasses allowlist, rate limits, and has no request-size cap on base64 payloads. | `route.ts:91-317` | Add per-IP + per-user rate limits; enforce max body size; optionally require `isAllowed(userId)`. | 4h |
| High | Secret compared with `!==`, not `crypto.timingSafeEqual`. | `route.ts:98` | Use timing-safe compare. | 30m |
| High | Duplicates pending-execution race from webhook. | `route.ts:241-265` | Reuse atomic pending consumer once fixed in shared helper. | 2h |

### 1.3 OAuth callback (`app/api/oauth/google/callback/route.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Medium | Auto-resume catches failures and calls `clearPending`, silently dropping failed actions. | `route.ts:42-57` | Log failures; do not clear pending for actions that failed due to transient errors. | 3h |
| Low | Returns JSON instead of HTML on `!isAllowed`. | `route.ts:35-37` | Consistent HTML response. | 1h |

### 1.4 Cron sweep (`app/api/cron/sweep/fire/route.ts`, `lib/sweep.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Critical | Unbounded `Promise.allSettled` over all users. | `route.ts:62-78` | Batch with concurrency limit (e.g., p-map 10–20). | 3h |
| High | Typed one-shot morning/evening cases skip time-window checks. | `route.ts:84-140` | Reuse `shouldFireBriefingNow` / `shouldFireEveningSummaryNow`. | 2h |
| Medium | `task_check_in` typed case updates `lastTaskCheckInTs` even if push failed. | `route.ts:142-158` | Update timestamp only after successful push. | 1h |
| Medium | `markUserActive` is a racy read-then-write. | `lib/sweep.ts:18-25` | Use `SET active:{userId} {ts} EX 600 NX`. | 1h |
| Medium | Push-lock key uses UTC date, not user timezone date. | `lib/sweep.ts:56-60` | Compute date in user's timezone. | 1h |

### 1.5 Reminder fire (`app/api/reminders/fire/route.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Final reminder consumed before push; push failure loses it forever. | `route.ts:79-91` | Push first, then consume on success; add idempotency lock. | 3h |
| Medium | Warning pushes not wrapped in `try/catch`; throw can cause QStash retry against existing lock. | `route.ts:68-77` | Wrap push in `try/catch`; return 200 on push failure with logged alert. | 2h |

### 1.6 Scheduled email fire (`app/api/scheduled-email/fire/route.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Schedule consumed before send; send failure returns 200 and schedule is gone. | `route.ts:32-54` | Do not consume until send succeeds; return non-2xx for transient failures so QStash retries safely. | 4h |

### 1.7 Stripe webhook (`app/api/webhooks/stripe/route.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Low | `sig!` non-null assertion instead of explicit check. | `route.ts:27` | Validate header presence before calling `constructEvent`. | 30m |

### 1.8 QStash / manual bypass (`lib/qstash-verify.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | String comparison of bearer secret, not timing-safe. | `lib/qstash-verify.ts:41-44` | Use `crypto.timingSafeEqual`. | 30m |

---

## 2. Agent Orchestration (`lib/llm/agent.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Critical | `processResult` overwrites auth/disabled/google error with the last in iteration order; earlier errors are silently dropped. | `agent.ts:108-148` | Collect all errors; prioritize auth > disabled > google error; log suppressed ones. | 4h |
| High | `generateText` used instead of `streamText`; no streaming. | `agent.ts:680-693` | Adopt `streamText` for the final text reply; accumulate tool calls; keep fallback paths. | 8h |
| High | `withTimeout` does not abort the underlying AI SDK call. | `agent.ts:680`, `lib/timing.ts:10-17` | Pass `AbortSignal` into SDK/fetch and cancel on timeout. | 3h |
| High | `confirmDraft && successfulCalls.length === 0` can never be true by construction, masking a real invariant. | `agent.ts:727-730` | Remove or rewrite; ensure drafts are only counted when pending actions exist. | 1h |
| Medium | Error-presence check splits on `": "`, fragile if model paraphrases. | `agent.ts:154` | Use structured tool-result validation, not string inclusion. | 2h |
| Medium | Fallback heuristics (`looksLikeWeather`, `looksLikeMediaQuery`) are English-centric and have false positives. | `agent.ts:838-844` | Move to intent classifier; remove regex defaults that assume Bangkok. | 3h |
| Medium | `timePrefix` declared but never populated. | `agent.ts:664` | Remove dead code. | 15m |
| Medium | `pickAccount` hint references non-existent `upload_to_drive`. | `agent.ts:769` | Fix to `drive_upload_recent_media`. | 15m |
| Medium | Cost calculation hardcodes Flash rates; will be wrong if router switches models. | `agent.ts:696-699` | Pass model/rate into logger or compute centrally. | 1h |

---

## 3. Prompting System (`lib/llm/prompts.ts`, `lib/llm/render-drafts.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Thai politeness instruction hardcodes `ค่ะ` regardless of user particle. | `prompts.ts:1` | Detect particle from recent user messages (`ครับ`/`ค่ะ`) and inject matching instruction. | 2h |
| High | `buildTimeContext` regex assumes `en-US` returns `GMT+07:00`; wrong in some ICU builds and date can be off by one. | `prompts.ts:43-49` | Use `date-fns-tz` or explicit offset calculation; validate output. | 2h |
| Medium | `sanitizePromptValue` strips backticks but not newlines/control chars. | `prompts.ts:52-54` | Strip control chars and normalize whitespace; keep backticks where needed. | 1h |
| High | `render-drafts.ts` always formats dates with `en-US`. | `render-drafts.ts:117-126` | Use `Intl.DateTimeFormat` with user's locale. | 2h |
| High | System prompt references non-existent `read_list` tool. | `prompts.ts:14` | Change to `list_items`. | 15m |
| Medium | Duplicate `FACT_EXTRACTION_PROMPT` in `extract-facts.ts` vs `prompts.ts`. | `extract-facts.ts:25-44`, `prompts.ts:29-41` | Delete duplicate; import from prompts. | 30m |

---

## 4. Memory System

### 4.1 History (`lib/memory/history.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Synchronous LLM summarization blocks the request path. | `history.ts:93-136` | Move summarization to background or pre-compute in `appendTurn`. | 6h |
| Medium | Token cap `3000` is extremely low for a 1M-context model. | `history.ts:9` | Raise to 12k–24k heuristic tokens or use actual usage. | 1h |
| Medium | Summary injected as `role: "user"`. | `history.ts:131-134` | Use `role: "system"` or a dedicated context message. | 1h |
| Low | Summary cache and running summary not updated atomically. | `history.ts:111-125` | Wrap in `MULTI/EXEC`. | 1h |

### 4.2 Facts (`lib/memory/facts.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Critical | `appendFact` / `updateFact` / `removeFact` are read-modify-write; concurrent calls lose updates. | `facts.ts:66-160` | Use Lua script or Redis JSON / hash per fact; add per-user lock. | 6h |
| Medium | `factsCache` returns stale state across instances and during concurrent requests. | `facts.ts:56` | Remove or drastically shorten TTL; invalidate on write. | 2h |
| Low | Near-duplicate facts stored separately. | `facts.ts:73-84` | Add semantic deduplication at extraction time. | 4h |

### 4.3 Archive / vector search (`lib/memory/archive.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Vector filter uses unsafe string interpolation for `userId`. | `archive.ts:96` | Validate `userId` against strict regex or use parameterized filter. | 2h |
| Medium | Vector path collapses `fromTs`/`toTs`/`createdAt` all to `ts`. | `archive.ts:106-108` | Preserve full metadata fields. | 1h |
| Medium | Silent fallback to substring; operators may not notice vector index misconfiguration. | `archive.ts:125-127` | Add metrics/logging distinguishing vector vs fallback hits. | 2h |

### 4.4 Settings (`lib/memory/settings.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | `updateSettings` is read-modify-write; concurrent dashboard + tool updates race. | `settings.ts:241-272` | Use Lua script that merges patch atomically; guard migration write with `SET NX` lock. | 6h |
| Medium | `settingsCache` TTL 5s is too short to help and causes stale reads across instances. | `settings.ts:212-213` | Remove or switch to Redis-backed cache with explicit invalidation. | 2h |
| Low | `userConfigured` array grows monotonically. | `settings.ts:256-265` | Prune or convert to set. | 2h |

### 4.5 Tasks (`lib/memory/tasks.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Critical | Every mutation reads the full task list, deletes the key, and rewrites it. Concurrent updates lose data. | `tasks.ts:44-160` | Migrate to Redis hash per task (`user:{id}:task:{taskId}`) plus sorted-set index. | 12h |
| High | No cap on task count; list grows unbounded. | `tasks.ts:1-30` | Add cap (e.g., 500 open, 1000 total) with LRU eviction. | 2h |
| Medium | `reopenTask`/`updateTask` perform two separate write transactions. | `tasks.ts:61-99` | Atomic single operation; schedule warning inside same transaction. | 3h |
| Low | `completeAllOpenTasks` uses `void cancelTaskDeadlineWarning`, fire-and-forget. | `tasks.ts:108` | Await cancellations or handle failures. | 1h |

### 4.6 Receipts (`lib/memory/receipts.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Medium | `RPUSH` and `LTRIM` are separate commands; crash between them can overfill list. | `receipts.ts:22-26` | Use `MULTI/EXEC`. | 1h |

### 4.7 Recent media (`lib/memory/recent-media.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Low | File handler and text handler race; `media-ai.ts` and `receipts.ts` poll with `setTimeout` retries. | `recent-media.ts:24-31`, `media-ai.ts:64-72` | Use explicit "media ready" signal or sequential processing. | 4h |

---

## 5. RAG Implementation

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Embedding model `text-embedding-004` is not optimized for Thai/SEA retrieval. | `lib/llm/provider.ts:32-34` | Evaluate `multilingual-e5-large-instruct`, Cohere embed-multilingual-v3, or SEA-Embedding for Thai-heavy workloads. | 8h |
| Medium | Archive substring fallback is O(N) over 200 summaries. | `lib/memory/archive.ts:125-127` | Keep vector as primary; monitor fallback ratio. | 2h |
| Low | Index dimension/metric mismatch not detected at startup. | `lib/env.ts:31-34` | Add startup validation check. | 2h |

---

## 6. Tool Calling (`lib/tools/`, `lib/llm/agent-flex.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Critical | Dead references: `search_news`, `get_weather`, `upload_to_drive`, `read_list`. | `agent.ts:297,769`, `agent-flex.ts:156,208-209,251`, `prompts.ts:14` | Delete/fix references; add registry consistency test. | 3h |
| Critical | `envHas("google_user_connected")` always returns `true`, contradicting registry comment and bloating tool registry for users without Google. | `lib/tools/index.ts:101-104` | Honor gating; include a single `connect_google_account` tool instead of full Google surface. | 3h |
| High | Tavily HTTP errors silently return empty results. | `lib/search-cache.ts:47,105`, `lib/news-cache.ts:61` | Log errors and return `{ ok: false, error }`; update orchestrator to relay. | 3h |
| High | `fetchCachedWebSearch` cache key ignores `count`. | `lib/search-cache.ts:28` | Include `count` in key. | 30m |
| High | `contacts_search` swallows all API errors with `.catch(() => ...)`. | `lib/tools/contacts.ts:35-46` | Remove catch-all; let `withGoogleClient` surface structured errors. | 2h |
| Medium | `scheduled-email.ts` `qstash()` has no guard; crashes if `QSTASH_TOKEN` missing. | `lib/tools/scheduled-email.ts:23` | Gate tool on `hasQStash()` in registry. | 1h |
| Medium | `drive_upload_recent_media` leaves files staged on partial upload. | `lib/tools/drive.ts:187-188` | Clear staged media after successful upload only. | 2h |
| Medium | `sendEmail` fetches Drive attachments sequentially. | `lib/tools/email.ts:128-130` | Use `Promise.all`. | 1h |
| Medium | `draft_gmail_reply` not rendered in `render-drafts.ts`. | `lib/tools/gmail-inbox.ts:178-247`, `render-drafts.ts` | Add reply rendering case. | 2h |
| Medium | `fx_rate` `asOf` null for fallback providers; `stock_history` has no `asOf`. | `lib/tools/finance.ts:198-262,116-130` | Set `asOf` from each provider's date field. | 2h |
| Low | `crypto_price` `xrp` alias points to legacy `ripple` ID. | `lib/tools/finance.ts:146-152` | Update to `xrp`; add missing major coins. | 1h |
| Low | `receipts.ts:15` uses `Math.random()` for IDs. | `receipts.ts:15` | Use `crypto.randomUUID()`. | 30m |

---

## 7. Search Stack

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Three separate Tavily code paths (`web_search`, `news_search`, briefing/evening) with inconsistent caching and shapes. | `lib/tools/web-search.ts`, `lib/tools/news.ts`, `lib/llm/briefing.ts`, `lib/llm/evening-summary.ts` | Consolidate into single `lib/search/tavily.ts` service with unified `NewsStory`/`WebResult` types. | 8h |
| High | Briefing weather has no Open-Meteo fallback and a separate hardcoded implementation. | `lib/llm/briefing.ts:16-47` | Call shared `weather` tool or `lib/weather.ts` with caching + fallback. | 3h |
| Medium | `fetchCachedNews` hardcodes `max_results: 4` regardless of briefing length. | `lib/news-cache.ts:40-47` | Pass desired count into fetch. | 1h |
| Medium | Morning briefing fetches up to 5 separate Tavily topics; evening summary fetches 3 fixed topics including low-signal Polymarket. | `lib/llm/briefing.ts:288-309`, `lib/llm/evening-summary.ts:162-196` | Cap topics by `briefingLength`; make evening topics configurable. | 3h |
| Medium | Gmail inbox fetched every briefing with up to 50 `messages.get` calls and no caching. | `lib/llm/briefing.ts:330-367` | Cache unread summary for 5–10 min; make categories configurable. | 4h |
| Medium | Calendar fetched every briefing with no caching. | `lib/llm/briefing.ts:315-329` | Cache events for 5 min. | 2h |
| Medium | `endOfToday` and `todayDateStr` parsed in server local time, not user timezone. | `lib/llm/briefing.ts:285-286` | Compute end-of-day in user's timezone. | 2h |
| Medium | `briefingLanguage` parameter accepted but never used. | `lib/tools/morning-briefing.ts:13-22`, `lib/llm/briefing.ts:277` | Generate briefing in requested language or remove parameter. | 3h |
| Low | News source extraction breaks on multi-part TLDs. | `lib/llm/briefing.ts:451-454` | Parse registered domain properly. | 1h |
| Low | Evening summary timezone bug: `startOfToday` uses server local time. | `lib/llm/evening-summary.ts:202-204` | Use user's timezone. | 1h |

---

## 8. Authentication (`lib/tools/google-auth.ts`, `lib/dashboard-auth.ts`, `lib/gate.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Critical | Self-serve pending queue is documented but not wired; `passesAllowlist` never calls `addToPending`. | `lib/gate.ts:28-50`, `lib/memory/allowlist.ts:30-67` | Either implement pending queue + admin notification, or update docs and remove dead code. | 4h |
| High | Connect-link token replay window allows account takeover if link is intercepted. | `lib/tools/google-auth.ts:96-115` | Make token single-use; handle LINE double-request with idempotent redirect cookie. | 4h |
| Medium | Google token refresh callback writes asynchronously without error handling. | `lib/tools/google-auth.ts:298-307` | Add `.catch` logging and atomic write. | 2h |
| Medium | `accountsCache` is per-instance and not invalidated across workers. | `lib/tools/google-auth.ts:47-48` | Remove or use Redis cache. | 2h |
| Low | `jose` imported directly but only a transitive dependency. | `lib/dashboard-auth.ts` | Add to `package.json`. | 30m |

---

## 9. Session Handling

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Medium | `contentCache` keyed only by `messageId`; assumes global uniqueness. | `lib/line/client.ts:9` | Key by `${userId}:${messageId}`. | 30m |
| Medium | In-process caches (`settingsCache`, `factsCache`, `accountsCache`) return stale data across Vercel instances. | `settings.ts:212`, `facts.ts:56`, `google-auth.ts:47` | Remove or switch to Redis-backed short-TTL cache. | 4h |
| Low | Profile first-contact is racy. | `lib/memory/profile.ts:11-20` | Use `SET NX`; only fetch profile if key absent. | 1h |

---

## 10. Database / Redis Layer (`lib/memory/redis.ts`)

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Medium | Single singleton client with no timeout/pool tuning. | `lib/memory/redis.ts:1-12` | Add connection timeout; consider pipelining for batch operations. | 2h |
| Medium | Many keys have no TTL; abandoned accounts accumulate forever. | `history.ts`, `facts.ts`, `archive.ts`, `tasks.ts`, `profile.ts`, etc. | Add TTLs (e.g., 90d history, 1y archive, 1y tasks). | 4h |
| Low | Shared `search:shared:*` / `news:shared:*` cache uses 40-char base64url hash with non-trivial collision risk. | `lib/search-cache.ts:6-9`, `lib/news-cache.ts:36` | Use full SHA-256 hex or include more entropy. | 1h |

---

## 11. Queue Systems

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Pending actions expire in 5 minutes; user returning later gets "Nothing to confirm." | `lib/confirm.ts:3` | Extend TTL to 30 min or make configurable; notify user of expiry. | 1h |
| Medium | `classify()` only matches exact strings; "yes please" cancels pending. | `lib/confirm.ts:86-91` | Expand Thai/English affirmative/negative lists. | 2h |
| High | `executePendingAll` does not isolate each action in its own `try/catch`; one throw aborts the queue. | `lib/pending-runner.ts:16-19` | Wrap each `executeOne` and continue. | 2h |
| Medium | `attachmentCount` undercounts when both `attachments` and `attachRecentMediaIndexes` used. | `lib/pending-runner.ts:43` | Sum both arrays. | 30m |

---

## 12. Background Jobs

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Fact extraction runs every 10 turns with no concurrency lock; concurrent requests duplicate work. | `app/api/dev/chat/route.ts`, `lib/maybe-extract.ts` | Use Redis `SET NX` lock per user. | 2h |
| High | Morning/evening briefings use full Flash for generation and make many external calls synchronously. | `lib/llm/briefing.ts`, `lib/llm/evening-summary.ts` | Use Flash Lite for summarization; cache external data; bound topics. | 8h |
| Medium | History summarization is synchronous in request path. | `lib/memory/history.ts:93-136` | Move to background. | 6h |

---

## 13. Logging

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| Medium | Ad-hoc `console.warn`/`console.error` with `[module]` prefix; no trace IDs in many paths. | Throughout | Introduce structured logger (e.g., Pino) with `userId`, `traceId`, `model`, `costUsd` on every line. | 6h |
| Medium | Tavily and other external errors not consistently logged. | `lib/search-cache.ts`, `lib/news-cache.ts` | Log status/body on non-2xx. | 2h |

---

## 14. Observability

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | No metrics on tool-call success rate, structured-output success, model fallback rate, or cost per conversation. | N/A | Emit metrics (e.g., Vercel Analytics, custom endpoint) for: cost/conversation, tool success, latency buckets, fallback rate. | 8h |
| Medium | Vector vs substring fallback not measured. | `lib/memory/archive.ts` | Add counters. | 1h |
| Low | Health endpoint exists alongside more comprehensive `/api/report/status`; possibly duplicated effort. | `app/api/health/route.ts`, `app/api/report/status/route.ts` | Consolidate. | 2h |

---

## 15. Error Handling

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | Tool errors are sometimes swallowed (contacts, Tavily) instead of returned to orchestrator. | `lib/tools/contacts.ts`, `lib/search-cache.ts` | Return `{ ok: false, error }` and let `processResult` relay. | 4h |
| Medium | `handleAgentError` uses regex on error message to classify transient failures. | `agent.ts:911-945` | Use AI SDK error codes/status fields where available. | 3h |
| Medium | `extractToolValue` only unwraps `{ type: "json", value }`; many tool shapes pass through untransformed. | `agent.ts:24-31` | Standardize all tool returns to `{ ok, ... }` shape. | 4h |

---

## 16. Streaming Implementation

| Severity | Description | Root Cause | Recommended Fix | Effort |
|---|---|---|---|---|
| High | No streaming anywhere; full `generateText` response awaited. | `lib/llm/agent.ts` | Implement `streamText` for agent replies; stream to LINE if supported, else accumulate. | 12h |
| Medium | `showLoading(60)` fires with no cancel on agent timeout. | `lib/handlers/text.ts:23` | Cancel loading indicator when agent times out or errors. | 2h |

---

## Summary by Effort

| Estimated Effort | Count | Representative Items |
|---|---|---|
| ≤ 1h | 18 | Dead references, string compares, cache keys, missing `asOf`, formatting |
| 1–4h | 28 | Race fixes, error handling, caching, briefings, registry gating |
| 4–12h | 12 | Streaming, task store refactor, Tavily consolidation, atomic updates, observability |

The highest concentration of risk is in the memory layer (race conditions + O(N²) task list) and the agent layer (single-model overuse + no streaming). Fixing these two areas first yields the largest safety and cost improvements.
