# Performance Analysis & Tuning Guide

## Timing Logs (Zero-Overhead)

Every step of the AI pipeline is now instrumented with `lib/timing.ts`. When `DEBUG_TIMING=1` is set, structured JSON logs are emitted to stdout. When unset, the instrumentation compiles to no-ops — **zero runtime cost**.

### Enabling

```bash
# Local dev
DEBUG_TIMING=1 npm run dev

# Vercel (add as env var)
vercel env add DEBUG_TIMING
# → Value: 1
```

### Reading the Logs

Each log line is a JSON object with `_timing: true`:

```json
{"_timing":true,"traceId":"Uxxabc_123","label":"agent:generateText","ms":2840,"steps":2,"toolCalls":3}
```

**Key labels by subsystem:**

| Subsystem | Labels | What they measure |
|---|---|---|
| **Webhook** | `webhook:handleEvent`, `webhook:prelight`, `webhook:executePending` | Full request, parallel pre-flight, pending action execution |
| **Text handler** | `text:respondToText`, `text:preload`, `text:getMessageContent`, `text:reply`, `text:appendTurns` | End-to-end text response, data loading, media download, LINE reply, history writes |
| **Image handler** | `image:respondToImage`, `image:preload`, `image:generateText`, `image:reply` | End-to-end image response, data loading, vision LLM call, reply |
| **Agent** | `agent:runAgent`, `agent:preload`, `agent:toolsForUser`, `agent:generateText`, `agent:step`, `agent:processResult` | Full agent run, internal preflight, tool registry building, LLM call, per-step breakdown, post-processing |
| **History** | `history:load`, `history:append`, `history:forPrompt`, `history:summarize` | Redis LRANGE, Redis MULTI LPUSH/LTRIM, token-cap check + summary fetch/generation |
| **LINE API** | `line:reply`, `line:push`, `line:getMessageContent` | LINE Messaging API calls |
| **Google** | `google:withGoogleClient` | Any Google API call (Gmail, Calendar, Drive, People) |

### Example: A Typical Text Request

```
{"_timing":true,"traceId":"Uabc_123","label":"webhook:prelight","ms":45,"pending":0}
{"_timing":true,"traceId":"Uabc_123","label":"text:preload","ms":32,"historyTurns":8,"facts":12}
{"_timing":true,"traceId":"Uabc_123","label":"agent:preload","ms":28,"accounts":1}
{"_timing":true,"traceId":"Uabc_123","label":"agent:toolsForUser","ms":12,"toolCount":18}
{"_timing":true,"traceId":"Uabc_123","label":"agent:step","stepMs":890,"stepIndex":1,"toolCalls":["web_search"],"resultTypes":["ok"]}
{"_timing":true,"traceId":"Uabc_123","label":"agent:step","stepMs":1950,"stepIndex":2,"toolCalls":[],"resultTypes":[],"textLength":340}
{"_timing":true,"traceId":"Uabc_123","label":"agent:generateText","ms":2840,"steps":2,"toolCalls":1}
{"_timing":true,"traceId":"Uabc_123","label":"agent:processResult","ms":2,"confirmDraft":false}
{"_timing":true,"traceId":"Uabc_123","label":"text:reply","ms":180,"ok":true}
{"_timing":true,"traceId":"Uabc_123","label":"text:appendTurns","ms":25}
{"_timing":true,"traceId":"Uabc_123","label":"text:respondToText","ms":3152}
{"_timing":true,"traceId":"Uabc_123","label":"webhook:handleEvent","ms":3201,"type":"text"}
```

**What this tells you:**
- Total request: **3.2s**
- Pre-flight (Redis): **45ms** — healthy
- Data loading: **32ms** — healthy
- LLM call: **2.84s** across 2 steps — the dominant cost
  - Step 1: model decided to call `web_search` → Tavily API took ~890ms
  - Step 2: model generated text with search results — ~1.95s
- LINE reply: **180ms** — normal
- History writes: **25ms** — fast

---

## Pipeline Breakdown

### Where Time Goes (Typical Text Message)

