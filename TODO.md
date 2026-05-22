# Operation Tune-Up — TODO

**Branch**: feat/operation-tune-up (PR #21)
**Last updated**: 2026-05-22T09:52Z
**Current focus**: Smoke tests + merge to main

## In progress
- [ ] Smoke tests via `/api/dev/chat` against the Vercel preview
- [ ] Final merge to main

## Up next (deferred, not blocking merge)
- [ ] **E.decorative** — remaining flex templates (draft-email-preview, draft-calendar-preview, reminder-confirm, weather, morning-briefing, evening-summary). The foundational Flex pieces and the two highest-UX templates (confirm/cancel, task-list) are shipped; these are decorative enhancements that can land as follow-up PRs.
- [ ] `draft:send/edit/cancel` and `reminder:cancel` postback verbs — wire when their templates land.

## Done
- [x] Branch + baseline typecheck clean
- [x] PLAN.md + TODO.md skeleton
- [x] **Task A**: rate limit 30 → 500 (`lib/ratelimit.ts`)
- [x] **Task C**: tool timeouts — finance 3s→12s, weather default 4s→12s, Gemini 45s→60s in `agent.ts` and webhook (2 sites)
- [x] **Task B**: conditional tool registry — `toolsForUser` async, Google tools gated on per-user `listAccounts`. Connect-account tool still exposed.
- [x] **Task D**: self-serve signup + approval queue. `users:pending` set + `pending:{userId}` hash; `/pending`, `/approve <id>`, `/deny <id>` admin commands; rate-limited admin notification. 8 vitest tests.
- [x] **Task E (foundation + tasks)**:
  - `lib/line/client.ts` — `FlexMessage` added to `LineMessage` union
  - `lib/line/flex/confirm-cancel.ts` — confirm/cancel bubble; postback verb `confirm`
  - `lib/line/flex/task-list.ts` — task rows w/ per-row Done/Reopen button; postback verb `task`
  - `lib/line/flex/index.ts` — barrel + `parsePostbackData` helper
  - `lib/line/types.ts` — `PostbackEvent` zod schema
  - `app/api/line/webhook/route.ts` — postback event branch with `confirm` + `task` verbs wired; `enrichReply` returns Flex for draft confirmation
  - `tests/flex.test.ts` — 11 tests covering templates + parser
- [x] **Task E.contacts**: `contacts_remember` tool re-added (`lib/tools/contacts.ts`); both `contacts_search` (Google People + Other Contacts) and `contacts_remember` (createContact) gated on `userHasGoogle`
- [x] **Task F1**: structured facts schema. `user:{userId}:facts:v2` JSON value; `Fact` type with `id`/`category`/`content`/`createdAt`/`updatedAt`/optional `confidence`; LRU at 200 cap. `factsToPromptBlock` groups by category. Extractor emits structured output via `generateObject` with category + confidence. Tools `remember`/`list_memories`/`update_memory`/`forget_memory`/`clear_all_memories` operate on display order. Old `user:{userId}:facts` key is lazily wiped on first read (dev env). 11 new vitest tests.
- [x] **Task F3**: history token-cap summarization. `historyForPrompt(userId)` — estimates tokens (chars/4); if >3000 it summarizes the oldest 10 turns to ~200 tokens via extractor model, caches by content hash 7d, prepends as synthetic earlier-conversation note + assistant "Noted." ack. Swapped at all call sites (webhook text path, image path, `/api/dev/chat`). 3 new unit tests.
- [x] **Task F2**: Upstash Vector for archive. `UPSTASH_VECTOR_REST_URL`/`_TOKEN` env vars + `hasUpstashVector()` helper. `lib/llm/provider.ts` adds `embeddingModel()` (Gemini `text-embedding-004`, dim 768). On `appendArchive`, embed and upsert with `{ userId, archiveId, ts, summary }` metadata. On `searchArchive`, embed query and run top-10 cosine similarity filtered by userId; map hits to ArchivedSummary; substring fallback on Vector unavailability or zero hits. `@upstash/vector` dep added. **James action: create Upstash Vector index manually — dim 768, cosine — then add the two env vars to Vercel.**
- [x] **CLAUDE.md sweep**: decisions #10, #12, #15, #16 updated. New decisions #18 (conditional tool registry), #19 (structured facts + token-bounded history), #20 (Flex Messages + postback routing). Stack table updated with embeddings + vector rows. Gotchas list extended with vector dim mismatch, postback `data` cap, Flex `altText` requirement.

## Blocked / questions for James
- **Manual prerequisite for F2:** create Upstash Vector index (dim 768, cosine), then add `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN` to Vercel (Production + Preview). Until that's done, `search_archived_memory` silently falls back to substring (no error path).
- Open PRs #14, #13, #10 will conflict on `lib/tools/index.ts`, `lib/llm/agent.ts`, `lib/llm/prompts.ts`, `app/api/line/webhook/route.ts`. Decide rebase priority before merging this one.

## Files touched (summary)
- New: `PLAN.md`, `TODO.md`, `lib/line/flex/{confirm-cancel,task-list,index}.ts`, `lib/tools/contacts.ts`, `tests/{allowlist,flex,facts,history}.test.ts`
- Rewritten: `lib/memory/{allowlist,facts,history,archive}.ts`, `lib/llm/extract-facts.ts`, `lib/tools/memory.ts`
- Edited: `lib/ratelimit.ts`, `lib/tools/{finance,weather,index}.ts`, `lib/llm/{agent,provider}.ts`, `lib/env.ts`, `lib/line/{client,types}.ts`, `app/api/line/webhook/route.ts`, `app/api/dev/chat/route.ts`, `lib/tools/export.ts`, `scripts/measure-prompt.ts`, `CLAUDE.md`, `package.json` (+ `@upstash/vector`)

## Handoff / smoke test plan

113 vitest tests pass; `npm run typecheck` clean.

To run smoke tests against the Vercel preview (auto-deployed for this branch):

```bash
# Confirm in LINE: send "yo" first to verify the bot still works
curl -s -X POST https://<preview-url>/api/dev/chat \
  -H "Content-Type: application/json" \
  -H "x-dev-secret: $(grep DEV_CHAT_SECRET .env.local | cut -d= -f2)" \
  -d "{\"userId\":\"$(grep DEV_LINE_USER_ID .env.local | cut -d= -f2)\",\"text\":\"yo\"}"
```

Tests to run (per James's spec):
1. `"remember my mom's email is mom@gmail.com"` → confirms; should call `contacts_remember`.
2. `"who do I have in my email contacts"` → lists via `contacts_search`.
3. `"email mom a quick note saying I'll be home for dinner tonight"` → draft email rendered as Flex confirm bubble in LINE; tap Yes/Cancel.
4. After 25+ unrelated turns, `"email mom about something"` → still finds the contact (proves durability beyond rolling history).
5. F1: `"what do you remember about me"` → list with `[idx] [category] content — relative time` shape.
6. F2: 20+ turns about "Phoenix" project, later `"what did we discuss about that bird-themed project"` → should hit via semantic search (assuming Upstash Vector index is configured).
7. F3: verify in `npx vercel logs` that the history block is compressed once token estimate exceeds 3000.

## CLAUDE.md updates pending
- [x] Decision #10 (rate limit) — done
- [x] Decision #12 (no vectors) — REVERSED, done
- [x] Decision #15 (allowlist) — extended, done
- [x] Decision #16 (Gemini timeout) — bumped to 60s, done
- [x] New decisions #18, #19, #20 — done
- [x] Stack table + Gotchas — done
