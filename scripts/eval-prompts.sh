#!/usr/bin/env bash
# Eval prompts targeting failure modes found in real MCP sessions
set -euo pipefail

WORKSPACE_ID="HfCy68zUUPM7"
HOME_NODE="L5LXruUwGET9"
MODEL="${2:-haiku}"
RESULTS_DIR="${1:-./eval-results/${MODEL}/run-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$RESULTS_DIR"

declare -A SCENARIOS

# Real-world user flows derived from actual MCP sessions (see docs/prompt-optimization-findings.md)
# Session A: deep workspace/supertag exploration (32 calls, many failures)
# Session C: search for notes on a topic, read them (2 calls, but 35KB raw JSON)

# Discovery flow (Session A pattern)
SCENARIOS["e01-discovery"]="What supertags do I have in workspace $WORKSPACE_ID and what are they for?"
SCENARIOS["e02-structure"]="What kinds of things do I track in Tana? Give me an overview of workspace $WORKSPACE_ID"

# Search + read flow (Session C pattern)
SCENARIOS["e03-search-read"]="Find my notes about 'meeting' in workspace $WORKSPACE_ID and show me what they say"
SCENARIOS["e04-topic-search"]="Search for anything related to 'test' in workspace $WORKSPACE_ID"

# Task/status queries (common real usage)
SCENARIOS["e05-tasks"]="Show me my recent tasks in workspace $WORKSPACE_ID and their status"
SCENARIOS["e06-schema"]="What fields does the task tag have in workspace $WORKSPACE_ID?"

# Multi-step workflows
SCENARIOS["e07-create"]="Create a note called 'Standup $(date +%Y-%m-%d)' with 3 action items under node $HOME_NODE"
SCENARIOS["e08-tag-explore"]="I want to understand how my tags in workspace $WORKSPACE_ID relate to each other — which ones extend other tags?"

echo "=== Tana MCP Eval (Failure Mode Scenarios) ==="
echo "Model:     $MODEL"
echo "Results:   $RESULTS_DIR"
echo "Scenarios: ${#SCENARIOS[@]}"
echo ""

for key in $(echo "${!SCENARIOS[@]}" | tr ' ' '\n' | sort); do
  prompt="${SCENARIOS[$key]}"
  output_file="$RESULTS_DIR/${key}.json"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$key]"
  echo "Prompt: ${prompt:0:80}..."
  echo ""

  claude --dangerously-skip-permissions --model "$MODEL" -p "$prompt" --output-format json > "$output_file" 2>/dev/null || true

  if [[ -f "$output_file" ]] && [[ -s "$output_file" ]]; then
    jq -r '.[-1] | (.modelUsage // {} | to_entries | map(.value) | add // {}) as $u |
      "Duration:    \(.duration_ms // 0)ms",
      "Cost:        $\($u.costUSD // 0 | tostring | .[0:8])",
      "Tokens In:   \($u.inputTokens // 0) (+\($u.cacheReadInputTokens // 0) cache)",
      "Tokens Out:  \($u.outputTokens // 0)",
      "Turns:       \(.num_turns // 0)",
      "Success:     \(if .is_error then "FAIL \(.result // "error")[0:50]" else "PASS" end)"
    ' "$output_file" 2>/dev/null || echo "Parse error"
  else
    echo "No output file"
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

jq -s '[.[] | .[-1]] |
  [.[] | (.modelUsage // {} | to_entries | map(.value) | add // {})] as $usage |
  {
    scenarios: length,
    successful: [.[] | select(.is_error != true)] | length,
    failed: [.[] | select(.is_error == true)] | length,
    total_duration_sec: (([.[].duration_ms // 0] | add) / 1000 | floor),
    total_cost_usd: ([$usage[] | .costUSD // 0] | add),
    total_input_tokens: ([$usage[] | .inputTokens // 0] | add),
    total_output_tokens: ([$usage[] | .outputTokens // 0] | add),
    total_cache_read: ([$usage[] | .cacheReadInputTokens // 0] | add),
    total_turns: ([.[].num_turns // 0] | add)
  } |
  "Scenarios:      \(.scenarios) (\(.successful) passed, \(.failed) failed)",
  "Total Time:     \(.total_duration_sec)s",
  "Total Cost:     $\(.total_cost_usd | tostring | .[0:8])",
  "Total Tokens:   \(.total_input_tokens) in / \(.total_output_tokens) out (+\(.total_cache_read) cache)",
  "Total Turns:    \(.total_turns)"
' "$RESULTS_DIR"/*.json 2>/dev/null || echo "Could not generate summary"

echo ""
echo "Results: $RESULTS_DIR/"
