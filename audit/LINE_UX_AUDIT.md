# Lekha LINE UX Audit

**Date:** 2026-07-09  
**Scope:** LINE 1:1 chat, onboarding/tutorial, settings menu, confirmation/draft flows, media handling, proactive pushes, group chat, error surfaces, localization, and memory recall.  
**Method:** Source review of `app/api/line/webhook/route.ts`, `lib/handlers/*`, `lib/line/flex/*`, `lib/llm/*`, `lib/settings-menu.ts`, `lib/tutorial.ts`, `lib/sweep.ts`, `lib/confirm.ts`, `lib/i18n.ts`, and related files.

---

## Top 10 Issues (Prioritized)

1. **Thai users get English-only rich cards and proactive messages.** Briefings, task check-ins, drafts, help, group gate, and connect-Google cards ignore the user’s language setting.
2. **“Describe edits” on drafts is a dead end.** The rendered draft block invites edits, but the webhook throws away the pending queue on any non-yes/no reply.
3. **Pending confirmation classifier over-fires on casual agreement words.** Replies like *“ok but change the time”* or *“ได้ แต่ขอแก้เวลา”* are classified as yes and executed immediately.
4. **Custom onboarding time/timezone inputs reject many valid values.** The alias list omits common zones and Thai-style time inputs are not accepted.
5. **Task check-in “Done all” is a single-tap destructive action.** A single accidental tap marks every open task complete with no confirmation.
6. **The proactive briefing “Email” channel is advertised but never delivered.** Settings show an email toggle, but the sweep only ever pushes to LINE chat.
7. **Google re-auth errors from pending execution lack a tappable button.** Users are told to type “connect google” instead of getting the same connect button used elsewhere.
8. **Group chat silently ignores non-text messages.** Receipts, photos, and files sent in a group are dropped even when the bot is explicitly invoked.
9. **Settings prompt flow absorbs accidental text.** While waiting for a timezone/location/fact, any stray message is accepted as the value.
10. **Dates and times in Flex cards are hard-coded to `en-US`.** Thai users see English month names and AM/PM everywhere.

---

## High-Priority Findings

### H1. Thai users receive English-only rich cards and proactive pushes

- **Journey step:** Every proactive push (morning/evening briefing, task check-in) and most high-touch cards (drafts, tasks, help, connect Google, group gate, confirm/cancel).
- **Problem:** The Flex builders and briefing generators do not consume the user’s language setting.
  - `lib/line/flex/briefing.ts:32` hardcodes `☀️  Morning briefing` / `🌙  Evening summary` and English footer labels.
  - `lib/line/flex/task-checkin.ts:28-29` hardcodes `"✅  Quick check-in"` / `"Which of these did you finish today?"`.
  - `lib/line/flex/task-list.ts:55` hardcodes `"Your tasks"`; `formatDueDate` uses `en-US` (`lib/line/flex/task-list.ts:10-44`).
  - `lib/line/flex/help.ts:139-176` renders the entire help card in English.
  - `lib/line/flex/google-connect.ts:11,39` uses English reason text and button label.
  - `lib/line/flex/confirm-cancel.ts:13,27,46,53` uses English yes/no labels and header.
  - `lib/line/flex/group-gate.ts:57-119` is English-only.
  - `lib/llm/briefing.ts:246,456` accepts `briefingLanguage` but never uses it; the whole briefing text is generated in English.
  - `lib/llm/evening-summary.ts:283` likewise builds English text regardless of language.
- **User impact:** The product promises Thai/English bilingual support, but Thai users regularly receive English-only surfaces. This feels robotic and undermines trust, especially for proactive pushes that arrive unprompted.
- **Recommended fix:**
  - Pass `settings.language` (or `uiLang`) into every Flex builder and localize labels, headers, button text, and empty states.
  - In `buildMorningBriefing` / `buildEveningSummary`, branch on `opts.briefingLanguage` (or the user’s reply language) to generate Thai, English, or bilingual text.
  - Use locale-aware date formatting in cards (e.g., `Intl.DateTimeFormat` with `th-TH` or `en-US`).

### H2. Drafts invite edits, but the edit path is broken

- **Journey step:** Confirming a draft email, calendar event, or scheduled email.
- **Problem:** `renderDraftsBlock` tells the user they can *“describe edits”* (`lib/llm/render-drafts.ts:104`), but the webhook discards the pending queue whenever a reply is not a clear yes/no.
  - `app/api/line/webhook/route.ts:242` calls `clearPending(userId)` if `classify(userText)` returns `"neither"`.
  - `lib/confirm.ts:95-107` returns `"neither"` for any message that is not an exact yes/no pattern.
- **User impact:** A user who follows the on-screen prompt and says *“change the time to 3pm”* loses the original draft. The agent starts a fresh turn and may create a duplicate or unrelated draft.
- **Recommended fix:**
  - Either detect edit intent before clearing pending and feed the existing draft + edit request back to the model (then re-render the draft), **or**
  - Remove *“(or describe edits)”* from `renderDraftsBlock` and offer explicit buttons: **Send**, **Edit** (re-enters chat), **Cancel**.

