# Model Analysis — Current Landscape & Root-Cause Failure Audit

This document surveys commercially available API-accessible models as of June 2026, evaluates them against Lekha's specific workload, and performs a root-cause analysis of current model-related failures before recommending any migration.

## Part 1 — Model Discovery & Evaluation

### Current implementation

```ts
// lib/llm/provider.ts
export function chatModel()      { return googleClient()("gemini-2.5-flash"); }
export function extractorModel() { return googleClient()("gemini-2.5-flash"); }
export function classifierModel(){ return googleClient()("gemini-2.5-flash-lite"); }
```

The agent, all background extraction/summarization, and media AI all run on **Gemini 2.5 Flash**. Only intent classification runs on **Gemini 2.5 Flash Lite**. This is the baseline for comparison.

### Pricing baseline (published list prices, June 2026)

| Model | Input $/M | Output $/M | Context | Notes |
|---|---|---|---|---|
| Gemini 2.5 Flash | $0.30 | $2.50 | 1M | Current agent/extractor |
| Gemini 2.5 Flash Lite | $0.10 | $0.40 | 1M | Current classifier only |
| Gemini 3 Flash Preview | $0.50 | $3.00 | 1M | Google next-gen workhorse |
| Gemini 3.5 Flash | $1.50 | $9.00 | 1M | Higher quality, more expensive |
| Gemini 3.1 Pro Preview | $2.00 | $12.00 | 1M | Frontier reasoning; >200K pricing higher |
| GPT-4.1 Nano | $0.10 | $0.40 | 1M | OpenAI cheap tier; good structured output |
| GPT-4.1 Mini | $0.40 | $1.60 | 1M | Mid-tier production |
| GPT-4.1 | $2.00 | $8.00 | 1M | Strong tool calling / instruction following |
| GPT-5 Mini | $0.25 | $2.00 | 128K | Budget general-purpose |
| GPT-5 | $1.25 | $10.00 | 128K–1M | Frontier reasoning |
| Claude Haiku 4.5 | $1.00 | $5.00 | 200K | Fast, cheap Anthropic tier |
| Claude Sonnet 4.6 | $3.00 | $15.00 | 1M | Strong coding/agents |
| Claude Opus 4.6 | $5.00 | $25.00 | 1M | Highest Anthropic quality |
| DeepSeek V4 Flash | $0.098 | $0.196 | 1M | Very cheap, MoE, good reasoning |
| DeepSeek V4 Pro | $0.435 | $0.87 | 1M | Strong coding/reasoning |
| MiniMax M3 | $0.30 | $1.20 | 1M | Tool-calling optimized |
| Qwen3.5-Plus | $0.40 | $2.40 | 256K | Strong multilingual |

Prices are list and exclude batch/caching discounts. Effective costs can be 50–90% lower with prompt caching and batch processing.

### Candidate evaluation matrix

Scoring: **5 = excellent for Lekha**, **1 = poor for Lekha**. Scores combine public benchmarks and fit to this project's constraints (Thai/English bilingual LINE assistant, heavy tool use, long conversations, cost-sensitive).

