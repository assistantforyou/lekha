# Audit: Per-Tool Verification

Legend: ✅ good | ⚠️ concern | ❌ bug

| Tool name | File:line | Description matches behavior? | Input schema sane? | Error paths return structured markers (not throw)? | Idempotent or guarded? | Confirmation-gated (side effect)? | Notes |
|-----------|-----------|------------------------------|--------------------|----------------------------------------------------|------------------------|-------------------------------------|-------|
| `show_help` | `help.ts:62` | ✅ | ✅ | ✅ n/a | ✅ | n/a | Returns `HELP_TEXT` constant. |
| `get_my_settings` | `settings.ts:15` | ✅ | ✅ | ✅ n/a | ✅ | n/a | Exposes internal fields (`userConfigured`, `settingsVersion`, etc.) to model. Not harmful but noisy. |
| `set_timezone` | `settings.ts:22` | ✅ | ✅ | ✅ returns `{ok:false}` on bad TZ | ✅ | n/a | Validates via `Intl.DateTimeFormat`. |
| `set_location` | `settings.ts:40` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `set_language` | `settings.ts:50` | ✅ | ✅ | ✅ | ✅ | n/a | Accepts `null` to re-enable auto-detect. |
| `enable_morning_briefing` | `settings.ts:60` | ✅ | ⚠️ | ✅ | ✅ | n/a | `include_inbox` defaults to `false`. Calling this tool silently disables inbox if user previously had it enabled via migration defaults. P2. |
| `disable_morning_briefing` | `settings.ts:76` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `enable_evening_summary` | `settings.ts:85` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `disable_evening_summary` | `settings.ts:93` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `enable_pre_meeting_alerts` | `settings.ts:104` | ✅ | ✅ | ✅ | ✅ | n/a | Accepts `[]` to disable. |
| `remember` | `memory.ts:16` | ✅ | ✅ | ✅ | ✅ dedupes on exact lowercase | n/a | |
| `list_memories` | `memory.ts:27` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `update_memory` | `memory.ts:36` | ✅ | ✅ | ✅ returns `{ok:false}` on bad index | ✅ | n/a | |
| `forget_memory` | `memory.ts:46` | ✅ | ✅ | ✅ returns `{ok:false}` on bad index | ✅ | n/a | |
| `clear_all_memories` | `memory.ts:54` | ✅ | ✅ | ✅ | n/a (destructive) | n/a — no external side effect | |
| `search_archived_memory` | `memory.ts:62` | ✅ | ✅ | ✅ | ✅ | n/a | Substring match only. |
| `list_archived_memory` | `memory.ts:70` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `add_task` | `tasks.ts:14` | ✅ | ✅ | ✅ | ✅ | n/a — local state | `dueAt` parsed via `new Date(dueAt).getTime()` — NaN stored silently if invalid ISO. P2. |
| `list_tasks` | `tasks.ts:32` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `complete_task` | `tasks.ts:40` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | |
| `reopen_task` | `tasks.ts:48` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | |
| `update_task` | `tasks.ts:56` | ✅ | ⚠️ | ✅ returns `{ok:false}` | ✅ | n/a | Same NaN issue as `add_task` for invalid `dueAt`. |
| `delete_task` | `tasks.ts:71` | ✅ | ✅ | ✅ | ✅ | n/a — local state | |
| `set_reminder` | `reminders.ts:36` | ✅ | ✅ | ✅ returns `{ok:false}` | n/a (QStash publish is external) | No gate — fires directly | Validates timestamp, checks past/too-far. |
| `list_reminders` | `reminders.ts:88` | ⚠️ | ✅ | ✅ | ✅ | n/a | Doesn't expose `cron` field — user can't see which reminders are recurring in output. |
| `cancel_reminder` | `reminders.ts:103` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ idempotent (QStash delete swallowed) | n/a | |
| `set_recurring_reminder` | `reminders.ts:124` | ✅ | ✅ | ✅ returns `{ok:false}` | n/a | No gate — fires directly | No TTL on Redis entry (`redis().set(reminderKey, stored)` — no `ex`). Orphan keys if user never cancels. P3. |
| `web_search` | `web-search.ts:17` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | 6s timeout via AbortController. |
| `news_search` | `news.ts:19` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | 6s timeout. |
| `stock_price` | `finance.ts:26` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | Yahoo Finance v8 chart endpoint. |
| `stock_history` | `finance.ts:91` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | |
| `crypto_price` | `finance.ts:151` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | CoinGecko, alias map for common tickers. |
| `fx_rate` | `finance.ts:196` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | Two-provider fallback (fawazahmed0 → Frankfurter). |
| `weather` | `weather.ts:6` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | wttr.in + Open-Meteo fallback. |
| `list_google_accounts` | `google-accounts.ts:7` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `connect_google_account` | `google-accounts.ts:24` | ✅ | ✅ | ✅ | n/a | n/a — generates link, no external action | Does not call `startOAuth` — just builds a connect URL. The OAuth flow starts when user taps the link. |
| `switch_google_account` | `google-accounts.ts:36` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | |
| `disconnect_google_account` | `google-accounts.ts:48` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a — no external revocation | Removes from Redis. Does NOT revoke Google token at Google. User's token stays valid at Google side. P3. |
| `contacts_search` | `contacts.ts:28` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | Falls back to `otherContacts.search` on empty result. |
| `draft_email` | `email.ts:14` | ✅ | ✅ | ✅ returns `{ok:false}` on empty staged | ✅ via `appendPending` | ✅ YES gate | Validates `attach_recent_media` XOR `attach_recent_media_indexes`. |
| `gmail_search` | `gmail-inbox.ts:54` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | Parallel fetches for metadata. |
| `gmail_read` | `gmail-inbox.ts:99` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | Truncates body at 50KB. |
| `gmail_summarize_recent` | `gmail-inbox.ts:127` | ⚠️ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | `newer_than:${Math.ceil(hours/24) || 1}d` — rounds 1-23 hour queries up to 1 day. Not quite what "last N hours" implies. |
| `draft_gmail_reply` | `gmail-inbox.ts:178` | ✅ | ✅ | ✅ returns error result from `withGoogleClient` | ✅ via `appendPending` | ✅ YES gate | Fetches thread metadata to build threading headers. |
| `draft_calendar_event` | `calendar.ts:34` | ✅ | ✅ | ✅ n/a (just appends pending) | ✅ via `appendPending` | ✅ YES gate | No Google auth required to queue the draft — auth checked at execution. |
| `list_upcoming_events` | `calendar.ts:69` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | Uses `calendar.events` write scope for a read-only operation. P2. |
| `calendar_today` | `calendar.ts:102` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | Same write-scope issue. P2. |
| `calendar_week` | `calendar.ts:126` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | Same write-scope issue. P2. |
| `calendar_find_free_time` | `calendar.ts:150` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | Uses freebusy API. Slices to 20 slots. |
| `drive_search` | `drive.ts:56` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | Escapes `'` in query. |
| `drive_list_recent` | `drive.ts:83` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | |
| `drive_get_link` | `drive.ts:105` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | |
| `drive_upload_recent_media` | `drive.ts:130` | ✅ | ✅ | ❌ **THROWS** at `drive.ts:155` | n/a | n/a (no YES gate for uploads) | On invalid index, calls `throw new Error(...)` inside `execute`. AI SDK v6 swallows this; model gets an opaque exception string instead of structured `{ok:false,error}`. **P0.** |
| `drive_read_text` | `drive.ts:193` | ✅ | ✅ | ✅ returns `{ok:false}` for binary files | ✅ | n/a | Truncates at 50KB. Handles Google Docs, plain text/JSON/XML. PDF: not handled — returns `{ok:false}` with advice. |
| `transcribe_audio` | `media-ai.ts:14` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | Defaults to most-recent audio kind. |
| `summarize_audio` | `media-ai.ts:23` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | |
| `ocr_image` | `media-ai.ts:32` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | |
| `summarize_image` | `media-ai.ts:40` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | |
| `summarize_document` | `media-ai.ts:48` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | Default kind is `"file"`. Falls back to most recent item overall if no file found. |
| `schedule_email` | `scheduled-email.ts:29` | ✅ | ✅ | ✅ returns `{ok:false}` | n/a | ❌ **No YES gate** | Schedules immediately without confirmation. Side effect is irreversible until manually cancelled. No draft block rendered. P2. |
| `list_scheduled_emails` | `scheduled-email.ts:70` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `cancel_scheduled_email` | `scheduled-email.ts:91` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | |
| `sent_history` | `sent-history.ts:9` | ✅ | ✅ | ✅ | ✅ | n/a | `recipient_contains` filters by `to`/`cc`/`attendees` only — not `bcc`. |
| `export_my_data` | `export.ts:12` | ✅ | ✅ | ✅ | ✅ | n/a | Explicitly excludes OAuth tokens. |
| `add_to_list` | `lists.ts:29` | ✅ | ✅ | ✅ returns `{ok:false}` on full | ✅ | n/a | 100-item cap per list. |
| `remove_from_list` | `lists.ts:49` | ✅ | ✅ | ✅ returns `{ok:false}` on not-found | ✅ | n/a | Case-insensitive match. |
| `list_items` | `lists.ts:70` | ✅ | ✅ | ✅ | ✅ | n/a | Returns empty array if list not found. |
| `clear_list` | `lists.ts:83` | ✅ | ✅ | ✅ | n/a (destructive) | n/a | |
| `show_all_lists` | `lists.ts:95` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `rename_list` | `lists.ts:111` | ✅ | ✅ | ✅ returns `{ok:false}` | ✅ | n/a | Uses RPUSH + DEL (not atomic). If two renames race: possible duplication. Unlikely in practice. P3. |
| `delete_list` | `lists.ts:136` | ✅ | ✅ | ✅ | n/a (destructive) | n/a | |
| `create_google_doc` | `docs.ts:11` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a — no YES gate | Creates without confirmation. Side effect is external (Drive). Acceptable since Doc creation is low-risk. |
| `edit_google_doc` | `docs.ts:43` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a — no YES gate | Destructive (replaces body). Description says to read first; model is instructed but not enforced. |
| `create_google_slide` | `docs.ts:87` | ✅ | ✅ | ✅ via `withGoogleClient` | ✅ | n/a | Makes 3 API calls per presentation. If step 3 fails, partial presentation exists. |
| `list_staged_media` | `staged-media.ts:7` | ✅ | ✅ | ✅ | ✅ | n/a | |
| `clear_staged_media` | `staged-media.ts:26` | ✅ | ✅ | ✅ | n/a | n/a | |

---

## Summary of structural issues

1. **`drive_upload_recent_media`** throws inside `execute` for out-of-range index — only tool in the registry that does this. **P0**.
2. **`schedule_email`** has no confirmation gate — only externally-visible side-effect tool that bypasses YES/NO. **P2**.
3. **`calendar_today`/`calendar_week`/`list_upcoming_events`** request write-level scope (`calendar.events`) for read-only operations. **P2**.
4. **`enable_morning_briefing`** silently resets `inboxBriefingEnabled` to false when called with default args. **P2**.
5. **`list_reminders`** doesn't expose `cron` field — user can't see recurring vs one-shot. **P2**.
6. **`set_recurring_reminder`** stores no TTL on the Redis reminder entry. **P3**.
7. **`disconnect_google_account`** doesn't revoke token at Google. **P3**.
