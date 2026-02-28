# MCP Prompt Optimization Findings

Analysis of `tana-mcp-codemode` sessions to identify inefficiency patterns and iteratively improve prompt + code.

---

## Current State

### Prompt: v5.1_schema-pagination (current)
Based on v5_schema-pagination + eval-driven micro-fixes from n=2 qualitative analysis.

Key additions over baseline (cumulative v0→v5):
- `tana.format(data)` API for compact output
- Default Workspace code pattern
- Output section: format/map guidance, "never JSON.stringify"
- API Notes: no pagination, timeout recovery (proactive style), tags.list alternative
- Factual: childOf/ownedBy/inWorkspace broken — use `workspaceIds` option instead
- Removed childOf/ownedBy from Search Query Operators (models shouldn't know they exist)
- SearchResult shape documentation (eliminates field name guessing)
- Complete `is` enum (12 values, was 7)
- `includeInheritedFields` param on getSchema (P2-C)
- Search workspace scoping via TANA_SEARCH_WORKSPACES (P2-D)

v5-specific additions:
- `tags.listAll(workspaceId)` — renamed from `tags.list`, uses Schema node pagination (385 tags vs 200 limit)
- `getSchema` Extends format hint: "Extends #parent (id:xxx)" line documents inheritance output format
- Tag search pattern: `search({ and: [{ hasType: "SYS_T01" }, { textContains: "name" }] })`
- Prompt trims for overall length reduction

v5.1 micro-fixes (from n=2 qualitative analysis):
- `.filter()` scoped to listAll iteration only (was ambiguous "when searching by name" → model confused listAll+filter with search)
- `listAll` documented as "workspace Schema tags only" (not template tags) — search is primary tag lookup
- `.read()` clarified to return "content and field values" (was just "content" → model didn't drill into field data)
- Extends format hint expanded: added `(base type)` variant for system types (Haiku misread as circular self-reference)

### Code Fixes Applied
- **P2-A**: HTTP client timeout 3s (was 10s), 2 retries (was 3), 500ms backoff (was 1s). Retries now fit within 10s sandbox window.
- **P2-B**: `getSchema` option lists truncated to 5 shown + count summary. Top schemas: action (24K→~1.5K chars), note (24K→~1.5K), milestone (24K→~1.5K).
- **FM-10**: Bun.Transpiler strips TypeScript annotations before sandbox execution. Models can write `Record<>`, `as Type`, type annotations without SyntaxError.
- **FM-11**: childOf/ownedBy/inWorkspace queries all broken due to boolean GET serialization bug in Tana Local API. `workspaceIds` search option works correctly. Prompt updated + operators removed from docs.

### Variant Backups
All prompt/code variants backed up for reproducibility:
```
eval-results/.backup/          <- gitignored
├── variants/
│   ├── v0_baseline/           <- original prompt, no format()
│   ├── v1_format-apinotes/    <- format() + proactive API notes
│   ├── v2_batching/           <- format() + reactive API notes + batching nudge
│   ├── v3_timeout-schema-ts/  <- v1 prompt + factual notes + code fixes
│   ├── v4_factual-p2cd/      <- v3 + SearchResult shape, is enums, P2-C, P2-D
│   └── v5_schema-pagination/ <- v4 + P2-E schema pagination, listAll, Extends hint (CURRENT)
└── haiku/                     <- haiku result JSON copies
```

Restore any variant: `cp eval-results/.backup/variants/<name>/*.ts src/` (then restart MCP server)

### Eval Results Location
```
eval-results/
├── haiku/
│   ├── v0_baseline/
│   ├── v1_format-apinotes/
│   ├── v2_batching/
│   ├── v3_timeout-schema-ts/
│   ├── v3_timeout-schema-ts_r1/    <- n=2 re-eval
│   ├── v3_timeout-schema-ts_r2/
│   ├── v4_factual-p2cd_r1/
│   ├── v4_factual-p2cd_r2/
│   ├── v5_schema-pagination_r1/
│   ├── v5_schema-pagination_r2/
│   ├── v5.1_prompt-fixes_r1/
│   └── v5.1_prompt-fixes_r2/
└── sonnet/
    ├── v0_baseline/
    ├── v1_format-apinotes/
    ├── v2_batching/
    ├── v3_timeout-schema-ts/
    ├── v3_timeout-schema-ts_r1/    <- n=2 re-eval
    ├── v3_timeout-schema-ts_r2/
    ├── v4_factual-p2cd_r1/
    ├── v4_factual-p2cd_r2/
    ├── v5_schema-pagination_r1/
    ├── v5_schema-pagination_r2/
    ├── v5.1_prompt-fixes_r1/
    └── v5.1_prompt-fixes_r2/
```

Compare any two: `/opt/homebrew/bin/bash scripts/compare-eval.sh <dir-a> <dir-b>`

---

## Eval Results

### Prompt Change Taxonomy (Key Discovery)

| Category | Example | Effect |
|----------|---------|--------|
| **Factual** | "search: max 100, no pagination" | Universal win — prevents known errors on both models |
| **Prohibitive** | "Never JSON.stringify" | Universal win — both models respect prohibitions |
| **Strategic** | "Batch work in one execute call" | **Model-divergent** — helped Haiku, made Sonnet over-ambitious |
| **Structural** (code) | Timeout/retry tuning, schema truncation, TS transpiler | Universal win — prevents errors that no prompt can fix |

**Conclusion**: Factual notes, prohibitions, and structural code fixes are safe. Strategic instructions are risky. Code fixes compound with prompt optimization — Sonnet's best result uses both.

### Haiku Results (8 scenarios each)

| Variant | Cost | Output Tokens | Turns | vs Baseline |
|---------|------|---------------|-------|-------------|
| v0_baseline | $0.339 | 11,962 | 23 | — |
| v1_format-apinotes | $0.324 | 13,710 | 25 | -4.6% cost |
| v2_batching | **$0.287** | 9,873 | 21 | **-15.4% cost** |
| v3_timeout-schema-ts | $0.297 | 11,357 | 21 | -12.4% cost |

### Sonnet Results (8 scenarios each)

| Variant | Cost | Output Tokens | Turns | vs Baseline |
|---------|------|---------------|-------|-------------|
| v0_baseline | $1.712 | 14,551 | 30 | — |
| v1_format-apinotes | $1.569 | 14,027 | 29 | -8.4% cost |
| v2_batching | $1.911 | 18,286 | 32 | +11.6% cost |
| v3_timeout-schema-ts | **$1.523** | 13,546 | 24 | **-11.0% cost** |

### v3 vs v4 Re-evaluation (n=2)

Ran each variant twice to test reproducibility. 8 scenarios × 2 runs × 2 models = 32 eval runs.

**Haiku (n=2):**

| Version | Run | Cost | Output Tokens | Turns |
|---------|-----|------|---------------|-------|
| v3 | r1 | $0.288 | 11,496 | 20 |
| v3 | r2 | $0.342 | 14,787 | 30 |
| v3 avg | — | $0.315 | 13,142 | 25 |
| v4 | r1 | $0.333 | 15,799 | 26 |
| v4 | r2 | $0.304 | 12,650 | 24 |
| v4 avg | — | $0.318 | 14,225 | 25 |
| v5 | r1 | $0.285 | 9,905 | 20 |
| v5 | r2 | $0.237 | 8,850 | 19 |
| v5 avg | — | **$0.261** | 9,378 | 19.5 |
| v5.1 | r1 | $0.286 | 9,322 | 22 |
| v5.1 | r2 | $0.234 | 9,303 | 19 |
| v5.1 avg | — | $0.260 | 9,313 | 20.5 |

**v4→v5 Haiku: -18% cost, -34% output tokens, -22% turns.** Driven primarily by e08 stabilization (see below).

**v5→v5.1 Haiku: -0.4% cost (noise). Output tokens nearly identical. Turns +1 avg.**

**Sonnet (n=2):**

| Version | Run | Cost | Output Tokens | Turns |
|---------|-----|------|---------------|-------|
| v3 | r1 | $1.765 | 14,075 | 32 |
| v3 | r2 | $1.713 | 17,647 | 29 |
| v3 avg | — | $1.739 | 15,861 | 30.5 |
| v4 | r1 | $1.892 | 22,228 | 32 |
| v4 | r2 | $1.391 | 12,974 | 24 |
| v4 avg | — | $1.642 | 17,601 | 28 |
| v5 | r1 | $1.341 | 8,798 | 23 |
| v5 | r2 | $1.315 | 8,888 | 22 |
| v5 avg | — | **$1.328** | 8,843 | 22.5 |
| v5.1 | r1 | $1.320 | 9,634 | 25 |
| v5.1 | r2 | $1.312 | 10,253 | 24 |
| v5.1 avg | — | $1.316 | 9,944 | 24.5 |

**v4→v5 Sonnet: -19% cost, -50% output tokens, -20% turns.** e08 variance collapsed from $0.586 to $0.010 (59x narrower). Intra-v5 spread is 2% ($1.341 vs $1.315) vs v4's 36% ($1.892 vs $1.391).

**v5→v5.1 Sonnet: -0.9% cost (noise). Output tokens +12%. Turns +2 avg. Cost-neutral.**

**v4→v5 Per-Scenario Averages (Haiku):**

| Scenario | v4 avg cost | v5 avg cost | Change | v4 avg turns | v5 avg turns |
|----------|------------|------------|--------|-------------|-------------|
| e01-discovery | $0.049 | $0.043 | -12% | 2 | 2 |
| e02-structure | $0.036 | $0.035 | -3% | 2.5 | 3 |
| e03-search-read | $0.029 | $0.035 | +17% | 2 | 2.5 |
| e04-topic-search | $0.026 | $0.032 | +22% | 2 | 2 |
| e05-tasks | $0.032 | $0.027 | -14% | 2 | 2 |
| e06-schema | $0.025 | $0.033 | +32% | 2 | 4 |
| e07-create | $0.037 | $0.024 | -35% | 4.5 | 2 |
| e08-tag-explore | $0.084 | $0.032 | **-62%** | 8 | 2 |
| **Total** | **$0.318** | **$0.261** | **-18%** | **25** | **19.5** |

**v4→v5 Per-Scenario Averages (Sonnet):**

| Scenario | v4 avg cost | v5 avg cost | Change | v4 avg turns | v5 avg turns |
|----------|------------|------------|--------|-------------|-------------|
| e01-discovery | $0.251 | $0.296 | +18% | 3 | 3 |
| e02-structure | $0.181 | $0.176 | -3% | 3 | 4 |
| e03-search-read | $0.142 | $0.162 | +14% | 2.5 | 3 |
| e04-topic-search | $0.128 | $0.128 | 0% | 2 | 2 |
| e05-tasks | $0.171 | $0.153 | -10% | 3 | 2.5 |
| e06-schema | $0.146 | $0.147 | +1% | 3.5 | 3 |
| e07-create | $0.124 | $0.111 | -11% | 2.5 | 2 |
| e08-tag-explore | $0.498 | $0.155 | **-69%** | 8.5 | 3 |
| **Total** | **$1.642** | **$1.328** | **-19%** | **28** | **22.5** |

e08 dominates the cost improvement on both models. Non-e08 scenarios are roughly cost-neutral (Haiku +2%, Sonnet +2% excluding e08).

**v5→v5.1 Per-Scenario Averages (Haiku):**

| Scenario | v5 avg cost | v5.1 avg cost | Change | v5 avg turns | v5.1 avg turns |
|----------|------------|--------------|--------|-------------|---------------|
| e01-discovery | $0.043 | $0.046 | +7% | 2 | 2.5 |
| e02-structure | $0.035 | $0.039 | +11% | 3 | 3 |
| e03-search-read | $0.035 | $0.035 | 0% | 2.5 | 3 |
| e04-topic-search | $0.032 | $0.030 | -6% | 2 | 2 |
| e05-tasks | $0.027 | $0.028 | +4% | 2 | 2.5 |
| e06-schema | $0.033 | $0.032 | -3% | 4 | 3.5 |
| e07-create | $0.024 | $0.024 | 0% | 2 | 2 |
| e08-tag-explore | $0.032 | $0.026 | -19% | 2 | 2 |
| **Total** | **$0.261** | **$0.260** | **-0.4%** | **19.5** | **20.5** |

**v5→v5.1 Per-Scenario Averages (Sonnet):**

| Scenario | v5 avg cost | v5.1 avg cost | Change | v5 avg turns | v5.1 avg turns |
|----------|------------|--------------|--------|-------------|---------------|
| e01-discovery | $0.296 | $0.211 | -29% | 3 | 3.5 |
| e02-structure | $0.176 | $0.178 | +1% | 4 | 3 |
| e03-search-read | $0.162 | $0.163 | +1% | 3 | 3 |
| e04-topic-search | $0.128 | $0.135 | +5% | 2 | 2 |
| e05-tasks | $0.153 | $0.160 | +5% | 2.5 | 3 |
| e06-schema | $0.147 | $0.193 | +31% | 3 | 4.5 |
| e07-create | $0.111 | $0.110 | -1% | 2 | 2 |
| e08-tag-explore | $0.155 | $0.167 | +8% | 3 | 3.5 |
| **Total** | **$1.328** | **$1.316** | **-0.9%** | **22.5** | **24.5** |

Note: Sonnet e06 cost increase (+31%) is from timeout/retry on workspace ID typo, not from strategy change. e01 decrease (-29%) is from cache efficiency variance.

### Variance Analysis

n=1 results were misleading. Key findings:

1. **Original v3 Sonnet ($1.523) was a lucky run** — n=2 average is $1.739 (+14%). The "best result" from n=1 was below the range of either n=2 run ($1.713, $1.765).
2. **Sonnet v4 has 36% spread** — ranges from $1.391 to $1.892. Individual runs can swing $0.50 in either direction.
3. **Haiku is more stable** — v3 spread 19% ($0.288–$0.342), v4 spread 10% ($0.304–$0.333).
4. **e08-tag-explore is the dominant variance driver** — single scenario ranges $0.05 to $0.79 across all runs. This one scenario can swing total cost by $0.74, which is ~45% of Sonnet's average total.
5. **Cost-neutral conclusion**: v3 and v4 are statistically indistinguishable on cost. Haiku: $0.315 vs $0.318 (+1%). Sonnet: $1.739 vs $1.642 (-6%, within noise).

#### v5 Variance Update: e08 Stabilized

v5's Schema pagination (P2-E) + `listAll` rename + Extends format hint dramatically stabilized e08:

| Metric | v4 e08 | v5 e08 | Change |
|--------|--------|--------|--------|
| **Haiku** | | | |
| Cost range | $0.048–$0.120 | $0.026–$0.038 | 6x narrower |
| Turn range | 5–11 | 2–2 | Locked at 2 |
| Avg cost | $0.084 | $0.032 | -62% |
| **Sonnet** | | | |
| Cost range | $0.205–$0.791 | $0.150–$0.160 | **59x narrower** |
| Turn range | 3–14 | 3–3 | Locked at 3 |
| Avg cost | $0.498 | $0.155 | -69% |

**e08 is no longer the dominant variance driver on either model.** v5 runs complete e08 in 2 turns (Haiku) or 3 turns (Sonnet) — `listAll` returns all tags, `getSchema` finds `Extends` lines, done. The v4 approach (`tags.list` with pagination limit → multiple attempts → schema parsing) caused 3-14 turns of exploration.

Sonnet's overall variance collapsed even more dramatically: v4 had 36% spread ($1.391–$1.892), v5 has 2% spread ($1.315–$1.341). Haiku v5 spread is 17% ($0.237–$0.285), slightly higher than v4's 10% due to non-e08 scenario variance (e02: 2-4 turns, e06: 3-5 turns).

#### v5.1 Variance

| Model | v5 cost range | v5.1 cost range | v5 spread | v5.1 spread |
|-------|-------------|----------------|-----------|-------------|
| Haiku | $0.237–$0.285 | $0.234–$0.286 | 17% | 18% |
| Sonnet | $1.315–$1.341 | $1.312–$1.320 | 2% | 0.6% |

Sonnet v5.1 variance is the tightest observed across all versions (0.6%). Haiku remains in the 17-18% range, consistent with v5.

#### v5.1 e08 Variance (continued from v5 analysis)

| Metric | v5 Haiku r1 | v5 Haiku r2 | v5.1 Haiku r1 | v5.1 Haiku r2 |
|--------|------------|------------|--------------|--------------|
| Cost | $0.038 | $0.026 | $0.025 | $0.026 |
| Turns | 2 | 2 | 2 | 2 |
| Quality | Partial | Correct | Correct | Partial (hedged) |

| Metric | v5 Sonnet r1 | v5 Sonnet r2 | v5.1 Sonnet r1 | v5.1 Sonnet r2 |
|--------|-------------|-------------|---------------|---------------|
| Cost | $0.150 | $0.160 | $0.162 | $0.172 |
| Turns | 3 | 3 | 3 | 4 |
| Quality | Correct | Correct | Correct | Correct |

e08 cost/turn variance remains tight on both models. Quality variance persists for Haiku (2/4 runs Partial — both caused by regex stripping `(base type)` from Extends output) but is fully stable for Sonnet (4/4 Correct across v5+v5.1).

### Per-Scenario Patterns

**Universal wins:**
- tana.format() saves ~40% on tool result tokens (both models adopt consistently)
- "No JSON.stringify" prohibition universally followed
- Factual API docs prevent known errors on both models

**Model-specific effects (prompt):**
- "search returns identity; use .read()" → helped Sonnet (clearer mental model), minor negative for Haiku
- "tags.list can be slow" (proactive) → helped Sonnet (avoided bad patterns), hurt Haiku on e08
- "Batch work in one call" → helped Haiku (fewer calls), hurt Sonnet (over-ambitious)

**Code fix effects (v3_timeout-schema-ts):**
- **e08-tag-explore divergence**: Schema truncation (P2-B) made Sonnet more efficient (5→3 turns, -37% cost) but Haiku more ambitious (2→7 turns, +148% cost vs v2_batching). With less data per schema, Haiku explored more tags instead of stopping early. See qualitative analysis below — Haiku's cost increase is actually a **correctness improvement**.
- **e02-structure**: Both models improved. Haiku: 4-6→2 turns (-43% to -61% cost). Sonnet: 5→3 turns (-14% cost).
- **e05-tasks (Sonnet)**: -30% cost vs v0_baseline (7→6 turns). Faster retries (P2-A) help multi-turn scenarios.
- **e03-search-read (Haiku)**: -40% cost vs v0_baseline (7→2 turns). TS support (FM-10) likely prevented retry loops.
- **Net effect**: Code fixes compound with prompt optimization for Sonnet (new best). For Haiku, code fixes help vs v0_baseline but don't recover v2_batching's advantage.

### Qualitative Analysis (v3 vs v0/v2)

The numbers hide the most important finding: **code fixes changed model behavior, not just efficiency**. Three scenarios illustrate this clearly.

#### e08-tag-explore: Cheaper ≠ Better

The workspace has real tag inheritance (container → work → todo → task, objective → goal/project, etc.). Each variant handled this differently:

| Variant | Turns | Cost | Found Inheritance? | Answer |
|---------|-------|------|--------------------|--------|
| Haiku v2_batching | 2 | $0.025 | **No** | "68 tags, flat structure, no inheritance" — **wrong** |
| Haiku v3_timeout-schema-ts | 7 | $0.062 | **Partial** | Found objective→task (1 relationship). Debugged through 6 calls. |
| Sonnet v0_baseline | 7 | $0.331 | **Yes** | Full tree. Had workspace ID typo on turn 1, recovered. |
| Sonnet v3_timeout-schema-ts | 3 | $0.211 | **Yes** | Full tree. No typo. Clean 2-call execution. |

Haiku v2 was the cheapest variant on this scenario — and completely wrong. It accepted its first result ("no extends found") without verification. Haiku v3 cost 2.5x more but was actually *trying to be correct*: when initial parsing failed, it tried different strategies (regex, raw schema inspection, node reads at increasing depth) until it found the relationship. The +148% cost "regression" is a quality improvement.

Sonnet v3 is the clear winner: same full tree as v0 baseline, but in 3 turns instead of 7. The v0 baseline wasted its first turn on a workspace ID typo (`HfCy68zUPM7` instead of `HfCy68zUUPM7`), then needed 5 more calls to build the tree. v3 got it right first try with `Promise.all()` parallel schema fetching.

#### e03-search-read: Workspace Scoping

Search for "meeting" notes — straightforward, but the API returns cross-workspace results unless you filter.

| Variant | Filter Used | Results | Quality |
|---------|------------|---------|---------|
| Sonnet v0_baseline | None | Mixed (includes other workspaces) | Manually filtered in post-processing |
| Haiku v2_batching | None | 60 results (cross-workspace) | Presented all, diluted relevance |
| Haiku v3_timeout-schema-ts | `workspaceIds` | 31 results (scoped) | Focused on actual meetings |
| Sonnet v3_timeout-schema-ts | `workspaceIds` | 31 results (scoped) | Categorized by type, high quality |

The v3 prompt's factual note about `workspaceIds` (from FM-11 investigation) taught both models to scope searches correctly. This is invisible in cost metrics — v0 and v3 both used ~1-2 calls — but the v3 answers are more precise because they don't include noise from other workspaces.

#### e05-tasks: Error Path Elimination

"Show my recent tasks" — the hardest scenario because it requires filtering by status and recency.

| Variant | Turns | What Went Wrong |
|---------|-------|-----------------|
| Sonnet v0_baseline | 7 | Tried `childOf` + `is: "todo"` compound query → 400 error. Tried `workspaceId` (wrong param) → wrong results. 4 fallback attempts. |
| Sonnet v3_timeout-schema-ts | 6 | `childOf`/`ownedBy` removed from prompt → never tried broken queries. Still needed iteration for `id` vs `nodeId` field discovery and `edited.last` filter semantics. |

v0 wasted 2+ turns on `childOf` queries that can't work (FM-11 bug). v3 never tried them because they were removed from the prompt. The remaining iteration in v3 was *legitimate debugging* — discovering the actual API response shape — not fighting known-broken features.

#### Summary: What Code Fixes Actually Did

1. **Eliminated known-broken paths** (FM-11): Removing `childOf`/`ownedBy` from the prompt prevented models from trying queries that always fail. Saved 1-2 turns on complex scenarios.
2. **Enabled workspace scoping** (FM-11): The `workspaceIds` note taught models to filter correctly. Improved answer precision without affecting cost.
3. **Removed TS syntax errors** (FM-10): Bun.Transpiler means models can write natural TypeScript without wasting a turn on `SyntaxError: Unexpected token`. Most visible on Haiku, which writes TS annotations more often.
4. **Made retries viable** (P2-A): 3s timeout + 2 retries fits in the 10s sandbox window. Before, a single slow API call would eat the entire budget.
5. **Reduced schema noise** (P2-B): Truncating 24K schemas to ~1.5K let Sonnet process more schemas per call. On e08, this cut turns from 5→3 (fetched all 68 schemas in one `Promise.all()` instead of batching).

The overall pattern: **code fixes remove failure modes that prompt engineering can only partially address**. You can tell the model "search has no pagination" (factual note), but you can't prompt-engineer around a 10s timeout that kills retries before they fire.

### Methodology
8 real-world scenarios derived from Session A (discovery) and Session C (search+read). Run via `claude -p --model <model> --output-format json`. v0–v3: n=1 per scenario. v3/v4 re-evaluation: n=2 per scenario (16 runs total per model). v5/v5.1: n=2 both models (Haiku + Sonnet). Eval scripts: `scripts/eval-prompts.sh <output-dir> <model>`, `scripts/run-eval-comparison.sh`.

### Qualitative Scoring

Cost metrics alone are misleading — Haiku v2_batching was cheapest but produced 2 wrong answers out of 8 scenarios. These tables score each scenario for correctness/completeness.

#### Sonnet: v0_baseline → v3_timeout-schema-ts

| Scenario | v0 | v3 | Change |
|----------|----|----|--------|
| e01-discovery | Partial (50/68 tags) | Correct (68 tags) | Quality ↑ |
| e02-structure | Correct | Correct | Same |
| e03-search-read | Partial (no ws filter) | Correct (workspaceIds) | Quality ↑ |
| e04-topic-search | Partial (20 results, cross-ws) | Correct (50, scoped) | Quality ↑ |
| e05-tasks | Partial (7 turns, childOf errors) | Partial (6 turns, id/nodeId) | Efficiency ↑ |
| e06-schema | Correct (2 task tags) | Correct (all 4 task tags) | Quality ↑ |
| e07-create | Correct | Correct | Same |
| e08-tag-explore | Correct (typo + 7 turns) | Correct (no typo, 3 turns) | Efficiency ↑↑ |

**v3 improved 4 scenarios on quality, 2 on efficiency, 0 regressions.**

#### Haiku: v0_baseline → v2_batching → v3_timeout-schema-ts

| Scenario | v0 | v2 | v3 | v2→v3 |
|----------|----|----|-----|-------|
| e01-discovery | Correct | **Wrong** (typo → "no tags") | Correct | ↑↑ |
| e02-structure | Partial (4 turns) | Partial (5 turns) | Correct (1 call) | ↑ |
| e03-search-read | Partial (no ws filter) | Partial (60 results) | Correct (31 scoped) | ↑ |
| e04-topic-search | Correct | Correct (best grouping) | Correct | Same |
| e05-tasks | Correct | Correct | Correct | Same |
| e06-schema | Partial (.find()→1 tag) | Partial (.find()→1 tag) | Partial (.find()→1 tag) | Same |
| e07-create | Correct | Correct | Correct | Same |
| e08-tag-explore | Correct (sparse) | **Wrong** ("no inheritance") | Partial (found 1 rel) | ↑ |

**v2_batching DISQUALIFIED: 2/8 wrong answers (e01, e08). v3 has 0 wrong answers on either model.**

#### Key Findings (v0→v3)

1. **Workspace scoping is the #1 quality driver** — fixes e03/e04 for both models
2. **v2_batching's cost advantage was from accepting wrong answers faster** — not real efficiency
3. **Haiku's `.find()` on e06** — always gets 1/4 task tags regardless of variant. Model capability gap, addressable with a prompt note about duplicate names
4. **v3 is the correct baseline** going forward — best correctness on both models

#### Sonnet: v3→v4 (n=2 verified)

| Scenario | v3 (n=2) | v4 (n=2) | Change |
|----------|----------|----------|--------|
| e01-discovery | Correct | Correct | Same |
| e02-structure | Correct | Correct | Same |
| e03-search-read | Correct | Correct | Same |
| e04-topic-search | Correct | Correct | Same |
| e05-tasks | Correct | Correct | Same |
| e06-schema | Correct | Correct | Same |
| e07-create | Correct | Correct | Same |
| e08-tag-explore | Correct (6-7 turns) | Correct (3-14 turns) | Efficiency varies |

**v4 maintains Sonnet correctness across all scenarios. No regressions.**

#### Haiku: v3→v4 (n=2 verified)

| Scenario | v3 (n=2) | v4 (n=2) | Change |
|----------|----------|----------|--------|
| e01-discovery | Correct | Correct | Same |
| e02-structure | Correct | Correct | Same |
| e03-search-read | Correct | Correct | Same |
| e04-topic-search | Correct | Correct | Same |
| e05-tasks | Partial (vague) | Correct (real data) | Quality ↑ |
| e06-schema | Partial (1 tag) | Partial (1 tag) | Same |
| e07-create | Correct | Correct | Same |
| e08-tag-explore | **WRONG** ("no inheritance") | Correct (found tree) | Quality ↑↑ |

**v4 fixes Haiku's two weakest scenarios. e08 goes from wrong to correct — the SearchResult shape documentation and complete `is` enum give Haiku enough context to find the inheritance tree. e05 improves from vague summaries to real task data.**

#### Key Findings (v3→v4, n=2)

1. **v4 is a quality improvement, not a cost improvement** — cost-neutral on both models
2. **Haiku benefits most** — 2 scenario quality upgrades (e05, e08) vs 0 for Sonnet
3. **Factual documentation pays off** — SearchResult shape, complete `is` enum, `includeInheritedFields` all contributed to Haiku's e08 fix
4. **e06 remains a model capability gap** — Haiku `.find()` still returns 1/4 task tags regardless of prompt version

#### Sonnet: v4→v5 (n=2)

| Scenario | v4 (n=2) | v5 r1 | v5 r2 | Change |
|----------|----------|-------|-------|--------|
| e01-discovery | Correct | Correct (20 tags) | Correct (20 tags) | Same — `listAll` + `format()` |
| e02-structure | Correct | Correct | Correct | Same |
| e03-search-read | Correct | Correct | Correct | Same |
| e04-topic-search | Correct | Correct | Correct | Same |
| e05-tasks | Correct | Partial (no field data) | Partial (no field data) | Quality ↓ (consistent) |
| e06-schema | Correct | Correct (5 tags) | Partial (1 tag) | Strategy diverges by run |
| e07-create | Correct | Correct | Correct | Same |
| e08-tag-explore | Correct (3-14 turns) | Correct (3 turns) | Correct (3 turns) | Cost ↓↓, quality same |

**Summary: v5 Sonnet r1 is 7C/1P/0W, r2 is 6C/2P/0W. v4 was 8C/0P/0W. e05 regresses consistently; e06 is strategy-dependent.**

**Regressions explained:**
- **e05**: Both runs found 50 tasks but only reported names/counts. Neither read individual tasks to show field values (status, dates). v4 Sonnet did this. The regression may be a side effect of prompt trims reducing the model's inclination to drill deeper.
- **e06**: Strategy diverges between runs. r1 used `nodes.search({ and: [{ hasType: "SYS_T01" }, { textContains: "task" }] })` — the tag search pattern — and found 5 task tags with full schemas (Correct). r2 used `listAll` + `.includes("task")` name filter → found only `task test` (Partial). Root cause: `listAll` walks Schema node children (user-defined tags only), while `search` with `hasType: SYS_T01` returns ALL tags including template-installed ones. The `.filter()` note competed with the search pattern — both were valid strategies in the prompt but for different purposes. **Fix (v5.1)**: scoped `.filter()` note to `listAll` iteration, clarified `listAll` returns Schema tags only, positioned search as THE way to find a tag by name.

#### Haiku: v4→v5 (n=2)

| Scenario | v4 (n=2) | v5 r1 | v5 r2 | Change |
|----------|----------|-------|-------|--------|
| e01-discovery | Correct | Correct (20 tags) | Correct (20 tags) | Same — `listAll` adopted |
| e02-structure | Correct | Correct | Correct | Same |
| e03-search-read | Correct | Correct | Correct | Same |
| e04-topic-search | Correct | Correct | Correct | Same |
| e05-tasks | Correct | Partial (no field data) | Correct | Run variance |
| e06-schema | Partial (1 tag) | **Wrong** (gave up) | Partial (1 tag) | r1 regression |
| e07-create | Correct | Correct | Correct | Same |
| e08-tag-explore | Correct (5-11 turns) | Partial (misread Extends) | Correct (2 turns) | Cost ↓↓, quality varies |

**Summary: v5 r2 matches v4 quality (7C/1P/0W). v5 r1 regresses (5C/2P/1W). Quality is stochastic on 3 scenarios.**

**v5 r1 issues:**
- **e05**: Listed tasks but didn't read field-level data (status, dates). Scored Partial vs v4's Correct.
- **e06**: Found `todo` and `task test` but said "there's no task tag" and asked user to clarify instead of proactively investigating. Scored Wrong (v4 was Partial).
- **e08**: Found all 3 `Extends` relationships but misinterpreted `day extends #day` as a "circular self-reference" — actually means user's `day` tag extends Tana's built-in `#day` base type (SYS_T124). Regex captured `#day` without the `(base type)` qualifier. Scored Partial (v4 was Correct).

**v5 r2 strengths:**
- **e08**: Found all 3 inheritance relationships correctly in 2 turns (v4 took 5-11). Used `listAll` → `getSchema` → regex parse. Clean execution.
- **e04/e05**: Used `tana.format()` as intended.
- **e01**: Listed all 20 tags via `listAll` (v4 also got 20, but with more effort).

#### Key Findings (v4→v5, n=2 both models)

1. **v5 is a cost + stability improvement on both models** — Haiku: -18% cost, Sonnet: -19% cost. e08 variance collapsed on both (6x narrower for Haiku, 59x for Sonnet).
2. **`listAll` adoption is universal** — all 4 runs use it correctly for tag enumeration, no pagination struggles.
3. **e08 cost stabilized but Haiku quality is stochastic** — Haiku r1 misinterpreted Extends format, r2 got it right. Sonnet gets it right both runs. Turns locked at 2-3 across all runs (vs v4's 3-14).
4. **e06 is strategy-dependent, not consistently regressed** — Sonnet r1 used the tag search pattern (`nodes.search` with `hasType: SYS_T01`) → found 5 task tags (Correct). r2 used `listAll` + name filter → found 1 tag (Partial). The `.filter()` note provides a valid strategy but competes with the tag search pattern. Which strategy the model picks is stochastic.
5. **e05 regressed on Sonnet** — v4 Sonnet read task field data, v5 only reports names/counts. Consistent across both runs. May be a side effect of prompt trims reducing the model's inclination to drill deeper.
6. **Sonnet v5 cost variance is near-zero** — 2% cost spread (vs v4's 36%). Quality varies slightly between runs (7C/1P vs 6C/2P) due to e06 strategy selection.
7. **Overall quality tradeoff**: v5 Sonnet best run (r1) is 7C/1P/0W vs v4's 8C/0P/0W — only 1 regression (e05). Worst run (r2) is 6C/2P/0W. Both are significant cost improvements (-19%) with near-zero variance.

#### Sonnet: v5→v5.1 (n=2)

| Scenario | v5 (n=2) | v5.1 r1 | v5.1 r2 | Change |
|----------|----------|---------|---------|--------|
| e01-discovery | Correct | Correct | Correct | Same |
| e02-structure | Correct | Correct | Correct | Same |
| e03-search-read | Correct | Correct | Correct | Same |
| e04-topic-search | Correct | Correct | Correct | Same |
| e05-tasks | Partial (no field data) | Partial (no field data) | Partial (no field data) | Same (not fixed) |
| e06-schema | Correct/Partial | Correct (search) | Correct (search) | Strategy stabilized ↑ |
| e07-create | Correct | Correct | Correct | Same |
| e08-tag-explore | Correct | Correct | Correct | Same |

**Summary: v5.1 Sonnet r1=7C/1P/0W, r2=7C/1P/0W. v5 was r1=7C/1P, r2=6C/2P. e06 stabilized — both runs now use `search({hasType:"SYS_T01"})` instead of mixed strategies. e05 remains Partial (consistent across all 4 v5+v5.1 runs).**

#### Haiku: v5→v5.1 (n=2)

| Scenario | v5 (n=2) | v5.1 r1 | v5.1 r2 | Change |
|----------|----------|---------|---------|--------|
| e01-discovery | Correct | Correct | Correct | Same |
| e02-structure | Correct | Correct | Correct | Same |
| e03-search-read | Correct | Correct | Correct | Same |
| e04-topic-search | Correct | Correct | Correct | Same |
| e05-tasks | Partial/Correct | Partial (no field data) | Partial (no field data) | Regressed to consistent Partial |
| e06-schema | Wrong/Partial | Partial (listAll+filter) | Partial (listAll+filter) | Strategy unchanged |
| e07-create | Correct | Correct | Correct | Same |
| e08-tag-explore | Partial/Correct | Correct | Partial (hedged) | Quality variance persists |

**Summary: v5.1 Haiku r1=6C/2P/0W, r2=5C/3P/0W. e06 still uses `listAll()+filter` — prompt change didn't reach Haiku. e08 r1 correctly identified system base types (fix worked); r2 regex stripped "(base type)" but hedged correctly ("might indicate a base system tag") — scored Partial for consistency with v5 r1's identical failure mode. e05 consistently Partial — `.read()` clarification insufficient for both models.**

#### v5.1 Regression Target Analysis

v5.1 targeted 3 specific behaviors. Results across all 4 runs:

| Target | Fix Applied | Haiku r1 | Haiku r2 | Sonnet r1 | Sonnet r2 | v5 baseline | Verdict |
|--------|------------|----------|----------|-----------|-----------|-------------|---------|
| e05: `.read()` for field values | Clarified ".read() returns content and field values" | FAIL | FAIL | FAIL | FAIL | 0/4 PASS | **Not fixed** |
| e06: search vs listAll | Scoped `.filter()` to listAll, search as primary lookup | FAIL | FAIL | PASS | PASS | 1/4 PASS | **Sonnet fixed, Haiku unchanged** |
| e08: Extends base type | Added `(base type)` variant to format hint | PASS | PARTIAL | PASS | PASS | 2/4 PASS | **Improved (3.5/4 → was 2/4)** |

**Analysis:**
1. **e05**: The wording "content and field values" is insufficient. Neither model interprets this as "search returns metadata; you need `.read()` for field-level data." The gap is conceptual — models don't understand that search results are lightweight summaries. All 4 runs showed only names/IDs/breadcrumbs from search metadata. Sonnet r2 was closest — ran a separate `{is: "done"}` query to check completion status, but still no per-task `.read()`. A more explicit note like "search results contain only name/id/tags/breadcrumb — use `.read()` to get field values (status, dates, checkbox state)" may be needed, or an API Notes example.
2. **e06**: Model-asymmetric response. The `.filter()` scoping and search positioning fixed Sonnet's strategy selection (2/2 runs use `search({hasType:"SYS_T01"})`, finding all 5 task tags). Haiku still defaults to `listAll()+.find()` (finds only 1 tag — "task test"). The `listAll` API is more salient to Haiku than the search pattern documented in API Notes. Possible fix: move the tag search pattern into the `listAll` docstring itself ("for tag lookup by name, use `search({hasType:'SYS_T01'})` instead").
3. **e08**: Improved from 2/4 to 3.5/4. Haiku r2's failure is self-inflicted: the model's regex `(/Extends #([^\s(]+)/)` strips the "(base type)" qualifier, then it sees `day extends: day` and interprets it as "could be circular... might indicate a base system tag." The hedging earns Partial (not Wrong) — same failure mode and scoring as v5 Haiku r1. The prompt fix works when the model preserves the full Extends line, but can't prevent information loss during model-generated code execution.

#### e08 Variance Analysis (v4→v5)

The primary goal of v5's Schema pagination and Extends format hint was to stabilize e08-tag-explore:

| Metric | v4 Haiku r1 | v4 Haiku r2 | v5 Haiku r1 | v5 Haiku r2 | v4 Spread | v5 Spread |
|--------|------------|------------|------------|------------|-----------|-----------|
| Cost | $0.120 | $0.048 | $0.038 | $0.026 | $0.072 (2.5x) | $0.012 (1.5x) |
| Turns | 11 | 5 | 2 | 2 | 6 | 0 |
| Quality | Correct | Correct | Partial | Correct | — | — |

| Metric | v4 Sonnet r1 | v4 Sonnet r2 | v5 Sonnet r1 | v5 Sonnet r2 | v4 Spread | v5 Spread |
|--------|-------------|-------------|-------------|-------------|-----------|-----------|
| Cost | $0.791 | $0.205 | $0.150 | $0.160 | $0.586 (3.9x) | $0.010 (1.1x) |
| Turns | 14 | 3 | 3 | 3 | 11 | 0 |
| Quality | Correct | Correct | Correct | Correct | — | — |

**Verdict**: Cost/turn stabilization is dramatic — turns locked at 2-3, Sonnet cost spread collapsed 59x. Haiku r1 quality dip (misread `day extends #day` as circular self-reference instead of system base type) is the remaining variance. Sonnet e08 is fully stable on all dimensions.

---

## Remaining Work

### ~~Re-eval After Code Fixes~~ ✓ Complete
Results: Sonnet -11.0% vs v0_baseline (new best). Haiku -12.4% vs v0_baseline (v2_batching remains best at -15.4%).

### ~~v3 vs v4 Re-evaluation (n=2)~~ ✓ Complete
v4 is a **quality improvement**, not a cost improvement. n=2 confirms v3/v4 are cost-neutral (Haiku: $0.315 vs $0.318, Sonnet: $1.739 vs $1.642). v4 fixes Haiku e08 (wrong → correct) and e05 (vague → real data). See n=2 results and qualitative scoring above.

### ~~v4 vs v5 Evaluation (n=2 both models)~~ ✓ Complete
v5 is a **cost + stability improvement** on both models. Haiku: -18% cost, e08 turns locked at 2. Sonnet: -19% cost, cost variance collapsed from 36% to 2%. Quality: Sonnet r1=7C/1P/0W, r2=6C/2P/0W (e06 strategy-dependent). Haiku varies by run (5C-7C).

### ~~v5 vs v5.1 Evaluation (n=2 both models)~~ ✓ Complete
v5.1 is **cost-neutral, quality-targeted**. Prompt-only changes (no code). Haiku: $0.260 avg (-0.4%), Sonnet: $1.316 avg (-0.9%). Sonnet e06 stabilized (both runs use search). e05 NOT fixed (zero `.read()` calls). Haiku e08 improved (3/4 correct+partial vs 2/4). Sonnet: 7C/1P both runs. Haiku: 6C/2P (r1), 5C/3P (r2).

### Next Steps
- **~~e06 strategy competition~~** ✓ Fixed for Sonnet (v5.1) — both runs use `search({hasType:"SYS_T01"})`. Haiku still uses `listAll()+filter`. Model-asymmetric response.
- **~~e05 depth regression~~** ✗ NOT fixed (v5.1) — ".read() returns content and field values" insufficient. All 4 runs (both models) only show search metadata, never call `.read()` on individual tasks.
- **~~Haiku e08 quality variance~~** Partially fixed (v5.1) — improved from 2/4 to 3/4 correct (Haiku r2 hedged correctly → Partial, not Wrong). Root cause is self-inflicted regex stripping `(base type)` — a model capability issue, not prompt comprehension.
- **e05 next attempt**: Stronger prompt: "search results contain only name/id/tags — use .read(nodeId) to get field values". Or add explicit example in API Notes.
- **e06 Haiku next attempt**: Move tag search pattern into listAll docstring to make it more visible, or add "NOT for finding tags by name" to listAll.
- **n=3+ useful for Haiku** — Haiku v5.1 quality varies (5C-6C/8). Sonnet is stable (7C/8 both runs).

### Remaining Code Items
- [x] **P2-C**: Expose `includeInheritedFields` parameter on getSchema (exists in API, not exposed in tana.ts)
- [x] **P2-D**: Configurable search workspace scoping (TANA_SEARCH_WORKSPACES env var)
- [x] **P2-E**: tags.list via Schema node pagination (bypasses 200-tag limit, finds all inheritance)
- [ ] **P3-A**: Document silent parameter ignoring (API accepts unknown params without error)

### Eval Infrastructure Improvements
- [x] Run n=2 per scenario for v3/v4 — see re-evaluation results above
- [ ] Run n=3-5 per scenario for full statistical confidence
- [ ] Add FM-3 specific scenario (tag with 250+ options — verify P2-B truncation helps)
- [x] **Add qualitative scoring** — see Qualitative Scoring section above
- [x] **Eval comparison script** — `scripts/run-eval-comparison.sh`
- [ ] Isolate format() contribution (run format code change with baseline prompt)

---

## Failure Modes Catalog

### FM-1: `tags.list()` Timeout
**Status**: Addressed (prompt warning + P2-A timeout fix)

AI called `tana.tags.list(wsId, limit)` three times (limits 100, 30, 10). All timed out at 10s. Reducing limit didn't help — the API computes full tag set before applying limit.

Collateral damage: Each call was paired with a parallel `nodes.read()` that got killed by Claude Code's "sibling tool call errored" behavior. Total: 5 calls lost.

### FM-2: `search` with Non-Existent `offset`
**Status**: Addressed (prompt note)

AI tried `offset: 50` and `offset: 150` to paginate search results. Got identical results — search has no offset parameter, API silently ignores it.

### FM-3: Massive `getSchema` Option Dumps
**Status**: Addressed (P2-B code fix)

The `#action` tag has a "belongs to..." field with 362 option values (every project/mission). Schema was 24,128 chars. Three tags (action, note, milestone) total ~72K chars of schemas.

Now truncated to 5 options + count summary. ~95% reduction.

### FM-4: Irrelevant Broad Searches
**Status**: Partially addressed (not in prompt, but less impactful with format())

AI explored Inbox/Library/`{ has: "tag" }` for workspace understanding. Not relevant to supertag analysis. Not seen in evals — may be specific to Session A's open-ended task.

### FM-5: Duplicate Schema Fetches
**Status**: Not addressed (minor, may self-resolve with format())

56 total getSchema calls for 38 unique tag IDs = 18 duplicates. Mostly justified by error recovery.

### FM-6/FM-7: Raw JSON Dumps
**Status**: Addressed (tana.format() + prompt prohibition)

Both sessions used `JSON.stringify(data, null, 2)` for all output. Session C produced 35KB for 40 results. Now mitigated by format() helper (~40% token savings) and "never JSON.stringify" prompt note.

### FM-8: tana-local Comparison Notes
**Status**: Reference only

tana-local needed 31 tool calls vs codemode's 2 for same task. Codemode's batching pattern (for-loop in one execute) is fundamentally more efficient.

### FM-9: Double Timeout Trap
**Status**: Fixed (P2-A)

HTTP client had 3 retries with 1s/2s/4s backoff. Sandbox timeout was 10s. Retries could never fire. Now: client timeout 3s, 2 retries, 500ms backoff. Worst case: 6.5s — fits in sandbox window.

### FM-10: TypeScript Syntax in Sandbox
**Status**: Fixed (Bun.Transpiler)

Models write `Record<string, string>`, `as Type`, type annotations. Sandbox ran plain JS. Wasted 1-2 calls per complex scenario across ALL variants. Now Bun.Transpiler strips annotations before execution.

### FM-11: `childOf`/`ownedBy`/`inWorkspace` Broken
**Status**: Fixed (prompt note + operator removal)

**Root cause**: GET query params are strings. The API's Zod validation expects actual booleans for `recursive`, `includeRefs`, `includeSelf`. String `"true"` != boolean `true`. This is an API-side validation bug (no `.coerce()` on boolean fields).

Testing results:
- `childOf` without `recursive` → accepted, returns 0 (default recursive behavior not applied)
- `childOf` with `recursive: true` → 400 "expected boolean, received string"
- `ownedBy` → same pattern
- `inWorkspace` → returns 0 (possibly same issue or unimplemented)
- **`workspaceIds` search option → WORKS correctly** (separate query param, not nested boolean)

Fix: Removed childOf/ownedBy from prompt's Search Query Operators. Added note: "use workspaceIds option to scope by workspace."

### FM-12: Workspace ID Typo
**Status**: Cannot fix

Models write `HfCy68zUPM7` instead of `HfCy68zUUPM7` (missing double-U). Nondeterministic.

---

## Implementation Checklist

### Prompt (P1)
- [x] **P1-A**: Output discipline — tana.format() + "never JSON.stringify"
- [x] **P1-B**: Timeout recovery — in API Notes section
- [x] **P1-C**: API limitations — search pagination, getChildren offset
- [!] **P1-D**: Batching guidance — tested in v2_batching, hurts Sonnet. Dropped.
- [!] **P1-E**: Anti-patterns — cut for verbosity. FM-3/FM-4 addressed via code fixes.
- [!] **P1-F**: Exploration workflow — too prescriptive/strategic, risks model-divergent effects.
- [x] **P1-G**: Default Workspace — code example with fallback

### Code
- [x] **P2-A**: Fix double timeout — client 3s, 2 retries, 500ms backoff
- [x] **P2-B**: Truncate getSchema options — 5 shown + count summary
- [x] **P2-C**: Expose `includeInheritedFields` parameter
- [x] **P2-D**: Configurable search workspace scoping (TANA_SEARCH_WORKSPACES env var)

### Code (continued)
- [x] **P2-E**: Schema node pagination — `listAll` bypasses 200-tag limit, finds all inheritance

### New (discovered during eval)
- [x] tana.format() helper — `src/api/format.ts`
- [x] Eval framework — `scripts/eval-prompts.sh` (model-configurable), `scripts/compare-eval.sh`, `scripts/run-eval-comparison.sh`
- [x] TS sandbox support — Bun.Transpiler (FM-10)
- [x] childOf/ownedBy/inWorkspace limitation — factual note + operator removal (FM-11)
- [ ] **P3-A**: Document silent parameter ignoring

---

## Original Analysis

### Sessions Analyzed

| Session | ID | Task | Execute Calls | Key Finding |
|---|---|---|---|---|
| **Session A** | `b37a3f99` | Deep workspace/supertag analysis | ~32 | Massive waste: timeouts, raw dumps, broad searches |
| **Session C** | `a7e62b83` | Search for notes on "taste" | 2 | Good structure, but 35KB raw JSON dump |

tana-local comparison: same "taste" task needed 31 tool calls vs codemode's 2.

### Waste Quantification (Session A)

| Category | Calls Wasted | Tokens Wasted | Time Wasted |
|---|---|---|---|
| `tags.list()` timeout retries | 3 + 2 collateral | ~0 | 30s |
| `search` with fake `offset` | 2 identical | ~5,000 | 10s |
| Full option dumps from `getSchema` | ~4 | ~30,000-40,000 | — |
| Library/Inbox/broad searches | 5 | ~15,000 | — |
| Duplicate `getSchema` fetches | 3 truly redundant | ~5,000 | — |
| `JSON.stringify(data, null, 2)` everywhere | all calls | ~10,000 | — |
| **Total** | | **~55,000-65,000 (36-43%)** | **~40s** |

### Waste Quantification (Session C)

| Category | Calls Wasted | Tokens Wasted |
|---|---|---|
| Raw JSON dump of 40 search results | 1 call | ~30,000 (35KB) |
| Reading 2 empty leaf nodes | part of batch | negligible |

### Key Context
- **Testing workspace**: "testing environment" (ID: `HfCy68zUUPM7`, home: `L5LXruUwGET9`). Safe for create/modify/delete.
- **API**: `localhost:8262` (requires Tana Desktop running)
- **Tana docs**: `~/Core/dev/projects/text-experiments/docs-ext/tana_docs`

### Code Examples from Sessions

#### Timeout Calls (FM-1)
```typescript
// All three timed out — reducing limit doesn't help
const tags = await tana.tags.list("4T1T-cLhpX", 100); // timeout
const tags = await tana.tags.list("4T1T-cLhpX", 30);  // timeout
const tags = await tana.tags.list("4T1T-cLhpX", 10);  // timeout
```

#### Fake Offset Pagination (FM-2)
```typescript
// All three return identical results — offset is silently ignored
search({ hasType: "SYS_T01" }, { limit: 50 });
search({ hasType: "SYS_T01" }, { limit: 100, offset: 50 });
search({ hasType: "SYS_T01" }, { limit: 100, offset: 150 });
```

#### Raw JSON Dump vs Proper Summary (FM-6/FM-7)
```typescript
// BAD — 35KB for 40 results
console.log(JSON.stringify(results, null, 2));

// GOOD — same information, ~4KB
results.forEach(r => console.log(
  `  [${r.id}] ${r.name} — ${r.tags.map(t=>t.name).join(", ")} — ${r.breadcrumb.join(" > ")}`
));
```

#### Good Pattern: Batched Reads (Session C)
```typescript
// 7 reads in one execute call — 65ms total
for (const id of ids) {
  const content = await tana.nodes.read(id, 3);
  console.log(`\n========== ${id} ==========`);
  console.log(content);
}
```
