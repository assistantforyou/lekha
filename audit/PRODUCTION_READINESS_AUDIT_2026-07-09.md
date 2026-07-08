# Lekha — Brutal Production Readiness Audit

**Date:** 2026-07-09  
**Auditor:** Kimi Code CLI (multi-agent deep dive + manual verification)  
**Scope:** Full Next.js LINE bot, dashboard, marketing site, AI layer, Redis layer, security, CI/CD  
**Previous audits:** `audit/04-security.md`, `audit/05-bugs-and-gaps.md`, `audit/phase1-architecture-report.md`  

---

## Executive Summary

Lekha is a **functionally impressive personal assistant** with a lot of good architectural decisions: per-user Redis isolation, encrypted OAuth tokens, HMAC-verified webhooks, atomic QStash verification, a well-structured tool registry, and a growing test suite. The previous audit cycle fixed many real P0/P1 bugs, and that work shows.

But this audit is about **shipping to thousands of real users**, and on that bar the application is **not ready**.

The most severe problems are not isolated bugs. They are **architectural and product-integrity issues**:

- The AI's **automatic long-term memory is disabled** and the docs claim it works.
- The **multi-step request path ignores facts, persona, group context, and staged media**.
- The **dashboard lets users corrupt their own settings** because the API has no input validation.
- The **cron sweep scales linearly with total users** and will fall over at scale.
- The **marketing page presents fabricated metrics, fake testimonials, and a fake "live operations" demo**.
- The **frontend lacks error boundaries, mobile navigation, and accessible focus management**.

This is a codebase that can delight a small group of beta users today, but it will produce silent data loss, confused users, runaway costs, and compliance risk at scale.

---

## Overall Score

**4.2 / 10** — Not production-ready for thousands of users. Functional for a private beta of tens of users.

### Sub-scores

| Dimension | Score | Notes |
|---|---|---|
| **Reliability** | 5/10 | Core paths work; cron sweep, Redis races, and silent failures are liabilities. |
| **UX** | 3/10 | Visually polished but misleading marketing, broken mobile nav, silent save failures, poor a11y. |
| **Performance** | 4/10 | Uncapped per-turn tokens, O(users) sweep, no Google API caching, fat webhook bundle. |
| **Security** | 6/10 | Good primitives (HMAC, encryption, OAuth) but key reuse, dev-chat bypass, and dashboard validation gaps. |
| **Maintainability** | 4/10 | Heavy god files, duplicated logic, `any` casts, missing tests for critical paths. |
| **Scalability** | 3/10 | Redis data model and sweep architecture do not scale past a few hundred active users. |

---

## How This Audit Was Conducted