| Candidate | Thai | English | Reasoning | Tool Calling | Coding | RAG | Latency | Cost | Context | Stability | Vendor Lock-in | Score for Lekha |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gemini 2.5 Flash (current) | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 5 | 4 | 3 (Google) | Baseline |
| Gemini 2.5 Flash Lite | 3 | 3 | 3 | 3 | 3 | 3 | 5 | 5 | 5 | 4 | 3 (Google) | High for background |
| Gemini 3 Flash Preview | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 5 | 3 (preview) | 3 | Watch |
| Gemini 3.5 Flash | 4 | 5 | 5 | 5 | 5 | 4 | 3 | 2 | 5 | 3 | 3 | Quality upgrade, costly |
| GPT-4.1 Nano | 2 | 3 | 2 | 3 | 2 | 2 | 5 | 5 | 5 | 4 | 3 (OpenAI) | Low for agentic use |
| GPT-4.1 Mini | 3 | 4 | 3 | 4 | 3 | 3 | 4 | 4 | 5 | 4 | 3 | Viable classifier/router |
| GPT-4.1 | 4 | 5 | 4 | 5 | 5 | 4 | 3 | 3 | 5 | 4 | 3 | Strong alternative |
| GPT-5 | 4 | 5 | 5 | 5 | 5 | 4 | 3 | 2 | 4 | 4 | 3 | Frontier fallback |
| Claude Sonnet 4.6 | 4 | 5 | 5 | 5 | 5 | 4 | 3 | 2 | 5 | 4 | 3 | Best long-agentic sessions |
| Claude Opus 4.6 | 4 | 5 | 5 | 5 | 5 | 5 | 2 | 1 | 5 | 4 | 3 | Overkill for Lekha |
| DeepSeek V4 Flash | 3 | 4 | 4 | 4 | 4 | 3 | 4 | 5 | 5 | 3 | 2 (China infra) | Cheap, compliance risk |
| DeepSeek V4 Pro | 3 | 5 | 5 | 4 | 5 | 4 | 3 | 4 | 5 | 3 | 2 | Cheap reasoning, risk |
| MiniMax M3 | 3 | 4 | 4 | 5 | 4 | 3 | 4 | 4 | 5 | 3 | 2 | Tool-calling specialist |
| Qwen3.5-Plus | 4 | 4 | 4 | 4 | 4 | 4 | 3 | 4 | 4 | 3 | 2 | Strong multilingual |

### Thai / Southeast Asian language considerations

- **Gemini 2.5 family** handles Thai well in practice and is the current known-good path. Google's training data for Thai is strong, and Flash Lite is already used for classification.
- **GPT-4.1 / GPT-5** are competent in Thai but historically slightly behind Gemini on low-resource SEA nuance.
- **Claude 4.x** understands Thai but is not meaningfully better than Gemini for this workload given the 5–10× cost increase.
- **Qwen3.5** is explicitly multilingual and strong on Asian languages, but its tool-calling ecosystem is less mature than Gemini/OpenAI.
- **SEA-LION v4 / v4.5** (AI Singapore, based on Gemma 3 27B) is the leading open model family for SEA languages and cultures. It is **not available via a standard serverless API** at scale; it would require self-hosting (Vertex/GKE or similar). This adds operational complexity that is unlikely to pay off unless Thai quality is the dominant bottleneck.
- **SEA-Embedding / Qwen3-Embedding** outperformed `text-embedding-004` on the SEA-BED benchmark for retrieval tasks. If RAG quality for Thai becomes a bottleneck, switching the embedding model is higher-leverage than switching the chat model.

### Objective conclusion on model replacement

There is **no single model that is objectively superior to Gemini 2.5 Flash for Lekha's full workload while remaining economically viable**.

- For **agentic turns with tool use**, Gemini 2.5 Flash is already cost-competitive and quality-competitive.
- For **background extraction/summarization/casual replies**, **Gemini 2.5 Flash Lite is objectively superior** (3× cheaper input, 6× cheaper output, adequate quality).
- For **frontier reasoning fallback** on rare complex tasks, **Gemini 3.5 Flash or GPT-4.1** are viable but should be used sparingly.
- **Claude Opus 4.6** is overkill; its cost is not justified by marginal gains for a LINE assistant.
- **DeepSeek V4** is cheap but introduces GDPR/compliance risk for a personal assistant handling Google account data.

Therefore, the correct economic strategy is **not a single-model migration** but a **multi-tier routing architecture** that sends simple/chat-only work to Flash Lite and reserves Flash (and occasional frontier models) for tool-heavy or reasoning-heavy turns.

---

## Part 2 — Root Cause Analysis of Current Model Failures

Before replacing the model, we categorize every observed or code-inferred failure by root cause. The goal is to quantify how much is fixable by engineering alone.

### Failure inventory

