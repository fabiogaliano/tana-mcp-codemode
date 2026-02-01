#!/bin/bash
# Benchmark with natural language prompts
set -euo pipefail

WORKSPACE_ID="HfCy68zUUPM7"
HOME_NODE="L5LXruUwGET9"
RESULTS_DIR="${1:-./results-nl}"
TIMESTAMP=$(date +%s)
mkdir -p "$RESULTS_DIR"

declare -A SCENARIOS

# READ
SCENARIOS["01-read-list-workspaces"]="What workspaces do I have in Tana?"
SCENARIOS["02-read-list-tags"]="Show me all the tags in workspace $WORKSPACE_ID"
SCENARIOS["03-read-search"]="Search for some nodes in workspace $WORKSPACE_ID, just show me 5"
SCENARIOS["04-read-node"]="Read node $HOME_NODE and show me 2 levels deep"
SCENARIOS["05-read-tag-schema"]="List tags in $WORKSPACE_ID and show me the schema of the first one"
SCENARIOS["06-read-get-children"]="What are the children of node $HOME_NODE?"

# CREATE
SCENARIOS["07-create-simple"]="Create a node called 'Benchmark $TIMESTAMP' under $HOME_NODE"
SCENARIOS["08-create-todo"]="Add a todo '[ ] Benchmark task $TIMESTAMP' under $HOME_NODE"
SCENARIOS["09-create-with-tag"]="Find a tag in $WORKSPACE_ID and create a node with it under $HOME_NODE"
SCENARIOS["10-create-hierarchy"]="Create a parent node with 3 children under $HOME_NODE"

# EDIT
SCENARIOS["11-edit-rename"]="Create a node 'Original $TIMESTAMP' under $HOME_NODE, then rename it to 'Renamed $TIMESTAMP'"
SCENARIOS["12-edit-description"]="Create a node under $HOME_NODE and add a description to it"
SCENARIOS["13-edit-add-tag"]="Create a plain node under $HOME_NODE, find a tag, and apply it to the node"
SCENARIOS["14-edit-check-uncheck"]="Create a todo under $HOME_NODE, check it off, then uncheck it"
SCENARIOS["15-edit-set-field"]="Find a tag with fields, create a node with it under $HOME_NODE, and set a field value"

# DELETE
SCENARIOS["16-delete-trash"]="Create a node 'Delete me $TIMESTAMP' under $HOME_NODE and trash it"

# WORKFLOWS
SCENARIOS["17-workflow-crud"]="Full CRUD: create a node under $HOME_NODE, read it, rename it, then trash it"
SCENARIOS["18-workflow-bulk-create"]="Create 5 sibling nodes in one go under $HOME_NODE"
SCENARIOS["19-workflow-tag-explore"]="List all tags in $WORKSPACE_ID, get schemas for 3 of them, and summarize what they're for"
SCENARIOS["20-workflow-structured-data"]="Find a tag with multiple fields, create a node with it under $HOME_NODE, and fill in 2 fields"

echo "=== Tana MCP Benchmark (Natural Language) ==="
echo "Results: $RESULTS_DIR"
echo "Scenarios: ${#SCENARIOS[@]}"
echo ""

for key in $(echo "${!SCENARIOS[@]}" | tr ' ' '\n' | sort); do
  prompt="${SCENARIOS[$key]}"
  output_file="$RESULTS_DIR/${key}.json"

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$key]"
  echo "Prompt: ${prompt:0:80}..."
  echo ""

  claude --dangerously-skip-permissions --model haiku -p "$prompt" --output-format json > "$output_file" 2>/dev/null || true

  if [[ -f "$output_file" ]]; then
    jq -r '
      "Duration:    \(.duration_ms // 0)ms",
      "Cost:        $\(.total_cost_usd // 0 | tostring | .[0:8])",
      "Tokens In:   \(.usage.input_tokens // 0)",
      "Tokens Out:  \(.usage.output_tokens // 0)",
      "Success:     \(if .is_error then "❌ \(.result // "error")[0:50]" else "✓" end)"
    ' "$output_file" 2>/dev/null || echo "Parse error"
  else
    echo "No output file"
  fi
  echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

jq -s '
  {
    scenarios: length,
    successful: [.[] | select(.is_error != true)] | length,
    failed: [.[] | select(.is_error == true)] | length,
    total_duration_sec: (([.[].duration_ms // 0] | add) / 1000 | floor),
    total_cost_usd: ([.[].total_cost_usd // 0] | add),
    total_input_tokens: ([.[].usage.input_tokens // 0] | add),
    total_output_tokens: ([.[].usage.output_tokens // 0] | add)
  } |
  "Scenarios:      \(.scenarios) (\(.successful) passed, \(.failed) failed)",
  "Total Time:     \(.total_duration_sec)s",
  "Total Cost:     $\(.total_cost_usd | tostring | .[0:8])",
  "Total Tokens:   \(.total_input_tokens) in / \(.total_output_tokens) out"
' "$RESULTS_DIR"/*.json 2>/dev/null || echo "Could not generate summary"

echo ""
echo "Results: $RESULTS_DIR/"