- Read prior audit reports and verified which issues were fixed.
- Ran `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `npm audit`.
- Dispatched five parallel senior-engineer agents to audit: Frontend/UX, Performance/Scalability, Code Quality, AI/Tooling, Security/Reliability.
- Manually verified the most critical claims (dead memory code, dashboard validation, dev-chat guard, cron sweep).
- Build completed successfully; 283 tests passed; lint had only warnings.

---

## Repository State

```
$ git status --short
?? coverage/
```

- **No files are staged for commit** (contrary to the user's note about staged files from a previous session).
- `coverage/` is **untracked** and should be added to `.gitignore`.
- `.DS_Store` files exist in the working tree.
- `for_video/` contains ~2.8 MB of raw marketing assets and `.DS_Store`.
- `public/screenshots/` contains a `.gitkeep` and symlinks back to `for_video/`.

These are repo-hygiene issues, not production blockers, but they suggest a need for a pre-launch cleanup pass.

---

## Issues by Category

### 1. Functional Bugs

#### 1.1 Auto fact-extraction is dead code
- **Severity:** Critical
- **What is wrong:** `mastra/agents/lekha-agent.ts` explicitly disables Mastra Memory (`createMemory()` returns `undefined`). `lib/llm/extract-facts.ts` only calls `extractAndMergeFactsFromMastra()`, which immediately returns when `getLekhaAgent().getMemory()` is undefined. The only way facts enter long-term memory is via the explicit `remember` tool.
- **Why it matters:** AGENTS.md/CLAUDE.md claim facts are extracted every `memoryCompactAt` turns. In reality the bot silently forgets almost everything unless the model happens to call `remember`. A "personal assistant" with broken auto-memory is materially broken.
- **How to reproduce:** Tell the bot "My mom's name is Sombat", wait, then ask "What's my mom's name?" Check Redis — `user:{id}:facts:v2` is unchanged unless `remember` was called.
- **Recommended fix:** Rewire `maybeExtractFacts` to read Redis rolling history (`loadHistory`) and call `extractAndMergeFacts(userId, recentTurns)` directly. Remove the Mastra-memory dependency or re-enable it once the bug is fixed.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 1.2 Multi-step planner ignores facts, persona, group context, and staged media
- **Severity:** Critical
- **What is wrong:** When `looksMultiStep()` fires, `runMastraAgent` calls `runMultiStep()` with only `{ timezone, language, displayName, location }`. The planner and synthesizer do not receive facts, persona settings, group context, active Google account, or staged media.
- **Why it matters:** A request like "check the weather and my tasks" is handled by a generic mini-agent that doesn't know who the user is, where they live (unless restated), or how they want to be addressed. Replies are inconsistent and factually wrong.
- **How to reproduce:** Set location to Chiang Mai and a preferred name, then ask "What's the weather and convert 100 USD to THB?" The reply ignores persona and may default to Bangkok.
- **Recommended fix:** Feed the full system prompt + relevant facts into planner/synthesizer, or retire the separate multi-step path and let the main agent handle parallel tool calls.
- **Estimated effort:** 1 week
- **Blocks production:** Yes

#### 1.3 `schedule_email` confirmation flow is inconsistent
- **Severity:** High
- **What is wrong:** `schedule_email` is rendered as a draft card but the QStash schedule is published immediately during tool execution. The user sees a "Schedule Email" confirmation button, but the schedule may already exist.
- **Why it matters:** Users can tap NO or delay, yet the email may still fire. This contradicts the confirmation model used for `draft_email` and `draft_calendar_event`.
- **How to reproduce:** Ask the bot to schedule an email, then tap NO. The QStash message may already be queued.
- **Recommended fix:** Route `schedule_email` through `appendPending` and execute only on YES, or remove it from the draft card list.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 1.4 Affirmative classifier misses common Thai confirmations
- **Severity:** High
- **What is wrong:** `classify` only recognizes "ครับ", "ค่ะ", "ใช่", "ส่ง", "ส่งเลย". It misses "ได้", "โอเค", "ตกลง", "ยืนยัน", "yes please", "go ahead", and compound replies like "ok ส่งเลย".
- **Why it matters:** Thai users replying naturally will have confirmations rejected. The pending queue is cleared and the draft is lost.
- **How to reproduce:** Reply "ตกลง" or "ok ส่ง" to a draft confirmation.
- **Recommended fix:** Expand the regex set or use a lightweight LLM classifier.
- **Estimated effort:** 30 minutes
- **Blocks production:** No (but high Thai UX impact)

#### 1.5 Pending action TTL is too short
- **Severity:** Medium
- **What is wrong:** Pending actions expire after 5 minutes (`lib/confirm.ts`).
- **Why it matters:** Users often step away. A user who replies "yes" after 6 minutes gets "Nothing to confirm." The draft is lost.
- **Recommended fix:** Extend TTL to 30–60 minutes, or persist drafts separately with a longer TTL.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 1.6 `resolveStagedItem` returns wrong media kind
- **Severity:** Medium
- **What is wrong:** When no index is provided and no item matches the expected kind, the function falls back to `staged[staged.length - 1]`, regardless of kind.
- **Why it matters:** Asking to summarize an image when the most recent staged item is a PDF sends the PDF to the vision model, or vice versa.
- **How to reproduce:** Stage a PDF, then ask "summarize this image" without an index.
- **Recommended fix:** Return an explicit error when no matching kind is found.
- **Estimated effort:** 1 hour
- **Blocks production:** No

#### 1.7 `fallbackFinance` only handles crypto
- **Severity:** High
- **What is wrong:** `looksLikeFinance` can return `{ type: "stock", ticker: ... }`, but `fallbackFinance` explicitly checks `finInfo.type !== "crypto"` and returns a failure message.
- **Why it matters:** Stock/FX queries that fail the agent path are not rescued by the deterministic fallback.
- **How to reproduce:** Ask "What's AAPL stock price?" in a way that triggers the fallback path.
- **Recommended fix:** Implement stock and FX fallbacks, or remove the partial implementation.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 1.8 `fallbackWeather` defaults to Bangkok
- **Severity:** Medium
- **What is wrong:** If no location is parsed from the query, `fallbackWeather` defaults to `"Bangkok"`.
- **Why it matters:** Non-Bangkok users get wrong weather when the agent fails.
- **How to reproduce:** Set location to "Chiang Mai", ask "weather?" in a way that triggers fallback.
- **Recommended fix:** Pass `settings.location` into the fallback and use it as default.
- **Estimated effort:** 30 minutes
- **Blocks production:** No

---

### 2. UX / UI

#### 2.1 Marketing page presents fabricated data
- **Severity:** Critical
- **What is wrong:** The landing page has hard-coded empty metrics, a fake admin testimonial, empty logo placeholders in the "trusted by" strip, and a "Live Operations Layer" built from static `TICKERS`, `CMD_EVENTS`, `CMD_TASKS`, and `CMD_OPS` arrays.
- **Why it matters:** For a public site claiming executive/doctor users, this is misleading and potentially violates advertising law. It destroys trust.
- **How to reproduce:** Inspect `.hero-meta .stat .num`, `.trusted-logos span`, and the Live Operations Layer section.
- **Recommended fix:** Remove fake social proof or replace with real, permissioned data. Rename "Live" to "Sample" if demo data.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 2.2 Missing OpenGraph image
- **Severity:** High
- **What is wrong:** `metadata.openGraph.images` references `/og.png`, but the file does not exist in `public/`.
- **Why it matters:** Link previews on LINE/Twitter/Facebook are broken.
- **How to reproduce:** `ls public/og.png`.
- **Recommended fix:** Add a 1200×630 `public/og.png` or remove the broken reference.
- **Estimated effort:** 30 minutes
- **Blocks production:** Yes

#### 2.3 No mobile hamburger menu on landing page or dashboard
- **Severity:** Critical
- **What is wrong:** At ≤880px the `.nav-links` and sidebar are hidden, but no hamburger button is rendered. Mobile users cannot navigate.
- **Why it matters:** LINE is a mobile-first platform. A huge share of traffic will be mobile.
- **How to reproduce:** Resize to mobile width on `/` and `/dashboard`.
- **Recommended fix:** Add accessible hamburger menus with focus trap and keyboard handling.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 2.4 Dashboard save failures are silent
- **Severity:** Critical
- **What is wrong:** The dashboard patches local React state immediately and debounces a `fetch` to `/api/dashboard/settings`. If the backend returns an error, the UI still shows the change and never notifies the user.
- **Why it matters:** Users believe their settings are saved when they are not.
- **How to reproduce:** Throttle network or make `/api/dashboard/settings` return 500; UI stays green.
- **Recommended fix:** Track save status, show error toast/banner on failure, and roll back or retry.
- **Estimated effort:** 1–2 days
- **Blocks production:** Yes

#### 2.5 Dashboard initial load has no error state
- **Severity:** Critical
- **What is wrong:** If `/api/dashboard/me` fails, the dashboard shows "Loading your dashboard…" forever. No retry, no error message.
- **How to reproduce:** Block `/api/dashboard/me`; page hangs.
- **Recommended fix:** Add error state, retry button, and `error.tsx` boundary.
- **Estimated effort:** 4–6 hours
- **Blocks production:** Yes

#### 2.6 `alert()` used for user-facing errors
- **Severity:** High
- **What is wrong:** Google connect failure and test-line failure use `alert()`, which blocks the UI and is inaccessible.
- **How to reproduce:** Trigger a failed Google connect in the dashboard.
- **Recommended fix:** Replace with in-app toast/inline error messages.
- **Estimated effort:** 3 hours
- **Blocks production:** No

#### 2.7 No focus management, skip links, or reduced-motion support
- **Severity:** High
- **What is wrong:** Interactive `<div>`s lack `role`/`tabIndex`/keyboard handlers. `outline: none` is applied globally with no `:focus-visible` replacement. No `prefers-reduced-motion` guards. No skip-to-content link.
- **Why it matters:** Keyboard and motion-sensitive users cannot use the site.
- **How to reproduce:** Tab through the landing page; focus indicators are missing. Enable reduced motion; animations still run.
- **Recommended fix:** Use real `<button>` elements, add `:focus-visible` styles, guard animations, add skip link.
- **Estimated effort:** 2–3 days
- **Blocks production:** Yes (a11y/compliance)

#### 2.8 i18n does not update `html lang`
- **Severity:** High
- **What is wrong:** `app/i18n.tsx` mutates DOM text nodes directly and does not update `<html lang>`. Screen readers mispronounce Thai content.
- **How to reproduce:** Toggle ไทย; `html[lang]` stays `en`.
- **Recommended fix:** Use Next.js i18n routing or `next-intl` and update `<html lang>`.
- **Estimated effort:** 2–3 days
- **Blocks production:** Yes

#### 2.9 `/signup` does not validate plan against Stripe
- **Severity:** Critical
- **What is wrong:** The plan ID is only checked against a local `validPlans` array. A user can pass `?plan=anything` and see UI for a plan that may not exist in Stripe.
- **How to reproduce:** Visit `/signup?plan=fake`.
- **Recommended fix:** Fetch valid plans from Stripe/backend or use a strict allowlist and redirect invalid values.
- **Estimated effort:** 4–6 hours
- **Blocks production:** Yes

#### 2.10 `/signup/success` reachable without checkout completion
- **Severity:** High
- **What is wrong:** The success page is reachable directly via URL without verifying signup/payment.
- **How to reproduce:** Visit `/signup/success` in an incognito window.
- **Recommended fix:** Gate on session/checkout status or make it dynamic.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 2.11 `/report/tests` shows fake static results
- **Severity:** High
- **What is wrong:** `STATIC_TESTS` always reports 126 passes in ~2.1s.
- **Why it matters:** If linked as a real test report, it is misleading.
- **How to reproduce:** Open `/report/tests`.
- **Recommended fix:** Fetch real Vitest/coverage JSON from CI or remove the page.
- **Estimated effort:** 1 day
- **Blocks production:** Yes (if public)

#### 2.12 Tool filter tabs in dashboard are non-functional
- **Severity:** Medium
- **What is wrong:** The segmented control in `ToolsView` is hard-coded to show "All".
- **How to reproduce:** Click "Recent" or "Disabled"; nothing changes.
- **Recommended fix:** Wire state or remove the control.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 2.13 Connection view shows all Google services as connected
- **Severity:** Medium
- **What is wrong:** The UI hardcodes Calendar, Gmail, Drive, Contacts as connected whenever any Google account exists.
- **How to reproduce:** Connect a Gmail-only account; UI still says all four are active.
- **Recommended fix:** Pull actual granted scopes from backend or change copy.
- **Estimated effort:** 1 day
- **Blocks production:** No

#### 2.14 No `loading.tsx`, `error.tsx`, or `not-found.tsx` boundaries
- **Severity:** Critical
- **What is wrong:** Any client error or slow route hangs or shows the generic Next.js error UI.
- **How to reproduce:** Trigger an error in any route.
- **Recommended fix:** Add root `error.tsx`, `loading.tsx`, `not-found.tsx`.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 2.15 Marketing page is a giant `"use client"` component
- **Severity:** High
- **What is wrong:** `app/page.tsx` is 1500+ lines of client-side code with `// @ts-nocheck`.
- **Why it matters:** SEO-critical content is client-rendered, hurting Core Web Vitals and crawlers. TypeScript is disabled on the most important page.
- **How to reproduce:** Read `app/page.tsx`.
- **Recommended fix:** Split into server components; move interactivity into small client islands. Remove `// @ts-nocheck`.
- **Estimated effort:** 2–3 days
- **Blocks production:** Yes

