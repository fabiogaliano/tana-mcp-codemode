#!/usr/bin/env bash
# Compare two eval result directories side by side
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <baseline-dir> <comparison-dir>"
  echo "Example: $0 ./eval-results/baseline ./eval-results/after-p1"
  exit 1
fi

DIR_A="$1"
DIR_B="$2"

if [[ ! -d "$DIR_A" ]]; then
  echo "Error: directory not found: $DIR_A"
  exit 1
fi

if [[ ! -d "$DIR_B" ]]; then
  echo "Error: directory not found: $DIR_B"
  exit 1
fi

LABEL_A=$(basename "$DIR_A")
LABEL_B=$(basename "$DIR_B")

echo "=== Eval Comparison ==="
echo "A (baseline):   $DIR_A"
echo "B (comparison): $DIR_B"
echo ""

printf "%-24s | %8s %8s %6s | %8s %8s %6s | %8s %8s %6s | %5s %5s | %7s %7s\n" \
  "Scenario" \
  "TokIn-A" "TokIn-B" "Delta" \
  "TokOut-A" "TokOut-B" "Delta" \
  "Cost-A" "Cost-B" "Delta" \
  "Trn-A" "Trn-B" \
  "Dur-A" "Dur-B"
printf "%s\n" "$(printf '%.0s-' {1..160})"

total_in_a=0
total_in_b=0
total_out_a=0
total_out_b=0
total_cost_a=0
total_cost_b=0
total_turns_a=0
total_turns_b=0
total_dur_a=0
total_dur_b=0
matched=0

extract() {
  local file="$1"
  local field="$2"
  # Handle both old format (single object) and new format (array, result in last element)
  jq -r "if type == \"array\" then .[-1] else . end | $field // 0" "$file" 2>/dev/null || echo "0"
}

extract_usage() {
  local file="$1"
  local field="$2"
  # New format: .modelUsage.{model}.{field}, Old format: .usage.{field}
  jq -r "if type == \"array\" then .[-1] else . end |
    if .modelUsage then (.modelUsage | to_entries | map(.value) | add | .$field // 0)
    elif .usage then .usage.$field // 0
    else 0 end" "$file" 2>/dev/null || echo "0"
}

for file_a in "$DIR_A"/*.json; do
  name=$(basename "$file_a")
  scenario="${name%.json}"
  file_b="$DIR_B/$name"

  if [[ ! -f "$file_b" ]]; then
    continue
  fi

  matched=$((matched + 1))

  in_a=$(extract_usage "$file_a" 'inputTokens')
  in_b=$(extract_usage "$file_b" 'inputTokens')
  in_delta=$((in_b - in_a))

  out_a=$(extract_usage "$file_a" 'outputTokens')
  out_b=$(extract_usage "$file_b" 'outputTokens')
  out_delta=$((out_b - out_a))

  cost_a=$(extract_usage "$file_a" 'costUSD')
  cost_b=$(extract_usage "$file_b" 'costUSD')
  cost_delta=$(echo "$cost_b - $cost_a" | bc -l 2>/dev/null || echo "0")

  turns_a=$(extract "$file_a" '.num_turns')
  turns_b=$(extract "$file_b" '.num_turns')

  dur_a=$(extract "$file_a" '.duration_ms')
  dur_b=$(extract "$file_b" '.duration_ms')

  total_in_a=$((total_in_a + in_a))
  total_in_b=$((total_in_b + in_b))
  total_out_a=$((total_out_a + out_a))
  total_out_b=$((total_out_b + out_b))
  total_cost_a=$(echo "$total_cost_a + $cost_a" | bc -l)
  total_cost_b=$(echo "$total_cost_b + $cost_b" | bc -l)
  total_turns_a=$((total_turns_a + turns_a))
  total_turns_b=$((total_turns_b + turns_b))
  total_dur_a=$((total_dur_a + dur_a))
  total_dur_b=$((total_dur_b + dur_b))

  cost_a_fmt=$(printf "%.4f" "$cost_a")
  cost_b_fmt=$(printf "%.4f" "$cost_b")
  cost_delta_fmt=$(printf "%+.4f" "$cost_delta")
  in_delta_fmt=$(printf "%+d" "$in_delta")
  out_delta_fmt=$(printf "%+d" "$out_delta")
  dur_a_sec=$(printf "%.1f" "$(echo "$dur_a / 1000" | bc -l)")
  dur_b_sec=$(printf "%.1f" "$(echo "$dur_b / 1000" | bc -l)")

  printf "%-24s | %8d %8d %6s | %8d %8d %6s | %8s %8s %6s | %5d %5d | %6ss %6ss\n" \
    "$scenario" \
    "$in_a" "$in_b" "$in_delta_fmt" \
    "$out_a" "$out_b" "$out_delta_fmt" \
    "\$$cost_a_fmt" "\$$cost_b_fmt" "$cost_delta_fmt" \
    "$turns_a" "$turns_b" \
    "$dur_a_sec" "$dur_b_sec"
done

if [[ $matched -eq 0 ]]; then
  echo "No matching scenario files found between the two directories."
  exit 1
fi

printf "%s\n" "$(printf '%.0s-' {1..160})"

total_cost_a_fmt=$(printf "%.4f" "$total_cost_a")
total_cost_b_fmt=$(printf "%.4f" "$total_cost_b")
total_cost_delta=$(echo "$total_cost_b - $total_cost_a" | bc -l)
total_cost_delta_fmt=$(printf "%+.4f" "$total_cost_delta")
total_in_delta_fmt=$(printf "%+d" $((total_in_b - total_in_a)))
total_out_delta_fmt=$(printf "%+d" $((total_out_b - total_out_a)))
total_dur_a_sec=$(printf "%.1f" "$(echo "$total_dur_a / 1000" | bc -l)")
total_dur_b_sec=$(printf "%.1f" "$(echo "$total_dur_b / 1000" | bc -l)")

printf "%-24s | %8d %8d %6s | %8d %8d %6s | %8s %8s %6s | %5d %5d | %6ss %6ss\n" \
  "TOTAL ($matched scenarios)" \
  "$total_in_a" "$total_in_b" "$total_in_delta_fmt" \
  "$total_out_a" "$total_out_b" "$total_out_delta_fmt" \
  "\$$total_cost_a_fmt" "\$$total_cost_b_fmt" "$total_cost_delta_fmt" \
  "$total_turns_a" "$total_turns_b" \
  "$total_dur_a_sec" "$total_dur_b_sec"

echo ""
echo "--- Percentage Change (B vs A) ---"

pct_change() {
  local a="$1"
  local b="$2"
  if [[ "$a" == "0" ]] || [[ "$a" == "0.0" ]]; then
    echo "N/A"
    return
  fi
  printf "%+.1f%%" "$(echo "($b - $a) / $a * 100" | bc -l)"
}

echo "Input Tokens:  $(pct_change "$total_in_a" "$total_in_b")"
echo "Output Tokens: $(pct_change "$total_out_a" "$total_out_b")"
echo "Cost:          $(pct_change "$total_cost_a" "$total_cost_b")"
echo "Turns:         $(pct_change "$total_turns_a" "$total_turns_b")"
echo "Duration:      $(pct_change "$total_dur_a" "$total_dur_b")"