### H3. Pending confirmation classifier over-fires on casual agreement words

- **Journey step:** Any time a draft or pending action is awaiting yes/no.
- **Problem:** The classifier treats broad agreement words as yes, even when the user is hedging or asking for a change.
  - `lib/confirm.ts:91-92` regexes include `ok`, `okay`, `sure`, `go`, `send`, Thai `ได้`, `โอเค`, `ตกลง`, `เอา`, etc.
  - `app/api/line/webhook/route.ts:217-228` executes all pending actions immediately on a yes classification.
- **User impact:** Messages like *“ok but change the subject”* or *“ได้ แต่ขอแก้เวลา”* are classified as yes, causing the wrong email/event to be sent/created with no chance to edit.
- **Recommended fix:**
  - For the pending-confirmation path, require an **exact** yes/no match (the `AFFIRMATIVE`/`NEGATIVE` sets) and treat everything else as an edit/cancel request.
  - Add an explicit edit-intent guard (`change`, `edit`, `แก้`, `เปลี่ยน`) before executing.

### H4. Custom onboarding inputs reject many valid timezone and time values

- **Journey step:** Tutorial steps 2 (locale) and 3 (briefing times), plus `/set` commands.
- **Problem:**
  - `lib/tutorial.ts:235-268` `TIMEZONE_ALIASES` only covers 15 cities/regions. Typing *Seoul*, *Jakarta*, *Mumbai*, *Taipei*, etc. fails.
  - `lib/tutorial.ts:282-294` `parseCustomTime` only accepts `H:MM [am|pm]`; it does not accept Thai time suffixes (`น.`), period separators (`19.30`), or leading zeros variations.
  - `lib/settings-menu.ts:83-85` `isValidTime` and `applyTypedSet` only accept `HH:MM` for `/set morning/evening/checkin`.
- **User impact:** Non-Bangkok users and Thai-language typers get repeated error messages and may abandon setup.
- **Recommended fix:**
  - Expand timezone resolution to use `Intl.supportedValuesOf('timeZone')` plus fuzzy matching.
  - Normalize Thai time input (`น.`, `.` separator, Thai numerals) before validating.
  - Allow natural forms like `7:30 AM`, `19:30`, `19.30`, `7:30 น.` in both tutorial and `/set`.

### H5. Task check-in “Done all” completes every open task with a single tap

- **Journey step:** End-of-day task check-in push.
- **Problem:**
  - `lib/line/flex/task-checkin.ts:89-99` shows a single footer button labeled **Done all** that posts `checkin:done:all`.
  - `lib/webhook-postback.ts:90-103` marks every open task done immediately.
- **User impact:** A single mis-tap while scrolling destroys the task list; the user must reopen tasks one by one.
- **Recommended fix:** Add a confirmation step (e.g., a second bubble *“Mark all N tasks done?”* with **Yes / No**) or move **Done all** behind a less prominent secondary action.

### H6. Proactive briefing “Email” channel is advertised but never delivered

- **Journey step:** Settings → Briefings → Channels; expecting morning/evening briefings via email.
- **Problem:**
  - `lib/line/flex/settings.ts:284-288` renders toggles for LINE chat, Email, and Push.
  - `lib/sweep.ts:82,125,160` only checks `briefingChannels.line !== false` and only ever calls `push(userId, msgs)`. There is no email-delivery path.
- **User impact:** Users enable email briefings, but nothing arrives, leading them to believe the feature is broken.
- **Recommended fix:** Either implement email briefing delivery (using the existing Gmail send path) or hide the Email/Push toggles until they are wired up.

### H7. Google re-auth from pending execution has no tappable button

- **Journey step:** Tapping **Yes** on a draft after the Google token has expired or been revoked.
- **Problem:**
  - `lib/pending-runner.ts:48-51,76-78,89-91` returns the plain-text string from `formatReconnectPrompt`.
  - `lib/tools/google-auth.ts:75-80` `formatReconnectPrompt` returns English-only text and no button.
  - Contrast with the main auth flow: `lib/enrich-reply.ts:34-39` adds a **Connect Google** quick reply.
- **User impact:** After confirming a draft, the user is told to type a specific phrase instead of tapping a button — extra friction on mobile.
- **Recommended fix:** When pending execution hits a Google auth error, return a `googleConnectFlex` card (or a quick reply) instead of plain text, and localize the message.

---

## Medium-Priority Findings

### M1. Group chat silently ignores non-text messages

- **Journey step:** Sending a photo, receipt, PDF, or voice note in a group after mentioning the bot.
- **Problem:** `lib/handlers/group-message.ts:36` returns `true` for any non-text message without handling it. There is no acknowledgment or media processing in groups.
- **User impact:** Users cannot scan receipts, summarize documents, or transcribe voice memos in group chats even though the bot is present.
- **Recommended fix:** Extend `handleGroupMessage` to route `image`, `video`, `audio`, and `file` messages through `respondToImage` / `respondToOtherMedia` when the message is an explicit mention/reply to the bot.