#### 2.16 No `next/image` usage
- **Severity:** High
- **What is wrong:** All images are raw `<img>` tags.
- **Why it matters:** Missing optimization, lazy loading, blur placeholders, responsive srcset.
- **How to reproduce:** `grep -r "next/image" app` returns nothing.
- **Recommended fix:** Replace hero/use-case images with `<Image>`.
- **Estimated effort:** 1–2 days
- **Blocks production:** No

---

### 3. Performance

#### 3.1 Cron sweep is O(users) with no pagination or time budget
- **Severity:** Critical
- **What is wrong:** `/api/cron/sweep/fire` calls `listAllUsers()` (unbounded `SMEMBERS`) and iterates all users with fixed concurrency of 5. Each user may call Google APIs.
- **Why it matters:** At 1,000 users the job can take minutes; at 10,000 it can exceed QStash's max invocation time. This is the single biggest scalability blocker.
- **How to reproduce:** Read `app/api/cron/sweep/fire/route.ts` and `lib/sweep.ts`.
- **Recommended fix:** Convert to a stateful paginated job: store last-processed user ID in Redis, process a fixed batch per invocation, schedule next batch via QStash.
- **Estimated effort:** 1 week
- **Blocks production:** Yes

#### 3.2 Morning briefing makes up to 51 Gmail API calls per user
- **Severity:** High
- **What is wrong:** `lib/llm/briefing.ts` fetches up to 50 unread messages and then individually `messages.get` each one.
- **Why it matters:** 1,000 briefings = 51,000 Gmail API calls around 7–9 AM. High latency and cost.
- **Recommended fix:** Use batch endpoint, reduce `maxResults` to 10–15, or cache inbox snapshot.
- **Estimated effort:** 2 days
- **Blocks production:** Yes

#### 3.3 No caching for Google API reads
- **Severity:** High
- **What is wrong:** Calendar, Gmail, Drive reads hit Google every time. Briefings do this proactively for every user.
- **Why it matters:** Re-reads dominate cost and latency.
- **Recommended fix:** Add short Redis TTL caches (30–120s) keyed by user + account + query hash.
- **Estimated effort:** 3 days
- **Blocks production:** Yes

#### 3.4 Webhook bundle is 1.5 MB+ with heavy static imports
- **Severity:** High
- **What is wrong:** The webhook route statically imports all handlers and tools, pulling in `pdf-parse`, `heic-convert`, Mastra, Google APIs, etc.
- **Why it matters:** Text-only webhook events pay the cold-start tax for document parsers.
- **Recommended fix:** Dispatch based on event type and `await import(...)` the appropriate handler. Keep only signature verification and dedup in the hot path.
- **Estimated effort:** 3–5 days
- **Blocks production:** Yes

#### 3.5 No per-turn token or cost budget
- **Severity:** Critical
- **What is wrong:** The bot logs token usage but does not cap it. A user can upload a 20 MB PDF, trigger 40 chunks, then ask follow-ups that re-embed and re-read. `maxSteps: 8` with ~50 tools can send 100k–300k input tokens per turn.
- **Why it matters:** Runaway Gemini costs. A single power user can consume dollars per turn.
- **Recommended fix:** Add per-turn max token budget; truncate large inputs; limit document chunks; add daily per-user cost tracking.
- **Estimated effort:** 1 week
- **Blocks production:** Yes

