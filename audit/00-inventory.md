# Audit: Inventory

## app/ directory

| File | Purpose |
|------|---------|
| `app/api/line/webhook/route.ts` | Main orchestrator — verifies LINE signature, dispatches events, runs LLM agent, handles pending queue, admin commands, dedup |
| `app/api/oauth/google/callback/route.ts` | OAuth code exchange, stores tokens, auto-resumes pending queue |
| `app/api/reminders/fire/route.ts` | QStash callback for one-shot reminders — verifies signature, pushes LINE message |
| `app/api/scheduled-email/fire/route.ts` | QStash callback for deferred email sends — verifies signature, sends email, pushes confirmation |
| `app/api/cron/sweep/route.ts` | QStash 15-min sweep — morning briefings, evening summaries, pre-meeting alerts, task warnings |
| `app/api/health/route.ts` | Returns `{ok: true, ts}` — no dependency checks |
| `app/connect/[token]/page.tsx` | Validates connect-link token, redirects to Google consent URL |
| `app/layout.tsx` | Root Next.js layout (minimal) |
| `app/page.tsx` | Root page (placeholder) |

## lib/env.ts
Zod-validated env schema + `redisCreds()` + feature-gate helpers (`hasGoogleOAuth`, `hasQStash`).

## lib/errors.ts
Three typed control-flow errors: `GoogleAuthRequired`, `RateLimited`, `NeedsConfirmation`.

## lib/ratelimit.ts
Upstash sliding-window rate limiter (30/hr/user). Singleton.

## lib/confirm.ts
Pending-action queue: `appendPending` (atomic RPUSH + EXPIRE), `getPending`, `clearPending`, `classify` (YES/NO/neither). Defines `PendingAction` union type.

## lib/pending-runner.ts
`executePendingAll` — loops queue, calls `sendEmail` or `createCalendarEvent`, handles `GoogleAuthRequired`, logs to sent-log.

## lib/cron.ts
`scheduleRecurring`, `cancelSchedule`, `scheduleOneShot` (QStash wrappers). `localTimeToUtcCron` — converts HH:mm + IANA TZ to UTC cron expression.

## lib/line/verify.ts
HMAC-SHA256 signature verification with length-safe compare.

## lib/line/client.ts
LINE REST API wrapper: `reply`, `push`, `replyOrPush`, `showLoading`, `getMessageContent`, `getProfile`, `text`.

## lib/line/types.ts
Zod schemas for all LINE webhook event types.

## lib/llm/provider.ts
`chatModel()` → `gemini-flash-lite-latest`. `fallbackChatModels()` → llama-4-scout-17b, gpt-oss-120b. `extractorModel()` → same as chatModel.

## lib/llm/prompts.ts
`BASE_PERSONALITY` (system prompt), `FACT_EXTRACTION_PROMPT`, `buildSystemPrompt()`.

## lib/llm/extract-facts.ts
`extractAndMergeFacts` — calls Gemini to extract facts + write archive chunk. Fire-and-forget.

## lib/llm/render-drafts.ts
`renderDraftsBlock` — builds canonical draft display from tool-call args. Hardcodes `DISPLAY_TZ = "Asia/Bangkok"`.

## lib/llm/briefing.ts
`buildMorningBriefing` — assembles reminders + calendar + tasks + inbox, polishes with Gemini. `shouldFireBriefingNow` — time-window check.

## lib/llm/evening-summary.ts
`buildEveningSummary` + `shouldFireEveningSummaryNow` — 9 PM digest.

## lib/llm/health.ts
`markGeminiDown` / `isGeminiDown` — Redis TTL flag for cascade skipping.

## lib/memory/redis.ts
Singleton Upstash Redis client.

## lib/memory/crypto.ts
`encrypt`/`decrypt` (AES-256-GCM), `hmac` (SHA-256), `safeEqual` (timing-safe).

## lib/memory/history.ts
Rolling 20-turn conversation history (LPUSH + LTRIM). `turnCounter` (separate INCR key for fact-extraction cadence).

## lib/memory/facts.ts
User facts blob (~4KB cap). `appendFact`, `updateFact`, `removeFact`, `clearFacts`, `factsToPromptBlock`.

## lib/memory/archive.ts
Long-term archive: `appendArchive` (RPUSH + LTRIM at 200), `listArchive`, `searchArchive` (substring).

## lib/memory/profile.ts
`getOrCreateProfile` (displayName + joinedAt), `isFirstContact`.

## lib/memory/recent-media.ts
Staged LINE media: RPUSH + LTRIM (10 max) + 30-min TTL. `appendRecentMedia`, `listRecentMedia`, `clearRecentMedia`.

