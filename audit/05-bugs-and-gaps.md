# Audit: Bugs and Gaps

All bugs found across phases 00–04, de-duplicated and prioritized.

---

## P0 — Fix before any production traffic

| # | Bug | File:line | Symptom |
|---|-----|-----------|---------|
| 1 | `drive_upload_recent_media` throws inside `execute` instead of returning `{ok:false,...}` | `lib/tools/drive.ts:155` | AI SDK v6 swallows exceptions and feeds opaque error text to the model. Model paraphrases badly. All other 50+ tools return structured errors; this is the only outlier. Fix: replace `throw new Error(...)` with `return { ok: false, error: "..." }`. |
| 2 | VERBOSE DEBUG MODE not reverted | `app/api/line/webhook/route.ts:622–638` | Raw error chains including class names, stack-adjacent messages, HTTP status codes, Google/QStash API response bodies (up to 400 chars), and cause chains (depth 4) are surfaced to LINE users via `verboseError(err)`. Comment at line 622 says "Revert when stable." Not reverted. Information leakage in production. Fix: remove or gate behind a `DEBUG_MODE` env var. |

---

## P1 — Fix this week

| # | Bug | File:line | Symptom |
|---|-----|-----------|---------|
| 3 | `next ^16.0.0` pinned below vulnerable range | `package.json:21` | 13 CVEs including SSRF via WebSocket upgrades (CVSS 8.6), two middleware/proxy bypass vectors (CVSS 8.1, 7.5), XSS in App Router CSP nonces, and 8 more. Fix: bump to `"next": "^16.2.5"` and run `npm audit fix`. |

---

## P2 — Fix this sprint

| # | Bug | File:line | Symptom |
|---|-----|-----------|---------|
| 4 | `schedule_email` has no confirmation gate | `lib/tools/scheduled-email.ts:41–67` | Only externally-visible side-effect tool that bypasses YES/NO. QStash schedule is published immediately during tool execution. User has no chance to cancel before the email is queued. Fix: route through `appendPending` and add a renderer in `render-drafts.ts`. |
| 5 | `enable_morning_briefing` silently resets `inboxBriefingEnabled` to false | `lib/tools/settings.ts:66–74` | Schema: `include_inbox: z.boolean().default(false)`. Calling this tool with default args (or any call that omits `include_inbox`) overwrites the setting to false even if user had enabled inbox via migration defaults. Fix: read current `inboxBriefingEnabled` before writing; only update `include_inbox` if explicitly provided. |
| 6 | `DISPLAY_TZ` hardcoded to `"Asia/Bangkok"` in draft rendering | `lib/llm/render-drafts.ts:7` | All draft email/calendar times shown in Bangkok TZ regardless of user's configured timezone. Fix: pass `userId` (or the settings timezone) into `renderDraftsBlock` and use it. |
| 7 | `list_reminders` omits `cron` field | `lib/tools/reminders.ts:88–100` | Model and user cannot distinguish one-shot from recurring reminders in the list output. Fix: include `"type": "one-shot"` or `"type": "recurring"` and the cron expression in the tool result. |
| 8 | Calendar read tools request write-level scope | `lib/tools/calendar.ts:8` | `list_upcoming_events`, `calendar_today`, `calendar_week` use `calendar.events` (write scope). Should use `calendar.readonly`. Users grant more permission than necessary when connecting Google. Fix: change `CAL_SCOPE` for read tools or use `calendar.readonly` on reads and `calendar.events` only for `draft_calendar_event` flow. |
| 9 | `add_task` / `update_task` store NaN silently on invalid `dueAt` | `lib/tools/tasks.ts:14,56` | `new Date(dueAt).getTime()` returns `NaN` for non-ISO strings. NaN is stored in Redis. `list_tasks` renders it as `null`; `sweepTaskDeadlines` skips it (correct but silent). Fix: validate `dueAt` format and return `{ok:false,error:"..."}` if invalid. |
| 10 | `localTimeToUtcCron` unreliable for half-hour-offset timezones | `lib/cron.ts:65–68` | `new Date(now.toLocaleString("en-US", { timeZone }))` computes a fake "local" Date by parsing the locale string — this doesn't account for the fractional-hour UTC offset (India +5:30, Iran +3:30, Nepal +5:45). Cron expression is off by 30 min for those users. Fix: use `Intl.DateTimeFormat.formatToParts()` to extract local H/M, then arithmetic. |
| 11 | `gmail_summarize_recent` rounds sub-day queries to 1 day | `lib/tools/gmail-inbox.ts:127` | `newer_than:${Math.ceil(hours/24) || 1}d` — "last 2 hours" becomes "newer_than:1d". Users asking for recent email get up to 24h of results. Fix: use `newer_than:Xh` directly; Gmail supports hour-level `newer_than` via `h` unit. |
| 12 | `consumeReminder` / `consumeScheduledEmail` non-atomic get+del | `lib/tools/reminders.ts:179–181`, `lib/tools/scheduled-email.ts:111–113` | Non-atomic read+delete: concurrent QStash retries can both get the record before either deletes it, causing double push/email. Fix: use a Lua script or Redis `GETDEL` (single atomic op). |
| 13 | Reminder deleted before push in fire route | `app/api/reminders/fire/route.ts:49,55` | `consumeReminder` deletes Redis key before `push()` call. If LINE push fails, the reminder is silently lost. Fix: push first, then delete; or catch push failure and re-insert. |
| 14 | Allowlist gate silently skipped when `ADMIN_LINE_USER_ID` is not set | `app/api/line/webhook/route.ts:84` | `adminIds.size === 0` makes the gate condition `false` → every LINE user passes. Intended for dev, dangerous in production. Fix: either require `ADMIN_LINE_USER_ID` in env schema, or log a loud warning when `adminIds.size === 0`. |
| 15 | OAuth auto-resume leaves stale pending queue on error | `app/api/oauth/google/callback/route.ts:40–46` | If `executePendingAll` throws during auto-resume, `clearPending` is never called. Next webhook event clears pending (webhook line 156) so it's self-healing, but user sees stale "confirm?" prompt. Fix: call `clearPending(userId)` in the catch block of the auto-resume try/catch. |
| 16 | Health endpoint returns 200 with no dependency checks | `app/api/health/route.ts:6–7` | Redis ping, QStash reachability, LINE token validity all unverified. Monitoring tools see "healthy" when the app is broken. Fix: add a Redis ping and env validation; return 503 if either fails. |

