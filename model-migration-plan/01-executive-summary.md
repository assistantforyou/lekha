# Executive Summary — Lekha Architecture Audit & Model Migration

## Current Architecture Overview

Lekha is a private LINE-integrated AI assistant built on:

- **Runtime:** Next.js 16 App Router on Vercel Functions (Node.js, Fluid Compute)
- **LLM:** Vercel AI SDK v6 + `@ai-sdk/google`, pinned to `gemini-2.5-flash` for all agent/extraction work and `gemini-2.5-flash-lite` only for intent classification
- **Memory / queues:** Upstash Redis (KV_* env), Upstash Vector for archive semantic search, Upstash QStash for reminders, scheduled email, and cron sweep
- **Integrations:** Gmail/Calendar/Drive/People/Docs/Slides via Google OAuth, Tavily for web/news search, LINE Messaging API, Stripe for subscriptions
- **State model:** Stateless per request; all durable state keyed by LINE `userId` in Redis

The system works for its current personal-bot scale, but the architecture assumes low concurrency, single-model inference, and a small user base. Several subsystems will break or become uneconomical under the target scale of thousands of concurrent users.

## Major Findings

1. **Overuse of the most expensive model tier.** `chatModel()` and `extractorModel()` both call `gemini-2.5-flash` ($0.30/M input, $2.50/M output). Background extraction, summarization, history compression, and casual replies are not agentic tool-use tasks and could run on `gemini-2.5-flash-lite` ($0.10/M input, $0.40/M output), cutting background inference cost by ~60–85%.

2. **No streaming and no request abortion.** Every agent turn uses `generateText` (not `streamText`), and `withTimeout` races the promise against a timer without aborting the underlying SDK call. Users wait for full generation; timed-out calls continue consuming quota server-side.

3. **Widespread read-modify-write races.** Facts (`lib/memory/facts.ts`), settings (`lib/memory/settings.ts`), tasks (`lib/memory/tasks.ts`), and Google accounts (`lib/tools/google-auth.ts`) all load a JSON blob, mutate in JS, and write it back. Concurrent requests for the same user will lose updates.

4. **Task list is O(N²).** Every task mutation reads the entire list, deletes the key, and rewrites it. No cap exists on task count.

5. **Dead and hallucinated tool references.** `lib/llm/agent.ts:769` references `upload_to_drive` (real tool is `drive_upload_recent_media`); `agent.ts:297`, `agent-flex.ts`, and prompts reference `search_news`/`get_weather`/`read_list`, none of which exist in the registry.

6. **Thai language is second-class.** System prompt hardcodes `ค่ะ`; renderers, briefings, and draft blocks are English-only; `briefingLanguage` is accepted but never used; date/time formatting uses `en-US`.

7. **Three separate Tavily implementations.** `lib/tools/web-search.ts`, `lib/tools/news.ts`, `lib/llm/briefing.ts`, and `lib/llm/evening-summary.ts` each call Tavily differently with inconsistent caching, error handling, and result shapes.

8. **Critical security gaps.** `/api/dev/chat` bypasses allowlist and rate limits; `FREETRIAL100` is a hardcoded unlimited bypass; cron manual bypass and dev-secret comparisons use non-timing-safe string equality.

9. **Data-loss paths in queues.** Final reminders and scheduled emails are consumed before delivery; push/send failures permanently lose the item.

10. **Master sweep is unbounded.** `Promise.allSettled` over all active users with no concurrency limit; each user may trigger multiple LLM calls.

## Risk Assessment

| Risk | Likelihood | Impact | Current Mitigation |
|---|---|---|---|
| Lost task/fact updates under concurrency | High | High | None — read-modify-write everywhere |
| Runaway inference cost at scale | High | High | 500 req/hr/user rate limit only |
| Missed reminders / scheduled emails | Medium | High | None — consume-before-send |
| Cross-user data leakage | Low | Critical | Key-prefix isolation only; `contentCache` keyed by messageId |
| Abuse via dev endpoint / free trial code | Medium | High | Secret string compare; no rate limit on dev endpoint |
| LINE timeout / poor perceived latency | High | Medium | No streaming; 60s loading indicators |
| Thai user dissatisfaction | High | Medium | Hardcoded particles, English renderers |
| Build/deployment failures from stale docs | Medium | Low | `audit/` docs list already-fixed bugs |

## Recommended Migration Path

**Phase 1 — Safety & cost (weeks 1–2):**
- Move background extraction/summarization/casual replies to `gemini-2.5-flash-lite`.
- Add `AbortSignal` to `withTimeout` and the AI SDK / fetch calls.
- Fix pending-action, task, and settings race conditions with atomic Lua scripts or `WATCH`/`MULTI`/`EXEC`.
- Fix consume-before-send in reminders and scheduled emails.

**Phase 2 — Quality & Thai (weeks 3–4):**
- Localize renderers and briefings; detect and mirror user politeness particle (`ครับ`/`ค่ะ`).
- Consolidate Tavily into a single service; add proper error propagation.
- Fix dead tool references and registry gating.

**Phase 3 — Routing & scale (weeks 5–6):**
- Implement a lightweight model router: Flash Lite first for simple/chat-only turns, Flash for tool-use/reasoning, with confidence-based escalation.
- Add streaming for agent text replies where LINE supports it.
- Bound sweep concurrency; add per-user task hash store.

**Phase 4 — Observability & cleanup (weeks 7–8):**
- Replace ad-hoc `console.*` with structured logger + trace IDs.
- Remove dead code/dependencies (marketing Vite site, duplicate dashboard, unused UI libs).
- Add concurrency tests and load tests.

## Expected Cost Savings

Based on current published Gemini pricing and the observed workload mix:

- **Background model downgrade** (extraction, summarization, casual replies): ~60–85% reduction on those calls. For a user base doing 1,000 extraction/summary calls/day, saves roughly **$150–400/month**.
- **Flash Lite-first routing** for ~50% of chat-only turns: ~40–55% reduction on agent inference spend.
- **Prompt compression / context caching**: up to 90% on repeated system-prompt tokens; realistic 30–50% saving on long threads.
- **Consolidated Tavily + bounded briefing topics**: ~30–50% reduction in search API calls.

Estimated blended **total operating cost reduction: 35–55%** at current volumes, with larger proportional savings as scale increases because fixed per-instance and race-overhead costs are amortized.

## Expected Performance Gains

- **Latency:** streaming + Flash Lite fast path should reduce perceived time-to-first-token from several seconds to sub-second for common replies.
- **Reliability:** eliminating race conditions and consume-before-send paths removes silent data loss; aborting timed-out calls stops quota burn.
- **Thai quality:** localized prompts and renderers plus particle mirroring should improve user trust and reduce fallback English output.
- **Tool-call accuracy:** fixing dead references, reducing registry size for focused intents, and surfacing Tavily errors should raise successful-task-completion rate.

## Bottom Line

Lekha does not need a speculative rewrite. The highest-value changes are engineering fixes inside the existing architecture: use cheaper models for non-agentic work, make Redis mutations atomic, stop losing queue items, and clean up accumulated tool-registry debt. A phased, measured migration preserves all current functionality while cutting cost and raising the ceiling for concurrent users.
