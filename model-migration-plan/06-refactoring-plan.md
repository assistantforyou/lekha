# Refactoring Plan — Dead Code, Duplication, and Technical Debt

This document identifies dead code, duplicate logic, unused dependencies, over-engineered abstractions, and performance bottlenecks. Each item includes location, impact, and priority.

## 1. Dead Code

| # | Location | Issue | Impact | Priority |
|---|---|---|---|---|
| 1 | `lib/llm/agent.ts:664` | `const timePrefix: ModelMessage[] = []` declared but never populated. | Confusion | P3 |
| 2 | `lib/llm/agent.ts:769` | `upload_to_drive` referenced; real tool is `drive_upload_recent_media`. | Account picker hint never fires. | P1 |
| 3 | `lib/llm/agent.ts:297`, `agent-flex.ts:156,208-209` | `search_news` referenced; tool does not exist. | Unreachable branches. | P1 |
| 4 | `lib/llm/agent-flex.ts:251` | `get_weather` referenced; tool does not exist. | Unreachable branch. | P1 |
| 5 | `lib/llm/prompts.ts:14` | `read_list` referenced; real tool is `list_items`. | Model told to call non-existent tool. | P1 |
| 6 | `lib/llm/evening-summary.ts:5` | Unused `redis` import. | Hygiene | P3 |
| 7 | `app/api/subscribe/route.ts` | Validates email but never persists it. | Non-functional feature. | P2 |
| 8 | `app/report/tests/page.tsx` | Hardcodes 126 passing tests. | Misleading. | P2 |
| 9 | `audit/*.md` | Lists bugs already fixed (webhook error leakage, DISPLAY_TZ, health endpoint, etc.). | Stale docs. | P2 |
| 10 | `README.md`, `audit/` | References `lib/llm/health.ts` which does not exist. | Stale docs. | P3 |

## 2. Duplicate Logic

| # | Location | Issue | Impact | Priority |
|---|---|---|---|---|
| 11 | `lib/llm/briefing.ts:68-160` and `lib/llm/evening-summary.ts:14-103` | Near-identical `toDayKey`, `formatAgendaItem`, `buildAgenda`, `dayLabel`. | Maintenance burden, inconsistent fixes. | P2 |
| 12 | `lib/tools/web-search.ts`, `lib/tools/news.ts`, `lib/llm/briefing.ts`, `lib/llm/evening-summary.ts` | Four separate Tavily call paths. | Inconsistent caching, error handling, shapes. | P1 |
| 13 | `lib/tools/weather.ts` and `lib/llm/briefing.ts:16-47` | Two separate weather fetch implementations. | Briefing lacks fallback/cache. | P1 |
| 14 | `app/page.tsx` + `marketing/` | Two marketing sites. | Duplicate content, extra build time. | P2 |
| 15 | `app/dashboard/` vs `dashboard/project/` + `public/dashboard/` | Two dashboard implementations. | Confusion, dead assets. | P2 |
| 16 | `app/api/health/route.ts` and `app/api/report/status/route.ts` | Overlapping health endpoints. | Redundancy. | P3 |
| 17 | `lib/search-cache.ts` and `lib/news-cache.ts` | Separate news/web caches with overlapping concerns. | Consolidate after unifying search service. | P2 |

## 3. Unused Dependencies

| # | Dependency | Evidence | Action | Priority |
|---|---|---|---|---|
| 18 | `lucide-react` | No imports found. | Remove. | P2 |
| 19 | `framer-motion` | Only used in `components/marketing/reveal.tsx`, which is unused because `app/page.tsx` has its own `useReveal`. | Remove dep and component. | P2 |
| 20 | `clsx`, `tailwind-merge`, `class-variance-authority` | Support `lib/utils.ts` `cn()` and `components/ui/button.tsx`, but these are not used by production pages. | Evaluate after Tailwind decision. | P3 |
| 21 | `tailwindcss`, `@tailwindcss/postcss` | Marketing and dashboard use custom CSS; Tailwind utilities appear unused. | Audit actual usage; remove if confirmed. | P3 |
| 22 | `jszip`, `heic-convert` | Used only by dev chat endpoint. | Move to `devDependencies` or keep if dev chat is permanent. | P3 |
| 23 | `jose` | Imported in `lib/dashboard-auth.ts` but only transitive. | Add to `dependencies`. | P2 |
| 24 | `@ai-sdk/provider-utils` | Imported in `scripts/measure-prompt.ts` but only transitive. | Add to `devDependencies`. | P2 |

## 4. Performance Bottlenecks

