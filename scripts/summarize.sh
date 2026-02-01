#!/bin/bash
# Generate benchmark summary from results folders
cd "$(dirname "$0")/../benchmark-results" || exit 1

# Collect all data
data=$(for dir in */; do
  name="${dir%/}"
  jq -s --arg name "$name" '{
    name: $name,
    cost: ([.[].total_cost_usd // 0] | add | . * 100 | round / 100),
    time: (([.[].duration_ms // 0] | add) / 1000 | floor),
    tokens: ([.[].usage.output_tokens // 0] | add),
    passed: ([.[] | select(.is_error | not)] | length),
    total: length
  }' "$dir"*.json
done | jq -s 'sort_by(.name)')

echo "# Benchmark Summary"
echo ""
echo "| Benchmark | Cost | Time | Tokens | Passed |"
echo "|-----------|------|------|--------|--------|"
echo "$data" | jq -r '.[] | "| \(.name) | $\(.cost) | \(.time)s | \(.tokens) | \(.passed)/\(.total) |"'
echo ""

# Comparisons
echo "## Comparisons"
echo ""
echo "$data" | jq -r '
  (map(select(.name | contains("haiku"))) | sort_by(.name)) as $haiku |
  (map(select(.name | contains("opus"))) | sort_by(.name)) as $opus |
  if ($haiku | length) == 2 then
    ($haiku[0] as $code | $haiku[1] as $local |
    "Haiku: Codemode \((1 - $code.cost/$local.cost)*100 | round)% cheaper, \(($code.time/$local.time - 1)*100 | round)% slower")
  else empty end,
  if ($opus | length) == 2 then
    ($opus[0] as $code | $opus[1] as $local |
    "Opus: Codemode \((1 - $code.cost/$local.cost)*100 | round)% cheaper, \(($code.time/$local.time - 1)*100 | round)% slower")
  else empty end
'
