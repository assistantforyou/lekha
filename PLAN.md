# Operation Tune-Up — Architecture Plan

Branch: `feat/operation-tune-up`
Owner: James
Status: in progress

## Scope

Rework areas — do NOT preserve existing CLAUDE.md decisions in these zones:

- **A. Rate limit**: 30/hr/user → 500/hr/user (paid Gemini tier removes the original concern; this is now LINE push quota + abuse defense at 100+ user scale)
- **B. Conditional tool registry**: Skip Google-dependent tools and their prompt blurbs for users without OAuth; save ~2K tokens/request
- **C. Tool timeouts**: finance 3s → 12s, weather similar bump (don't slow Open-Meteo fallback), Gemini call 20s → 30s. Keep `stepCountIs(8)` cap.
- **D. Self-serve signup + approval queue**: Pending users land in `users:pending`; admin commands `/pending`, `/approve`, `/deny`
- **E. LINE Flex Messages**: New `lib/line/flex/` module with templates for confirm/cancel, draft email, draft calendar, task list, reminder confirm, weather, briefings. Postback routing in webhook.
- **F. Memory overhaul**:
  - F1: Structured fact schema (Redis hash `user:{userId}:facts:v2`, categorized, capped at 200, LRU)
  - F2: Upstash Vector for archive semantic search; substring fallback
  - F3: History summarization by token count (>3K tokens → compress oldest 10 turns to 200-token block)

Per James, dev environment: it's OK to wipe `user:*:facts` (old text-blob) and existing archive entries on F1/F2 deploy. Preserve: settings, tasks, reminders, allowlist, sent log, OAuth tokens, recent-media.

## Decisions (overrides to CLAUDE.md)

| CLAUDE.md decision | Change |
|---|---|
| #10 rate limit 30/hr | 500/hr (paid tier absorbs the burst; still abuse-bound) |
| #12 no vectors | REVERSE — Upstash Vector for archive; substring fallback |
| #15 allowlist | Extend with self-serve pending queue + approve/deny flow |

## Env vars added

- `UPSTASH_VECTOR_REST_URL`
- `UPSTASH_VECTOR_REST_TOKEN`

## Manual prereqs (James to do)

- Create Upstash Vector index manually in Upstash console. Set dimension to **768** (Gemini `text-embedding-004` output dim). Cosine similarity metric.
- Add `UPSTASH_VECTOR_REST_*` env vars to Vercel project (Production + Preview).
- LINE paid push plan when user count exceeds free push quota (currently 500/mo on free LINE Messaging API).

## Migration strategy

- **F1 facts**: New write path uses `user:{userId}:facts:v2` hash. Old `user:{userId}:facts` key NOT deleted in same release (read-fallback for safety). Per James's note we can wipe old keys after one release.
- **F2 archive**: New writes embed + upsert to Vector. Lazy backfill on first read for users with pre-existing archive entries (background, non-blocking). Substring search remains as fallback when Vector unavailable.
- **F3 history**: Backward compatible — reads still pull the 20-turn rolling list; prompt assembly is the only change point.

## Rollback plan

- Each task is its own commit (or small set of commits). To roll back any single task, `git revert <sha>`.
- Memory schema additions are additive — old keys remain readable.
- Postback handlers are additive — old text flows still work.
- Vector outage → substring fallback path covers `search_archived_memory`.

## Gemini call timeout vs agent loop budget

- Gemini call timeout: in `lib/llm/agent.ts` (was 20s in CLAUDE.md decision #16). Will bump to 30s.
- Agent loop budget: `stepCountIs(8)` in `generateText` call — caps total reasoning steps. Stays at 8.
- Vercel Fluid Compute function budget: ~300s. Plenty of headroom.

## Open PRs to watch for conflicts

- #14: Gemini caching → touches `lib/tools/index.ts`, `lib/llm/prompts.ts`
- #13: Gemini-only agent → touches `lib/llm/agent.ts`, `app/api/line/webhook/route.ts`
- #10: Content library → touches `lib/tools/index.ts`, `lib/llm/agent.ts`, `lib/llm/prompts.ts`

Strategy: don't block on these. Land Tune-Up on `main`; if any of these PRs merges first, they'll need a rebase — James decides priority.
