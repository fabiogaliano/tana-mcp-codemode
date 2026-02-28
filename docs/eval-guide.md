# Eval Guide

How to run prompt/code evals for `tana-mcp-codemode`.

## Prerequisites

- Tana Desktop running with Local API enabled
- `claude` CLI installed and authenticated
- `jq` installed (for result parsing)

## Quick Start

Run all 8 scenarios against Haiku:

```bash
bash scripts/eval-prompts.sh eval-results/haiku/my-test haiku
```

Against Sonnet:

```bash
bash scripts/eval-prompts.sh eval-results/sonnet/my-test sonnet
```

Results land in the specified directory as individual JSON files per scenario.

## Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `eval-prompts.sh` | Run 8 scenarios against a model | `bash scripts/eval-prompts.sh <output-dir> <model>` |
| `compare-eval.sh` | Side-by-side comparison of two result dirs | `/opt/homebrew/bin/bash scripts/compare-eval.sh <dir-a> <dir-b>` |
| `run-eval-comparison.sh` | Automated A/B testing across variants and models | `bash scripts/run-eval-comparison.sh [runs_per_model]` |

## Scenarios

8 real-world scenarios derived from actual MCP sessions:

| ID | Task | Tests |
|----|------|-------|
| e01-discovery | List supertags in workspace | Tag enumeration, format() usage |
| e02-structure | Overview of workspace content | Workspace understanding, grouping |
| e03-search-read | Search "meeting" notes + read them | Search scoping, workspaceIds |
| e04-topic-search | Search for "test" related content | Broad search, result formatting |
| e05-tasks | Show recent tasks and status | Status filtering, field access |
| e06-schema | Get task tag fields | Schema fetching, duplicate tag names |
| e07-create | Create a note with action items | Node creation, import syntax |
| e08-tag-explore | Find tag inheritance relationships | tags.listAll, getSchema Extends parsing |

## Running a Single Scenario

The eval script runs all 8 in sequence. To test just one:

```bash
claude --dangerously-skip-permissions \
  --model haiku \
  -p "What supertags do I have in workspace HfCy68zUUPM7 and what are they for?" \
  --output-format json > result.json
```

## Comparing Results

Compare two runs side-by-side (cost, tokens, turns per scenario):

```bash
/opt/homebrew/bin/bash scripts/compare-eval.sh \
  eval-results/sonnet/v4_factual-p2cd_r1 \
  eval-results/sonnet/v4_factual-p2cd_r2
```

## A/B Testing Variants

`run-eval-comparison.sh` automates variant comparison:

1. Restores source files from `eval-results/.backup/variants/<name>/`
2. Runs N evals per model per variant
3. Restores source to the latest variant when done

```bash
bash scripts/run-eval-comparison.sh 2   # 2 runs per model
```

Variants are defined in the script's `VARIANTS` array. To test a new variant:

1. Back up current source files:
   ```bash
   mkdir -p eval-results/.backup/variants/v5_my-variant
   cp src/prompts.ts src/api/tana.ts src/api/client.ts src/sandbox/executor.ts \
      eval-results/.backup/variants/v5_my-variant/
   ```
2. Add `v5_my-variant` to the `VARIANTS` array in `run-eval-comparison.sh`
3. Run the comparison

## Qualitative Scoring

Cost metrics alone are misleading (see findings doc — cheapest variant had 2 wrong answers). After running evals:

1. Open each `<scenario>.json` result file
2. Read the model's final answer (last element in the JSON array)
3. Score: **Correct** / **Partial** / **Wrong**
4. Note specific issues (e.g., "used .find() instead of .filter()", "missed inheritance")

## Variant History

| Variant | Prompt Changes | Code Changes |
|---------|---------------|--------------|
| v0_baseline | Original prompt | Original code |
| v1_format-apinotes | + format(), API notes | — |
| v2_batching | + batching guidance | — |
| v3_timeout-schema-ts | v1 prompt + factual notes | P2-A timeout, P2-B schema truncation, FM-10 TS transpiler |
| v4_factual-p2cd | + SearchResult shape, is enum | P2-C includeInheritedFields, P2-D workspace scoping |
| v5_schema-pagination | + Extends format, listAll rename, .filter() hint, tag search pattern, trims | P2-E Schema node pagination |

## Key Learnings

- **n=1 is unreliable** — v3 Sonnet $1.523 was a lucky run, n=2 avg was $1.739 (+14%)
- **e08 drives most variance** — $0.05–$0.79 in a single scenario
- **Factual notes are safe** — always help, never hurt
- **Strategic instructions are risky** — batching helped Haiku, hurt Sonnet
- **Code fixes compound with prompt** — Sonnet's best result uses both
- **Qualitative scoring is essential** — cheapest != best