---

## P3 — Fix when convenient

| # | Bug | File:line | Symptom |
|---|-----|-----------|---------|
| 17 | `set_recurring_reminder` stores Redis key with no TTL | `lib/tools/reminders.ts:162` | `redis().set(reminderKey(userId, id), stored)` — no `ex`. Recurring reminder metadata never expires. If user cancels without calling `cancel_reminder`, key is orphaned forever. Fix: set TTL to something generous (e.g., 2 years) or clean up on cancel (already happens: `cancel_reminder` calls `redis().del`). |
| 18 | `disconnect_google_account` doesn't revoke token at Google | `lib/tools/google-accounts.ts:48` | Token removed from Redis but remains valid at Google. Fix: call `oauth2Client.revokeToken(refreshToken)` before delete. |
| 19 | `rename_list` non-atomic RPUSH + DEL | `lib/tools/lists.ts:111` | Two concurrent renames could duplicate data. Fix: wrap in a Redis pipeline/transaction. |
| 20 | Morning/evening briefing dedup has minor concurrent-sweep race | `lib/llm/briefing.ts:188`, `lib/llm/evening-summary.ts:182` | If two sweep invocations land simultaneously, both may pass the 12h timestamp check before either writes back `lastFiredTs`. Double briefing possible at most once per day. Fix: use a Redis NX key as an atomic lock instead of/in addition to the timestamp check. |
| 21 | `logSent` failure causes false error notification in scheduled-email fire | `app/api/scheduled-email/fire/route.ts:58–70` | `logSent` is inside the try block. If it throws (Redis down), the catch fires and pushes an error to the user even though the email was sent. Fix: move `logSent` outside the sendEmail try/catch and suppress its errors separately. |
| 22 | `displayName` and `location` injected into system prompt unsanitized | `lib/llm/prompts.ts:74–77` | Prompt injection vector. Low risk for allowlist-gated private bot — all users are trusted. Noted for completeness. |

---

## Documentation gaps (not code bugs)

| # | Gap | Location | Notes |
|---|-----|----------|-------|
| 23 | README claims 13 tools; registry has 51 | `lib/tools/index.ts` | Stale diagram. |
| 24 | CLAUDE.md says `stepCountIs(8)`; code uses `stepCountIs(3)` | `app/api/line/webhook/route.ts:719` | — |
| 25 | CLAUDE.md says Gemini timeout 12s; code uses 20s | `app/api/line/webhook/route.ts:763` | — |
| 26 | CLAUDE.md says Groq cascade `llama-4-scout → gpt-oss-120b`; code has `llama-4-maverick → llama-4-scout → gpt-oss-120b` | `lib/llm/provider.ts:43–49` | maverick not documented |
| 27 | `GROQ_API_KEY` and `ADMIN_LINE_USER_ID` missing from `.env.example` | `lib/env.ts:32,40` | Critical for access control and fallback LLM |
| 28 | `lib/llm/health.ts` not mentioned in CLAUDE.md or README | `lib/llm/health.ts` | Used by cascade but undocumented |
| 29 | Health endpoint implied to check dependencies; it doesn't | `app/api/health/route.ts` | — |
| 30 | `render-drafts.ts` Bangkok TZ not documented anywhere | `lib/llm/render-drafts.ts:7` | Users in other TZs silently get wrong times in drafts |

---

## Bug count by priority

| Priority | Count |
|----------|-------|
| P0 | 2 |
| P1 | 1 |
| P2 | 13 |
| P3 | 6 |
| Docs | 8 |
| **Total** | **30** |