## lib/memory/settings.ts
`UserSettings` type. Versioned defaults + migration table (`CURRENT_VERSION = 2`). `getSettings` (applies migrations on read), `updateSettings` (tracks `userConfigured` to protect explicit choices from future migrations).

## lib/memory/tasks.ts
Persistent task CRUD (open/done/all filter).

## lib/memory/sent-log.ts
Audit log: LPUSH + LTRIM (200 max) + 6-month TTL. `logSent`, `listSent`.

## lib/memory/allowlist.ts
Redis set `users:allowed`. `isAllowed`, `addToAllowlist`, `removeFromAllowlist`, `listAllowed`.

## lib/memory/user-registry.ts
Redis set `users:active`. `registerUser`, `listAllUsers`, `unregisterUser`.

## lib/tools/index.ts
`toolsForUser(userId)` — full registry (~50 tools, env-gated). `coreToolsForUser(userId)` — slim Groq subset (~25 tools).

## lib/tools/help.ts
`show_help` tool + `HELP_TEXT` export (also used as shortcut in webhook).

## lib/tools/settings.ts
9 settings tools: `get_my_settings`, `set_timezone`, `set_location`, `set_language`, `enable/disable_morning_briefing`, `enable/disable_evening_summary`, `enable_pre_meeting_alerts`.

## lib/tools/memory.ts
7 memory tools: `remember`, `list_memories`, `update_memory`, `forget_memory`, `clear_all_memories`, `search_archived_memory`, `list_archived_memory`.

## lib/tools/tasks.ts
6 task tools: `add_task`, `list_tasks`, `complete_task`, `reopen_task`, `update_task`, `delete_task`.

## lib/tools/reminders.ts
4 reminder tools: `set_reminder`, `list_reminders`, `cancel_reminder`, `set_recurring_reminder`. Also exports `listReminders` and `consumeReminder` (used by briefing and fire route).

## lib/tools/web-search.ts
`web_search` via Tavily. 6s timeout.

## lib/tools/news.ts
`news_search` via Tavily topic=news. 6s timeout.

## lib/tools/finance.ts
4 finance tools: `stock_price`, `stock_history` (Yahoo Finance v8/chart), `crypto_price` (CoinGecko), `fx_rate` (fawazahmed0 CDN + Frankfurter fallback). 3s timeout each.

## lib/tools/weather.ts
`weather` — wttr.in primary + Open-Meteo fallback. 4s timeouts each.

## lib/tools/google-auth.ts
OAuth2 client, connect-link generation (`buildConnectUrl`), token verification (`verifyConnectToken`), flow start/complete, multi-account storage, `getGoogleClient`, `listAccounts`, `setActiveAccount`, `removeAccount`, `hasGoogleConnection`.

## lib/tools/with-google.ts
`withGoogleClient` — wraps Google API calls, catches `GoogleAuthRequired` / `invalid_grant` / API-disabled / other errors → structured result markers.

## lib/tools/google-accounts.ts
4 tools: `list_google_accounts`, `connect_google_account`, `switch_google_account`, `disconnect_google_account`.

## lib/tools/contacts.ts
`contacts_search` — Google People API + other-contacts fallback.

## lib/tools/email.ts
`draft_email` tool (queues pending). `sendEmail` function (called by pending-runner). Handles Drive attachments + staged LINE media. Builds RFC-2822 MIME.

## lib/tools/gmail-inbox.ts
4 tools: `gmail_search`, `gmail_read`, `gmail_summarize_recent`, `draft_gmail_reply`.

## lib/tools/calendar.ts
5 tools: `draft_calendar_event`, `list_upcoming_events`, `calendar_today`, `calendar_week`, `calendar_find_free_time`. `createCalendarEvent` function (called by pending-runner).

## lib/tools/drive.ts
5 tools: `drive_search`, `drive_list_recent`, `drive_get_link`, `drive_upload_recent_media`, `drive_read_text`.

## lib/tools/media-ai.ts
5 tools: `transcribe_audio`, `summarize_audio`, `ocr_image`, `summarize_image`, `summarize_document`. All use `extractorModel()` with multimodal content.

## lib/tools/scheduled-email.ts
3 tools: `schedule_email`, `list_scheduled_emails`, `cancel_scheduled_email`. `consumeScheduledEmail` (used by fire route).

## lib/tools/sent-history.ts
`sent_history` tool.

## lib/tools/export.ts
`export_my_data` tool — full JSON dump of all user data.

## lib/tools/lists.ts
7 tools: `add_to_list`, `remove_from_list`, `list_items`, `clear_list`, `show_all_lists`, `rename_list`, `delete_list`.

