# Lekha LLM Evaluation Framework

This directory contains a permanent, production-grade evaluation framework for the Lekha LINE bot. It is designed to maximize confidence in LLM behaviour while minimizing API cost.

## Philosophy: Three Layers

| Layer | Purpose | Uses LLM? | Runs in CI? | Cost |
|---|---|---|---|---|
| **Layer 1** | Deterministic application logic (routing, state, formatting) | No | Yes | $0 |
| **Layer 2** | Mocked LLM tests (tool selection, drafts, fallbacks, state) | Mocked | Yes | $0 |
| **Layer 3** | Real-model golden evaluation suite | Yes | No | Billed to Gemini API key |

**Rule:** never use the real LLM for something that can be tested deterministically.

## Quick Start

```bash
# Layer 1 + 2 — fast, deterministic, no API calls
npm run test:eval

# Layer 3 — list scenarios without running them
npm run eval:list

# Layer 3 — run a real-LLM suite (requires GEMINI_API_KEY)
npm run eval:small
npm run eval:medium
npm run eval:full
npm run eval:stress
```

## Layer 1: Application Tests

Location: `eval/layer1/`

These are ordinary Vitest tests for pure logic:

- `fastClassify` intent routing
- `toolsForUser` registry filtering
- `processResult` draft/error/auth handling
- Deterministic fallbacks (`looksLikeTaskList`, `looksLikeWeather`, etc.)

They mock Redis/env/LINE where needed and never call Gemini.

## Layer 2: Mocked LLM Tests

Location: `eval/layer2/`

These tests exercise the full `runAgent` orchestrator with a deterministic mock of the `ai` SDK's `generateText`. They verify:

- Correct tool selection per intent
- Draft confirmation flow
- Error-relay override
- Deterministic fallback execution
- Conversation state across turns

The mock lives in `eval/mocks/llm.ts` and is configured per test via `mockGenerateText([...])`.

## Layer 3: Golden Evaluation Suite

Location: `eval/layer3/`

Golden scenarios define behaviour, not exact wording. Each scenario specifies:

- conversation history
- user message
- required tools
- forbidden tools
- argument checks
- behavioural constraints

### Suites

| Suite | When to run | Scenarios | ~Runtime | ~Cost |
|---|---|---|---|---|
| `small` | After prompt changes | 6 | ~30s | ~$0.01 |
| `medium` | Before merge to main | 12 | ~2m | ~$0.05 |
| `full` | Before production deploy | 24 | ~5m | ~$0.10 |
| `stress` | Manual only | 5 | configurable | configurable |

Costs are estimates for `gemini-2.5-flash` and depend on prompt size.

### CLI Flags

```bash
tsx eval/layer3/run.ts --suite=small
  --model=gemini-2.5-flash   # override model
  --no-cache                 # force fresh LLM calls
  --max-cost=0.50            # stop after $0.50
  --compare                  # fail if any scenario regressed vs previous run
  --list                     # print scenario IDs and exit
```

### Caching

Layer 3 caches LLM results keyed by scenario + prompt version + model + state. Cached results are stored in `eval/results/cache/`. Use `--no-cache` to bypass.

### Results & Reports

Each run writes:

- `eval/results/runs/<timestamp>-<suite>.jsonl` — raw per-scenario records
- `eval/results/reports/<timestamp>-<suite>.md` — human-readable report
- `eval/results/reports/<timestamp>-<suite>.json` — summary for CI parsing

### Regression Protection

Run with `--compare` to compare against the most recent run for the same suite. Any scenario that previously passed and now fails causes a non-zero exit code.

When a real regression is found:

1. Add a deterministic Layer 2 mock scenario that reproduces it.
2. Document root cause + fix in `eval/layer3/regressions/`.
3. The CI path (`npm run test:eval`) will catch it for free forever.

## Adding a New Scenario

1. Create or edit a file in `eval/layer3/scenarios/`.
2. Use `defineScenario({ ... })` from `eval/engine/scenario.ts`.
3. Add the scenario ID to the appropriate suites in `eval/engine/suite.ts`.
4. Run `npm run eval:list` to confirm it appears.
5. Run `npm run eval:small` (or the relevant suite) to validate against the real model.

Example:

```ts
import { defineScenario, taskListState } from "@/eval/engine/scenario";

export const myScenarios = [
  defineScenario({
    id: "my-feature-happy",
    name: "My feature — happy path",
    category: "my-feature",
    layer: 3,
    suite: ["small", "medium", "full"],
    state: taskListState(["example task"]),
    userText: "show my example tasks",
    expected: {
      requiredTools: ["list_tasks"],
      forbiddenTools: ["web_search"],
    },
  }),
];
```

## Shared Infrastructure

- `eval/engine/types.ts` — shared types
- `eval/engine/matchers.ts` — behavioural assertions
- `eval/engine/runner.ts` — Layer 3 execution engine
- `eval/engine/cache.ts` — response cache
- `eval/engine/history.ts` — result storage + regression detection
- `eval/engine/reporter.ts` — Markdown/JSON reports
- `eval/engine/version.ts` — prompt version + commit hash
- `eval/mocks/redis.ts` — in-memory Redis mock
- `eval/mocks/llm.ts` — `ai` SDK mock
- `eval/mocks/env.ts` — env helper mock
- `eval/fixtures/user.ts` — reusable user/profile builders
- `eval/fixtures/state.ts` — state seeders

## Cost Control Checklist

- [ ] Layer 1 + 2 run on every push (no API cost).
- [ ] Layer 3 uses caching by default.
- [ ] Run `small` after prompt tweaks.
- [ ] Run `medium` before merging to `main`.
- [ ] Run `full` before production deploy.
- [ ] `stress` is manual only.
- [ ] Use `--max-cost` to cap spend.

## Notes

- QR / Plant flow scenarios are placeholders (`eval/layer3/scenarios/qr-plant.ts`) because that feature does not exist in the current codebase.
- The framework intentionally does not compare exact wording. It asserts behaviour: tools called, arguments valid, no hallucinated sources, constraints satisfied.