```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL ~2–6s (median ~3s)                                   │
├─────────────────────────────────────────────────────────────┤
│  Pre-flight (Redis)          ████░░░░░░░░░░░░░░░░░░  30–80ms │
│  Data loading (Redis)        ███░░░░░░░░░░░░░░░░░░░  20–60ms │
│  Tool registry build         ██░░░░░░░░░░░░░░░░░░░░  10–30ms │
│  LLM generateText            ████████████████████░  2–5s    │
│  ├─ Step 1: model thinks     ███░░░░░░░░░░░░░░░░░░  200–800ms│
│  ├─ Step 2: tools execute    ██████░░░░░░░░░░░░░░░  500ms–3s│
│  ├─ Step 3: model responds   ████████░░░░░░░░░░░░░  1–3s    │
│  └─ (more steps possible)    ...                          │
│  Post-processing             ░░░░░░░░░░░░░░░░░░░░░░  1–5ms   │
│  LINE reply API              █░░░░░░░░░░░░░░░░░░░░  100–300ms│
│  History writes (Redis)      ░░░░░░░░░░░░░░░░░░░░░░  10–30ms │
└─────────────────────────────────────────────────────────────┘
```

### Where Time Goes (Image Message)

```
┌─────────────────────────────────────────────────────────────┐
│  TOTAL ~1–4s (median ~2s)                                   │
├─────────────────────────────────────────────────────────────┤
│  Media download (LINE)       ████░░░░░░░░░░░░░░░░░░  100–500ms│
│  Data loading (Redis)        ███░░░░░░░░░░░░░░░░░░░  20–60ms │
│  Vision LLM call             ████████████████████░  1–3s    │
│  LINE reply API              █░░░░░░░░░░░░░░░░░░░░  100–300ms│
│  History writes              ░░░░░░░░░░░░░░░░░░░░░░  10–30ms │
└─────────────────────────────────────────────────────────────┘
```

Images are often **faster** than text because there's no tool execution loop — just a single `generateText` call.

---

## Identified Bottlenecks

### P0 — Critical (can cause 60s timeout or silent failure)

#### 1. `generateText` is the single dominant cost (~70–95% of total time)

**What:** Every text request calls `generateText` with `maxRetries: 3` and `stopWhen: stepCountIs(8)`. The model can decide to call tools, wait for results, then decide again. Each step is sequential.

**Evidence from logs:** Look for `agent:generateText` — it's typically 2–5s but can spike to 15s+ if multiple tool steps are needed.

**Why it matters:** The 60s `AGENT_TIMEOUT_MS` is a last resort. In practice, users perceive slowness at >3s. There's no fallback LLM since Groq was removed.

#### 2. No `replyOrPush` fallback on expired replyToken

**What:** `reply()` uses a single-use token that expires in ~60s. If `runAgent` + processing takes >60s, the token is dead and `reply()` silently fails. The user sees nothing.

**Evidence:** Look for `line:reply` with `ok: false` in logs. No subsequent `line:push` appears.

**Why it matters:** Heavy requests (multiple Google API calls, large attachments) can exceed the token lifetime. The user thinks the bot is broken.

#### 3. Tool execution happens sequentially inside `generateText`

**What:** When the model calls 3 tools in one step (e.g., `web_search`, `gmail_search`, `contacts_search`), the AI SDK executes them **in parallel within the step**, but each **step** is sequential. Step 1 → wait for all tools → feed results → Step 2.

**Evidence:** Look at `agent:step` logs. `stepIndex: 1` with multiple `toolCalls` means parallel tool execution. The `stepMs` includes ALL tool latencies.

**Why it matters:** A request that needs search + Gmail + calendar = 3 steps minimum. Each step adds model-thinking time + API latency.

---

### P1 — Significant (adds 100ms–3s)

#### 4. Redundant `listAccounts` / `listRecentMedia` fetch

**What:** `respondToText` already loads accounts and media in parallel. Then `runAgent` loads them **again**.

**Evidence:** Compare `text:preload` (already has accounts/media) with `agent:preload` (fetches again).

**Impact:** ~20–60ms wasted + extra Redis round-trips per request.

#### 5. History summarization blocks on cache miss

**What:** When conversation history exceeds ~3000 tokens, `historyForPrompt` sends the oldest 10 turns to `extractorModel()` for summarization.

**Evidence:** Look for `history:summarize` with high `ms` values. `history:forPrompt` with `cached: false`.

