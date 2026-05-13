# Audit: Test Plan

## What to test and why

The codebase has zero tests. The highest-value targets are pure functions with non-obvious invariants — cryptography, time math, and validation — plus the structural patterns that prevent data corruption (atomic queues, error return contract).

No test runner is installed. Plan: add `vitest` + `@types/vitest` to devDependencies, configure `vitest.config.ts`, and write unit tests in `tests/`.

---

## Test targets by priority

### P0 — `lib/memory/crypto.ts`

The encryption layer protects OAuth refresh tokens at rest. Bugs here are unrecoverable.

- `encrypt` / `decrypt` round-trip: `decrypt(encrypt(s)) === s` for ASCII, UTF-8 multi-byte (Thai), empty string, long string (>50KB)
- Modified ciphertext rejected: flip one byte in the blob → `decrypt` throws (GCM auth tag verification)
- Modified IV rejected: flip one byte in the IV portion → `decrypt` throws
- Modified auth tag rejected: flip one byte in bytes 12–27 → `decrypt` throws
- Two encryptions of the same plaintext produce different ciphertexts (IV randomness)
- `hmac` is deterministic: same inputs → same output
- `safeEqual` returns false for strings of different length (without timing leak)
- `safeEqual` returns true for identical strings

### P0 — `lib/line/verify.ts`

LINE signature verification is the outermost security gate.

- Valid HMAC → `true`
- `null` header → `false`
- Wrong secret → `false`
- Truncated signature → `false` (different length)
- Extended signature → `false` (different length)
- Empty body → verifies correctly when expected HMAC matches

### P0 — `lib/tools/google-auth.ts` — connect-link token

- `buildConnectUrl` + `verifyConnectToken` round-trip succeeds (mocked Redis `set`/`getdel`)
- Expired token (`expiresAt` in the past) → throws `"expired"`
- Tampered signature → throws `"bad signature"`
- Already-consumed token (`getdel` returns null) → throws `"link already used or expired"`
- Malformed token (not 3 dot-separated parts) → throws `"malformed token"`

### P1 — `lib/cron.ts` — `localTimeToUtcCron`

- `"07:00"` in `"Asia/Bangkok"` (UTC+7) → `"0 0 * * *"` (midnight UTC)
- `"09:00"` in `"America/New_York"` (UTC-5 in winter) → `"0 14 * * *"`
- `"07:30"` in `"Asia/Kolkata"` (UTC+5:30) → `"0 2 * * *"` — tests half-hour offset
- Invalid `hhmm` format → `null`
- Out-of-range hour/minute → `null`
- `"00:00"` in UTC → `"0 0 * * *"`

### P1 — `lib/tools/drive.ts` — `drive_upload_recent_media` P0 bug

- Invalid index when staged list has 2 items: tool returns `{ok:false,error:...}`, does NOT throw
- Valid index executes (integration mock only — verify no throw path)

### P2 — `lib/confirm.ts` — pending queue classification

- `classify("yes")` → `"yes"` (case-insensitive variants: "Yes", "YES", "y", "yeah", "yep", "sure", "ok")
- `classify("no")` → `"no"` (case-insensitive variants: "No", "NO", "nope", "cancel")
- `classify("remind me tomorrow")` → `"neither"`
- `classify("")` → `"neither"`

### P2 — `lib/llm/render-drafts.ts` — draft block rendering

- Email draft renders: to, subject, body; omits empty cc/bcc
- Calendar draft renders: title, start, end, attendees (optional)
- Mixed drafts (email + calendar) renders both
- Timezone: currently hardcoded Bangkok — test exists to detect when this is fixed

### P2 — `lib/memory/facts.ts` — facts CRUD

- `appendFact`: facts stored and retrieved
- `updateFact`: updates by index, returns `{ok:false}` on bad index
- `removeFact`: removes by index, returns `{ok:false}` on bad index
- `clearFacts`: all removed
- Size cap at ~4KB (via truncation) — append beyond cap doesn't grow unboundedly

### P2 — `lib/llm/briefing.ts` / `lib/llm/evening-summary.ts` — fire-gate functions

- `shouldFireBriefingNow("07:00", null, "Asia/Bangkok")` → `true` when local time is 07:00–07:14, `false` at 06:59 and 07:15
- `shouldFireBriefingNow("07:00", Date.now() - 1 * 60 * 60 * 1000, "Asia/Bangkok")` → `false` (fired 1h ago, within 12h guard)
- `shouldFireBriefingNow("07:00", Date.now() - 13 * 60 * 60 * 1000, "Asia/Bangkok")` → `true` (fired 13h ago, past 12h guard)
- `shouldFireBriefingNow(null, null, "Asia/Bangkok")` → `false` (no briefing time set)
- Same cases for `shouldFireEveningSummaryNow`

### P3 — `lib/memory/tasks.ts` — task NaN bug

- `add_task` with `dueAt: "not-a-date"` → returns `{ok:false,error:...}` (currently silently stores NaN — test documents the existing broken behavior so fix is detectable)
- `add_task` with valid ISO string → `dueAt` is finite number in stored record

---

## Test infrastructure

### `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
  },
});
```

### `package.json` additions

```json
"scripts": {
  "test": "vitest run",
  "test:watch": "vitest"
},
"devDependencies": {
  "vitest": "^3.0.0",
  "@vitest/coverage-v8": "^3.0.0",
  "vite-tsconfig-paths": "^5.0.0"
}
```

### Mocking strategy

- `lib/memory/redis.ts` — mock the singleton; inject a fake client per test
- `lib/tools/google-auth.ts` — mock `redis()` calls; don't hit real Redis
- `lib/env.ts` — stub `env()` to return test credentials

All tests should be pure unit tests. No network calls, no Redis, no Google APIs.

---

## CI — `.github/workflows/ci.yml`

Run on every push to `main` and every PR:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:

jobs:
  typecheck-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
        env:
          TOKEN_ENCRYPTION_KEY: ${{ '0'.repeat(64) }}
          OAUTH_STATE_SECRET: ${{ 'x'.repeat(32) }}
          APP_BASE_URL: https://test.example.com
          LINE_CHANNEL_SECRET: test
          LINE_CHANNEL_ACCESS_TOKEN: test
```

(Env vars needed because `env()` is called at module load in some paths. Tests should override with stubs.)

---

## Coverage targets (not enforced, but aim for)

| Module | Target |
|--------|--------|
| `lib/memory/crypto.ts` | 100% |
| `lib/line/verify.ts` | 100% |
| `lib/cron.ts` | 90% |
| `lib/confirm.ts` | 80% |
| `lib/llm/briefing.ts` (pure fns only) | 80% |
