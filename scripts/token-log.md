# Token Optimization Log

Tracking before/after token counts for each optimization applied to the Lekha prompt.
Counts measured with `scripts/measure-prompt.ts` against Gemini 2.5 Flash Lite.

## Baseline (2026-05-20, branch main, 51 tools, 11 facts, 20 history turns)

| Component              | Tokens |
|------------------------|-------:|
| a) System prompt       |  3,426 |
| b) Tool defs (combined)|  3,613 |
| d) History (20 turns)  |    317 |
| e) FULL REQUEST        |  7,358 |

---

## Optimizations

### 1. Delete `contacts_search` (commit 588c8ee)
Remove the Google Contacts tool — no users rely on it; email tools accept literal addresses.

| Component              | Before | After | Delta |
|------------------------|-------:|------:|------:|
| b) Tool defs (combined)|  3,613 |   TBD |   TBD |
| e) FULL REQUEST        |  7,358 |   TBD |   TBD |

*Re-run `measure-prompt.ts` to fill in After column.*

---

### 2. BASE_PERSONALITY capabilities block trim (pending)
Replace verbose per-tool routing paragraphs with terse one-liners (~460 tokens saved).

### 3. Context caching — extract `Current time` from system prompt (pending)
Move per-request timestamp out of the cacheable system prompt into the first content turn.
Enables Gemini implicit caching on the static portion (~7,039 tokens/request saved, ~96%).

### 4. Top tool description trim (pending)
Shorten the 10 most token-heavy tool descriptions (~175 tokens saved).