**Impact:** ~1–3s on long conversations (cached after first hit for 7 days).

#### 6. `maxRetries: 3` on `generateText` can burn time on transient failures

**What:** If Gemini returns a 503, the AI SDK retries automatically. Each retry is a full LLM call.

**Evidence:** `agent:generateText` with much higher `ms` than the sum of `agent:step` times.

**Impact:** On a bad day, 3× the normal latency.

#### 7. Background fact extraction consumes quota every 10 turns

**What:** `maybeExtractFacts` fires after every reply. Every 10th turn, it calls `extractorModel()` in the background.

**Evidence:** Not visible in request logs (fire-and-forget), but burns Gemini quota that could be used for the main response.

---

### P2 — Moderate (adds 10–100ms)

#### 8. Sequential `appendTurn` ×2

**What:** User turn and assistant turn are written sequentially.

**Impact:** ~10–30ms. Could be parallelized but gain is small.

#### 9. `toolsForUser` re-evaluates env gates on every request

**What:** Iterates 24 registry entries, checks env vars and user state.

**Impact:** ~10–30ms. Could cache the registry shape per-user.

---

### P3 — Architectural

#### 10. `googleapis` package bloats server bundle

**What:** The full `googleapis` SDK is 114MB. Only Gmail, Calendar, Drive, and People are used.

**Impact:** Cold-start latency on Vercel Functions.

#### 11. No provider-level timeout on Gemini

**What:** The 60s timeout is enforced by our `withTimeout()` wrapper, not by the SDK or HTTP layer. Gemini can hang indefinitely inside the wrapper.

---

## Recommendations

### Immediate Wins (Low Effort, High Impact)

#### R1. Pass pre-loaded data into `runAgent` — saves 20–60ms per request

**Current:**
```ts
// text.ts
const [history, facts, staged, accounts] = await Promise.all([...]);
// ...
const result = await runAgent(userId, profile, facts, messages);

// agent.ts
const [accounts, staged, settings] = await Promise.all([listAccounts(), listRecentMedia(), getSettings()]);
```

**Fix:** Add `accounts` and `staged` as optional parameters to `runAgent`:
```ts
export async function runAgent(
  userId, profile, facts, messages,
  opts?: { accounts?: AccountList; staged?: MediaItem[]; settings?: Settings },
) { ... }
```

**Impact:** ~20–60ms saved + 2 fewer Redis round-trips per text request.

---

#### R2. Use `replyOrPush` instead of `reply` in handlers — prevents silent failures

**Current:**
```ts
await reply(replyToken, messages); // silently fails if token expired
```

**Fix:**
```ts
await replyOrPush(userId, replyToken, messages); // falls back to push
```

**Impact:** Eliminates silent failures on slow requests.

---

#### R3. Reduce `AGENT_TIMEOUT_MS` from 60s to 20s — fail fast, retry via push

**Current:** 60s timeout means a hung request blocks the function for a full minute.

**Fix:** Lower to 20s. If timeout hits, use `replyOrPush` to send a "still thinking" message, then continue in background (or ask user to retry).

**Impact:** Faster failure detection, better user experience.

---

#### R4. Add `maxRetries: 1` instead of `3` — reduce retry burn

**Current:** `maxRetries: 3` in `generateText`.

**Fix:** `maxRetries: 1` for chat, `maxRetries: 2` for background tasks.

**Impact:** On transient 503s, reduces worst-case latency from 3× to 2×.

---

### Medium Effort, High Impact

#### R5. Cache `toolsForUser` result per user

**Current:** Builds the tool registry from scratch on every request.

**Fix:** Cache the registry in Redis with a 5-minute TTL, keyed by userId + connected-accounts hash.

```ts
const cacheKey = `tools:${userId}:${hashAccounts(accounts)}`;
const cached = await redis().get(cacheKey);
if (cached) return cached;
const tools = await buildTools(userId, accounts);
await redis().set(cacheKey, tools, { ex: 300 });
```

**Impact:** ~10–30ms saved per request. More importantly, reduces CPU time on every request.

---

#### R6. Pre-compute history summary in background

**Current:** Summarization happens synchronously when token cap is exceeded.

