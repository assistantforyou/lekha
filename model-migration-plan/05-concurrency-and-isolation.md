# Concurrency & Session Isolation Audit

This document verifies that Lekha can safely handle thousands of concurrent users without session leakage, cross-user memory contamination, shared mutable state, race conditions, or unsafe caching. Where gaps exist, concrete fixes are provided.

## Verdict Summary

| Concern | Status | Notes |
|---|---|---|
| Per-user Redis key isolation | ✅ Strong | All state keyed by `userId` |
| Cross-user in-memory leakage | ⚠️ Minor | `contentCache` keyed by `messageId` only |
| Same-user concurrent mutation | ❌ Unsafe | Read-modify-write on facts, settings, tasks, accounts |
| Request-scoped context | ⚠️ Missing | No per-request transaction context |
| Distributed deployment safety | ❌ Partial | In-process caches do not invalidate across Vercel instances |
| Async safety | ⚠️ Partial | Some operations atomic, many are not |
| Queue safety | ❌ Partial | Pending/reminder/scheduled-email consume-before-send |
| Database transaction safety | ❌ Partial | Redis used as store; no cross-key transactions |

---

## 1. Session Isolation

### 1.1 Redis key isolation

All durable state uses user-scoped keys:

- `user:{userId}:history`
- `user:{userId}:settings`
- `user:{userId}:tasks`
- `pending:{userId}`
- `recent_media:{userId}`
- `google:tokens:{userId}:{email}`
- `reminder:{userId}:{id}`
- `pushlock:{userId}:{type}:{date}`

**Conclusion:** Strong. There is no shared key space between users.

### 1.2 Global sets

- `users:allowed`, `users:pending`, `users:active` are global access-control sets.
- These contain only `userId` strings, not user data.

**Conclusion:** Acceptable.

### 1.3 In-process caches

| Cache | Location | Key | Risk |
|---|---|---|---|
| `settingsCache` | `lib/memory/settings.ts:212` | `userId` | Stale reads across instances and concurrent same-user requests |
| `factsCache` | `lib/memory/facts.ts:56` | `userId` | Same |
| `accountsCache` | `lib/tools/google-auth.ts:47` | `userId` | Same |
| `toolCache` | `lib/tools/index.ts:35` | `userId + config` | Deterministic; safe but per-instance bloat |
| `weatherCache` | `lib/tools/weather.ts:6` | location query | Per-instance; unbounded growth |
| `contentCache` | `lib/line/client.ts:9` | `messageId` | Potential cross-user leak if LINE reuses IDs |

**Fixes:**
1. Key `contentCache` by `${userId}:${messageId}`.
2. Remove `settingsCache` or reduce TTL to 0; settings are small and correctness matters more than micro-optimization.
3. Remove `factsCache` and `accountsCache` or replace with Redis-backed short-TTL cache with explicit invalidation.
4. Cap `weatherCache` size or move to Redis.

---

## 2. Race Conditions

### 2.1 Critical: read-modify-write JSON blobs

These operations load the entire object, mutate in JavaScript, and write back:

- **Facts:** `appendFact`, `updateFact`, `removeFact` (`lib/memory/facts.ts:66-160`)
- **Settings:** `updateSettings` (`lib/memory/settings.ts:241-272`)
- **Tasks:** `completeTask`, `reopenTask`, `updateTask`, `completeAllOpenTasks`, `deleteTask` (`lib/memory/tasks.ts:44-160`)
- **Google accounts:** `addAccount`, `setActiveAccount`, `removeAccount` (`lib/tools/google-auth.ts:167-250`)

**Impact:** Two concurrent requests for the same user will load the same blob, each modify it, and the last write wins — one update is silently lost.

**Fix options:**

1. **Lua script atomic update** (recommended for facts/settings):
   ```lua
   local key = KEYS[1]
   local patch = ARGV[1]
   local current = redis.call('GET', key)
   local data = cjson.decode(current or '{}')
   local patchObj = cjson.decode(patch)
   for k, v in pairs(patchObj) do data[k] = v end
   redis.call('SET', key, cjson.encode(data))
   return cjson.encode(data)
   ```

