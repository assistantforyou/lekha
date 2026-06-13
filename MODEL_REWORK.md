# Lekha Model Rework — Findings & Migration Plan

**Author:** Claude (Opus 4.8) · **Date:** 2026-06-14 · **Status:** Investigation complete, no code changed yet

---

## 0. TL;DR

- **Move the agent off `gemini-2.5-flash-lite` and onto full `gemini-2.5-flash`.** It is the cheapest possible upgrade, keeps your existing Google billing, keeps caching, and is **almost a one-line change** — because full Flash is *already wired into this codebase* (it runs intent classification, casual replies, OCR, receipts, fact extraction, and history summarization today). Only the agentic tool-use path was left on Flash Lite.
- **The "full Flash silently drops tool calls" claim ([provider.ts:13](lib/llm/provider.ts)) was never actually tested against your tool registry.** Every existing full-Flash call site runs *without tools*. That comment is almost certainly a misdiagnosed config/parallel-tool issue, not a model defect. This is the single most important thing to verify in Phase 1.
- **Stay on Gemini direct, not OpenRouter.** For a Gemini target you already pay for, direct is cheaper (no router fee), lower latency, keeps Gemini implicit caching intact, and needs zero new wiring. Use an OpenRouter key *only* as a throwaway eval conduit if you later want to benchmark Kimi/GLM/DeepSeek without opening accounts.
- **The migration unlocks deletions.** Roughly **600–900 lines of compensating scaffolding** exist only because Flash Lite is unreliable. Once a capable model is confirmed (via an eval harness), most of it can be removed — which also *reduces* cost and latency by cutting extra LLM round-trips.
- **Cost projection: ~$20–40/month**, landing near your <$30 target once the redundant LLM calls (intent classifier + casual model) are removed. Removing scaffolding partially pays for the model upgrade.

---

## 1. The core problem (recap)

Lekha pours a full agentic tool-use workload — ~25 tool families, multi-step reasoning, intent routing, draft rendering, bilingual Thai/English — into the *cheapest, most stripped-down model in existence* (`gemini-2.5-flash-lite`), then patches the model's failures with deterministic code. Every recent commit is firefighting a model-competence failure:

```
5fde5f5 fix: intent router + news guard to stop article spam and tool hallucination
70c0182 fix: address stress test issues — task routing, search count, tool hallucination
ed6b0b4 fix: surface overdue tasks ... + stop recurring-reminder floods
e5885e8 fix: add my-tasks shortcut to bypass LLM and serve fresh task lists directly
a6af433 fix: inject freshness instruction into user message for task queries
e7f86fe fix: sanitize history — strip stale task-list replies when user asks about tasks
d4df9bd fix: add negative example to list_tasks prompt to prevent stale-history replies
ad1e26d fix: strengthen stateful tool descriptions to force fresh calls
7970317 fix: strengthen prompt to force fresh tool calls for stateful data
```

