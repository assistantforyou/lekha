# Lekha — Full-Scale Audit: Final Report

Audit date: 2026-05-13  
Auditor: Claude Code (claude-sonnet-4-6)  
Scope: all files in `app/` and `lib/`; 73 source files, 51 tools, 6 route handlers.

---

## Executive summary

The architecture is sound. Per-user Redis isolation, AES-256-GCM token encryption, HMAC-verified LINE webhooks, atomic QStash signature verification, and the pending-action queue pattern are all correctly implemented. The core security primitives (crypto.ts, verify.ts, connect-link HMAC, OAuth state nonce) are correct and reviewed positively.

**Two P0 bugs were fixed in this audit session.** Twenty-two additional bugs were found across P1–P3, plus eight documentation gaps. None of the unfixed bugs are catastrophic, but several (P2 class) can cause silent data loss or user-facing degradation.

A test suite (81 tests) and CI pipeline were added from scratch. Before this audit, the project had zero tests and no automated CI.

---

## What was built

| Deliverable | Location | Status |
|-------------|----------|--------|
| Inventory | `audit/00-inventory.md` | ✅ done |
| Claims vs reality | `audit/01-claims-vs-reality.md` | ✅ done |
| Per-tool verification (51 tools) | `audit/02-per-tool-verification.md` | ✅ done |
| Route handler analysis (6 routes) | `audit/03-route-handlers.md` | ✅ done |
| Security audit | `audit/04-security.md` | ✅ done |
| Bug & gap registry | `audit/05-bugs-and-gaps.md` | ✅ done |
| Test plan | `audit/06-test-plan.md` | ✅ done |
| `vitest.config.ts` | root | ✅ done |
| Unit tests (81 tests) | `tests/` | ✅ done |
| CI pipeline | `.github/workflows/ci.yml` | ✅ done |
| P0 fix: `drive_upload_recent_media` throw | `lib/tools/drive.ts:152` | ✅ fixed |
| P0 fix: VERBOSE DEBUG MODE reverted | `app/api/line/webhook/route.ts:622` | ✅ fixed |

---

## Bug registry summary

### Fixed in this session

| Priority | Bug | Fix location |
|----------|-----|--------------|
| P0 | `drive_upload_recent_media` throws on out-of-range index — AI SDK v6 swallows it, model gets opaque error | `lib/tools/drive.ts:152–156` |
| P0 | VERBOSE DEBUG MODE: stack traces, API response bodies, cause chains surfaced to LINE users | `app/api/line/webhook/route.ts:622–638` |

### Open bugs (not fixed — see `audit/05-bugs-and-gaps.md` for full detail)

| Priority | # | Bug |
|----------|---|-----|
| P1 | 1 | `next <16.2.5` — 13 CVEs including SSRF (8.6) and middleware bypass (8.1). Run `npm audit fix`. |
| P2 | 13 | See below |
| P3 | 6 | See below |

**P2 bugs (in priority order):**

1. `schedule_email` has no confirmation gate — fires immediately without YES/NO
2. `enable_morning_briefing` silently resets `inboxBriefingEnabled` to false
3. `DISPLAY_TZ` hardcoded to `"Asia/Bangkok"` in draft rendering
4. `list_reminders` omits `cron` field — can't see recurring vs one-shot
5. Calendar read tools request write-level scope (`calendar.events` not `calendar.readonly`)
6. `add_task` / `update_task` store NaN silently on invalid `dueAt`
7. `localTimeToUtcCron` unreliable for half-hour-offset timezones (India, Iran, Nepal)
8. `gmail_summarize_recent` rounds sub-day queries up to 1 day
9. `consumeReminder` / `consumeScheduledEmail` non-atomic get+del (double-push on retry)
10. Reminder deleted before LINE push — silent loss if push fails
11. Allowlist gate silently skipped when `ADMIN_LINE_USER_ID` not set
12. OAuth auto-resume leaves stale pending queue if `executePendingAll` throws
13. Health endpoint returns 200 with no dependency checks

**P3 bugs:**

1. `set_recurring_reminder` stores Redis key with no TTL
2. `disconnect_google_account` doesn't revoke token at Google
3. `rename_list` non-atomic RPUSH + DEL
4. Morning/evening briefing dedup has minor concurrent-sweep race
5. `logSent` failure causes false error notification in scheduled-email fire
6. `displayName`/`location` injected into system prompt unsanitized (low risk: private bot)

---

## Security posture

| Control | Status |
|---------|--------|
| LINE webhook HMAC verification | ✅ correct |
| QStash signature on all 3 fire routes | ✅ correct |
| AES-256-GCM with random IV per encrypt | ✅ correct |
| OAuth CSRF state (getdel, 10-min TTL) | ✅ correct |
| Connect-link token (HMAC + single-use) | ✅ correct |
| Per-user Redis isolation | ✅ correct |
| Rate limiting (30/hr sliding window) | ✅ correct |
| Token encryption at rest | ✅ correct |
| HTML escaping in OAuth callback | ✅ correct |
| SSRF protection (encodeURIComponent on all user params) | ✅ correct |
| npm audit — Next.js CVEs | ❌ 13 CVEs, bump to `>=16.2.5` |
| Allowlist gate when `ADMIN_LINE_USER_ID` unset | ⚠️ gate skipped |

---

## Test coverage (new)

| Test file | What it covers |
|-----------|---------------|
| `tests/crypto.test.ts` (16 tests) | AES-256-GCM round-trips, tamper detection, HMAC, safeEqual |
| `tests/verify.test.ts` (8 tests) | LINE HMAC-SHA256 signature verification |
| `tests/cron.test.ts` (10 tests) | `localTimeToUtcCron` — UTC math, invalid input, half-hour offset |
| `tests/confirm.test.ts` (37 tests) | YES/NO classification — all variants |
| `tests/briefing-gate.test.ts` (10 tests) | Morning briefing and evening summary fire-gate logic |

All 81 tests pass. TypeScript strict mode (`noUncheckedIndexedAccess`) passes.

---

## Documentation accuracy

Of 26 claims in README/CLAUDE.md verified:

| Result | Count |
|--------|-------|
| ✅ matches | 15 |
| ⚠️ partial | 2 |
| ❌ false | 7 |
| 🔍 unverifiable | 2 |

Notable false claims: step count (8 vs 3), Gemini timeout (12s vs 20s), tool count (13 vs 51), Groq cascade (missing llama-4-maverick), public vs allowlist-gated.

---

## Recommendations (top 5 by impact)

1. **Run `npm audit fix`** — bumps Next.js to `>=16.2.5`, resolves 13 CVEs including SSRF and middleware bypass. Zero code changes required.
2. **Add `schedule_email` to the confirmation gate** — it's the only irreversible side-effect tool that bypasses YES/NO. Users can't cancel a scheduled email before it's queued.
3. **Fix `enable_morning_briefing` schema default** — read current `inboxBriefingEnabled` before overwriting; the silent reset to `false` will confuse users.
4. **Replace `consumeReminder`/`consumeScheduledEmail` get+del with atomic GETDEL** — prevents double-push/send on QStash retry.
5. **Fix `localTimeToUtcCron` for half-hour timezones** — use `Intl.DateTimeFormat.formatToParts()` instead of `toLocaleString`. Affects India, Iran, Nepal users.

---

## What was not audited

- Runtime behavior (no staging environment; all findings are static analysis)
- QStash schedule IDs and live cron state
- Vercel deployment configuration and env var hygiene
- LINE channel permissions and bot settings
- Google Cloud OAuth consent screen and allowed scopes
- Redis key cardinality / memory usage at scale