2. **Redis JSON** (if available) for per-field updates.

3. **Per-user lock** (`SET user:{id}:lock 1 NX EX 5`) around read-modify-write.

4. **Migrate tasks to hash + sorted set** (recommended):
   - Store each task as `HSET user:{userId}:task:{taskId} ...`
   - Maintain index `ZADD user:{userId}:tasks:open createdAt taskId`
   - `completeTask` becomes `HSET` + `ZREM` + `ZADD` to done index.

### 2.2 Pending action queue

Flow in `app/api/line/webhook/route.ts:206-229`:
1. `getPending(userId)` → `LRANGE pending:{userId}`
2. `executePendingAll(userId)`
3. `clearPending(userId)` → `DEL pending:{userId}`

**Impact:** Two concurrent requests both read the same pending list, both execute, both delete. Duplicate sends and lost newly appended actions.

**Fix:** Atomic pop-all-and-process:

```lua
local key = KEYS[1]
local items = redis.call('LRANGE', key, 0, -1)
redis.call('DEL', key)
return items
```

Or acquire a per-user processing lock for the duration of execution.

### 2.3 Settings migration race

`getSettings` applies migrations and writes back if version changed. Two concurrent first reads can both see the old version and both write back, potentially corrupting `userConfigured`.

**Fix:** Use `SET NX` on a migration lock key:

```
SET user:{userId}:settings:migrating 1 EX 10 NX
```

Only proceed if lock acquired.

### 2.4 Profile first-contact race

`lib/memory/profile.ts:11-20`:

```ts
const existing = await redis().get<Profile>(key(userId));
if (existing) return existing;
const lp = await getProfile(userId);
...
await redis().set(key(userId), profile);
```

**Impact:** Two concurrent first messages both see `existing === null` and both fetch/create profile.

**Fix:**

```ts
const created = await redis().set(key(userId), profile, { nx: true, ex: 0 });
if (!created) return await redis().get<Profile>(key(userId)) ?? profile;
```

### 2.5 Google token refresh race

`lib/tools/google-auth.ts:298-307` asynchronously overwrites encrypted tokens on refresh. Concurrent requests may refresh simultaneously and last write wins.

**Fix:** Use per-user refresh lock:

```ts
const lock = await redis().set(`google:refresh_lock:${userId}:${email}`, 1, { nx: true, ex: 10 });
if (!lock) { /* wait and re-read */ }
```

### 2.6 Fact extraction duplication

`maybeExtract` fires every 10 turns with no lock. Concurrent requests for the same user run extraction in parallel, wasting tokens and possibly creating duplicate facts.

**Fix:**

```ts
const lock = await redis().set(`extract:${userId}`, 1, { nx: true, ex: 60 });
if (!lock) return;
```

### 2.7 Atomic operations that are correct

These already use atomic primitives:

- `appendTurn`: `MULTI` with `LPUSH`/`LTRIM` (`lib/memory/history.ts:38-42`)
- `appendRecentMedia`: `MULTI` with `RPUSH`/`LTRIM`/`EXPIRE` (`lib/memory/recent-media.ts:24-31`)
- `appendPending`: `MULTI` with `RPUSH`/`EXPIRE` (`lib/confirm.ts:59-65`)
- `consumeReminder`: `GETDEL` (`lib/tools/reminders.ts:282-287`)
- `consumeScheduledEmail`: `GETDEL` (`lib/tools/scheduled-email.ts:145-150`)
- `claimPushLock`: `SET NX` (`lib/sweep.ts:56-60`)

---

## 3. Thread / Async Safety

### 3.1 Singleton Redis client

`lib/memory/redis.ts` exports a singleton. Node.js is single-threaded with an event loop, so the client is safe as long as no async yield happens between a read and a dependent write within the same request. Many of the read-modify-write patterns violate this.

**Fix:** See Section 2.

### 3.2 Tool execution

