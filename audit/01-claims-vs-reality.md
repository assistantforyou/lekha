# Audit: Claims vs Reality

| Claim | Source | File:line | Status | Notes |
|-------|--------|-----------|--------|-------|
| "13 tools, gated on env" | README architecture diagram | `lib/tools/index.ts:29-53` | ❌ false | Registry has **51 tools** across 21 categories. The "13" was accurate at some earlier version but the diagram is stale. |
| `stopWhen: stepCountIs(8)` | README architecture diagram | `app/api/line/webhook/route.ts:719` | ❌ false | Code uses `stepCountIs(8)` for Gemini. README says 3. |
| "Public by design — every LINE user who adds the bot gets isolated memory" | README intro | `app/api/line/webhook/route.ts:79-94` | ❌ false | Bot is **allowlist-gated** (CLAUDE.md is correct). When `ADMIN_LINE_USER_ID` is set, non-admin users must be in `users:allowed` set. Note: if `ADMIN_LINE_USER_ID` is NOT set, `adminIds.size === 0` and the gate is skipped entirely — all users pass. |
| "Per-user sliding-window rate limit (30/hr) via @upstash/ratelimit" | README security table | `lib/ratelimit.ts:9` | ✅ matches | `Ratelimit.slidingWindow(30, "1 h")` confirmed. |
| "Refresh tokens at rest: AES-256-GCM with TOKEN_ENCRYPTION_KEY (32 bytes)" | README security table | `lib/memory/crypto.ts:4,11-17` | ✅ matches | AES-256-GCM, 12-byte random IV, auth tag verified on decrypt. Key validated to 64 hex chars (32 bytes) in env.ts. |
| "webhookEventId dedup for 10 min" | README security table | `app/api/line/webhook/route.ts:73` | ✅ matches | `set(seenKey, 1, { ex: 60 * 10, nx: true })` — 10-min TTL, NX prevents double-set. |
| "pending queue, atomic RPUSH, TTL 5 min" | README / CLAUDE.md | `lib/confirm.ts:50-53` | ✅ matches | `tx.rpush(k, JSON.stringify(action)); tx.expire(k, TTL_SEC)` where `TTL_SEC = 5 * 60`. |
| "OAuth state CSRF: signed HMAC + server-side nonce in Redis with 10-min TTL, single-use" | README security table | `lib/tools/google-auth.ts:83-93,103` | ✅ matches | Nonce stored with `ex: 600`, consumed via `getdel` (atomic). |
| "Reminders fire route verifies QStash signature via @upstash/qstash Receiver" | CLAUDE.md / README | `app/api/reminders/fire/route.ts:27-40` | ✅ matches | `Receiver.verify()` called before any work. Returns 401 on failure. |
| "After successful send, staged list is cleared" | README attachment section | `lib/tools/email.ts:186` | ✅ matches | `clearRecentMedia(userId)` called only when `usedRecentMedia === true` and no throw. If send fails or throws, staged list is preserved. |
| "Connect-link token: signed HMAC, single-use, 10-min TTL" | README / CLAUDE.md | `lib/tools/google-auth.ts:57-79` | ✅ matches | HMAC signed, Redis marker consumed via `getdel` atomically. `expiresAt` enforced at verify time. |
| "Each event de-duped by webhookEventId before any side effects" | CLAUDE.md pitfall | `app/api/line/webhook/route.ts:71-75` | ✅ matches | Dedup check is the first thing inside `handleEvent`, before allowlist, rate-limit, and LLM. |
| "Per-user state isolation — all Redis keys keyed by userId" | CLAUDE.md | All `lib/memory/*.ts` | ✅ matches | Confirmed across all Redis key functions. userId always comes from verified webhook source, not tool args. |
| "Fact extraction every 10th turn" | CLAUDE.md / README | `app/api/line/webhook/route.ts:930-938` | ✅ matches | `turnCounter(userId) % 10 === 0`. But: turn counter is loaded AFTER history was already fetched, so the current turn is not included in the extraction. Minor inconsistency. |
| "Archive capped at 200 chunks" | CLAUDE.md | `lib/memory/archive.ts:14,20` | ✅ matches | `MAX = 200`, `tx.ltrim(k, -MAX, -1)` — FIFO eviction (oldest dropped). |
| "Reminders are NOT gated — set_reminder schedules immediately" | README confirmation-gate section | `lib/tools/reminders.ts:45-81` | ✅ matches | No `appendPending` call; QStash publish happens directly in `execute`. |
| "Gemini down-marking for 60s after quota error" | CLAUDE.md | `app/api/line/webhook/route.ts:775`, `lib/llm/health.ts` | ✅ matches | `markGeminiDown(60)` on quota/timeout, `isGeminiDown()` checked at cascade start. |
| "cascade dedup via geminiRanToolCalls" | CLAUDE.md | `app/api/line/webhook/route.ts:698-737` | ✅ matches | `geminiRanToolCalls` set in `onStepFinish` when Gemini calls tools. If Gemini timed out after calling tools, cascade is skipped. |
| "schedule_email does NOT go through confirmation gate" | Not documented | `lib/tools/scheduled-email.ts:41-67` | 🔍 unverifiable in README | `schedule_email` schedules directly via QStash without `appendPending`. No YES/NO confirmation. Draft block is never rendered for scheduled emails. README says "schedule_email" under email tools but doesn't mention it bypasses the gate. P2 gap. |
| "VERBOSE DEBUG MODE — revert when stable" comment | Code comment | `app/api/line/webhook/route.ts:621-622` | ❌ false | Comment says to revert; raw error chain with stack traces and API responses is currently surfaced to LINE users in production. |
| "LLM cascade: Gemini primary (12s timeout)" | CLAUDE.md | `app/api/line/webhook/route.ts:763` | ⚠️ partial | Timeout is 20s (`withTimeout(..., 20_000)`), not 12s as CLAUDE.md claims. |

| "Pending action TTL 5 min — reply token lives ~1 min" | CLAUDE.md pitfall on TTL drift | `lib/confirm.ts:3` | ✅ noted correctly as a pitfall | The gap exists by design. After YES, pending is executed and reply token is used. If YES comes after 5 min, pending is expired and user gets "Nothing to confirm." |
| "OAuth tokens encrypted at rest" | CLAUDE.md | `lib/tools/google-auth.ts:126` | ✅ matches | `redis().set(tokensKey(...), encrypt(JSON.stringify(toStore)))`. Token is decrypted on read. |

| "Health endpoint actually checks dependencies" | Implied by /health | `app/api/health/route.ts:6-8` | ❌ false | Returns `{ok: true, ts}` with no Redis ping, no LINE check, no env validation. |
| "render-drafts shows times in user's timezone" | Implied | `lib/llm/render-drafts.ts:7` | ❌ false | Hardcoded `DISPLAY_TZ = "Asia/Bangkok"`. All draft times shown in Bangkok regardless of user's configured timezone. |
| "enable_morning_briefing preserves existing inbox setting" | Implied | `lib/tools/settings.ts:66-74` | ❌ false | Schema defaults `include_inbox: z.boolean().default(false)`. Calling `enable_morning_briefing` when inbox was already enabled (via migration defaults) will reset it to false. |

---

## Summary counts

| Status | Count |
|--------|-------|
| ✅ matches | 15 |
| ⚠️ partial | 2 |
| ❌ false | 7 |
| 🔍 unverifiable without runtime | 1 |
