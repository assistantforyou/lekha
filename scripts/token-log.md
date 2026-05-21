# Token Optimization Log

Tracking before/after token counts for each optimization applied to the Lekha prompt.
Counts measured with `scripts/measure-prompt.ts` against Gemini 2.5 Flash Lite.

Note: test environment has no Google OAuth configured, so all Google-gated tools
(email, calendar, drive, gmail, docs, google-accounts, scheduled-email, contacts) are
excluded from measurements. Tool-side savings for those tools are real in production
but won't appear here.

---

## Baseline (2026-05-20, branch main, 51 non-Google tools, 11 facts, 20 history turns)

| Component              | Tokens |
|------------------------|-------:|
| a) System prompt       |  3,426 |
| b) Tool defs (combined)|  3,613 |
| d) History (20 turns)  |    317 |
| e) FULL REQUEST        |  7,358 |

System prompt chars: ~12,500 (BASE_PERSONALITY + user meta + time + facts)

---

## After Phase 3 optimizations (commit bcad449, 2026-05-20)

All four optimizations applied together. Re-run of measure-prompt.ts:

| Component              | Before | After | Delta  | % |
|------------------------|-------:|------:|-------:|--:|
| a) System prompt       |  3,426 | 2,020 | -1,406 | -41% |
| b) Tool defs (combined)|  3,613 | 3,596 |    -17 | ~0% |
| d) History (20 turns)  |    317 |   317 |      0 |   0% |
| e) FULL REQUEST        |  7,358 | 5,935 | -1,423 | -19% |

System prompt chars: 8,058 (BASE_PERSONALITY: 7,273 + user meta + facts)

**Effective saving: -1,423 tokens per request (-19%) on non-Google tool set.**

In production (with Google OAuth — ~15 additional tools including email, calendar,
drive, gmail, docs, contacts), the savings are larger:
- contacts_search removal: ~70 tokens on tool defs
- 4 tool description trims (draft_email, read_document, edit_google_doc, draft_gmail_reply): ~175 tokens
- Estimated production full-request delta: ~-1,668 tokens vs baseline

---

## Breakdown by optimization

### 1. Delete `contacts_search` (commit 588c8ee)
Remove Google Contacts tool. Saves ~70 tokens on tool defs in production.
No effect in test env (Google OAuth not configured → tool was already excluded).

### 2. BASE_PERSONALITY capabilities block trim (commit f7845f7)
Replaced 33-line verbose capability list with 9-line terse key routing rules.
The tool descriptions already define what each tool does; system prompt only
needed the non-obvious routing overrides.
**Measured saving: ~1,386 tokens on system prompt** (majority of -1,406 delta,
remainder from removing time from system prompt in step 3).

### 3. Extract `Current time` from system prompt (commit d8a709f)
Moved per-request timestamp to a conversation prefix pair
`{role:"user", content: "Current time: ..."}` + `{role:"assistant", content:"Noted."}`.
System prompt is now stable across consecutive requests from the same user,
enabling Gemini 2.5 Flash Lite implicit caching.
Caching threshold: 1,024 tokens (current system prompt: ~2,020 tokens — qualifies).
**Expected cache benefit: ~2,020 tokens billed at cached rate (~4× cheaper) per
cache hit, starting from the 2nd request with the same system prompt + tools.**

### 4. Top 4 tool description trims (commit bcad449)
Shortened descriptions for draft_email (514→225 chars), read_document (295→165),
edit_google_doc (292→130), draft_gmail_reply (274→125).
Saves ~175 tokens on tool defs in production (Google OAuth required tools).
No effect in test env.
