# Model Routing Strategy — Cost, Quality, Latency Trade-offs

This document evaluates five routing architectures for Lekha and selects the one with the best measured balance of cost, quality, reliability, maintainability, and scalability.

## Current State

```ts
// lib/llm/provider.ts
export function chatModel()      { return googleClient()("gemini-2.5-flash"); }
export function extractorModel() { return googleClient()("gemini-2.5-flash"); }
export function classifierModel(){ return googleClient()("gemini-2.5-flash-lite"); }
```

Every agent turn, extraction, summarization, and media analysis uses **Gemini 2.5 Flash**. Only intent classification uses **Flash Lite**. The intent classifier is already wired in `lib/intent.ts` but the registry is almost always built with `intent` omitted in `runAgent` (`lib/llm/agent.ts:671`), so tool filtering is effectively disabled.

## Routing Options Evaluated

### Option A — Single Model (Gemini 2.5 Flash for everything)

**Description:** Keep current architecture. Maybe upgrade to Gemini 3 Flash or GPT-4.1 as the one model.

**Pros:**
- Simplest to implement and operate.
- No routing logic to maintain.
- Predictable behavior.

**Cons:**
- Pays Flash rates for simple greetings, fact extraction, history summarization, and casual replies.
- No cost lever as scale grows.
- Wastes quota on background work.

**Cost estimate:** Baseline. No savings.
**Quality estimate:** No change unless model is upgraded; then modest gains at higher cost.
**Complexity:** Low.
**Operational risk:** Low.

**Verdict:** Rejected. It ignores the clear economic signal that ~50% of calls are not agentic and do not need Flash.

---

### Option B — Fast Model + Reasoning Model

**Description:** Use Flash Lite for "easy" turns and Flash for "hard" turns, with a binary split (e.g., based on intent or tool-use requirement).

**Pros:**
- Simple two-tier design.
- Large cost savings on chat-only turns.

**Cons:**
- Binary split is coarse: some chat turns need reasoning; some tool turns are trivial.
- Can force expensive model for turns that only need one cheap tool call.
- No quality feedback loop.

**Cost estimate:** 25–40% savings if ~50% of turns route to Lite.
**Quality estimate:** Slight degradation possible if Lite is used for turns that need deeper reasoning.
**Complexity:** Medium.
**Operational risk:** Medium.

**Verdict:** Better than Option A, but too coarse for Lekha where a single turn can mix simple chat with high-stakes Gmail/Calendar actions.

---

### Option C — Hierarchical Router

**Description:** A fixed decision tree:
1. Classify intent.
2. If `help`/`settings`/`memory`/`lists`/`task` (no external API) → Flash Lite.
3. If `email`/`calendar`/`drive`/`contacts`/`reminder` (Google/QStash) → Flash.
4. If `media` / `receipts` (vision) → Flash (or Lite for OCR-only).
5. If `news` / `search` / `briefing` → Lite for summarization, Flash for final answer if needed.

**Pros:**
- Deterministic, auditable.
- Easy to map to existing `Intent` type in `lib/intent.ts`.
- Significant savings.

**Cons:**
- Intent boundaries are leaky (e.g., "add a task and email me about it" spans categories).
- Does not account for query complexity within a category.
- Requires maintaining the mapping.

**Cost estimate:** 30–45% savings.
**Quality estimate:** Stable; Flash still handles all Google/QStash/vision work.
**Complexity:** Medium.
**Operational risk:** Medium.

**Verdict:** Viable, but still rule-based and static. Lekha's existing intent classifier already gives us this signal; we can do better with confidence-based escalation.

---

### Option D — Adaptive Budget Routing

**Description:** Start every turn on the cheapest model (Flash Lite). Escalate to Flash (and optionally frontier) if:
- The Lite response has low confidence / high perplexity.
- Tool use is required and Lite's tool-call failed or was not emitted.
- The user request requires multi-step reasoning.
- The response is flagged by a lightweight validator.

This is a "cascade" or "escalation" pattern.

**Pros:**
- Maximizes cost savings.
- Only pays for capability when needed.
- Can learn from production feedback.

**Cons:**
- Latency for escalated turns increases because Lite is called first.
- More complex orchestration.
- Risk of cascading failures if Lite routinely fails on easy turns.
- Needs clear escalation signals.

**Cost estimate:** 40–60% savings.
**Quality estimate:** Potentially higher because hard turns get the right model.
**Complexity:** High.
**Operational risk:** High.

