# Operation Tune-Up — TODO

**Branch**: feat/operation-tune-up
**Owners**: James (primary), [friend] (handoff if James runs out of tokens)
**Last updated**: 2026-05-22T00:00:00Z (session start)
**Current focus**: Setup + Task A (rate limit)

## In progress
- [ ] Task A: rate limit 30 → 500

## Up next (in order)
- [ ] Task C: tool timeouts (finance/weather 12s, Gemini 30s)
- [ ] Task B: conditional tool registry (Google tools gated on OAuth connection)
- [ ] Task D: self-serve signup + approval queue + admin commands + tests
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

## Blocked / questions for James
- None yet. F2 will block on Upstash Vector index creation (manual, James).

## Files touched
- `PLAN.md` — architecture record (new)
- `TODO.md` — this file (new)

## Handoff notes
Branch `feat/operation-tune-up` created from `main` (commit 080b961). Baseline typecheck clean.
PRs #14, #13, #10 are in flight and touch overlapping files (`lib/tools/index.ts`, `lib/llm/agent.ts`, `lib/llm/prompts.ts`). Be prepared to rebase if any of those merge first.
Next concrete step: edit `lib/ratelimit.ts:11` — change `30` to `500` and update the comment.

## CLAUDE.md updates pending
- [ ] Decision #10 (rate limit) — revise to 500/hr/user with new justification
- [ ] Decision #12 (no vectors) — REVERSE: add Upstash Vector for archive
- [ ] Decision #15 (allowlist) — extend with self-serve approval queue
- [ ] Decision #16 (Gemini 20s timeout) — bump to 30s
- [ ] Add new decision: conditional tool registry gating on OAuth connection
