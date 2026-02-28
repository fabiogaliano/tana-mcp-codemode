# MCP Prompt Optimization Findings

Analysis of `tana-mcp-codemode` sessions to identify inefficiency patterns and iteratively improve prompt + code.

---

## Current State

### Prompt: v4_factual-p2cd (current)
Based on v3_timeout-schema-ts + factual prompt notes (SearchResult shape, missing `is` enums) + P2-C (`includeInheritedFields`) + P2-D (search workspace scoping).

Key additions over baseline:
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
│   └── v4_factual-p2cd/      <- v3 + SearchResult shape, is enums, P2-C, P2-D (CURRENT)
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
│   └── v4_factual-p2cd_r2/
└── sonnet/
    ├── v0_baseline/
    ├── v1_format-apinotes/
    ├── v2_batching/
    ├── v3_timeout-schema-ts/
    ├── v3_timeout-schema-ts_r1/    <- n=2 re-eval
    ├── v3_timeout-schema-ts_r2/
    ├── v4_factual-p2cd_r1/
    └── v4_factual-p2cd_r2/
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
| v4 avg | — | **$0.318** | 14,225 | 25 |

**Sonnet (n=2):**

| Version | Run | Cost | Output Tokens | Turns |
|---------|-----|------|---------------|-------|
| v3 | r1 | $1.765 | 14,075 | 32 |
| v3 | r2 | $1.713 | 17,647 | 29 |
| v3 avg | — | $1.739 | 15,861 | 30.5 |
| v4 | r1 | $1.892 | 22,228 | 32 |
| v4 | r2 | $1.391 | 12,974 | 24 |
| v4 avg | — | **$1.642** | 17,601 | 28 |

### Variance Analysis

n=1 results were misleading. Key findings:

1. **Original v3 Sonnet ($1.523) was a lucky run** — n=2 average is $1.739 (+14%). The "best result" from n=1 was below the range of either n=2 run ($1.713, $1.765).
2. **Sonnet v4 has 36% spread** — ranges from $1.391 to $1.892. Individual runs can swing $0.50 in either direction.
3. **Haiku is more stable** — v3 spread 19% ($0.288–$0.342), v4 spread 10% ($0.304–$0.333).
4. **e08-tag-explore is the dominant variance driver** — single scenario ranges $0.05 to $0.79 across all runs. This one scenario can swing total cost by $0.74, which is ~45% of Sonnet's average total.
5. **Cost-neutral conclusion**: v3 and v4 are statistically indistinguishable on cost. Haiku: $0.315 vs $0.318 (+1%). Sonnet: $1.739 vs $1.642 (-6%, within noise).

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
8 real-world scenarios derived from Session A (discovery) and Session C (search+read). Run via `claude -p --model <model> --output-format json`. v0–v3: n=1 per scenario. v3/v4 re-evaluation: n=2 per scenario (16 runs total per model). Eval scripts: `scripts/eval-prompts.sh <output-dir> <model>`, `scripts/run-eval-comparison.sh`.

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

---

## Remaining Work

### ~~Re-eval After Code Fixes~~ ✓ Complete
Results: Sonnet -11.0% vs v0_baseline (new best). Haiku -12.4% vs v0_baseline (v2_batching remains best at -15.4%).

### ~~v3 vs v4 Re-evaluation (n=2)~~ ✓ Complete
v4 is a **quality improvement**, not a cost improvement. n=2 confirms v3/v4 are cost-neutral (Haiku: $0.315 vs $0.318, Sonnet: $1.739 vs $1.642). v4 fixes Haiku e08 (wrong → correct) and e05 (vague → real data). See n=2 results and qualitative scoring above.

### Next Steps
- **n=3+ still needed** for statistical confidence — n=2 showed original v3 Sonnet ($1.523) was a lucky run (n=2 avg: $1.739, +14%)
- **e08 variance is the dominant cost driver** — single scenario ranges $0.05–$0.79 across runs. Any aggregate cost claim is fragile until e08 stabilizes.
- **Haiku e06 is a model capability gap** — `.find()` returns 1/4 task tags regardless of variant. May need explicit prompt note about duplicate tag names.
- **v4_batching-timeout-schema-ts**: Consider testing v2_batching prompt + v4 code fixes for Haiku. The v2 batching instruction helped Haiku (-15.4%) but hurt Sonnet. A model-specific prompt strategy may be optimal.

### Remaining Code Items
- [x] **P2-C**: Expose `includeInheritedFields` parameter on getSchema (exists in API, not exposed in tana.ts)
- [x] **P2-D**: Configurable search workspace scoping (TANA_SEARCH_WORKSPACES env var)
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