**Verdict:** Attractive in theory, but the added latency and orchestration complexity are not justified for a LINE chatbot where most turns are already fast and the cost of a wrong Lite reply is high (user confusion). Also, Flash Lite was observed to blank on the full tool registry, so escalation would be noisy.

---

### Option E — Architecture Discovery (Recommended)

**Description:** A hybrid architecture combining the best of the above, plus modern optimizations:

```
Incoming message
    │
    ▼
[Intent classifier] ──► Flash Lite (already implemented in lib/intent.ts)
    │
    ▼
[Router layer]
    │
    ├── Simple chat / help / settings / memory list ──► Flash Lite
    │
    ├── Tool-heavy or high-stakes turn ──► Flash (full registry or category-focused)
    │   │
    │   ├── Tool-call succeeds ──► return result
    │   │
    │   └── Tool-call fails / low confidence ──► escalate to Gemini 3.5 Flash or GPT-4.1
    │
    ├── Background extraction / summarization ──► Flash Lite
    │
    ├── Morning/evening briefing ──► Flash Lite for drafting, Flash for final polish if needed
    │
    └── Media AI (OCR / receipt / document) ──► Flash for complex docs, Lite for simple OCR
```

Additional layers:
- **Semantic/intent-based tool filtering:** enable the existing intent field in `toolsForUser` so the model sees only relevant tools.
- **Prompt caching:** cache the system prompt + facts block where possible.
- **Response cache / semantic cache:** cache repeated simple queries ("what's my timezone?").
- **Request deduplication:** dedupe identical background extraction jobs.
- **Abort/timeouts:** cancel expensive calls that exceed budget.

**Pros:**
- Captures most savings of adaptive routing without the latency penalty of starting every turn on Lite.
- Keeps Flash for the agentic turns where it is known-good.
- Uses existing infrastructure (`lib/intent.ts`, `lib/tools/index.ts` intent filtering).
- Extensible to future models.

**Cons:**
- More moving parts than single-model.
- Requires careful measurement to tune thresholds.

**Cost estimate:** 35–55% blended savings.
**Quality estimate:** Stable or improved because Flash still handles high-stakes turns.
**Complexity:** Medium-High.
**Operational risk:** Medium.

**Verdict:** Recommended.

---

## Detailed Recommended Design

### 1. Model roles

| Workload | Primary Model | Fallback | Rationale |
|---|---|---|---|
| Intent classification | Gemini 2.5 Flash Lite | Gemini 2.5 Flash | Already works; cheaper |
| Simple chat / help / settings / list memories | Gemini 2.5 Flash Lite | Gemini 2.5 Flash | No tool use or reasoning needed |
| Agentic tool-use turn | Gemini 2.5 Flash | Gemini 3.5 Flash / GPT-4.1 | Known-good for tool registry |
| Background fact extraction | Gemini 2.5 Flash Lite | Gemini 2.5 Flash | Pure summarization |
| History summarization | Gemini 2.5 Flash Lite | Gemini 2.5 Flash | Pure compression |
| Archive summarization | Gemini 2.5 Flash Lite | Gemini 2.5 Flash | Pure summarization |
| Morning/evening briefing draft | Gemini 2.5 Flash Lite | Gemini 2.5 Flash | Structured summarization |
| Media OCR (simple image) | Gemini 2.5 Flash Lite | Gemini 2.5 Flash | Vision input; test quality |
| Media document / receipt scan | Gemini 2.5 Flash | Gemini 3.5 Flash | Complex layout and reasoning |
| Casual reply | Gemini 2.5 Flash Lite | Gemini 2.5 Flash | Greeting/complaint fallback |
| Complex reasoning / coding (rare) | Gemini 3.5 Flash or GPT-4.1 | Gemini 3.1 Pro / GPT-5 | Explicit fallback only |

### 2. Router implementation

Introduce a new module `lib/llm/router.ts`:

```ts
export type ModelTier = "lite" | "flash" | "frontier";

export function pickAgentTier(intent: Intent, hasStagedMedia: boolean, historyLength: number): ModelTier {
  if (hasStagedMedia) return "flash";                       // vision + docs need full model
  if (["help", "settings", "memory", "lists"].includes(intent)) return "lite";
  if (intent === "fallback" && historyLength < 4) return "lite";
  return "flash";
}

export function pickExtractionTier() { return "lite"; }
export function pickSummarizationTier() { return "lite"; }
export function pickMediaTier(kind: "ocr" | "doc" | "receipt") {
  return kind === "ocr" ? "lite" : "flash";
}
```

