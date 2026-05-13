# Audit: Security

Legend: ✅ good | ⚠️ concern | ❌ bug/vulnerability

---

## Cryptography

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| AES-256-GCM token encryption | `lib/memory/crypto.ts:4-17` | ✅ | 12-byte random IV per encrypt. Auth tag (GCM) verified on decrypt. `Buffer.concat([iv, tag, ct]).toString("base64url")`. Correct. |
| AES-256-GCM key validation | `lib/env.ts:35` | ✅ | Regex `/^[0-9a-f]{64}$/` enforced at boot via Zod. 64 hex = 32 bytes. |
| HMAC-SHA256 connect-link | `lib/tools/google-auth.ts:60` | ✅ | `hmac(payload, OAUTH_STATE_SECRET)`. Secret min-32-byte enforced at boot (`lib/env.ts:36`). |
| HMAC comparison — timing safe | `lib/memory/crypto.ts:37-41` | ✅ | Length check before `timingSafeEqual`. Prevents timing oracle on length. |
| LINE signature verification | `lib/line/verify.ts:7-21` | ✅ | HMAC-SHA256 on raw body. Length-safe before `timingSafeEqual`. Runs on raw body before JSON parse in webhook handler. |
| Encrypted token storage | `lib/tools/google-auth.ts:126` | ✅ | `redis().set(tokensKey(...), encrypt(JSON.stringify(toStore)))`. Token decrypted on read. |
| IV uniqueness | `lib/memory/crypto.ts:12` | ✅ | `crypto.randomBytes(12)` per call. No IV reuse possible. |

---

## OAuth and token security

| Check | Location | Status | Notes |
|-------|----------|--------|-------|
| CSRF state — server-side nonce | `lib/tools/google-auth.ts:85-86` | ✅ | UUID nonce stored in Redis with 10-min TTL. |
| CSRF state — single-use | `lib/tools/google-auth.ts:103` | ✅ | `getdel` consumes atomically on callback. Replay attack returns error. |
| Connect-link token — HMAC + single-use | `lib/tools/google-auth.ts:57-79` | ✅ | HMAC-signed payload + Redis marker consumed via `getdel`. Replay returns error. Expiry verified server-side. |
| Open redirect on `/connect/[token]` | `app/connect/[token]/page.tsx:23-24` | ✅ | Redirect target is `generateAuthUrl()` from Google OAuth2 library — not user-controlled. |
| OAuth callback `state` verified atomically | `lib/tools/google-auth.ts:103-104` | ✅ | `getdel` returns `null` on replay. |
| Refresh token at rest | `lib/tools/google-auth.ts:126` | ✅ | AES-256-GCM encrypted. |
| `disconnect_google_account` does NOT revoke at Google | `lib/tools/google-accounts.ts:48` | ⚠️ | Removes from Redis only. Google token remains valid. If stored tokens were compromised before disconnect, attacker retains access. P3. |
| Missing `refresh_token` guard | `lib/tools/google-auth.ts:107-111` | ✅ | Checks `tokens.refresh_token` and throws with instructions to revoke and retry. |

---

## Request authenticity and authorization

| Check | Location | Status | Notes |
|-------|----------|--------|-------|
| LINE webhook signature | `app/api/line/webhook/route.ts:43` | ✅ | Before JSON parse. Returns 401 immediately. |
| QStash signature — reminders | `app/api/reminders/fire/route.ts:32-40` | ✅ | `Receiver.verify()` before body parse. Returns 401 on failure. |
| QStash signature — scheduled-email | `app/api/scheduled-email/fire/route.ts:27-35` | ✅ | Same pattern. |
| QStash signature — cron sweep | `app/api/cron/sweep/route.ts:37-46` | ✅ | With ops bypass via `Authorization: Bearer <OAUTH_STATE_SECRET>`. Acceptable for manual testing. |
| Allowlist gate | `app/api/line/webhook/route.ts:84` | ⚠️ | If `ADMIN_LINE_USER_ID` is not set in env, `adminIds.size === 0` → gate condition is false → ALL users pass. Intended for dev but risky if env var is accidentally unset in production. P2. |
| UserId isolation | All `lib/memory/*.ts` | ✅ | Every Redis key function takes `userId` from the verified webhook source. Tools never accept userId as an argument — userId is bound at `toolsForUser(userId)` call time. No cross-user key access possible. |
| Rate limiting | `lib/ratelimit.ts:8-11` | ✅ | Upstash sliding window 30 req/hr/userId. Applied before LLM in webhook handler. |

---

## Injection vectors

