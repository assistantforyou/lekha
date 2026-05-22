# Operation Tune-Up — TODO

**Branch**: feat/operation-tune-up
**Owners**: James (primary), [friend] (handoff if James runs out of tokens)
**Last updated**: 2026-05-22T09:33Z
**Current focus**: Task E (Flex messages)

## In progress
- [ ] Task E: LINE Flex Messages (start with confirm/cancel; postback routing; contacts_remember)

## Up next (in order)
- [ ] Task E: LINE Flex Messages (start with confirm/cancel; then drafts; then everything) + postback handler + contacts_remember tool
- [ ] Task F1: structured facts schema
- [ ] Task F3: history summarization by token count
- [ ] Task F2: Upstash Vector for archive (requires manual index creation)
- [ ] CLAUDE.md sweep
- [ ] Smoke tests via /api/dev/chat
- [ ] Final merge to main

## Done
- [x] Branch + baseline typecheck clean
- [x] PLAN.md + TODO.md skeleton
- [x] Task A: rate limit 30 → 500 (`lib/ratelimit.ts`)
- [x] Task C: tool timeouts — finance 3s→12s, weather default 4s→12s, Gemini 45s→60s in agent.ts and webhook (2 sites)
- [x] Task B: conditional tool registry — `toolsForUser` now async, Google tools gated on per-user `listAccounts` rather than just env presence. Connect-account tool still exposed so model can offer setup.
- [x] Task D: self-serve signup + approval queue. Webhook gate now adds non-allowed users to `users:pending` with profile/message metadata; admin commands `/pending`, `/approve <id>`, `/deny <id>` added. Admin notification rate-limited 1/min/user. 8 new vitest tests cover all paths.

## Blocked / questions for James
- None yet. F2 will block on Upstash Vector index creation (manual, James).

## Files touched
- `PLAN.md` — architecture record (new)
- `TODO.md` — this file (new)
- `lib/ratelimit.ts` — 30 → 500 sliding window
- `lib/tools/finance.ts` — TIMEOUT_MS 3000 → 12000
- `lib/tools/weather.ts` — fetchJSON default 4000 → 12000
- `lib/llm/agent.ts` — withTimeout 45000 → 60000; `toolsForUser` awaited
- `app/api/line/webhook/route.ts` — withTimeout 45000 → 60000 (x2); `toolsForUser` awaited
- `lib/tools/index.ts` — `toolsForUser` now async; per-user Google gating via `listAccounts`

## Handoff notes
Tasks A, B, C done in commit-batch 1. All 81 vitest tests pass; typecheck clean.
Note on Task C: CLAUDE.md decision #16 said 20s Gemini timeout but actual code was 45s. Bumped to 60s to match spirit of "more headroom".
Note on Task B: kept system prompt static (preserves Gemini implicit caching per PR #14). All Google tool gating is in the tool registry only.
PRs #14, #13, #10 in flight will conflict; James decides priority on rebase.
Next concrete step: design pending-allowlist gate in `app/api/line/webhook/route.ts` (find existing allowlist check) + add `users:pending` Redis set to `lib/memory/allowlist.ts`.

## CLAUDE.md updates pending
- [ ] Decision #10 (rate limit) — revise to 500/hr/user with new justification
- [ ] Decision #12 (no vectors) — REVERSE: add Upstash Vector for archive
- [ ] Decision #15 (allowlist) — extend with self-serve approval queue
- [ ] Decision #16 (Gemini 20s timeout) — bump to 30s
- [ ] Add new decision: conditional tool registry gating on OAuth connection
