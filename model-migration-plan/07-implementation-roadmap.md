# Implementation Roadmap — Migration Execution Plan

This roadmap breaks the migration into four phases. Each phase lists files affected, risks, rollback strategy, validation tests, and success criteria.

---

## Phase 1 — Safety & Atomicity Foundation

**Goal:** Eliminate data-loss race conditions and secure the most critical endpoints before changing models or UX.

### Files affected

- `lib/memory/tasks.ts` (task store refactor)
- `lib/memory/facts.ts` (atomic updates)
- `lib/memory/settings.ts` (atomic patch + migration lock)
- `lib/tools/google-auth.ts` (account update locking + token refresh lock)
- `lib/confirm.ts` (atomic pending pop)
- `lib/pending-runner.ts` (per-action isolation)
- `app/api/line/webhook/route.ts` (atomic pending consumption)
- `app/api/dev/chat/route.ts` (reuse atomic helper)
- `app/api/reminders/fire/route.ts` (consume-after-push)
- `app/api/scheduled-email/fire/route.ts` (consume-after-send)
- `lib/line/verify.ts`, `lib/qstash-verify.ts` (timing-safe compares)
- `app/api/line/webhook/route.ts` (remove hardcoded `FREETRIAL100`)
- `app/api/dev/chat/route.ts` (rate limits, body size, allowlist option)

### Implementation steps

1. **Task store refactor:** migrate from list to hash + sorted set.
   - `user:{userId}:task:{taskId}` hash for task data.
   - `user:{userId}:tasks:open` sorted set by `createdAt`.
   - `user:{userId}:tasks:done` sorted set by `doneAt`.
   - Update `addTask`, `listTasks`, `completeTask`, `reopenTask`, `updateTask`, `completeAllOpenTasks`, `deleteTask`.

2. **Atomic pending pop:** add Lua script `LRANGE` + `DEL` in one call.

3. **Atomic settings patch:** Lua script merges partial update and updates `userConfigured`.

4. **Atomic fact updates:** Lua script for append/update/remove with LRU cap.

5. **Google account lock:** `SET NX` lock around `addAccount`/`setActiveAccount`/`removeAccount` and token refresh.

6. **Queue safety:** push/send before consume; add idempotency locks.

7. **Security:** timing-safe compares, env-controlled free trial, dev endpoint hardening.

### Risks

| Risk | Mitigation |
|---|---|
| Task migration corrupts existing data | Write migration script that reads old list and writes hash+sets; run once on deploy |
| Lua scripts fail on Upstash | Test Lua scripts in staging; Upstash supports EVAL |
| Pending pop loses actions appended during execution | Lua returns current list before DEL; actions appended after DEL are not lost, they remain for next turn |
| Dev endpoint hardening breaks internal testing | Keep feature flag; document secret rotation |

### Rollback strategy

- Keep old task list keys during migration; read from hash first, fall back to list.
- Feature flags for new pending consumer and queue safety.
- Revert to old string compares if timing-safe compare causes issues (unlikely).

### Validation tests

- Parallel `completeTask` + `updateTask` for same user → no lost update.
- Parallel `appendFact` calls → both facts survive.
- Concurrent settings patches → both changes merge.
- Two webhook requests with pending queue → actions execute exactly once.
- Reminder push failure simulation → reminder not consumed, retry succeeds.
- Timing-safe compare tests.

### Success criteria

- `npm test` passes with new concurrency tests.
- No data-loss paths in reminder/scheduled-email/pending flows.
- Hardcoded bypass removed; dev endpoint rate-limited.

---

## Phase 2 — Model Routing & Cost Optimization

**Goal:** Reduce inference cost without reducing quality.

### Files affected

- `lib/llm/provider.ts` (tiered model factory)
- `lib/llm/router.ts` (new)
- `lib/llm/agent.ts` (use router, enable intent filtering)
- `lib/llm/extract-facts.ts` (Lite for extraction)
- `lib/memory/history.ts` (Lite for summarization)
- `lib/llm/casual-reply.ts` (Lite)
- `lib/llm/briefing.ts`, `lib/llm/evening-summary.ts` (Lite drafting, cache external data)
- `lib/tools/media-ai.ts` (Lite for OCR, Flash for docs/receipts)
- `lib/tools/index.ts` (enable intent filtering)
- `lib/intent.ts` (ensure classifier always runs)
- `lib/timing.ts` (AbortSignal support)
- `lib/llm/agent.ts` (pass signal to generateText)

