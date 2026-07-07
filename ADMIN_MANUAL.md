# Lekha Admin & Command Manual

> **Last updated:** 2026-07-07  
> **Bot version:** matches `main` branch  
> **How to keep this alive:** when you add a new `/` command, new settings key, new admin flow, or new group behaviour, add a row/section here and bump the **Last updated** line. Treat this file as part of the shipped feature.

---

## 1. The one thing admins do most: let someone in

You do **not** need a user to paste their LINE ID. `/myid` replies with the ID as plain text, so they can select, copy, and paste it to an admin.

### Approval options (pick any)

| Method | How | Best for |
|---|---|---|
| **Tap buttons in `/pending`** | Type `/pending` → tap **✓ Allow** on the user's card | Cleanest; no IDs needed |
| **`/approve <LINE_USER_ID>``** | Approve by ID + auto-send welcome | They already sent you their ID |
| **`/allow <LINE_USER_ID>``** | Add directly to allowlist (bypasses pending queue) | You sourced the ID yourself |
| **`/promo <code>`** (user side) | User redeems `FREETRIAL100` → gets Team/allowed access automatically | Self-serve free trials |

When you tap **Allow** on a pending card, the bot:
- moves them from `users:pending` → `users:allowed`
- removes any trial flag
- sends a welcome push if they weren't already allowed
- logs `[admin] pending action via postback { admin, action, targetId }`

---

## 2. User-facing `/` slash commands

| Command | Who | What it does |
|---|---|---|
| `/help` | anyone | Help card and command list (also works as `help`) |
| `/myid` | anyone | Sends your LINE user ID as plain text |
| `/settings` | allowed/trial/admin | Opens settings menu |
| `/settings <section>` | allowed/trial/admin | Jumps to section: `briefing`, `tools`, `persona`, `memory`, `facts`, `locale` |
| `/settings:section:<section>` | allowed/trial/admin | Postback-style section jump |
| `/settings:<section>:set:<key>:<value>` | allowed/trial/admin | Direct setting change, e.g. `/settings:briefing:set:morningTime:07:30` |
| `/settings:toggle:<target>:off` | allowed/trial/admin | Disable `morning`, `evening`, or `checkin` |
| `/settings:facts:del:<id>` | allowed/trial/admin | Delete a saved fact |
| `/set <key> <value>` | allowed/trial/admin | Quick typed setting change |
| `/remember <fact>` | allowed/trial/admin | Save a fact to memory |
| `/tutorial` | anyone | Restart onboarding tutorial |
| `/promo <code>` | anyone | Redeem a promo code |

### `/set` keys and accepted values

| Key | Aliases | Value | Example |
|---|---|---|---|
| `timezone` | `tz` | IANA timezone | `/set timezone Asia/Tokyo` |
| `location` | `loc` | free text | `/set location Bangkok` |
| `language` | `lang` | `en`, `th`, `auto` | `/set language th` |
| `morning` | — | `HH:MM` or `off` | `/set morning 07:30` |
| `evening` | — | `HH:MM` or `off` | `/set evening 21:30` |
| `checkin` | — | `HH:MM` or `off` | `/set checkin 18:00` |
| `compact` | `compactat`, `memorycompactat` | integer `1–1000` | `/set compact 15` |
| `preferredname` | `personapreferredname` | free text | `/set preferredname Jim` |

### Settings sections and the keys inside them

#### `briefing`
- `morningBriefingTime` — `HH:MM` or `null`
- `eveningSummaryEnabled` — boolean
- `eveningSummaryTime` — `HH:MM`
- `taskCheckInEnabled` — boolean
- `taskCheckInTime` — `HH:MM` or derived from evening −30 min
- `inboxBriefingEnabled` — boolean
- `briefingTopics` — object of topic IDs → boolean (stocks, wellness, politics, crime, sports, business, entertain)
- `briefingLength` — `"Headlines"`, `"Bullets"`, `"Full"`
- `briefingLanguage` — `"English"`, `"ไทย"`, `"EN + ไทย"`
- `briefingChannels` — `{ line, email, push }` booleans

#### `tools`
- `tools` — `{ todo, reminders, calendar, email, drive }` booleans
- `disabledCategories` — derived array; do not edit directly