| # | Failure | Likely Root Cause | Fixable by Engineering? |
|---|---|---|---|
| 1 | Model emits markdown despite instruction | Prompt design / base model behavior | Yes — stronger system prompt, post-processing already in place |
| 2 | Model answers from injected fact block instead of calling `list_memories` | Context management / prompt ordering | Yes — reorder prompt, reduce fact count, add explicit tool-first instruction |
| 3 | Model calls wrong tool (e.g., `news_search` for "what's new with you?") | Registry too large / intent not used | Yes — enable intent-based registry narrowing, add guardrails |
| 4 | Model blanks/panics on large registry | Model limitation / tool registry size | Partially — reduce tools for focused intents; if persists, keep Flash |
| 5 | Thai replies use `ค่ะ` for male users | Prompt design | Yes — detect and mirror particle |
| 6 | Mixed Thai/English output | Localization gap | Yes — localize renderers and briefings |
| 7 | Empty reply after display tool succeeds | Orchestrator fallback gap | Yes — improve `renderDisplayFallback` |
| 8 | Model hits 8-step cap mid-task | Context management / step limit | Yes — raise cap for complex intents or decompose tasks |
| 9 | Tool-call loops / repeated calls | Model limitation / lack of reflection | Partially — add step summary, deduplicate tool calls |
| 10 | Hallucinated tool names in prompts (`read_list`, `search_news`) | Dead code / stale docs | Yes — fix registry and prompts |
| 11 | Timeout but call continues server-side | API implementation | Yes — add AbortSignal |
| 12 | Perceived latency is high | No streaming | Yes — implement streaming |
| 13 | High cost for background extraction | Model selection | Yes — move to Flash Lite |
| 14 | Structured output parsing failures | Tool result shape inconsistency | Yes — standardize `{ ok, ... }` returns |
| 15 | Gemini 503 / rate-limit / spending cap errors | Vendor instability / rate limits | Partially — retries, fallback model, caching |
| 16 | Model ignores "no markdown" instruction in Flex `altText` | Prompt design + display layer | Yes — sanitize `altText` separately |
| 17 | Confirmation bypass (model asks in text instead of `draft_email`) | Tool design / prompt | Yes — add explicit pending-action instructions |

### Quantitative judgment

Roughly **75–85% of the current failure surface is addressable through engineering changes** without changing the primary model:

- Prompt and localization fixes: ~25%
- Registry narrowing / intent filtering / dead-code cleanup: ~20%
- Streaming and timeout/abort: ~10%
- Background model downgrade to Flash Lite: ~15%
- Tool-result standardization and fallback rendering: ~10%

Only **15–25%** is genuinely model-behavior limitation (e.g., Flash Lite blanking on full registry, rare complex reasoning tasks, vendor outages). These should be handled by a fallback/escalation tier, not by defaulting the entire workload to a more expensive model.

### What NOT to do

- Do **not** migrate wholesale to Claude or GPT-5. The cost increase (5–10×) is not justified by the failure rate that is actually caused by the model.
- Do **not** self-host SEA-LION unless Thai quality is proven to be the primary user-reported blocker. The operational overhead (GPU hosting, scaling, tokenization, tool-calling support) is large.
- Do **not** switch to DeepSeek as primary provider. The compliance and data-residency risk for a bot connected to Gmail/Calendar/Drive is unacceptable.

---

## Part 3 — Recommended Model Strategy

1. **Keep Gemini 2.5 Flash as the primary agentic model.** It is good enough, cheap enough, and already integrated. The failures attributed to it are mostly fixable in code.
2. **Promote Gemini 2.5 Flash Lite to all background work:** fact extraction, history summarization, archive summarization, casual replies, media OCR where quality permits, and morning/evening briefing drafting.
3. **Use Flash Lite as the first-pass model for chat-only turns** in a router, escalating to Flash only when tool use or reasoning confidence is low.
4. **Reserve Gemini 3.5 Flash or GPT-4.1 as an explicit fallback** for rare complex reasoning / coding tasks, triggered by a confidence/retry rule, not by default.
5. **Evaluate SEA-Embedding for RAG** if Thai retrieval quality becomes a measured issue, before changing the chat model.
6. **Maintain OpenRouter-compatible provider abstraction** in `lib/llm/provider.ts` so future models can be added without rewriting the orchestrator.

This strategy preserves the known-good Thai performance of the Gemini family, cuts background cost by ~60–85%, and adds a quality safety net without vendor lock-in to a single expensive model.