### M2. Settings prompt flow absorbs accidental text as values

- **Journey step:** Editing timezone, location, preferred name, or adding a fact via the settings menu.
- **Problem:**
  - `lib/settings-menu.ts:258-284` sets a pending prompt key.
  - `lib/settings-menu.ts:388-414` treats any non-`/` text as the value for that key.
- **User impact:** If the user accidentally sends *“hi”* or taps the wrong quick reply, it becomes a setting or fact. There is no visible **Cancel** button during the prompt.
- **Recommended fix:** Attach a **Cancel** quick reply to every prompt, and consider requiring confirmation for high-impact facts.

### M3. `agent-flex` caps output at 4 cards and can suppress explanatory text

- **Journey step:** Turns where multiple tools produce cards (e.g., morning briefing + news + inbox).
- **Problem:** `lib/llm/agent-flex.ts:1396-1397` returns `out.slice(0, 4)` and a blanket `suppressText` flag.
- **User impact:** The fifth card is silently dropped, and any model-generated explanation is suppressed whenever any card is rendered, even if the explanation adds value.
- **Recommended fix:** Rank cards by importance, drop the least important with a “…and N more” hint, and only suppress text when a display card fully replaces it.

### M4. Help/demo answers are English-only

- **Journey step:** Typing `/help` or tapping **Try it** on a help category.
- **Problem:**
  - `lib/line/flex/help.ts:11-89` `HELP_CATEGORIES` and demo answers are all English.
  - `lib/tools/help.ts:4-90` `HELP_TEXT` is English.
- **User impact:** Thai users cannot browse capabilities in Thai.
- **Recommended fix:** Localize `HELP_CATEGORIES`, demo answers, and `HELP_TEXT`; derive `uiLang` in `helpFlex`.

### M5. Dates/times in Flex cards always use `en-US`

- **Journey step:** Any card showing a date or time (drafts, tasks, calendar, reminders, scheduled emails, memories).
- **Problem:**
  - `lib/llm/agent-flex.ts:61-71` `fmtDateTime` uses `en-US`.
  - `lib/llm/agent-flex.ts:584-594` `draftFmtDate` uses `en-US`.
  - `lib/line/flex/task-list.ts:10-44` `formatDueDate` uses `en-US`.
- **User impact:** Thai users see English month names and AM/PM in cards.
- **Recommended fix:** Pass the user locale to all date formatters (e.g., `th-TH` for Thai users).

### M6. Group welcome message is English-only

- **Journey step:** Bot is added to an allowed group.
- **Problem:** `lib/handlers/group-lifecycle.ts:18` hardcodes `WELCOME_TEXT` in English.
- **User impact:** Thai-language groups get English onboarding instructions.
- **Recommended fix:** Localize the welcome message based on the inviter/admin language or group default.

### M7. Settings facts list shows raw English category names

- **Journey step:** Settings → Facts.
- **Problem:** `lib/line/flex/settings.ts:452` renders `[${f.category}] ${f.content}` using the raw category enum value.
- **User impact:** Thai users see categories like `preferences`, `people`, `deadlines`.
- **Recommended fix:** Translate categories through the existing i18n dictionary.

---

## Low-Priority Findings

### L1. Unknown postback fallback is English-only

- **Problem:** `lib/webhook-postback.ts:349` replies *“I didn't understand that button. Try typing your request instead.”*
- **User impact:** A Thai user who taps an unexpected button gets English text.
- **Recommended fix:** Localize through `t(settings.language, "unknownPostback")`.

### L2. Admin group-add notification is English-only

- **Problem:** `lib/line/flex/group-gate.ts:3-55` `newGroupAdminFlex` labels are all English.
- **User impact:** Admin notifications are English even when the admin uses Thai.
- **Recommended fix:** Localize or use simple icon-only labels.

### L3. `agent-flex` drops repeated results for the same tool

- **Problem:** `lib/llm/agent-flex.ts:894` skips a tool result if `seen.has(toolName)`.
- **User impact:** If the model calls the same tool twice (e.g., two `gmail_search` queries), only the first card is shown.
- **Recommended fix:** Deduplicate by tool-call ID or input, not by tool name.

### L4. Default briefing length “Headlines” hides agenda details

- **Problem:** `lib/memory/settings.ts:103` defaults `briefingLength` to `"Headlines"`, so new users only see section counts, not individual events/tasks.
- **User impact:** First-time users may think the briefing is empty or unhelpful.
- **Recommended fix:** Default to `"Bullets"` for richer first impressions.

---

## Summary

The strongest UX risks are **localization gaps** (English-only cards/proactive pushes for Thai users) and **fragile confirmation flows** (edit requests being treated as yes, custom inputs rejecting valid values, and a destructive “Done all” button). Fixing the top seven high-priority items would make the bot feel significantly more polished, trustworthy, and bilingual.