Update `lib/llm/provider.ts`:

```ts
export function modelForTier(tier: ModelTier) {
  switch (tier) {
    case "lite": return flashLiteModel();
    case "flash": return flashModel();
    case "frontier": return frontierModel();
  }
}
```

### 3. Enable intent-based tool filtering

`runAgent` already passes `intent` to `toolsForUser` but the classifier is not always used. Ensure the classifier runs for every message and the focused registry is passed. Keep a "full registry" option for `fallback`/`multi` intents.

### 4. Confidence-based escalation inside the agent

If Flash Lite is used and the turn requires tool use:
- If the model emits no tool call but the intent suggests tools are needed, escalate to Flash.
- If a tool call fails with a parse/validation error, retry with Flash.
- Cap escalations at 1 per turn to avoid cost explosion.

### 5. Caching layers

- **Prompt caching:** For the stable system prompt prefix, use Gemini context caching (90% cheaper on cached reads) or at least keep the system prompt compact.
- **Semantic cache:** Cache final replies for identical or near-identical simple queries using vector similarity over the last N user messages.
- **Tool-result cache:** Already partially implemented for weather/search/news; consolidate and add TTL discipline.

### 6. Observability

Log every routing decision:

```ts
console.log("[router]", { userId, tier, intent, hasStagedMedia, escalationReason, costUsd });
```

Track metrics:
- `% of turns by tier`
- `escalation rate`
- `cost per conversation`
- `tool-call success rate by tier`
- `user-reported fallback English rate`

---

## Cost Model

Assume 10,000 agent turns/day with this distribution:

| Tier | % of turns | Avg input | Avg output | Calls/day | Cost/day @ Flash | Cost/day @ routed |
|---|---|---|---|---|---|---|
| Lite chat | 40% | 1,500 | 300 | 4,000 | $2.10 | $0.72 |
| Flash agent | 50% | 2,500 | 500 | 5,000 | $7.25 | $7.25 |
| Frontier fallback | 2% | 3,000 | 800 | 200 | $2.90 | $2.90 |
| Media/doc | 8% | 4,000 | 600 | 800 | $4.40 | $4.40 |
| **Total agent** | | | | | **$16.65** | **$15.27** |

Background extraction/summarization (assume 2,000 calls/day):

| Workload | Model | Input | Output | Cost/day current | Cost/day routed |
|---|---|---|---|---|---|
| Extraction/summary | Flash | 2,000 | 400 | $2.60 | — |
| Extraction/summary | Lite | 2,000 | 400 | — | $0.36 |
| **Background total** | | | | **$2.60** | **$0.36** |

**Blended daily agent savings:** ~8% from Lite chat tier.
**Blended daily background savings:** ~86%.
**Total projected monthly savings at this volume:** ~$75–150/month, scaling roughly linearly with volume and more aggressively as the Lite chat share grows.

With prompt caching (30% effective input-token discount) and consolidated Tavily caching, **total operating cost reduction of 35–55%** is realistic.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Flash Lite produces lower-quality Thai replies | A/B test a sample of user messages; keep Flash for Thai if Lite fails measured quality gate |
| Escalation logic adds latency | Only escalate when Lite clearly fails; cap at 1 escalation/turn |
| Tool registry too large for Lite | Use intent-filtered registry for Lite turns |
| Router bugs send expensive work to Frontier | Frontier tier requires explicit opt-in flag; default is Flash |
| Vendor outage | Keep Google provider as primary; OpenRouter/GPT-4.1 as optional failover |

---

## Final Recommendation

Adopt **Option E — Architecture Discovery / Hybrid Routing**.

Specifically:
1. Keep **Gemini 2.5 Flash** as the primary agentic model.
2. Promote **Gemini 2.5 Flash Lite** to simple chat, background extraction, summarization, and briefing drafting.
3. Use **intent-based tool filtering** to reduce registry size.
4. Add a **single-step escalation** rule from Lite to Flash when tool use is required but missing.
5. Reserve **Gemini 3.5 Flash or GPT-4.1** as an explicit frontier fallback for rare complex reasoning.
6. Layer on **prompt caching, semantic cache, and request deduplication** for further savings.
7. Instrument everything to tune the router with real data.

This design is the best balance: it materially reduces cost, preserves Thai quality, does not add excessive latency, and keeps the architecture maintainable as the model landscape evolves.