**Fix:** On every `appendTurn`, check if we're approaching the cap (e.g., >2500 tokens). If so, fire a background summarization task so the next request has a warm cache.

**Impact:** Eliminates the 1–3s blocking summarization on cache miss.

---

#### R7. Bundle media download with preflight

**Current:** In `respondToText`, `getMessageContent` is fetched after `runAgent` preloads but before `runAgent` starts.

**Fix:** If `freshImage` is detected, start `getMessageContent` in parallel with `Promise.all([loadHistory, loadFacts, ...])`.

**Impact:** Up to 500ms saved on image+text combo messages.

---

#### R8. Add streaming response for long tasks

**Current:** The user sees nothing until the entire `generateText` completes.

**Fix:** For known-long operations (e.g., "summarize my last 50 emails"), send an immediate "Working on it..." push, then send the result when done.

**Impact:** Perceived latency drops from 5s to 0.5s for heavy requests.

---

### Big Bets (High Effort, High Impact)

#### R9. Replace `googleapis` with scoped `@googleapis/*` packages

**Current:**
```json
"googleapis": "^144.0.0"
```

**Fix:**
```json
"@googleapis/gmail": "^12.0.0",
"@googleapis/calendar": "^9.0.0",
"@googleapis/drive": "^8.0.0",
"@googleapis/people": "^3.0.0"
```

**Impact:** ~100MB smaller server bundle → faster cold starts on Vercel.

---

#### R10. Add a fast-path for common queries

**What:** 30–40% of user messages are simple lookups ("what's the weather", "what's on my calendar today", "set a reminder"). These don't need the full 18-tool registry.

**Fix:** Add an intent-classifier step before `runAgent`:
1. Fast classifier (small model or regex) categorizes intent
2. If "simple" intent → use a slim tool subset (~5 tools)
3. If "complex" intent → use full registry

**Impact:** Simple queries drop from 3s to 1s. Complex queries unchanged.

---

#### R11. Move to Vercel AI SDK v7 with `streamText` + tool streaming

**What:** AI SDK v6 doesn't support streaming tool execution. v7 does.

**Fix:** Upgrade to v7, use `streamText` with `experimental_toolCallStreaming`. The model can start responding while tools are still executing.

**Impact:** Perceived latency drops significantly because the user sees the response forming in real-time.

---

#### R12. Cache common tool results

**What:** "What's the weather in Bangkok" or "What's on my calendar today" are asked repeatedly.

**Fix:** Cache weather results for 10 minutes, calendar "today" for 1 minute, inbox summary for 5 minutes.

**Impact:** Repeated queries drop from 3s to 200ms.

---

## Monitoring Checklist

After deploying with `DEBUG_TIMING=1`, watch for these patterns in Vercel logs:

| Warning Sign | What to Look For | Action |
|---|---|---|
| Slow pre-flight | `webhook:prelight` > 200ms | Redis latency — check Upstash dashboard |
| Slow LLM | `agent:generateText` > 8s | Reduce `maxRetries`, consider model downgrade |
| Multi-step bloat | `agent:step` count > 3 | Review prompt — model is over-tooling |
| Slow tools | `agent:step` with `stepMs` > 2s | Check which tool — likely Google API or Tavily |
| Cache misses | `history:summarize` appearing often | Pre-compute summaries (R6) |
| LINE failures | `line:reply` with `ok: false` | Use `replyOrPush` (R2) |
| Timeout recovery | `agent:runAgent` with `timeout: true` | Reduce `AGENT_TIMEOUT_MS` (R3) |
| Cold starts | Function init time > 2s | Shrink bundle — `googleapis` → scoped packages (R9) |

---

## Quick Wins Summary

Do these in order for maximum speed improvement with minimal risk:

1. **R2** — `replyOrPush` fallback (prevents silent failures)
2. **R1** — Pass pre-loaded data to `runAgent` (saves 20–60ms)
3. **R4** — Reduce `maxRetries` from 3 → 1 (reduces retry burn)
4. **R3** — Lower timeout from 60s → 20s (fail fast)
5. **R7** — Parallelize media download (saves up to 500ms on image+text)
6. **R5** — Cache `toolsForUser` (saves 10–30ms + CPU)
7. **R12** — Cache common tool results (saves 1–3s on repeats)