These fall into three buckets, all meaning "stop trusting the model":
1. **Patch the prompt harder** — 59 numbered hard-rules in [prompts.ts](lib/llm/prompts.ts), many SHOUTING.
2. **Bypass the model with regex** — [shortcuts.ts](lib/shortcuts.ts) (135 lines) + the 206-line intent router [intent.ts](lib/intent.ts).
3. **Override the model after the fact** — `renderDisplayFallback` (~360 lines in [agent.ts](lib/llm/agent.ts)) + the soft-apology error override (decision #17).

The fix is not more scaffolding. It's a model that can do the job, plus an eval harness so you can measure that it does.

---

## 2. The decision: full Gemini 2.5 Flash

### 2.1 Why Flash full, specifically

You chose it, and it's the right call for your constraints (cheap, keep Google billing, keep caching, best Thai). The supporting facts:

| Factor | Verdict |
|---|---|
| **Cost** | ~$0.30 in / $2.50 out per 1M tokens — 3× input, ~6× output vs Flash Lite. Small absolute dollars at personal-bot volume (see §6). |
| **Migration effort** | Trivial — full Flash is already the `extractorModel()`. One function body changes. |
| **Caching** | Gemini implicit caching works identically on Flash. No change needed (see §5). |
| **Thai** | Gemini is the strongest cheap model at Thai — important for a bilingual bot. |
| **Provider risk** | Same provider you already depend on. No new outage surface. |
| **Tool-use reliability** | Materially better than Flash Lite. The whole premise of the rework. |

### 2.2 The critical finding — full Flash is already here, and the "drops tool calls" claim is unverified

Model call-site map (from a full scan of `lib/` and `app/`):

| Function | Model string | Used by | Uses tools? |
|---|---|---|---|
| `chatModel()` | **`gemini-2.5-flash-lite`** | [agent.ts:660](lib/llm/agent.ts) (main agent), [handlers/image.ts:87](lib/handlers/image.ts), health route, report/status route, dev/chat route | **Yes** (agent.ts) |
| `extractorModel()` | **`gemini-2.5-flash`** | [intent.ts:182](lib/intent.ts), [casual-reply.ts:20](lib/llm/casual-reply.ts), [media-ai.ts:108](lib/tools/media-ai.ts), [receipts.ts:93](lib/tools/receipts.ts), [extract-facts.ts](lib/llm/extract-facts.ts), [history.ts:172](lib/memory/history.ts) | **No** — all tool-free |
| `embeddingModel()` | `text-embedding-004` | [archive.ts:34](lib/memory/archive.ts) | n/a |

**Conclusion:** Full Flash already runs in production for six different workloads. It has never been run *with the agent's tool registry*. The comment "full Flash silently drops tool calls" therefore describes an untested or stale observation. The most likely real causes of any historical tool-dropping:
- A parallel-tool-call config issue (AI SDK v6 + Gemini parallel calls).
- An older `@ai-sdk/google` version with a tool-serialization bug.
- A `providerOptions` / safety-setting interaction.

**Phase 1's first job is to settle this empirically.** If full Flash handles the tool registry (very likely), the rest of the plan follows. If it genuinely drops tool calls, that's a config bug to fix — and we'd debug the AI SDK integration, not retreat to Flash Lite.

### 2.3 Fallbacks (documented, not recommended for now)

If full Flash proves insufficient *after* a fair eval (unlikely), in ascending cost/effort:
- **Kimi K2** (Moonshot) — open-weight, tuned for agentic tool use. ~4× cost. New provider.
- **GLM-4.6** (Zhipu) — agentic/coding strong. ~5× cost. New provider.
- **Claude Haiku 4.5** — frontier reliability, Western, best Thai of the non-Gemini set. ~10× cost ($1/$5). New SDK (`@ai-sdk/anthropic`).

You said "don't care on routing, cheapest wins" + "<$30/mo", which keeps the fallback list firmly behind Flash full. Only escalate if eval data forces it.

---

## 3. Provider: Gemini direct vs OpenRouter

You asked how OpenRouter compares. For a **Gemini target you already pay for directly**, the answer is: stay direct.

| | Gemini direct (current) | OpenRouter |
|---|---|---|
| Per-token price | Google list ($0.30/$2.50) | Same + ~5.5% credit fee |
| Latency | Direct to Google | Extra proxy hop (+50–150ms) |
| **Caching** | ✅ Gemini implicit caching works (you rely on this — decision #18) | ⚠️ Gemini cache pass-through unreliable through routers — you'd likely lose the discount |
| Dependencies | One vendor | Two (Google + OpenRouter both must be up) |
| Already wired | ✅ `@ai-sdk/google`, `GEMINI_API_KEY` | New provider + key |
| Multi-model swap | One family | ✅ One key → many models, no new accounts |

**Decision:** Production = **Gemini direct**. OpenRouter's only value here is as a *temporary eval conduit* — one key to benchmark Kimi/GLM/DeepSeek against Flash full during the eval phase without opening Chinese-provider accounts. It does not belong in the production request path.

---

## 4. What changes — staged migration

The migration is two phases. **Phase 1 is the model swap + eval harness (low risk, do first). Phase 2 is the scaffolding removal (only after Phase 1 proves the model).** Do not reorder — removing the fallback code before confirming the model works would break the bot, which violates the "without impacting the bot" constraint.

---

### PHASE 1 — Model swap + verification (low risk)

#### 1.1 The model change

**File: [lib/llm/provider.ts](lib/llm/provider.ts)**

Current:
```ts
/** Main chat model — Gemini 2.5 Flash Lite (full Flash silently drops tool calls). */
export function chatModel() {
  return googleClient()("gemini-2.5-flash-lite");
}

/** Background extraction model — Flash for better PDF/image quality. */
export function extractorModel() {
  return googleClient()("gemini-2.5-flash");
}
```

Change to:
```ts
/** Main chat model — Gemini 2.5 Flash (full). Flash Lite was too weak for
 *  reliable agentic tool use; see MODEL_REWORK.md. */
export function chatModel() {
  return googleClient()("gemini-2.5-flash");
}

/** Background extraction model — same Flash tier. Kept as a separate export so
 *  background/summarization work can be retuned independently of the agent. */
export function extractorModel() {
  return googleClient()("gemini-2.5-flash");
}
```

That's the core change. Every `chatModel()` call site (agent, image handler, health, status, dev/chat) now points at full Flash. No other file needs editing for the swap itself.

> **Optional cost lever:** background-only summarizers ([history.ts](lib/memory/history.ts) history compaction, [extract-facts.ts](lib/llm/extract-facts.ts)) are low-stakes and could stay on a separate `summarizerModel()` pinned to `gemini-2.5-flash-lite` to shave cost. Keep OCR/receipts ([media-ai.ts](lib/tools/media-ai.ts), [receipts.ts](lib/tools/receipts.ts)) on full Flash — they benefit from the quality. Defer this until §6 cost data says it's worth the extra function.

#### 1.2 Timeout — bump for the slightly slower model

**File: [lib/llm/provider.ts:32](lib/llm/provider.ts)**

```ts
export const AGENT_TIMEOUT_MS = 20_000;
```

Full Flash reasons more than Flash Lite, so healthy agentic turns will be a touch slower. Bump to **30s** to avoid clipping legitimate multi-step turns:

```ts
export const AGENT_TIMEOUT_MS = 30_000;
```

This constant is shared by [agent.ts:670](lib/llm/agent.ts) and [handlers/image.ts:93](lib/handlers/image.ts). One edit covers both.

> **Doc drift to fix:** CLAUDE.md decision #16 says "60s timeout" and the gotchas section says "20s" — both are wrong relative to the code (20s) and each other. Update CLAUDE.md to match the new value once set.

#### 1.3 Caching — verify it still bites (see §5)

No code change required, but confirm `cachedContentTokenCount` / implicit-cache savings appear in logs after the swap. Gemini implicit caching keys on a stable prefix; nothing in the swap changes the prefix.

#### 1.4 Build the eval harness (the safety net) — REQUIRED before Phase 2

This is the discipline that's been missing. Without it, every model/prompt change is a guess.

- Create `tests/eval/` with ~40–60 recorded real conversations covering the failure classes the git log has been firefighting:
  - Task add / list / complete / delete (the stale-history trap)
  - Multi-reminder ("remind me X and Y and Z" → N separate calls)
  - Email draft + calendar draft in one turn
  - News vs web_search disambiguation; "stop sending me articles" (no tool)
  - Casual / greeting / emoji (no tool)
  - Thai-language versions of the above (verify it replies fully in Thai)
  - Tool-hallucination bait ("run this code", "calculate X")
  - Media: "what does this say" with a staged doc
- Each case asserts on **which tools were called** (and which were *not*), not on exact prose. The agent already exposes `result.steps[].toolCalls` — assert against that.
- Run against Flash Lite first to capture the current baseline, then against Flash full. The delta is your evidence.
- This becomes the gate for every Phase 2 deletion: remove scaffolding, re-run, confirm no regression.

**Phase 1 acceptance:** Flash full passes the eval suite at ≥ the Flash Lite baseline (it will almost certainly exceed it), tool calls are not dropped, Thai replies stay in Thai, and caching savings still show in logs.

---

### PHASE 2 — Remove the compensating scaffolding (only after Phase 1 passes)

Each item below exists *because* Flash Lite is unreliable. With a capable model confirmed, they become dead weight. Remove them **one at a time, re-running the eval suite after each.** Ordered from highest-confidence/highest-value to most judgment-dependent.

#### 2.1 `renderDisplayFallback` — ~360 lines — HIGH VALUE

**File: [lib/llm/agent.ts:184–546](lib/llm/agent.ts)**

A giant hand-written switch that re-renders the output of ~30 tools (weather, tasks, gmail, crypto, FX, receipts, drive, …) into prose. It exists *only* because Flash Lite returns empty text after a tool call. It's invoked at [agent.ts:173](lib/llm/agent.ts) as a fallback when `modelText` is empty.

- **Why it can go:** A capable model narrates its own tool results. The "Known quirk: Gemini sometimes returns empty text" in CLAUDE.md is a Flash Lite symptom.
- **How to verify before deleting:** Add a temporary counter/log at the `renderDisplayFallback` call site recording how often it actually fires on full Flash. Run a few days of real traffic (or the eval suite). If it fires ~never, delete it.
- **Risk:** Low, *if* the empty-text behavior is gone. The verification step de-risks it. Keep the final generic "Done."/label fallback ([agent.ts:177–181](lib/llm/agent.ts)) as a tiny safety net.
- **Payoff:** Deletes ~360 lines and removes a whole class of "the rendered output doesn't match what the model said" bugs.

#### 2.2 The intent router + tool-gating — ~250 lines — HIGH VALUE

**Files: [lib/intent.ts](lib/intent.ts) (206 lines), the `intent` param threading in [tools/index.ts](lib/tools/index.ts) and [handlers/text.ts:54,97–103](lib/handlers/text.ts)**

Two distinct things are tangled here:

1. **`classifyIntent` as a pre-router** ([text.ts:54](lib/handlers/text.ts)) — an *extra LLM call* (or regex) before the main agent, to decide intent. This is the model doing the model's job twice. A capable agent routes itself. **Remove the pre-classification call.**
2. **Intent → tool-subset filtering** ([tools/index.ts:118](lib/tools/index.ts), `intents` arrays on every registry row) — narrows ~25 tool families to the intent-relevant subset. This is a *defensible* idea (fewer tools = less confusion) **but** it makes the tool prefix vary per request, which **hurts Gemini implicit caching** (tools render before the system prompt; a varying prefix = fewer cache hits). Since you want caching kept and you only have ~25 tools, a **static full tool set caches better and a capable model handles it fine.**

**Recommendation:**
- Delete [lib/intent.ts](lib/intent.ts) entirely.
- Remove the `intent` parameter from `toolsForUser` / `buildTools` and the `intents:` arrays from the `REGISTRY` rows in [tools/index.ts](lib/tools/index.ts). The registry keeps its `needs:` (env/OAuth gating) and `category:` (dashboard disable) logic — only the intent filtering goes.
- In [text.ts](lib/handlers/text.ts), drop the `classifyIntent` call and the casual branch (see 2.3).
- **Net effect:** one LLM call per message instead of two (lower latency + cost), a static tool prefix (better caching — directly serves your "keep caching" goal), and ~250 fewer lines.
- **Verify:** eval suite, especially the multi-intent and tool-disambiguation cases. Watch cache-hit logs go *up*.

> Counter-option if eval shows the full tool set confuses even Flash full: keep the *static* registry but adopt the AI-SDK/Gemini tool-count reduction only for OAuth-gated surfaces (already handled by `needs`). Don't reintroduce per-message intent classification.

#### 2.3 `casual-reply.ts` — 42 lines — MEDIUM VALUE

**File: [lib/llm/casual-reply.ts](lib/llm/casual-reply.ts), branch at [text.ts:92](lib/handlers/text.ts)**

A separate model call for greetings/thanks/emoji, routed to by the intent classifier. With the router gone (2.2) and a capable model that follows the prompt's "casual chat → no tools" rule (rule in [prompts.ts:6](lib/llm/prompts.ts)), the main agent handles casual turns directly.

- **Remove** `casual-reply.ts` and the `if (intentResult.primary === "casual")` branch in `text.ts`. All text goes through `runAgent`.
- **Risk:** Low. The base prompt already instructs no-tools-on-casual. Eval the greeting/emoji/"stop sending articles" cases.
- **Payoff:** Removes another extra LLM round-trip and 42 lines.

#### 2.4 History sanitization + freshness injection — ~25 lines — MEDIUM VALUE

**File: [handlers/text.ts:56–82](lib/handlers/text.ts)**

Two Flash-Lite band-aids:
- `sanitizedHistory` ([text.ts:59](lib/handlers/text.ts)) strips prior assistant task-list replies from history so the weak model is forced to re-call `list_tasks`.
- The `[ALWAYS call list_tasks — NEVER answer from memory...]` string injection ([text.ts:81](lib/handlers/text.ts)).

Both exist because Flash Lite answers stateful queries from stale history. A capable model + a clear tool description ("returns current state") handles this.

- **Remove** the `isTaskQuery` regex, `sanitizedHistory`, and the freshness-injection string. Pass history and user text through unmodified.
- **Risk:** Medium — this is exactly the failure the git log fought hardest. **Eval the stale-task-list cases specifically** (ask tasks, complete one, ask again — confirm fresh data). Keep this deletion last among the medium items so you have confidence from the earlier ones first.
- **Payoff:** Cleaner handler, no magic strings in user messages.

#### 2.5 Soft-apology error override — ~10 lines — LOW/MEDIUM VALUE

**File: [agent.ts:149–155](lib/llm/agent.ts) (decision #17)**

Overrides the model's reply with the raw tool error when the model "soft-apologized instead of relaying the actual error." This distrust is a Flash Lite behavior.

- **Cautious recommendation:** Keep the *structured* Google control-flow handling (`need_google_auth`, `google_api_disabled`, `google_error` at [agent.ts:122–144](lib/llm/agent.ts)) — that's good architecture (decision #1), not scaffolding. Only the *soft-apology text-matching override* ([agent.ts:149–155](lib/llm/agent.ts)) is the band-aid. Once prompt rule #11 ("relay the exact error") is reliably followed by a capable model, this can go. Verify with an eval case that forces a tool error and checks the reply names the real error.
- **Risk:** Low. Worst case the model phrases an error slightly softer than the raw string.

#### 2.6 Prompt rule diet — 59 rules → ~15 — MEDIUM VALUE, JUDGMENT-HEAVY

**File: [lib/llm/prompts.ts](lib/llm/prompts.ts) (`BASE_PERSONALITY`, 195 lines)**

The prompt is 59 numbered hard-rules of escalating desperation, many of which are anti-Flash-Lite guardrails (the ⚠️ NEGATIVE EXAMPLE at [prompts.ts:10](lib/llm/prompts.ts), rule 1b begging it not to hallucinate tools at [prompts.ts:34](lib/llm/prompts.ts), the repeated "NEVER answer from memory" rules).

- **Approach:** This is the *most* judgment-heavy change — do it incrementally and last, with the eval suite as the gate. Capable models also *overtrigger* on aggressive "CRITICAL/MUST/NEVER" language, so trimming can actually *improve* behavior.
- Collapse the stateful-data rules (1a, the negative example, "force fresh" repetitions) into one short line now that 2.4's history-stripping is gone.
- Soften "CRITICAL"/"NEVER"/"⚠️" to plain instructions.
- Keep the genuinely useful ones: Thai-language fidelity, LINE no-markdown formatting (rule 19), ISO/timezone handling (rule 4), draft-batching (rule 2), verbatim briefing output (rules 20–21).
- **Verify:** eval suite after *each* trim, not all at once. If a metric drops, restore that rule.
- **Payoff:** A shorter, stable system prompt also caches better and is far easier to maintain. Target ~15 focused rules.

#### 2.7 `shortcuts.ts` — KEEP (mostly) — review only

**File: [lib/shortcuts.ts](lib/shortcuts.ts) (135 lines)**

These LLM-bypass shortcuts (help, connect-google, morning/evening briefing, my-tasks) are a **legitimate optimization**, not pure scaffolding — they serve deterministic responses instantly without an LLM call, and the briefing/help ones are genuinely better as direct dispatch.

- **Keep:** `help`, `connect-google`, `morning-briefing`, `evening-summary` — fast, deterministic, correct.
- **Reconsider:** the `my-tasks` shortcut ([shortcuts.ts:100](lib/shortcuts.ts)) was added specifically to dodge Flash Lite's stale-task problem (commit `e5885e8`). With a capable model it's redundant with the agent's own `list_tasks`. You *can* keep it as a latency win, but if you'd rather have one code path, removing it (and its `isTaskQuery` regex) simplifies things. Low stakes either way — decide based on whether you value the instant response.
- **Note:** confirm where `dispatchShortcut` is called (the webhook entrypoint) and that the intent-router removal in 2.2 doesn't strand it. (Shortcuts run before the agent, independent of `classifyIntent`.)

---

## 5. Caching — how to keep and improve it

You said keep model caching. Good news: the migration helps it, and Phase 2 helps it more.

- **Gemini implicit caching** is automatic on `gemini-2.5-flash` when a request shares a long stable prefix with a recent one. It keys on the *exact prefix*: `tools` → `system` → `messages`.
- **Decision #18 already protects the system prompt** by keeping it static. Keep it that way — do not interpolate timestamps/IDs into the system prompt. (The time context is correctly injected as a *message* at [agent.ts:641](lib/llm/agent.ts), not the system prompt — good.)
- **The intent-based tool filtering (2.2) is currently *hurting* caching** because the tool list (rendered first, before system) varies per intent. Removing it → static tool prefix → **more cache hits.** So Phase 2.2 is both a simplification *and* a caching win.
- **Verify caching post-swap:** log `usage` and check for Gemini's cached-token count across repeated requests. If it's zero, audit for a silent prefix invalidator (a per-request value sneaking into tools/system).
- **Explicit caching** (Gemini `cachedContent`) is available if you ever want to pin the system+tools block harder, but implicit caching is sufficient and zero-maintenance for your volume. Don't add explicit caching unless logs show implicit isn't biting.

---

## 6. Cost — projection and monitoring

### 6.1 Assumptions
- Private bot: James + small allowlist. Estimate ~150 agent turns/day.
- ~10–20K cumulative input tokens/turn (system + tools + history + tool results across 1–3 steps), ~1K output/turn.

### 6.2 Rough monthly estimate (full Flash, direct)
| Component | Tokens/mo | Rate | Cost |
|---|---|---|---|
| Input (uncached) | ~50M | $0.30/1M | ~$15 |
| Input (cached prefix) | ~17M | ~$0.075/1M | ~$1 |
| Output | ~6.75M | $2.50/1M | ~$17 |
| **Subtotal** | | | **~$33** |
| *minus* removed intent-classifier calls (Phase 2.2) | | | −$3–5 |
| *minus* removed casual-model calls (Phase 2.3) | | | −$2–4 |
| **Net target** | | | **~$25–30/mo** |

This lands at/near your <$30 ceiling. The numbers are estimates — **the eval/monitoring phase replaces them with real data.** Key levers if it runs hot:
- Pin background summarizers (history compaction, fact extraction) to Flash Lite (§1.1 optional lever).
- Ensure caching is biting (§5).
- The current 500/hr rate limit (decision #10) already bounds worst-case spend.

### 6.3 Monitoring
- Add a per-request token/cost log line (input/cached/output) so you can see real spend within a day of the swap.
- Set a mental alert: if daily cost > ~$1.50, investigate caching or background-model tier before anything else.

---

## 7. What to KEEP — the good plumbing

None of this is the problem. Do **not** touch it during the rework:
- Per-user Redis state isolation (decision #6) and atomic RPUSH queues (decision #2).
- Structured Google error control-flow via `withGoogleClient` (decision #1) and the orchestrator's auth/disabled/error scan ([agent.ts:122–144](lib/llm/agent.ts)).
- Single-use OAuth nonce consumption (GETDEL), encrypted tokens (decision #9).
- The proactive sweep + `claimPushLock` idempotency (decision #13).
- Webhook 200-immediate + `after()` + event dedup (decision #7), signature verification (decision #8).
- LINE Flex/postback layer ([lib/line/flex/](lib/line/flex/), [agent-flex.ts](lib/llm/agent-flex.ts), [enrich-reply.ts](lib/enrich-reply.ts)) — structured UI, not model scaffolding.
- The declarative tool registry shape in [tools/index.ts](lib/tools/index.ts) (keep `needs`/`category`; only remove `intents`).
- The 5-minute in-memory tool cache ([tools/index.ts:35](lib/tools/index.ts)).

---

## 8. Net line-count impact (Phase 2)

| Item | Lines removed (approx) |
|---|---|
| `renderDisplayFallback` (2.1) | ~360 |
| `intent.ts` + intent threading (2.2) | ~250 |
| `casual-reply.ts` (2.3) | ~42 |
| history sanitize + freshness inject (2.4) | ~25 |
| soft-apology override (2.5) | ~10 |
| prompt rule diet (2.6) | ~80 (of 195) |
| **Total** | **~750–800 lines removed**, plus 2 fewer LLM round-trips per message |

The bot gets *simpler, cheaper, faster, and more reliable* simultaneously — because all of the above were costs imposed by the weak model.

---

## 9. Open questions for James

1. **Eval harness scope** — happy with ~40–60 recorded conversations as the gate, or do you want a bigger/smaller suite? (This is the one real time investment.)
2. **Background-model split** — do you want me to introduce a separate Flash-Lite `summarizerModel()` for history/fact extraction to shave cost, or keep everything on full Flash for simplicity? (Recommend: start unified, split only if §6 data says so.)
3. **`my-tasks` shortcut** (2.7) — keep it as an instant-response latency win, or remove it for a single code path? (Low stakes.)
4. **OpenRouter eval key** — do you want to *also* benchmark Kimi K2 / GLM-4.6 / DeepSeek during the eval phase (one throwaway OpenRouter key), or commit to Flash full and skip the comparison? You said cheapest-wins; this would confirm Flash full is genuinely the floor.
5. **Phase 2 appetite** — do you want all of §4 Phase 2 executed, or start with just the model swap (Phase 1) and the highest-value deletions (2.1, 2.2) and stop there?

---

## 10. Sequenced execution checklist

**Phase 1 (low risk, do first):**
- [ ] Build the eval harness (`tests/eval/`), capture Flash Lite baseline.
- [ ] Swap `chatModel()` → `gemini-2.5-flash` ([provider.ts](lib/llm/provider.ts)).
- [ ] Bump `AGENT_TIMEOUT_MS` → 30_000 ([provider.ts:32](lib/llm/provider.ts)).
- [ ] Add per-request token/cost logging.
- [ ] Run eval suite on full Flash; confirm tool calls are NOT dropped, Thai stays Thai, caching bites.
- [ ] **Gate:** Flash full ≥ baseline. If yes → Phase 2. If it drops tool calls → debug the AI SDK/Gemini config (do NOT revert to Flash Lite).
- [ ] Update CLAUDE.md timeout/model facts.

**Phase 2 (after gate passes — one item at a time, re-eval after each):**
- [ ] 2.1 Instrument then delete `renderDisplayFallback`.
- [ ] 2.2 Delete `intent.ts`; remove intent threading from `tools/index.ts` + `text.ts`. Confirm cache-hit rate rises.
- [ ] 2.3 Delete `casual-reply.ts` + casual branch.
- [ ] 2.4 Remove history sanitization + freshness injection (eval stale-task cases hard).
- [ ] 2.5 Remove soft-apology override (keep structured Google error handling).
- [ ] 2.6 Prompt rule diet, incremental, eval after each trim.
- [ ] 2.7 Decide on `my-tasks` shortcut.
- [ ] Final: update CLAUDE.md decisions (#16 model, #17 override, #18 tool-gating) to reflect the new reality.

---

*End of report. No code has been changed. Recommended next action: approve Phase 1, starting with the eval harness + the one-line model swap.*
