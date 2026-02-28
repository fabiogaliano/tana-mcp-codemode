#!/usr/bin/env bash
# Compare two prompt/code variants across models with multiple runs.
# Usage: ./scripts/run-eval-comparison.sh [runs_per_model]
#   runs_per_model: number of runs per model (default: 2)
#
# Example: ./scripts/run-eval-comparison.sh 3
set -euo pipefail

RUNS="${1:-2}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EVAL_SCRIPT="$SCRIPT_DIR/eval-prompts.sh"
BACKUP_DIR="$PROJECT_DIR/eval-results/.backup/variants"
MODELS=(haiku sonnet)
VARIANTS=(v3_timeout-schema-ts v4_factual-p2cd)

cd "$PROJECT_DIR"

echo "╔══════════════════════════════════════════════════╗"
echo "║  Eval Comparison: ${VARIANTS[*]}  ║"
echo "╠══════════════════════════════════════════════════╣"
echo "║  Models: ${MODELS[*]}"
echo "║  Runs per combo: $RUNS"
echo "║  Total evals: $(( ${#VARIANTS[@]} * ${#MODELS[@]} * RUNS ))"
echo "╚══════════════════════════════════════════════════╝"
echo ""

for variant in "${VARIANTS[@]}"; do
  echo "━━━ Restoring source: $variant ━━━"
  cp "$BACKUP_DIR/$variant/prompts.ts" src/prompts.ts
  cp "$BACKUP_DIR/$variant/tana.ts" src/api/tana.ts
  cp "$BACKUP_DIR/$variant/client.ts" src/api/client.ts
  cp "$BACKUP_DIR/$variant/executor.ts" src/sandbox/executor.ts
  echo ""

  for model in "${MODELS[@]}"; do
    for run in $(seq 1 "$RUNS"); do
      dir="eval-results/${model}/${variant}_r${run}"
      echo "▶ ${variant} / ${model} / run ${run}  →  ${dir}"
      /opt/homebrew/bin/bash "$EVAL_SCRIPT" "$dir" "$model"
      echo ""
    done
  done
done

# Restore to latest variant
latest="${VARIANTS[-1]}"
echo "━━━ Restoring source to $latest ━━━"
cp "$BACKUP_DIR/$latest/prompts.ts" src/prompts.ts
cp "$BACKUP_DIR/$latest/tana.ts" src/api/tana.ts
cp "$BACKUP_DIR/$latest/client.ts" src/api/client.ts
cp "$BACKUP_DIR/$latest/executor.ts" src/sandbox/executor.ts

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  All evals complete. Source restored to $latest."
echo "╚══════════════════════════════════════════════════╝"
