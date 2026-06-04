# Audit: Route Handlers

Legend: ✅ good | ⚠️ concern | ❌ bug

---

## `app/api/line/webhook/route.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Signature verified before any work | ✅ | `verifyLineSignature(raw, sig, ...)` runs before JSON parse at line 43. Returns 401 immediately on failure. |
| `after()` actually fires | ✅ | `after(async () => { for event of payload.events ... })` at line 56. Responds 200 before any real work. |
| `after()` callback error handling | ✅ | Each event is individually wrapped in `try/catch` (lines 58-62). A crashed event handler logs the error and continues to the next event. |
| If `after()` itself throws | ⚠️ | The per-event try/catch handles individual failures. But if `after()` scheduling itself fails (e.g., Next.js runtime doesn't support it), the response is already sent — user gets no notification. Not a code bug, but a runtime dependency. |
| Idempotency | ✅ | `seen:{webhookEventId}` NX key with 10-min TTL at line 72-74. First check inside `handleEvent` before allowlist or rate-limit. |
| Allowlist gate | ⚠️ | If `ADMIN_LINE_USER_ID` is not set, `adminIds.size === 0` at line 84 — gate is skipped entirely. All LINE users pass. Documented in CLAUDE.md but not validated at startup. |
| Rate-limit before LLM | ✅ | `checkRateLimit(userId)` in parallel preload at line 120. Returns 429-equivalent reply before any LLM call. |
| VERBOSE DEBUG MODE not reverted | ❌ | Lines 622-638: raw error chains including stack traces, API response bodies, and URLs are surfaced to LINE users in production. Comment reads "Revert when stable." Not reverted. |
| `stepCountIs` mismatch | ❌ | Code uses `stepCountIs(3)` at line 719. README/CLAUDE.md claims 8 steps. |

---

## `app/api/oauth/google/callback/route.ts`

| Check | Status | Notes |
|-------|--------|-------|
| OAuth state verified | ✅ | `completeOAuth(code, state)` at line 25 calls `redis().getdel(stateKey(state))` — atomic. Returns error if key missing/expired. |
| State nonce deleted after use | ✅ | `getdel` is atomic single-use. Replay of the same callback returns error. |
| Pending-action auto-resume wired up | ✅ | Lines 37-47: `getPending → executePendingAll → clearPending → push`. |
| `executePendingAll` failure leaves stale queue | ⚠️ | If `executePendingAll` throws, `clearPending` is never called (it's after the throw point, line 42). Pending queue remains. Next non-yes/no message in webhook clears it (webhook line 156), so it's self-healing on next user interaction — not data loss, but the user gets a confusing "run it?" prompt for a stale action. P2. |
| HTML response escapes user-controlled data | ✅ | `escapeHtml()` at line 93 escapes all injected content before HTML rendering. |
| Missing `clearPending` on error path | ⚠️ | Covered above — same issue restated. Stale pending + no push = silent drop after OAuth if auto-resume fails. P2. |

---

## `app/api/reminders/fire/route.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Signature verified before any work | ✅ | `receiver.verify()` at line 32-40. Returns 401 if missing or invalid. `hasQStash()` guard returns 503 before any env access if not configured. |
| Body parsed and validated after sig | ✅ | `Body.parse(JSON.parse(raw))` at line 44 — Zod schema. Returns 400 on bad body. |
| Replay-safe | ⚠️ | `consumeReminder` at line 49 does `get` then `del` non-atomically (`lib/tools/reminders.ts:179-181`). Two concurrent QStash retries can both read before either deletes → double push to user. P2. The correct fix is `GETDEL` (or a Lua script). |
| Reminder deleted before push | ⚠️ | `consumeReminder` deletes the Redis key before `push()` is called (line 55). If `push()` fails (LINE API down), the reminder is silently lost — user never gets the notification and the reminder can't be retried. P2. |
| Returns 200 on "already fired" | ✅ | Line 52 — `{ok: true, skipped: true}`. QStash won't retry on 2xx. |
| QStash retries on push failure | ❌ | Since the reminder is already deleted before push, a non-2xx return from `push()` would throw but the deletion can't be undone. The fire route doesn't return non-2xx on push failure — any exception from `push()` propagates unhandled (no try/catch around `push`) and would make QStash retry, but the Redis key is gone so the second attempt would return `{skipped: true}` and not re-push. Silent loss. P2. |

---

## `app/api/scheduled-email/fire/route.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Signature verified before any work | ✅ | Same pattern as reminders/fire. |
| Body validated after sig | ✅ | Zod `Body.parse(JSON.parse(raw))`. |
| `consumeScheduledEmail` non-atomic | ⚠️ | Same get+del race as reminders fire route (`lib/tools/scheduled-email.ts:111-113`). Two concurrent deliveries could double-send the email. P2. |
| Send failure handled gracefully | ✅ | Lines 72-77: `sendEmail` failure caught, user notified via push. Email already consumed (Redis key deleted) — not retried. Acceptable since the user is told. |
| `logSent` throws before push | ⚠️ | Line 58: `await logSent(...)` is inside the try block. If `logSent` throws, execution jumps to catch (line 72), user gets error push even though email was sent successfully. Audit log failure looks like send failure to the user. P3. |
| Push on success | ✅ | Line 69-71: user notified on success with subject and recipient. |

---

## `app/api/cron/sweep/route.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Signature verified | ✅ | QStash `receiver.verify()` at lines 37-46. |
| Manual ops bypass | ✅ (by design) | `Authorization: Bearer <OAUTH_STATE_SECRET>` bypass at lines 28-30 allows manual trigger without QStash. Secret is already used for OAuth state — shared-secret reuse is a design choice, not a vulnerability, since scope is limited. |
| Pre-meeting idempotency | ⚠️ | Audit claims `premeet:{userId}:{eventId}:{lead}` key. Actual code uses `claimPushLock()` (`pushlock:{userId}:pre_meeting:{date}` with 5-min TTL) in the fire route. The `proactive:premeet:${userId}:${eventId}` key only stores QStash message IDs for cancellation, not idempotency. |
| Task-warning idempotency | ⚠️ | Audit claims `taskwarn:{userId}:{task.id}` key. Actual code uses `claimPushLock()` (`pushlock:{userId}:task_deadline:{date}` with 5-min TTL) in the fire route. |
| Morning briefing dedup | ✅ | `shouldFireBriefingNow` checks `lastFiredTs` with 12h guard (`briefing.ts:188`). Races are possible if two sweeps land within 15 min concurrently, but that's a QStash scheduling edge case and impact is at most one duplicate briefing per day. P3. |
| Evening summary dedup | ✅ | Same 12h guard (`evening-summary.ts:182`). Same minor race. P3. |
| `sweepPreMeetingPushes` error handling | ✅ | `getGoogleClient` can throw `GoogleAuthRequired` — caught by per-user try/catch at line 101. Increments `stats.errors`, continues to next user. |
| All users parallelized | ✅ | `Promise.all(users.map(...))` — one user failure doesn't block others. |
| `sweepPreMeetingPushes` uses read-only scope | ✅ | Explicitly passes `["https://www.googleapis.com/auth/calendar.readonly"]` at line 148. Unlike calendar tools in `lib/tools/calendar.ts`, this correctly requests only the scope it needs. |

---

## `app/api/health/route.ts`

| Check | Status | Notes |
|-------|--------|-------|
| Returns something | ✅ | `{ok: true, ts: Date.now()}` |
| Checks downstream deps | ❌ | No Redis ping, no QStash check, no env validation, no LINE token check. A deployment with a misconfigured `KV_*` secret returns 200 as if healthy. Renders the endpoint useless for uptime monitoring. P2. |

---

## Summary of structural issues

| Priority | Route | Issue |
|----------|-------|-------|
| P0 | `webhook` | VERBOSE DEBUG MODE not reverted — raw error chains (stack traces, API bodies) surfaced to LINE users in production. |
| P2 | `webhook` | Allowlist gate skipped when `ADMIN_LINE_USER_ID` is not set. |
| P2 | `reminders/fire` | `consumeReminder` non-atomic get+del — double-push possible on QStash retry. |
| P2 | `reminders/fire` | Reminder deleted before push — silent loss if LINE push fails. |
| P2 | `scheduled-email/fire` | Same non-atomic consume pattern — double-send possible. |
| P2 | `oauth/callback` | Stale pending queue if `executePendingAll` throws during auto-resume. |
| P2 | `health` | No dependency checks — always returns 200 even when broken. |
| P3 | `scheduled-email/fire` | `logSent` failure inside try block causes false error notification. |
| P3 | `cron/sweep` | Morning/evening briefing dedup via settings timestamp has a minor concurrent-sweep race. |