#### 3.6 `maxSteps: 8` with full tool registry explodes context
- **Severity:** High
- **What is wrong:** Each step re-sends system prompt, history, and tool schemas. With 8 steps and ~50 tools, a single turn can send 100k–300k input tokens.
- **Why it matters:** Cost and latency become unsustainable at scale.
- **Recommended fix:** Reduce `maxSteps` to 4–5 for interactive turns. Use deterministic planner for known multi-part requests.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 3.7 Agent timeout does not abort underlying Gemini call
- **Severity:** High
- **What is wrong:** `AGENT_TIMEOUT_MS = 55s`. `withTimeout` rejects but no `AbortSignal` is passed to `agent.generate`.
- **Why it matters:** Timeouts return an error to the user but Gemini continues billing.
- **Recommended fix:** Create an `AbortController` and pass its signal to `agent.generate`; abort on timeout.
- **Estimated effort:** 4 hours
- **Blocks production:** Yes

#### 3.8 Tasks/facts use read-modify-write with race conditions
- **Severity:** High
- **What is wrong:** Tasks and facts are stored as single Redis blobs/lists. Mutations read the entire value, modify in memory, then delete + rewrite.
- **Why it matters:** Concurrent mutations can lose updates. At scale, each mutation becomes a multi-KB Redis round-trip.
- **Recommended fix:** Store tasks in a Redis Hash per task ID. Use Lua script or optimistic locking for facts.
- **Estimated effort:** 1 week
- **Blocks production:** Yes

#### 3.9 `users:active` set is unbounded
- **Severity:** High
- **What is wrong:** The cron sweep iterates `users:active`, which grows forever.
- **Why it matters:** At 10,000+ users, `SMEMBERS` becomes a multi-MB response and a slow command.
- **Recommended fix:** Use `SSCAN`. Add a separate "active in last N days" set with TTL.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 3.10 Heavy process-local caches
- **Severity:** Medium
- **What is wrong:** `contentCache` stores up to 20 MB media files (200-entry LRU). `toolCache` stores full `ToolSet` objects for 1,000 users. `factsCache` stores full fact blobs.
- **Why it matters:** Fluid Compute instances can OOM under load.
- **Recommended fix:** Reduce `contentCache` size or store only metadata. Precompute lightweight tool references.
- **Estimated effort:** 2 days
- **Blocks production:** Yes (for media-heavy users)

#### 3.11 Weather cache is process-local only
- **Severity:** Medium
- **What is wrong:** `weatherCache` is a plain `Map` with 10-minute TTL, not shared across Vercel instances.
- **Why it matters:** Popular locations are re-fetched by every cold instance.
- **Recommended fix:** Move to Redis with short TTL.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 3.12 Document indexing generates up to 40 embeddings per file
- **Severity:** Medium
- **What is wrong:** `lib/memory/documents.ts` chunks documents into 1,800-char slices with 200-char overlap, up to `MAX_CHUNKS_PER_DOC = 40`, and embeds each chunk.
- **Why it matters:** A single large PDF costs 40 embedding API calls plus vector upserts.
- **Recommended fix:** Use summarization first; only embed representative chunks or a single condensed summary.
- **Estimated effort:** 2 days
- **Blocks production:** No

---

### 4. Code Quality

#### 4.1 Massive dead-code surface
- **Severity:** High
- **What is wrong:** `npx knip` reports 47 unused files and 72 unused exports, including `components/marketing/reveal.tsx`, `dashboard/project/*.jsx`, `public/dashboard/*.jsx`, `scripts/*`, `lib/utils.ts`, `lib/tools/render-card.ts`.
- **Why it matters:** Bloats bundle, increases build time, confuses developers, hides attack surface.
- **Recommended fix:** Delete confirmed unused files; move scripts to separate repo or `package.json` commands.
- **Estimated effort:** 1–2 days
- **Blocks production:** No

#### 4.2 Duplicate dashboard/marketing artifacts
- **Severity:** Medium
- **What is wrong:** `dashboard/project/` and `public/dashboard/` contain duplicate JSX/CSS files. ESLint explicitly ignores both.
- **Why it matters:** Source of truth split; one change requires two edits.
- **Recommended fix:** Pick one directory; delete the other.
- **Estimated effort:** 1 day
- **Blocks production:** No

#### 4.3 Morning/evening briefing orchestration duplicated in 4+ places
- **Severity:** High
- **What is wrong:** The same briefing delivery sequence appears in `lib/sweep.ts`, `lib/shortcuts.ts`, `lib/admin-commands.ts`, and `lib/llm/agent-flex.ts`.
- **Why it matters:** Any formatting or error-handling change must be made in N places.
- **Recommended fix:** Extract `sendMorningBriefing(userId, opts)` and `sendEveningSummary(userId, opts)` helpers.
- **Estimated effort:** 1 day
- **Blocks production:** No

#### 4.4 God files
- **Severity:** High
- **What is wrong:** `lib/llm/agent-flex.ts` (1,468 lines), `lib/llm/agent-helpers.ts` (615 lines), `lib/tutorial.ts` (871 lines), `app/api/line/webhook/route.ts` (381 lines) mix too many concerns.
- **Why it matters:** Hard to test, hard to maintain, high regression risk.
- **Recommended fix:** Split by domain. `agent-flex.ts` → `lib/llm/flex-builders/{memory,finance,weather,...}.ts`.
- **Estimated effort:** 1–2 weeks
- **Blocks production:** No

#### 4.5 Explicit `any` at AI/Mastra boundaries
- **Severity:** High
- **What is wrong:** `processResult(result: any, …)`, `mastra/run.ts` multiple `as any`, `mastra/tools/wrap-ai-tool.ts` casts, `lekha-agent.ts` `ctx as any`.
- **Why it matters:** Invalid tool results and malformed context slip through.
- **Recommended fix:** Replace with narrow `unknown` → validation patterns (Zod or typed adapters).
- **Estimated effort:** 1 week
- **Blocks production:** No (latent bug source)

#### 4.6 Pervasive non-null assertions
- **Severity:** Medium
- **What is wrong:** `!` is used on regex matches, array indexes, and map lookups across the codebase (`lib/admin-commands.ts`, `lib/tools/drive.ts`, `lib/tools/media-ai.ts`, `lib/memory/facts.ts`, etc.).
- **Why it matters:** `noUncheckedIndexedAccess` is enabled but `!` defeats it. Can crash on malformed input.
- **Recommended fix:** Remove `!` and handle undefined cases explicitly.
- **Estimated effort:** 2–3 days
- **Blocks production:** Potential

#### 4.7 Inconsistent error contract (throws vs returns)
- **Severity:** High
- **What is wrong:** The architecture says "tool errors are RETURNED, not thrown," but many modules throw and catch inconsistently. `agent-helpers.ts` post-hoc scans for `{ ok: false }`.
- **Why it matters:** New tools will get it wrong; some errors bubble to Vercel 500, others are paraphrased by the model.
- **Recommended fix:** Enforce a single `ToolResult<T>` ADT and a wrapper that converts exceptions automatically.
- **Estimated effort:** 2 weeks
- **Blocks production:** Yes