The AI SDK may call tools in parallel within one step. Tools that mutate the same Redis key (e.g., `remember` + `update_memory`) race.

**Fix:** Make memory tools atomic or serialize memory mutations per user within a turn.

### 3.3 `after()` block

Next.js `after()` runs after the response is sent. If it throws, the error may be unhandled and the runtime may kill the function instance, losing in-flight work for other users.

**Fix:** Wrap every event handler in `try/catch`; never throw from `after()`.

---

## 4. Queue Safety

### 4.1 Reminders

Final reminder is consumed (`GETDEL`) before the LINE push. If push fails and QStash retries, the reminder is gone.

**Fix:**

```ts
// Push first
await pushMessage(userId, text);
// Then consume
await consumeReminder(userId, id);
// Use idempotency lock to prevent duplicate pushes on retry
await redis().set(`fired:${id}`, 1, { nx: true, ex: 86400 });
```

### 4.2 Scheduled emails

Schedule is consumed before `sendEmail`. On failure, the schedule is gone.

**Fix:** Do not consume until send succeeds. Return 5xx for transient failures so QStash retries. Add idempotency lock.

### 4.3 Pending actions

See Section 2.2.

---

## 5. Database Transaction Safety

Redis does not support multi-key ACID transactions across arbitrary keys. The code uses `MULTI/EXEC` for single-key operations but not for cross-key consistency.

Cross-key inconsistencies to address:

1. **Task + QStash warning:** A task is persisted but the deadline warning fails to schedule. The task exists without a warning.
   - Fix: schedule warning first, then persist task. On failure, clean up.

2. **Archive Redis + vector index:** Archive summary written to Redis but vector upsert fails.
   - Fix: treat vector upsert as best-effort; log divergence; optionally retry.

3. **Settings + user registry:** Not critical; eventual consistency is acceptable.

---

## 6. Distributed Deployment Safety

Vercel Functions are stateless and may run many instances. In-process caches (`settingsCache`, `factsCache`, `accountsCache`, `weatherCache`, `toolCache`) are not shared.

**Implications:**
- A user updates settings on instance A; instance B serves stale settings for up to 5s.
- A user connects Google on instance A; instance B's `accountsCache` is stale for 30s.
- Tool cache includes env state (e.g., Tavily key removal); other instances keep stale tools for 5 min.

**Fixes:**
1. Remove short-lived in-process caches for mutable data.
2. Use Redis as single source of truth.
3. For deterministic tool building, keep `toolCache` but include env hash in key and document per-instance limitation.

---

## 7. Validation Tests

Add these tests to prove isolation and concurrency safety:

1. **Parallel fact append:** Two `appendFact` calls for the same user; assert both facts survive.
2. **Parallel task update:** `completeTask` and `updateTask` concurrently; assert no lost update.
3. **Parallel settings patch:** Two `updateSettings` calls with different fields; assert both changes merge.
4. **Pending queue isolation:** Two concurrent consumers; assert actions execute exactly once.
5. **Cross-user read:** Request data for user A with user B's handler context; assert unauthorized.
6. **Cache invalidation:** Update settings, then read from a fresh cache instance; assert new value.

---

## 8. Fix Priority

| Priority | Fix |
|---|---|
| P0 | Make pending-action consumption atomic |
| P0 | Migrate tasks from list to hash + sorted set |
| P0 | Atomic updates for facts, settings, Google accounts |
| P1 | Add locks for fact extraction, token refresh, settings migration |
| P1 | Fix consume-before-send for reminders and scheduled emails |
| P2 | Remove or Redis-back in-process mutable caches |
| P2 | Key `contentCache` by `${userId}:${messageId}` |
| P2 | Add cross-key consistency checks |

---

## 9. Conclusion

Session isolation at the storage layer is good, but the system is **not safe under concurrency** because of pervasive read-modify-write patterns and stale per-instance caches. The fixes above must be implemented before scaling to thousands of concurrent users. The task store refactor and atomic pending queue are the highest-impact changes.