## lib/tools/docs.ts
3 tools: `create_google_doc`, `edit_google_doc`, `create_google_slide`.

## lib/tools/staged-media.ts
2 tools: `list_staged_media`, `clear_staged_media`.

---

## Files not imported anywhere (dead code)

None found. Every file in `lib/` is imported by at least one other module.

`lib/llm/health.ts` is not mentioned in CLAUDE.md or README but is actively used.

## Duplicate / near-duplicate logic

- `fetchJSON` defined independently in `finance.ts` and `weather.ts` with slightly different defaults — not a bug, but could be shared.
- `decodeBody` in `gmail-inbox.ts` is a bespoke HTML stripper — only used once.
- Both `sendEmail` path and `briefing.ts` call `getGoogleClient` directly (not via `withGoogleClient`). The briefing is correct — it wraps in a try/catch. The pending-runner wraps in `unwrapAuthRequired`.

## TODO / FIXME / ts-ignore / console.log

No `@ts-ignore`, `@ts-expect-error`, or `eslint-disable` found in any source file.

No `TODO` or `FIXME` comments found in source.

**Production-path `console.log` calls** (all prefixed — intentional logging):

| Location | Content |
|----------|---------|
| `app/api/line/webhook/route.ts:262` | `[webhook] preload done` timing |
| `app/api/line/webhook/route.ts:303` | `[webhook] preload done` timing |
| `app/api/line/webhook/route.ts:709` | `[agent] skipping gemini` |
| `app/api/line/webhook/route.ts:740` | `[agent] gemini step` detail log |
| `app/api/line/webhook/route.ts:764` | `[agent] gemini done` |
| `app/api/line/webhook/route.ts:823` | `[agent] groq step` |
| `app/api/line/webhook/route.ts:838` | `[agent] groq done` |
| `lib/tools/reminders.ts:76` | `[reminder] scheduled` |
| `lib/tools/finance.ts:58,115,176,228` | Per-tool timing logs |
| `lib/tools/weather.ts:55,104` | Provider timing logs |
| `lib/tools/web-search.ts:43` | Tavily timing |
| `lib/tools/news.ts:47` | Tavily timing |

**VERBOSE DEBUG MODE** — `app/api/line/webhook/route.ts:621-622` has a comment saying "Revert when stable." Raw error chains including stack traces and API response bodies are surfaced to LINE users in production. This comment has not been acted on.

---

## package.json dependency audit

| Package | Version | Used? |
|---------|---------|-------|
| `@ai-sdk/google` | ^2.0.0 | Yes — `lib/llm/provider.ts` |
| `@ai-sdk/groq` | ^3.0.38 | Yes — `lib/llm/provider.ts` |
| `@upstash/qstash` | ^2.7.0 | Yes — reminders, scheduled-email, cron |
| `@upstash/ratelimit` | ^2.0.0 | Yes — `lib/ratelimit.ts` |
| `@upstash/redis` | ^1.34.0 | Yes — `lib/memory/redis.ts` |
| `ai` | ^6.0.0 | Yes — `generateText`, `generateObject`, `tool`, `stepCountIs` |
| `googleapis` | ^144.0.0 | Yes — Gmail, Calendar, Drive, People, Slides, Docs |
| `next` | ^16.0.0 | Yes — App Router framework |
| `react` | ^19.0.0 | Yes — page components |
| `react-dom` | ^19.0.0 | Yes — rendering |
| `zod` | ^3.23.8 | Yes — schemas throughout |

**Missing from devDependencies**: No `eslint`, no `eslint-config-next`, no `vitest`, no `@vitest/*`, no test runner of any kind.

**Not in `.env.example` but read by code**:
- `GROQ_API_KEY` — read by `lib/env.ts:31`, used as fallback LLM
- `ADMIN_LINE_USER_ID` — read by `lib/env.ts:40`, critical for access control

**`npm audit` findings**: Next.js `^16.0.0 < 16.2.5` has multiple CVEs including:
- GHSA-8h8q-6873-q5fj: DoS via Server Components (HIGH, 7.5)
- GHSA-c4j6-fc7j-m34r: SSRF via WebSocket upgrades (HIGH, 8.6)
- GHSA-492v-c6pp-mqqv: Middleware/Proxy bypass via dynamic route parameter injection (HIGH, 8.1)
- GHSA-267c-6grr-h53f: Middleware/Proxy bypass via segment-prefetch routes (HIGH, 7.5)
- Plus 8 more (moderate/low)

Fix: bump `next` to `>=16.2.5` in package.json.