#### `persona`
- `personaTone` — `"Warm"`, `"Professional"`, `"Playful"`
- `personaAddressing` — `"First name"`, `"Khun"`, `"Sir / Madam"`, `"No address"`
- `personaPrimaryLang` — `"English"`, `"Thai"`
- `personaVoiceMatch` — boolean
- `personaPreferredName` — string or null

#### `memory`
- `memoryEnabled` — boolean
- `memoryCompactAt` — integer, messages between compactions

#### `locale`
- `timezone` — IANA string
- `location` — free text
- `language` — `en`, `th`, or null (auto)

#### `facts`
- Displays saved facts with **Delete** buttons.
- Facts have: `id` (short hex), `category`, `content`, `createdAt`, `updatedAt`, optional `confidence`, optional `priority`.
- Default category when added via `/remember` is `other`.
- Categories used internally: `preferences`, `people`, `habits`, `deadlines`, `context`, `health`, `work`, `other`.

---

## 3. Admin-only `/` slash commands

| Command | Arguments | What it does |
|---|---|---|
| `/allow <LINE_USER_ID>` | full LINE ID | Adds to allowlist, removes trial |
| `/remove <LINE_USER_ID>` | full LINE ID | Removes from allowlist |
| `/users` | — | Lists every known user with status tags: `ADMIN`, `allowed`, `trial`, `team` |
| `/pending` | — | Shows pending queue as Flex cards with **Allow / Deny** buttons |
| `/approve <LINE_USER_ID>` | full LINE ID | Approve from pending + send welcome |
| `/deny <LINE_USER_ID>` | full LINE ID | Remove from pending queue |
| `/allowgroup <GROUP/ROOM_ID>` | `C…` or `R…` ID | Allow a group/room |
| `/removegroup <GROUP/ROOM_ID>` | `C…` or `R…` ID | Remove group/room from allowed list |
| `/groups` | — | Shows allowed + discovered groups with **Allow / Remove** buttons |
| `/promo create <code> [allowed\|team] [uses] [days]` | e.g. `/promo create DEMO team 10 7` | Creates a promo code |
| `/promos` | — | Lists all promo codes |
| `/promo delete <code>` | code | Deletes a promo code |
| `/status <LINE_USER_ID>` | full LINE ID | Full diagnostic: admin/allowed/trial/team, settings, locks, last activity |
| `/audit <LINE_USER_ID> [n]` | full LINE ID, optional count `1–100` | Last `n` tool-call audit entries (default 5, max 100) |
| `/force-briefing <LINE_USER_ID> [morning\|evening]` | full LINE ID, kind | Manually push a briefing/summary |

### Why `/users` now shows more than just "allowed"

A user can be in several states at once:

- **ADMIN** — in `ADMIN_LINE_USER_ID` env var; bypasses all gates.
- **allowed** — in `users:allowed` Redis set.
- **trial** — in `users:trial` (e.g. started a free trial but hasn't redeemed a promo).
- **team** — in `users:team` (e.g. redeemed `FREETRIAL100` or paid Team plan).

So you will now see lines like:

```
James (U9b7…) [ADMIN]
Keno (U4e1…) [allowed]
dang (Ue00…) [trial]
SKY~💕 (U898…) [trial]
Pol (U7c4…) [ADMIN]
pang (Ub81…) [allowed]
```

This is why Keno and Pang show `allowed` — they explicitly used `/promo FREETRIAL100`, which writes them into `users:allowed` (or `users:team` depending on the code grant). James and Pol are `ADMIN`. Dang and Sky are on free trial (`trial`).

---

## 4. Group management

### How the bot knows about groups

- When the bot is **added to any group or room**, it stores the ID in `groups:discovered`.
- If the inviter is an **admin**, the group is automatically added to `groups:allowed`.
- If the inviter is **not an admin**, the group sees the Team paywall, and every admin gets a push notification with **Allow / Ignore** buttons.
- When the bot leaves or is removed, the group is removed from `groups:allowed` and `groups:discovered`.

### How to allow a group for free

| Method | Steps |
|---|---|
| **Tap the admin notification** | When a non-admin adds the bot, admins get a Flex card. Tap **✓ Allow**. |
| **`/groups`** | Type `/groups` → see discovered groups → tap **✓ Allow**. |
| **`/allowgroup <GROUP_ID>``** | Type the exact group/room ID. |
| **Add to `ADMIN_GROUP_IDS`** | Vercel env var; permanent, survives restarts. |

### How users talk to the bot in a group

LINE does **not** show bots in the group `@` autocomplete, so members cannot pick Lekha from the mention picker. They can still invoke the bot with:

1. **`@Lekha` typed manually** at the start of a message (case-insensitive).
2. **The name at the start** — e.g. `Lekha, what's the weather?`.
3. **A reply to any of the bot's messages** — swipe/right-click the bot's message and hit reply; the bot treats that as a direct invocation, no `@` needed.

> Tip: the bot's join message already tells members they can mention `@Lekha` or reply to its messages.

### `/groups` output

- **✅ Allowed groups** — already authorised (`groups:allowed` + `ADMIN_GROUP_IDS`).
- **⏳ Discovered, not allowed** — bot is in the group but it cannot respond yet. Tap **Allow** to activate.
- Each card shows the full group/room ID and a short prefix, plus an action button.

---

## 5. Promo codes

Promo codes live in Redis at `promo:<CODE>`.

| Field | Meaning |
|---|---|
| `grant` | `"allowed"` (personal access) or `"team"` (Team access) |
| `usesLeft` | how many redemptions remain |
| `expiresAt` | epoch ms expiration |
| `createdBy` | admin LINE ID |
| `usedBy` | set of user IDs who already redeemed |

`/promo FREETRIAL100` is the current self-serve code. When a user redeems, the bot logs:

```
[promo] redeem attempt { userId, code, ok, grant, error }
```

---

## 6. Audit & status

### `/audit <id> [n]`

- Shows the last `n` turns for a user (default 5, max **100**).
- Each entry includes: timestamp, hint, user message, every tool call (input/output), errors, and the final reply.
- Use this to trace exactly what the bot did and why.

### `/status <id>`

- Admin / allowed / trial / team flags
- Timezone, morning/evening/check-in times
- Whether LINE pushes are enabled
- Last briefing/summary timestamps
- Today's push locks
- Last activity relative time

---

## 7. Push vs reply: when the bot uses each

| Scenario | Method | Counts against push quota? |
|---|---|---|
| Answering a message you just sent | **reply** (uses replyToken) | No |
| Proactive briefings, reminders, alerts | **push** | Yes |
| Admin notifications for new groups | **push** | Yes |
| Welcome message after `/approve` | **push** | Yes |
| `/myid` | **reply** | No |
| `/pending`, `/users`, `/groups` | **reply** | No |

We prefer replies whenever there is a reply token, to save push quota.

---

## 8. Fact storage deep reference

Facts are stored per user at `user:{userId}:facts:v2`.

### Fact shape

```ts
{
  id: string;           // short hex, e.g. "a1b2c3d4e5f6"
  category: "preferences" | "people" | "habits" | "deadlines" | "context" | "health" | "work" | "other";
  content: string;      // max 1000 chars
  createdAt: number;
  updatedAt: number;
  confidence?: number;  // optional 0–1
  priority?: number;    // optional; higher = shown first in prompt
}
```

### How facts are added

- `/remember <fact>` → category `other`
- Background extraction after every `memoryCompactAt` turns → categorized automatically
- Document / image analysis can create facts with higher `priority`

### How facts are removed

- Settings → **Facts** section → tap **Delete** on a fact card (`/settings:facts:del:<id>`)
- There is no bulk-delete command by design

---

## 9. Changelog / future additions

Use this section as a running log. Add a bullet every time the manual is updated.

- **2026-07-07** — Converted `=` commands to `/` commands; added `/myid` plain-text reply; added group discovery and admin `/groups` Flex cards; increased `/audit` max to 100; improved `/users` status logging; created this manual.

---

## 10. Quick admin cheat sheet

```
/users              → see everyone and their tags
/pending            → approve/deny with buttons
/allow <id>         → add someone directly
/approve <id>       → approve from pending + welcome
/groups             → see/allow discovered groups
/allowgroup <id>    → allow a group by ID
/promos             → list promo codes
/promo create X team 50 30
/status <id>        → full user diagnostic
/audit <id> 20      → last 20 turns
/force-briefing <id> morning
```