### Implementation steps

1. Add `modelForTier(tier)` to `provider.ts`.
2. Create `lib/llm/router.ts` with `pickAgentTier`, `pickExtractionTier`, etc.
3. Update `extractorModel()` to default to Lite; allow override.
4. Update `runAgent` to call classifier, pass intent, and select tier.
5. Enable intent-based tool filtering in `toolsForUser`.
6. Add `AbortSignal` to `withTimeout` and pass to AI SDK / fetch.
7. Move history summarization to background or Flash Lite.
8. Add briefings cache for weather, calendar, inbox, news.
9. Cap Tavily topic count by `briefingLength`; make evening topics configurable.

### Risks

| Risk | Mitigation |
|---|---|
| Flash Lite produces lower-quality replies | A/B test; measure user-reported fallback English and task success; revert to Flash if quality drops |
| Intent filtering removes a needed tool | Keep `fallback`/`multi` intents with full registry; monitor tool-call failure rate |
| AbortSignal not supported by all SDK paths | Fallback to existing timeout race where unsupported |
| Caching stale briefing data | Short TTLs (5–10 min); user can request fresh |

### Rollback strategy

- Feature flag `USE_ROUTER`; disable to fall back to Flash for everything.
- Feature flag `INTENT_FILTERING`; disable if tool success drops.
- Keep old `extractorModel = flash` behind flag.

### Validation tests

- Lite vs Flash on sample Thai/English messages; judge quality.
- Tool-call success rate with intent filtering vs full registry.
- Cost per conversation measured in logs.
- Timeout with AbortSignal stops underlying request.
- Briefing cache hit/miss ratio.

### Success criteria

- 35–55% reduction in blended inference cost.
- Tool-call success rate does not decrease.
- User-reported quality metrics stable or improved.
- No timeout quota burn.

---

## Phase 3 — Thai Localization, Tool Cleanup & Streaming

**Goal:** Improve Thai user experience, remove dead code, and reduce latency via streaming.

### Files affected

- `lib/llm/prompts.ts` (particle detection, locale-aware time context)
- `lib/llm/render-drafts.ts` (localized date/time)
- `lib/llm/agent-flex.ts` (remove dead refs, duplicate tool handling)
- `lib/llm/agent.ts` (remove dead refs, refactor, streaming)
- `lib/llm/briefing.ts`, `lib/llm/evening-summary.ts` (use `briefingLanguage`, user timezone)
- `lib/tools/index.ts` (fix `google_user_connected` gating)
- `lib/tools/news.ts`, `lib/tools/web-search.ts`, `lib/search-cache.ts`, `lib/news-cache.ts` (consolidate)
- `lib/tools/weather.ts`, `lib/llm/briefing.ts` (unify weather)
- `lib/tools/contacts.ts` (remove error swallowing)
- `lib/tools/finance.ts` (fix `asOf`)
- `lib/tools/email.ts` (parallel Drive attachments)
- `lib/tools/gmail-inbox.ts` (render draft replies)
- `lib/handlers/text.ts` (cancel loading on timeout)

### Implementation steps

1. Detect `ครับ`/`ค่ะ` from recent user messages; inject matching instruction.
2. Localize all renderers and briefings based on `settings.language` / `personaPrimaryLang`.
3. Fix `buildTimeContext` to use user's timezone correctly.
4. Remove dead tool references (`search_news`, `get_weather`, `upload_to_drive`, `read_list`).
5. Consolidate Tavily into `lib/search/tavily.ts`.
6. Unify weather under shared helper.
7. Fix `google_user_connected` gating; register `connect_google_account` instead of full Google surface for unconnected users.
8. Fix contacts error handling, finance `asOf`, email parallelization.
9. Implement `streamText` for agent replies; accumulate tool calls; stream to LINE where supported.
10. Cancel `showLoading` on timeout/error.

### Risks

| Risk | Mitigation |
|---|---|
| Streaming complicates tool-call rendering | Accumulate text and tool events; render final display fallback after stream ends |
| Localization increases prompt tokens | Keep locale strings compact; cache localized templates |
| Tool registry gating hides tools from model | Provide explicit `connect_google_account` tool and clear prompts |

### Rollback strategy