| Type | Location | Status | Notes |
|------|----------|--------|-------|
| Redis key injection | All `lib/memory/*.ts` | ✅ | `userId` comes from LINE webhook (HMAC-verified). User-supplied strings embedded in Redis keys only appear via `userId`, which passes through Zod `z.string().min(1)` at line 11 of fire routes and is sourced from `event.source.userId` in the webhook. No freeform injection. |
| SSRF via user-supplied URLs | `lib/tools/finance.ts:55`, `weather.ts:54` | ✅ | All fetch base URLs are hardcoded strings. User-supplied parameters are interpolated with `encodeURIComponent()` only. No user-controlled URL base. |
| HTML injection in OAuth callback | `app/api/oauth/google/callback/route.ts:93-99` | ✅ | `escapeHtml()` applied to all injected content (`email`, error strings). |
| Prompt injection via display name | `lib/llm/prompts.ts:74-75` | ⚠️ | `profile.displayName` injected directly into system prompt: `"The user's LINE display name is "${profile.displayName}"."` No sanitization. A user with a name like `". Ignore all previous instructions and ...` could attempt jailbreak. Acceptable risk for a private allowlist-gated bot — all users are trusted. P3. |
| Prompt injection via location | `lib/llm/prompts.ts:77` | ⚠️ | Same — `settings.location` injected directly. User can set any string via `set_location` tool. Same risk level. P3. |
| SQL injection | n/a | ✅ | No SQL database. |

---

## Dependency vulnerabilities (npm audit)

| Package | Severity | CVE | Impact |
|---------|----------|-----|--------|
| `next <16.2.5` | **HIGH** | GHSA-8h8q-6873-q5fj | DoS via Server Components (score 7.5) |
| `next <16.2.5` | **HIGH** | GHSA-c4j6-fc7j-m34r | SSRF via WebSocket upgrades (score 8.6) |
| `next <16.2.5` | **HIGH** | GHSA-492v-c6pp-mqqv | Middleware/Proxy bypass via dynamic route param injection (score 8.1) |
| `next <16.2.5` | **HIGH** | GHSA-267c-6grr-h53f | Middleware/Proxy bypass via segment-prefetch routes (score 7.5) |
| `next <16.2.5` | HIGH | GHSA-ffhc-5mcf-pf4q | XSS via CSP nonces in App Router |
| `next <16.2.5` | HIGH | GHSA-gx5p-jg67-6x7h | XSS in beforeInteractive scripts |
| `next <16.2.5` | HIGH | (multiple) | Cache poisoning (2 more) |
| `next <16.2.5` | HIGH | (multiple) | Middleware bypass incomplete fix follow-up |
| `postcss <8.5.10` | moderate | GHSA-qx2v-qp2m-jg93 | XSS via unescaped `</style>` in CSS stringify |

**Fix:** bump `"next": "^16.2.5"` (or latest patch) in `package.json`. `npm audit fix` resolves all. **P1.**

Note: The SSRF (score 8.6) and middleware bypass (score 8.1) CVEs are particularly relevant. This app uses App Router with no middleware, so bypass risk is lower, but the SSRF applies to WebSocket upgrade paths generally.

---

## Information leakage

| Check | Location | Status | Notes |
|-------|----------|--------|-------|
| **VERBOSE DEBUG MODE** | `app/api/line/webhook/route.ts:622-638` | ❌ | `verboseError(err)` at line 635, 638 surfaces full error chains (class, message, statusCode, URL, responseBody up to 400 chars, cause chain up to depth 4) to LINE users. Stack traces and API response bodies from Google/Gemini/QStash are visible to end users. **P0.** |
| Env vars not leaked via health | `app/api/health/route.ts` | ✅ | Returns only `{ok, ts}`. No env data. |
| `export_my_data` excludes tokens | `lib/tools/export.ts:12` | ✅ | Explicitly excludes OAuth tokens from the data export. |
| Error messages from Google APIs | `lib/tools/with-google.ts` | ✅ | `withGoogleClient` returns structured markers (`need_google_auth`, `google_api_disabled`, `google_error`) rather than raw API error text. The raw message is included in `google_error` result but this is returned to the model, not directly to the user. |

---

## Security controls not in place

| Missing control | Risk | Notes |
|-----------------|------|-------|
| No Vercel Firewall / WAF | Low | Acceptable for private bot — allowlist provides access control at application layer. |
| No startup check for `ADMIN_LINE_USER_ID` | Medium | If unset, allowlist gate is silently skipped. Consider adding explicit warning log at boot. P2. |
| No secret rotation detection | Low | If `TOKEN_ENCRYPTION_KEY` changes, decrypt fails → `GoogleAuthRequired` → user reconnects. Silent from ops perspective. P3. |
| No request size limit on webhook body | Low | Next.js default body size applies. Body is read as text for HMAC verification. Could be a resource issue for extremely large payloads, but LINE's own size limits apply upstream. |

---

## Summary by priority

| Priority | Issue |
|----------|-------|
| P0 | VERBOSE DEBUG MODE — stack traces and API bodies surfaced to LINE users |
| P1 | `next <16.2.5` — 13 CVEs including SSRF (8.6) and middleware bypass (8.1). Run `npm audit fix`. |
| P2 | Allowlist gate silently skipped when `ADMIN_LINE_USER_ID` is unset |
| P3 | `disconnect_google_account` doesn't revoke Google token |
| P3 | `displayName`/`location` injected into system prompt without sanitization (low risk for private bot) |
