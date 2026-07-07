# Group chat support

Lekha works in both 1:1 LINE chats and LINE group/room chats. The 1:1 experience is unchanged.

## Behaviour in groups

In a group, Lekha behaves like another participant:

- It only replies when explicitly invoked.
- It reads the recent group discussion before responding.
- It acts on behalf of the member who invoked it.

Invocation signals:

- A LINE mention (`@Lekha`) — preferred.
- A message that starts with `@Lekha`, `Lekha,`, `Lekha:`, etc.
- A reply to a recent Lekha message (quote-token aware where possible).

General group chatter is silently logged for context but ignored.

## Context management

Group context is stored separately from personal history:

- Key pattern: `group:{groupId}:history` or `room:{roomId}:history`.
- Rolling window capped at 50 messages.
- 30-day TTL, refreshed on every message.
- Speaker display names are cached per group for one day.
- The most recent 20 messages are injected into the model prompt as `[Name]: text` lines.

Personal history, facts, settings, tasks, and reminders remain keyed by the invoking user's LINE user ID.

## Access control

Group use is gated by `hasGroupAccess({ userId, groupId, gate })`. Access is granted when any of:

1. The invoking user is an admin (`ADMIN_LINE_USER_ID`).
2. The group/room is in `groups:allowed`.
3. The group/room ID is in `ADMIN_GROUP_IDS`.
4. The invoking user has a Team subscription (`users:team`).

This keeps billing enforcement separate from feature implementation.

## Team subscription

The Team plan unlocks group chat:

- Monthly: ฿800
- Yearly: ฿8,000

Stripe checkout sets `plan` metadata to `team_monthly` or `team_yearly`. The webhook adds the user to `users:team`. Cancelation removes them.

Admins and pre-authorised groups bypass Team billing entirely.

## Admin commands for groups

Inside a group, admins can run:

- `/allowgroup <groupId>` — authorise the group.
- `/removegroup <groupId>` — revoke the group.

Group IDs look like `C…` (group) or `R…` (room).

## Lifecycle events

| Event | Action |
|---|---|
| Bot added to group/room by an admin | Auto-adds the group to `groups:allowed` and sends a welcome message. |
| Bot added by a non-paying user | Sends a one-time Team plan info card. |
| Bot removed / kicked | Removes the group from `groups:allowed` and clears its history + profile cache. |

## Configuration

Set these environment variables:

- `LINE_BOT_USER_ID` — the bot's own LINE user ID (for mention/leave detection).
- `ADMIN_LINE_USER_ID` — comma-separated admin LINE user IDs.
- `ADMIN_GROUP_IDS` (optional) — comma-pre-authorised group/room IDs.
- `STRIPE_TEAM_MONTHLY_PRICE_ID` / `STRIPE_TEAM_YEARLY_PRICE_ID` (+ test variants) — required only to sell Team plans.