| # | Location | Issue | Impact | Priority |
|---|---|---|---|---|
| 25 | `lib/memory/tasks.ts:44-160` | Full list rewrite on every task mutation. | O(N²) as task count grows; race-prone. | P0 |
| 26 | `app/api/report/marketing/route.ts:59-136` | Uses Redis `KEYS` scans (`user:*:facts:v2`, `user:*:tasks`, etc.). | Blocks Redis at scale. | P1 |
| 27 | `lib/llm/agent.ts:680-693` | `generateText` with full tool registry; no streaming. | High latency, poor UX. | P1 |
| 28 | `lib/memory/history.ts:93-136` | Synchronous LLM summarization in request path. | Adds seconds to response on long threads. | P1 |
| 29 | `lib/tools/index.ts` | Full 51-tool registry sent every turn. | Higher token cost, model confusion. | P2 |
| 30 | `lib/llm/briefing.ts` | Morning briefing fetches Gmail (up to 50 messages.get), calendar, multiple Tavily topics synchronously. | Slow, expensive proactive push. | P1 |
| 31 | `lib/llm/evening-summary.ts` | Three fixed Tavily queries every night. | Redundant search spend. | P2 |
| 32 | `lib/tools/email.ts:128-130` | Drive attachments fetched sequentially. | Adds seconds to send. | P2 |
| 33 | `lib/llm/briefing.ts:285-286`, `lib/llm/evening-summary.ts:202-204` | Server-local time used for user timezone boundaries. | Wrong "today" boundaries. | P2 |

## 5. Over-Engineered Abstractions

| # | Location | Issue | Impact | Priority |
|---|---|---|---|---|
| 34 | `lib/llm/agent.ts` | 946-line file mixing orchestration, rendering, fallbacks, error classification. | Hard to test and reason about. | P2 |
| 35 | `lib/memory/settings.ts` | Six migrations + large defaults object; `userConfigured` array grows monotonically. | Brittle; unbounded growth. | P2 |
| 36 | `lib/tools/index.ts` | Registry claims to omit tools based on prerequisites but `google_user_connected` always returns `true`. | Misleading abstraction. | P1 |
| 37 | `lib/llm/render-drafts.ts` + `lib/llm/agent-flex.ts` + `lib/llm/agent.ts:188-557` | Three separate display-rendering paths. | Inconsistent UX; localization gaps. | P2 |
| 38 | `lib/llm/extract-facts.ts` | Duplicate prompt definition vs `lib/llm/prompts.ts`. | Maintenance. | P3 |

## 6. Security / Configuration Debt

| # | Location | Issue | Impact | Priority |
|---|---|---|---|---|
| 39 | `app/api/line/webhook/route.ts:100-125` | Hardcoded `FREETRIAL100`. | Abuse vector. | P0 |
| 40 | `app/api/dev/chat/route.ts` | Dev endpoint bypasses allowlist and rate limits. | Credential leak = full takeover. | P0 |
| 41 | `lib/qstash-verify.ts:41-44` | Non-timing-safe secret compare. | Side-channel risk. | P1 |
| 42 | `lib/line/verify.ts:19` | Length check before `timingSafeEqual`. | Minor timing leak. | P2 |
| 43 | `lib/tools/google-auth.ts:96-115` | Connect token 90-second replay window. | Account takeover if link intercepted. | P1 |
| 44 | `lib/gate.ts:28-50` | Self-serve pending queue not implemented despite docs. | Functional gap. | P1 |

## 7. Cleanup Order

### Phase 1 — Safety & correctness (P0)
1. Fix task store (hash + sorted set).
2. Fix pending-action atomicity.
3. Remove/fix dead tool references.
4. Remove hardcoded `FREETRIAL100`.
5. Harden dev endpoint.

### Phase 2 — Cost & performance (P1)
6. Consolidate Tavily search stack.
7. Unify weather implementation.
8. Add streaming / abort.
9. Move background extraction to Flash Lite.
10. Replace `KEYS` scans with `SCAN`/counters.

### Phase 3 — Hygiene (P2/P3)
11. Remove unused dependencies.
12. Delete/archive duplicate marketing site and dashboard.
13. Reconcile `audit/` docs.
14. Refactor `agent.ts` into smaller modules.
15. Decide on Tailwind removal.

## 8. Verification Commands

```bash
# Find unused dependencies
npx depcheck

# Find unused files/exports
npx knip

# Type check after cleanup
npm run typecheck

# Run tests
npm test

# Audit dependencies
npm audit
```

## 9. Expected Outcomes

After completing P0/P1 cleanup:
- **Codebase size:** ~15–25% reduction in production code paths.
- **Build time:** Slightly faster after removing unused deps and duplicate sites.
- **Maintainability:** Clearer separation between orchestration, rendering, and tools.
- **Cost:** 35–55% operating cost reduction from model routing + search consolidation.
- **Reliability:** Elimination of race-related data loss and several data-loss queue paths.
