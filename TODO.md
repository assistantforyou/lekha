# Operation Tune-Up — TODO

**Branch**: feat/operation-tune-up (PR #21)
**Owners**: James (primary), [friend] (handoff if James runs out of tokens)
**Last updated**: 2026-05-22T09:37Z
**Current focus**: Task E foundation landed; remaining E templates + F1/F2/F3 pending

## In progress
- [ ] (none — stopped at a clean checkpoint)

## Up next (in order)
- [ ] **E.rest** — remaining Flex templates + tool integrations:
  - [ ] `lib/line/flex/draft-email-preview.ts` + flex variant of `renderDraftsBlock` for email drafts
  - [ ] `lib/line/flex/draft-calendar-preview.ts` + flex variant for calendar drafts
  - [ ] `lib/line/flex/task-list.ts` + postback verb `task` (done/reopen) handler wiring
  - [ ] `lib/line/flex/reminder-confirm.ts` — show flex confirm only when reminder >24h out
  - [ ] `lib/line/flex/weather.ts` — current + 3-day carousel; wire into morning-briefing
  - [ ] `lib/line/flex/morning-briefing.ts` and `evening-summary.ts` — multi-section bubbles
  - [ ] New tool `lib/tools/contacts.ts` `contacts_remember` (creates Google People contact); register in `lib/tools/index.ts` gated on `userHasGoogle`
  - [ ] Postback idempotency: `postback_seen:{eventId}` NX TTL key
  - [ ] Snapshot tests for each new template
- [ ] **F1** — Structured facts schema (`user:{userId}:facts:v2` hash, `Fact` type with category/timestamps, LRU 200 cap). Rewrite `lib/memory/facts.ts`, `lib/llm/extract-facts.ts`, fact tools in `lib/tools/memory.ts`. Dev env: OK to wipe old `user:*:facts` keys per James. Vitest round-trip + LRU.
- [ ] **F3** — History token-cap summarization. `lib/memory/history.ts` add `historyForPrompt(userId)` — if est tokens >3000, compress oldest 10 turns to 200-token summary block via Flash Lite, cache, prepend. Swap call sites in webhook + dev/chat.
- [ ] **F2** — Upstash Vector for archive (requires James to create Vector index manually, dim 768, cosine). `lib/env.ts` adds `UPSTASH_VECTOR_REST_URL`/`_TOKEN` + `hasUpstashVector()`. `lib/memory/archive.ts` embeds via `text-embedding-004`, upserts. `search_archived_memory` does vector search; substring fallback when Vector unavailable. Per James: wipe existing archive entries.
- [ ] **CLAUDE.md sweep** — update decisions #10 (500/hr), #12 (REVERSE — vector), #15 (pending queue), #16 (60s timeout); add new decision on conditional tool registry.
- [ ] Smoke tests via `/api/dev/chat` against preview deployment.
- [ ] Final merge `feat/operation-tune-up` → `main`.

## Done
- [x] Branch + baseline typecheck clean
- [x] PLAN.md + TODO.md skeleton
- [x] Task A: rate limit 30 → 500 (`lib/ratelimit.ts`)
- [x] Task C: tool timeouts — finance 3s→12s, weather default 4s→12s, Gemini 45s→60s in agent.ts and webhook (2 sites)
- [x] Task B: conditional tool registry — `toolsForUser` now async, Google tools gated on per-user `listAccounts`. Connect-account tool still exposed.
- [x] Task D: self-serve signup + approval queue. `users:pending` set + `pending:{userId}` hash; `/pending`, `/approve <id>`, `/deny <id>` admin commands; rate-limited admin notification on new request. 8 vitest tests with in-memory Redis mock.
- [x] **Task E (foundation)** — landed in commit:
  - `lib/line/client.ts` — added `FlexMessage` to the `LineMessage` union
  - `lib/line/flex/confirm-cancel.ts` — first flex template, two postback buttons (`confirm:yes` / `confirm:no`)
  - `lib/line/flex/index.ts` — barrel + `parsePostbackData(data)` helper
  - `lib/line/types.ts` — added `PostbackEvent` zod schema to `LineEvent` union
  - `app/api/line/webhook/route.ts` — postback event branch with confirm verb wired to `executePendingAll`/`clearPending`; `enrichReply` now returns flex for draft confirmation (text path is altText fallback)
  - `tests/flex.test.ts` — 8 tests covering altText, body truncation, postback wiring, custom labels, and `parsePostbackData`

## Blocked / questions for James
- F2 requires manual Upstash Vector index creation (dim 768, cosine). See PLAN.md.
- Open PRs #14, #13, #10 will conflict with `lib/tools/index.ts`, `lib/llm/agent.ts`, `lib/llm/prompts.ts`, `app/api/line/webhook/route.ts`. Decide rebase priority.

## Files touched (this branch so far)
- `PLAN.md` (new)
- `TODO.md` (new — this file)
- `lib/ratelimit.ts` — 30 → 500
- `lib/tools/finance.ts` — TIMEOUT_MS 3000 → 12000
- `lib/tools/weather.ts` — fetchJSON default 4000 → 12000
- `lib/llm/agent.ts` — withTimeout 45000 → 60000; `await toolsForUser`
- `app/api/line/webhook/route.ts` — withTimeout 45000 → 60000 (x2); `await toolsForUser`; pending queue gate; admin commands; postback event branch; flex confirm via `enrichReply`
- `lib/tools/index.ts` — `toolsForUser` now async; per-user Google gating via `listAccounts`
- `lib/memory/allowlist.ts` — pending queue functions
- `lib/line/client.ts` — `FlexMessage` added to union
- `lib/line/flex/confirm-cancel.ts` (new)
- `lib/line/flex/index.ts` (new)
- `lib/line/types.ts` — `PostbackEvent`
- `tests/allowlist.test.ts` (new)
- `tests/flex.test.ts` (new)

## Handoff notes

**Where I stopped:** Task E foundation is shippable on its own — draft confirmations now render as a Flex bubble with tap-to-confirm postback buttons. Tasks A/B/C/D fully done with tests + typecheck clean. 97 tests passing.

**Concrete next step:** Build `lib/line/flex/draft-email-preview.ts`. It should accept the parsed email draft (look at `lib/confirm.ts` `SendEmailAction` for shape) and render a bubble with To/CC/BCC/Subject/Body preview + three buttons: Send (`draft:send:<idx>`), Edit (`draft:edit:<idx>`), Cancel (`draft:cancel:<idx>`). Then add a `draft` verb branch in the webhook's postback handler (around `app/api/line/webhook/route.ts` line 195 where `confirm` is handled).

**Where to integrate flex drafts:** the existing rendering happens in `lib/llm/render-drafts.ts:renderDraftsBlock`. Add a `renderDraftsFlex(allCalls, activeEmail)` parallel function returning `FlexMessage[]` (one bubble per draft, plus the existing summary text as altText). Call site is in webhook around line 500 (`enrichReply`) and `lib/llm/agent.ts:148,296`.

**Watch out for:** the `replyText` carries the canonical text. Don't lose the text path — flex is additive, altText must be meaningful. Postback `data` capped at 300 chars (use indices, not full content). LINE Flex JSON has a 50KB max payload; truncate long bodies.

**Memory rework (F1/F2/F3):** start with F1 because F2 and F3 depend on the new fact/archive structures being settled. Per James, wiping old `user:*:facts` and old archive keys is fine — dev env.

**Don't touch:** Gemini system prompt staticness (preserves implicit cache; PR #14 strategy), cron sweep schedule ID, postback payload size cap.

## CLAUDE.md updates pending
- [ ] Decision #10 (rate limit) — revise to 500/hr/user
- [ ] Decision #12 (no vectors) — REVERSE: Upstash Vector for archive
- [ ] Decision #15 (allowlist) — extend with self-serve pending queue + `/pending`/`/approve`/`/deny`
- [ ] Decision #16 (Gemini timeout) — bump to 60s (was 20s in doc, 45s in code)
- [ ] Add new decision: conditional tool registry per-user OAuth gating in `toolsForUser`
- [ ] Add postback routing convention to "Conventions" section