- Feature flag `STREAMING`; disable to use `generateText`.
- Revert individual localization commits if Thai users report issues.

### Validation tests

- Thai male user gets `ครับ`; female user gets `ค่ะ`.
- Briefing generated in Thai when `briefingLanguage` is `ไทย`.
- Dead tool references absent from prompts and code.
- Tavily errors return structured `{ ok: false, error }`.
- Streaming reduces time-to-first-byte in latency tests.

### Success criteria

- No dead tool references.
- Thai localization tested with native speakers or LLM judge.
- Streaming works for simple chat turns.
- Tool-call success rate stable.

---

## Phase 4 — Observability, Cleanup & Scale Hardening

**Goal:** Make the system observable, remove debt, and prepare for thousands of users.

### Files affected

- New `lib/logger.ts` (structured logger)
- All route files (replace `console.*`)
- `lib/llm/agent.ts`, `lib/llm/router.ts` (cost/usage metrics)
- `app/api/cron/sweep/fire/route.ts`, `lib/sweep.ts` (bounded concurrency)
- `lib/memory/redis.ts` (connection tuning, TTLs)
- `marketing/` (delete or archive)
- `dashboard/project/`, `public/dashboard/` (delete or archive)
- `components/marketing/reveal.tsx`, `components/ui/button.tsx` (delete if unused)
- `package.json` (remove unused deps)
- `tailwind.config.ts`, `postcss.config.mjs` (remove if Tailwind unused)
- `audit/` (reconcile or archive)

### Implementation steps

1. Add structured logger with `traceId`, `userId`, `model`, `tier`, `costUsd`.
2. Emit metrics: cost/conversation, tool success, latency buckets, fallback rate.
3. Bound master sweep concurrency with `p-map` or equivalent.
4. Add TTLs to unbounded keys (history, archive, tasks, profile).
5. Remove duplicate marketing site and dashboard.
6. Remove unused dependencies (`lucide-react`, `framer-motion`, etc.).
7. Audit Tailwind usage; remove if confirmed unused.
8. Reconcile `audit/` docs with current code.
9. Add load tests for concurrent users.

### Risks

| Risk | Mitigation |
|---|---|
| Removing marketing site breaks deployment | Confirm active site is Next.js app; archive old directory |
| TTLs accidentally delete wanted data | Use long TTLs (90d+); add monitoring |
| Logger changes add overhead | Use async logging; sample high-volume paths |

### Rollback strategy

- Archive (don't delete) `marketing/` and old dashboard initially.
- TTL changes reversible within grace period.

### Validation tests

- Load test: 1,000 concurrent users, measure Redis command count and latency.
- Sweep completes within timeout for 10k users.
- `npm audit` shows no high-severity vulnerabilities.
- `npm run typecheck` and `npm test` pass.

### Success criteria

- All `console.*` replaced by structured logger.
- Cost/conversation metrics visible.
- Sweep bounded and load-tested.
- Dead code/dependencies removed.
- Build and tests green.

---

## Cross-Phase Dependencies

```
Phase 1 (atomicity/security)
    │
    ├── enables Phase 2 (routing) — safe to switch models once races are fixed
    │
    └── enables Phase 3 (streaming/localization) — reliable queue needed for streaming UX

Phase 2 (routing/cost)
    │
    └── informs Phase 4 (observability) — metrics depend on router decisions

Phase 3 (UX/cleanup)
    │
    └── prepares Phase 4 (scale) — dead code removed before load testing
```

---

## Timeline Estimate

| Phase | Duration | FTE |
|---|---|---|
| Phase 1 | 2 weeks | 1 |
| Phase 2 | 2 weeks | 1 |
| Phase 3 | 2 weeks | 1 |
| Phase 4 | 2 weeks | 1 |
| **Total** | **8 weeks** | **1 engineer sequential; 4–6 weeks with 2 engineers parallelizing phases 1+2 and 3+4** |

---

## Definition of Done

- [ ] No P0 race conditions remain.
- [ ] Model routing implemented and measured.
- [ ] Thai localization deployed and validated.
- [ ] Dead code and unused dependencies removed.
- [ ] Structured logging and cost metrics in place.
- [ ] Load tested for 1,000 concurrent users.
- [ ] `npm run typecheck` and `npm test` pass.
- [ ] Documentation (`AGENTS.md`, `audit/`) updated.