#### 4.8 `.catch(() => {})` fire-and-forget overused
- **Severity:** Medium
- **What is wrong:** `registerUser`, `markUserActive`, `maybeExtractFacts`, and many more swallow errors.
- **Why it matters:** Failures become invisible; Redis outages or bugs are not logged.
- **Recommended fix:** Pass errors to a structured logger; use a `swallowNonFatal` helper that still logs.
- **Estimated effort:** 1 day
- **Blocks production:** No

#### 4.9 Missing tests for core production paths
- **Severity:** High
- **What is wrong:** Coverage report shows `lib/tools/drive.ts` 1.1%, `email.ts` 1.6%, `calendar.ts` 1.8%, `media-ai.ts` 2.1%, `with-google.ts` 2.7%, `gmail-inbox.ts` 3.2%, `reminders.ts` 4.1%, `sweep.ts` 8.1%, `briefing.ts` 8.6%.
- **Why it matters:** The most failure-prone integrations have almost no automated safety net.
- **Recommended fix:** Add unit tests with mocked Redis and Google APIs; add integration tests for happy paths and auth failures.
- **Estimated effort:** 2–4 weeks
- **Blocks production:** Yes for team scale

#### 4.10 Documentation contradicts code
- **Severity:** High
- **What is wrong:** README says 30/hr rate limit; code implements 500/hr. README says 20 turns; code uses 35. README references `CLAUDE.md` which does not exist (it's `AGENTS.md`).
- **Why it matters:** Operations, user expectations, and abuse defense depend on the real numbers.
- **Recommended fix:** Audit all numeric claims across README/AGENTS.md and sync with code.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 4.11 `jose` is an unlisted dependency
- **Severity:** Medium
- **What is wrong:** `lib/dashboard-auth.ts` imports `jose`, but it is not in `package.json`.
- **Why it matters:** Works only because it is a transitive dependency; fragile.
- **Recommended fix:** Add `jose` to `dependencies`.
- **Estimated effort:** 5 minutes
- **Blocks production:** Potential

#### 4.12 No lint step or coverage gate in CI
- **Severity:** Medium
- **What is wrong:** CI runs typecheck, build, test, eval, but not lint. Coverage is generated but not enforced.
- **Recommended fix:** Add `npm run lint` to CI; add coverage threshold.
- **Estimated effort:** 1 hour
- **Blocks production:** No

#### 4.13 No structured logging
- **Severity:** Medium
- **What is wrong:** `console.log/warn/error` everywhere with ad-hoc payloads.
- **Why it matters:** Vercel logs are hard to query; PII may leak; cannot alert on patterns.
- **Recommended fix:** Adopt `pino` with redaction for user IDs/tokens.
- **Estimated effort:** 1 day setup, gradual migration
- **Blocks production:** No

#### 4.14 Scattered magic numbers
- **Severity:** Medium
- **What is wrong:** Limits are scattered: `MAX_FACTS = 500`, `MAX_MEDIA_BYTES = 20MB`, `10 * 60_000`, `5 * 60`, `200` cache sizes, `5000` text limit.
- **Why it matters:** Hard to tune, hard to keep docs in sync.
- **Recommended fix:** Create `lib/constants.ts` and import everywhere.
- **Estimated effort:** 1 day
- **Blocks production:** No

---

### 5. Security

#### 5.1 Dashboard settings endpoint accepts arbitrary input
- **Severity:** Critical
- **What is wrong:** `app/api/dashboard/settings/route.ts` parses raw JSON and casts fields into `Partial<UserSettings>` without Zod validation. The `directKeys` loop copies any provided key into the patch.
- **Why it matters:** An authenticated user can corrupt their own settings blob (e.g., set `briefingChannels` to a string, inject nested objects, override `settingsVersion`). Bad values can crash subsequent turns or poison the system prompt.
- **How to reproduce:** `POST /api/dashboard/settings` with `{ "toolSettings": { "email": { "autosend": "<script>" } }, "briefingChannels": "not-an-object" }`.
- **Recommended fix:** Add strict Zod schema for the dashboard settings payload; validate every field; reject unknown keys.
- **Estimated effort:** 1 day
- **Blocks production:** Yes

#### 5.2 Dev-chat endpoint allows any userId when `DEV_LINE_USER_ID` is unset
- **Severity:** Critical
- **What is wrong:** The guard is `if (allowedUserId && userId !== allowedUserId)`. If `DEV_LINE_USER_ID` is missing, the restriction is skipped.
- **Why it matters:** If `DEV_CHAT_SECRET` leaks, an attacker can impersonate any LINE user, read their data, send pushes, and execute actions.
- **How to reproduce:** Unset `DEV_LINE_USER_ID`, call with any `userId` and correct `x-dev-secret`.
- **Recommended fix:** Require `DEV_LINE_USER_ID` to be set; return 503 if unset.
- **Estimated effort:** 15 minutes
- **Blocks production:** Yes

#### 5.3 `OAUTH_STATE_SECRET` reused across three security contexts
- **Severity:** Critical
- **What is wrong:** The same secret is used for HMAC-signing OAuth connect-link tokens, signing dashboard session JWTs, and authorizing manual cron triggers.
- **Why it matters:** Cryptographic key reuse across protocols violates key separation. If one context leaks the secret, the attacker gains capabilities in the other two.
- **Recommended fix:** Introduce separate env vars: `DASHBOARD_SESSION_SECRET`, `CRON_MANUAL_SECRET`, and keep `OAUTH_STATE_SECRET` for OAuth only.
- **Estimated effort:** 1 day plus secret rotation
- **Blocks production:** Yes

#### 5.4 Dev-chat endpoint has no rate limiting
- **Severity:** Medium
- **What is wrong:** No per-IP, per-user, or global rate limit.
- **Why it matters:** An attacker with the secret can hammer the endpoint and burn Gemini/LINE/Redis quota.
- **Recommended fix:** Add Redis-backed rate limit (e.g., 10 req/min per IP or userId).
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 5.5 Dev-chat image path has no size limit
- **Severity:** Medium
- **What is wrong:** `imageBase64` is decoded into a Buffer with no max-size check before allocation.
- **Why it matters:** A huge base64 image can OOM the Vercel function.
- **Recommended fix:** Reject if decoded size exceeds ~20 MB before `Buffer.from`.
- **Estimated effort:** 30 minutes
- **Blocks production:** No

#### 5.6 `getMessageContent` has no fallback size limit when Content-Length is missing
- **Severity:** Medium
- **What is wrong:** It checks `Content-Length` against 20 MB, but if the header is absent it streams the whole body into memory.
- **Why it matters:** LINE can return large files without `Content-Length`; the function could OOM.
- **Recommended fix:** Stream into a buffer with a hard byte cap.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 5.7 Dashboard facts endpoint accepts unvalidated category
- **Severity:** Medium
- **What is wrong:** `category` is cast directly to `FactCategory` without checking `FACT_CATEGORIES`.
- **Why it matters:** A malformed category is stored and may break prompt rendering or fact filtering.
- **Recommended fix:** Validate against `FACT_CATEGORIES` enum before appending.
- **Estimated effort:** 30 minutes
- **Blocks production:** No

#### 5.8 Prompt injection via user-controlled strings is only partially mitigated
- **Severity:** Medium
- **What is wrong:** `buildSystemPrompt` strips `"`, `\`, and `` ` `` from `displayName`, `preferredName`, `location`, and fact content, but newlines and angle brackets are not escaped. `recentBlock` inserts `fileName` directly.
- **Why it matters:** A crafted display name, filename, or fact can inject instructions.
- **Recommended fix:** Escape or strip newlines and control characters; bound lengths; render facts as JSON block.
- **Estimated effort:** 1 day
- **Blocks production:** No

#### 5.9 Morning/evening briefing dedup race
- **Severity:** Medium
- **What is wrong:** `shouldFireBriefingNow` checks `Date.now() - lastFiredTs < 12h`. Two concurrent sweep invocations can both pass before either writes `lastFiredTs`.
- **Why it matters:** Users could receive duplicate briefings.
- **Recommended fix:** Use `claimPushLock` atomically inside `runSweepForUser`.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 5.10 npm audit: `@mastra/core` pulls vulnerable `@ai-sdk/provider-utils`
- **Severity:** High (rated Low by npm, but on critical path)
- **What is wrong:** `npm audit` reports uncontrolled resource consumption in `@ai-sdk/provider-utils` ≤3.0.97 via `@mastra/core`.
- **Why it matters:** The advisory is on the AI SDK provider path, which every user turn hits.
- **Recommended fix:** `npm audit fix` and verify resolution.
- **Estimated effort:** 30 minutes
- **Blocks production:** No

#### 5.11 Verified solid controls
- LINE webhook HMAC ✅
- QStash signature verification ✅
- OAuth CSRF / connect-link single-use ✅
- AES-256-GCM token encryption ✅
- Allowlist gate now fails closed ✅
- Rate limiting (500/hr/user) ✅
- Stripe webhook signature ✅
- GitHub webhook signature ✅
- OAuth token revocation ✅
- Health endpoint checks dependencies ✅

---

### 6. Reliability

#### 6.1 Cron sweep will not scale
- **Severity:** Critical
- See Performance 3.1.

#### 6.2 Redis read-modify-write races on tasks and facts
- **Severity:** Critical
- See Performance 3.8.

#### 6.3 Agent timeout does not cancel upstream work
- **Severity:** High
- See Performance 3.7.

#### 6.4 `after()` work is not time-bounded
- **Severity:** Medium
- **What is wrong:** Webhook returns 200 and runs real work in `after()`. If `after()` is killed when the background lifetime ends, partial state (history appended but audit log missing) can occur.
- **Recommended fix:** Make critical state writes durable before returning 200, or move to QStash jobs.
- **Estimated effort:** 2 days
- **Blocks production:** No

#### 6.5 `logSent` and other fire-and-forget operations swallow errors
- **Severity:** Medium
- See Code Quality 4.8.

#### 6.6 Extractor model has no quota fallback
- **Severity:** Medium
- **What is wrong:** `extractorModel()` prefers the free tier and never falls back to paid. Background fact extraction and history summarization fail when the free key is exhausted.
- **Recommended fix:** Wrap extractor calls in `withGeminiFallback`.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 6.7 `handleAgentError` does not fall back to paid tier for all errors
- **Severity:** Medium
- **What is wrong:** The main agent fallback only catches quota/rate-limit patterns, not `UNAVAILABLE` or `DeadlineExceeded`.
- **Recommended fix:** Extend the fallback regex and reuse `withGeminiFallback` for the main agent call.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 6.8 Document pre-read runs unconditionally
- **Severity:** Medium
- **What is wrong:** `respondToOtherMedia` calls `prereadDoc(...).catch(() => {})` for every readable document, downloading the file and calling `chatModel()` with full bytes.
- **Why it matters:** Uploading 10 large PDFs triggers 10 simultaneous Gemini calls before the user asks anything.
- **Recommended fix:** Defer pre-reading until the user asks a question, or rate-limit pre-reads.
- **Estimated effort:** 1 day
- **Blocks production:** No

#### 6.9 Trial daily quota has a brief race window
- **Severity:** Low
- **What is wrong:** Uses `incr` then compares to limit. Two concurrent requests could both pass, exceeding the limit by 1.
- **Recommended fix:** Use Lua script or accept off-by-one.
- **Estimated effort:** 1 hour
- **Blocks production:** No

#### 6.10 `extractStructuredDocument` caches empty result on parse failure
- **Severity:** Medium
- **What is wrong:** If the model returns malformed JSON, the function stores `{ items: [] }` for 30 days.
- **Why it matters:** A transient model failure permanently blocks structured extraction for that document.
- **Recommended fix:** Do not cache empty results, or cache with short TTL.
- **Estimated effort:** 1 hour
- **Blocks production:** No

---

### 7. Database / Redis

#### 7.1 Tasks stored as a Redis list with O(N) rewrites
- **Severity:** High
- See Performance 3.8.

#### 7.2 Facts stored as a single JSON blob
- **Severity:** High
- See Performance 3.8.

#### 7.3 Audit log entries store full tool inputs/outputs
- **Severity:** Medium
- **What is wrong:** `lib/memory/audit-log.ts` caps at 5,000 entries and 1-year TTL, but each entry stores the full user message, reply, and full tool inputs/outputs.
- **Why it matters:** Redis memory can balloon for power users.
- **Recommended fix:** Truncate tool outputs in audit entries (e.g., first 1 KB or summary).
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 7.4 Group member profile keys accumulate
- **Severity:** Low
- **What is wrong:** `clearGroupProfiles` exists but is never called automatically. Profile keys are written with 1-day TTL but refresh in active groups.
- **Recommended fix:** Call `clearGroupProfiles` on group leave; add periodic cleanup.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 7.5 Document search has no non-vector fallback
- **Severity:** Medium
- **What is wrong:** `searchDocuments` returns `[]` if Upstash Vector is not configured or fails. Unlike `searchArchive`, there is no substring fallback.
- **Recommended fix:** Add Redis substring fallback over indexed document metadata.
- **Estimated effort:** 1 day
- **Blocks production:** No

#### 7.6 Archive vector search uses metadata only
- **Severity:** Medium
- **What is wrong:** `searchArchive` reconstructs results from vector metadata instead of loading Redis entries. `fromTs`/`toTs` are set to `md.ts ?? 0`.
- **Recommended fix:** After vector hits, load matching Redis entries by `archiveId`.
- **Estimated effort:** 2 hours
- **Blocks production:** No

---

### 8. AI / Tooling

#### 8.1 Auto fact-extraction disabled
- **Severity:** Critical
- See Functional 1.1.

#### 8.2 Multi-step path ignores context
- **Severity:** Critical
- See Functional 1.2.

#### 8.3 System prompt can explode in size
- **Severity:** High
- **What is wrong:** `BASE_PERSONALITY` (~5 KB) + up to 30 facts (~6 KB) + 35 turns + tool schemas (~15–25 KB) + group/media context. A single turn can present 20–30 KB of prompt text.
- **Why it matters:** Input token cost dominates. At scale this is unsustainable.
- **Recommended fix:** Compress tool descriptions, reduce fact limits, summarize history more aggressively.
- **Estimated effort:** 3 days
- **Blocks production:** Yes

#### 8.4 System prompt contains contradictory memory instruction
- **Severity:** Medium
- **What is wrong:** `BASE_PERSONALITY` says "Never answer stateful questions from memory/history" and two lines later says "Specific memory questions … answer directly from the stored facts above."
- **Why it matters:** Models are sensitive to contradictions; behavior varies by model version.
- **Recommended fix:** Rewrite as a single unambiguous rule.
- **Estimated effort:** 30 minutes
- **Blocks production:** No

#### 8.5 `timePrefix` injected as fake user/assistant exchange
- **Severity:** Medium
- **What is wrong:** `runMastraAgent` prepends time/accounts/media context as a `user` message followed by fake assistant "Got it."
- **Why it matters:** The model may treat context as a user request. It consumes message slots.
- **Recommended fix:** Move context into system prompt or a dedicated `system` message.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 8.6 Group chat context lacks token budget and current-speaker prefix
- **Severity:** Medium
- **What is wrong:** `groupContextForPrompt` always loads up to 20 group turns with no token cap. The current user message is appended without a speaker prefix.
- **Recommended fix:** Cap group context by tokens; prefix current message with `[Speaker]:` in group mode.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 8.7 `processResult` error override can false-positive on paraphrases
- **Severity:** Medium
- **What is wrong:** Override checks if the error text is fully contained in `modelText`. If the model paraphrases slightly, the override fires and replaces a good reply with raw tool error.
- **Recommended fix:** Use semantic overlap or require explicit error acknowledgment.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 8.8 Tier-health circuit breaker is dead code
- **Severity:** Medium
- **What is wrong:** `lib/llm/health.ts` exports `markTierDown`/`isTierDown`, but nothing calls `markTierDown`.
- **Why it matters:** AGENTS.md implies a 60s "Gemini down" marker after quota errors. In reality there is no circuit breaker.
- **Recommended fix:** Call `markTierDown("free", 60)` in quota fallback path, or delete the module and update docs.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 8.9 `alwaysWithStagedMedia` flag name contradicts behavior
- **Severity:** Low
- **What is wrong:** The comment says "include even when hasStagedMedia is false", but the code skips the tool when no media is staged.
- **Recommended fix:** Rename to `requiresStagedMedia` and fix comment.
- **Estimated effort:** 5 minutes
- **Blocks production:** No

#### 8.10 Tool registry cache key does not include active account
- **Severity:** Low
- **What is wrong:** The 5-minute tool cache key does not include `activeEmail`.
- **Why it matters:** Switching Google accounts will not invalidate the tool cache for 5 minutes.
- **Recommended fix:** Add `activeEmail` to cache key.
- **Estimated effort:** 5 minutes
- **Blocks production:** No

---

### 9. Developer Experience

#### 9.1 Duplicate marketing Vite app
- **Severity:** Medium
- **What is wrong:** `marketing/` contains a separate React 18 Vite app mirroring the Next.js app, with its own `node_modules`.
- **Why it matters:** Version drift, duplicate installs, maintenance burden.
- **Recommended fix:** Delete or integrate into npm workspace.
- **Estimated effort:** 1 day
- **Blocks production:** No

#### 9.2 Marketing subproject not in workspace
- **Severity:** Medium
- See 9.1.

#### 9.3 `lib/llm/` overloaded with product concerns
- **Severity:** Medium
- **What is wrong:** `briefing.ts`, `evening-summary.ts`, `agent-flex.ts` are product/orchestration concerns, not LLM-provider concerns.
- **Recommended fix:** Create `lib/orchestration/` and move product logic there.
- **Estimated effort:** 2 days
- **Blocks production:** No

#### 9.4 `lib/i18n.ts` is not real i18n
- **Severity:** Low
- **What is wrong:** File contains only hardcoded English/Thai UI strings. Not a catalog system.
- **Recommended fix:** Rename to `lib/ui-strings.ts` or adopt `next-intl`.
- **Estimated effort:** 1 day
- **Blocks production:** No

#### 9.5 Repo hygiene issues
- **Severity:** Low-Medium
- **What is wrong:** `coverage/` untracked, `.DS_Store` files, `for_video/` raw assets in repo, `public/screenshots/` symlinks.
- **Recommended fix:** Add `coverage/` and `.DS_Store` to `.gitignore`; move `for_video/` to cloud storage; remove symlinks.
- **Estimated effort:** 2 hours
- **Blocks production:** No

#### 9.6 CI lacks lint, audit, coverage gates
- **Severity:** Medium
- See Code Quality 4.12 and 4.10.

#### 9.7 Environment setup contradictions
- **Severity:** Low
- **What is wrong:** `.env.example` says `AI_GATEWAY_API_KEY` is recommended; `lib/env.ts` says it is legacy fallback.
- **Recommended fix:** Pick one narrative and update both files.
- **Estimated effort:** 15 minutes
- **Blocks production:** No

---

## Top 20 Issues That Would Have the Biggest Impact If Fixed

| # | Issue | Severity | Why It Matters | Effort |
|---|---|---|---|---|
| 1 | Cron sweep is O(users) | Critical | Will fail as soon as user registry grows past a few hundred. | 1 week |
| 2 | Auto fact-extraction is dead code | Critical | The bot forgets almost everything. "Personal assistant" is broken. | 1 day |
| 3 | Multi-step path ignores facts/persona/context | Critical | Two assistants with different memories; inconsistent replies. | 1 week |
| 4 | Dashboard settings has no input validation | Critical | Users can corrupt their own state. | 1 day |
| 5 | Marketing page presents fabricated data | Critical | Legal/trust risk; looks like a scam. | 1 day |
| 6 | No per-turn token/cost budget | Critical | Runaway Gemini costs at scale. | 1 week |
| 7 | Mobile navigation broken on landing + dashboard | Critical | LINE is mobile-first; users cannot navigate. | 1 day |
| 8 | Dashboard save failures are silent | Critical | Users believe settings saved when they are not. | 1–2 days |
| 9 | Dev-chat allows any userId when DEV_LINE_USER_ID unset | Critical | Full impersonation backdoor if secret leaks. | 15 min |
| 10 | `OAUTH_STATE_SECRET` reused across contexts | Critical | Key reuse breaks separation of privileges. | 1 day |
| 11 | No error/loading/not-found boundaries | Critical | Any error hangs or shows generic UI. | 1 day |
| 12 | `maxSteps: 8` × full tool registry explodes tokens | High | Unsustainable cost and latency. | 1 day |
| 13 | Agent timeout does not abort Gemini call | High | Users see timeout but billing continues. | 4 hours |
| 14 | Morning briefing makes 51 Gmail calls/user | High | API quota and latency bomb at scale. | 2 days |
| 15 | No Google API caching | High | Re-reads dominate cost and latency. | 3 days |
| 16 | Tasks/facts read-modify-write races | High | Silent data loss under concurrency. | 1 week |
| 17 | Webhook bundle bloat | High | Cold starts hurt user experience. | 3–5 days |
| 18 | Marketing page is client-rendered giant component | High | SEO and Core Web Vitals suffer. | 2–3 days |
| 19 | Core Google/tool modules have ~0–10% test coverage | High | No safety net for most failure-prone code. | 2–4 weeks |
| 20 | Inconsistent error contract (throws vs returns) | High | Silent failures and 500s. | 2 weeks |

---

## Quick Wins (Under 30 Minutes Each)

1. **Add `coverage/` and `.DS_Store` to `.gitignore`.**
2. **Require `DEV_LINE_USER_ID` in dev-chat endpoint.**
3. **Add `jose` to `package.json` dependencies.**
4. **Fix `alwaysWithStagedMedia` rename/comment.**
5. **Add `activeEmail` to tool cache key.**
6. **Fix `fallbackWeather` default location.**
7. **Expand Thai affirmative classifier.**
8. **Fix contradictory memory instruction in system prompt.**
9. **Fix README rate-limit claim (30/hr → 500/hr).**
10. **Fix README `CLAUDE.md` → `AGENTS.md` link.**
11. **Add lint step to CI.**
12. **Normalize `APP_BASE_URL` trailing slash in QStash verifier.**
13. **Validate dashboard facts category against `FACT_CATEGORIES`.**
14. **Move `/signup` plan validation to strict allowlist or Stripe fetch.**
15. **Add `public/og.png` or remove broken OpenGraph reference.**
16. **Remove `// @ts-nocheck` from `app/page.tsx` and fix errors.**
17. **Run `npm audit fix`.**
18. **Fix `extractStructuredDocument` empty-result caching.**
19. **Fix `localTimeToUtcCron` if still half-hour offset issues remain.**
20. **Add `claimPushLock` inside `runSweepForUser` for briefing dedup.**

---

## High ROI Improvements

1. **Paginate the cron sweep.** Biggest scalability win. Use Redis to track batch cursor and chain QStash jobs.
2. **Add Google API read caching.** Dramatically reduces cost and latency for briefings and repeated queries.
3. **Reduce `maxSteps` and add per-turn token budget.** Immediate cost control.
4. **Rewire auto fact-extraction to Redis history.** Restores a core product promise.
5. **Add strict Zod validation to dashboard APIs.** Prevents a whole class of self-inflicted state corruption.
6. **Split the webhook into a thin dispatcher + dynamic imports.** Improves cold starts and maintainability.
7. **Extract shared briefing send helpers.** Eliminates duplication and reduces regression risk.
8. **Add error/loading/not-found boundaries across `app/`.** Prevents hangs and improves UX.
9. **Refactor tasks/facts to Redis Hash / atomic operations.** Fixes concurrency and scalability.
10. **Add tests for Google tools, Drive, email, calendar, reminders.** The highest-risk code has the least coverage.
11. **Adopt structured logging with PII redaction.** Operations will be impossible at scale without this.
12. **Remove fake marketing data or wire to real data.** Trust is the foundation of conversion.

---

## Final Verdict: Would I Personally Ship This to Production Today?

**No. Not to thousands of users. Not without fixing the production blockers first.**

I would ship it to a **small private beta of known users** (tens, maybe low hundreds) because the core LINE webhook, OAuth, encryption, and allowlist are solid. The bot will work and delight users who understand it is early.

But I would not put it in front of thousands of paying customers or public marketing traffic today because:

1. **The product promise is broken in a silent way.** Auto-memory is disabled but the docs say it works. Users will expect the bot to remember things it does not.
2. **The dashboard can corrupt user state.** A settings API with no validation is unacceptable for a production product.
3. **The marketing page lies.** Fabricated metrics and testimonials are a legal and reputational time bomb.
4. **It will become expensive and slow.** Uncapped tokens, uncached Google APIs, O(users) sweep, and 51 Gmail calls per briefing will explode costs as users grow.
5. **Mobile and accessibility are broken.** A LINE bot without working mobile navigation and focus management is not launchable.
6. **Security has rough edges.** Key reuse, a conditional dev-chat guard, and dashboard validation gaps are fixable but must be fixed before broad exposure.

The good news: the blockers are known, the architecture is fundamentally sound, and the team has already shown they can fix hard audit findings. **This is a 4–6 week hardening project away from being shippable**, not a rebuild. The highest-leverage fixes are the cron sweep pagination, dashboard validation, memory rewiring, and cost controls.

---

## Suggested First Two Sprints

### Sprint 1: Production Blockers
- Fix dashboard settings validation.
- Fix dev-chat fail-closed behavior and rate limiting.
- Separate `OAUTH_STATE_SECRET` use.
- Rewire auto fact-extraction.
- Remove or replace fake marketing data.
- Add error/loading/not-found boundaries.
- Fix mobile navigation.
- Run `npm audit fix`.

### Sprint 2: Scale & Cost
- Paginate cron sweep.
- Add Google API caching.
- Reduce `maxSteps` and add token budget.
- Refactor tasks/facts storage.
- Add structured logging.
- Begin adding tests for core Google tools.

After these two sprints, the application would be in a much stronger position for a controlled public launch.
