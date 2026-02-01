import { useMemo, useState } from "react";
import { colors, typography, radius, spacing } from "./design-system";

// Types
interface BenchmarkUsage {
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
}

interface BenchmarkResult {
  type: string;
  subtype: string;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  total_cost_usd: number;
  usage: BenchmarkUsage;
}

interface Scenario {
  id: string;
  name: string;
  category: Category;
  results: Record<string, BenchmarkResult | null>;
}

type Category = "read" | "create" | "edit" | "delete" | "workflow";

// Import all benchmark data by folder
const allResults: Record<string, Record<string, BenchmarkResult>> = {
  "haiku-local": import.meta.glob<BenchmarkResult>(
    "../../benchmark-results/haiku-local/*.json",
    { eager: true, import: "default" }
  ),
  "haiku-codemode": import.meta.glob<BenchmarkResult>(
    "../../benchmark-results/haiku-codemode/*.json",
    { eager: true, import: "default" }
  ),
  "opus-local": import.meta.glob<BenchmarkResult>(
    "../../benchmark-results/opus-local/*.json",
    { eager: true, import: "default" }
  ),
  "opus-codemode": import.meta.glob<BenchmarkResult>(
    "../../benchmark-results/opus-codemode/*.json",
    { eager: true, import: "default" }
  ),
};

// Suite metadata with unique colors
const SUITES: Record<string, { label: string; short: string; color: string; colorSoft: string }> = {
  "haiku-local": {
    label: "Haiku - Official MCP",
    short: "H-Offic",
    color: "#22c55e",  // green
    colorSoft: "rgba(34, 197, 94, 0.15)"
  },
  "haiku-codemode": {
    label: "Haiku - Codemode",
    short: "H-Code",
    color: "#3b82f6",  // blue
    colorSoft: "rgba(59, 130, 246, 0.15)"
  },
  "opus-local": {
    label: "Opus - Official MCP",
    short: "O-Offic",
    color: "#f97316",  // orange
    colorSoft: "rgba(249, 115, 22, 0.15)"
  },
  "opus-codemode": {
    label: "Opus - Codemode",
    short: "O-Code",
    color: "#a855f7",  // purple
    colorSoft: "rgba(168, 85, 247, 0.15)"
  },
};

const SCENARIO_META: Record<string, { name: string; category: Category }> = {
  "01": { name: "List Workspaces", category: "read" },
  "02": { name: "List Tags", category: "read" },
  "03": { name: "Search Nodes", category: "read" },
  "04": { name: "Read Node", category: "read" },
  "05": { name: "Get Tag Schema", category: "read" },
  "06": { name: "Get Children", category: "read" },
  "07": { name: "Create Simple", category: "create" },
  "08": { name: "Create Todo", category: "create" },
  "09": { name: "Create with Tag", category: "create" },
  "10": { name: "Create Hierarchy", category: "create" },
  "11": { name: "Rename", category: "edit" },
  "12": { name: "Description", category: "edit" },
  "13": { name: "Add Tag", category: "edit" },
  "14": { name: "Check/Uncheck", category: "edit" },
  "15": { name: "Set Field", category: "edit" },
  "16": { name: "Trash", category: "delete" },
  "17": { name: "CRUD Flow", category: "workflow" },
  "18": { name: "Bulk Create", category: "workflow" },
  "19": { name: "Tag Explore", category: "workflow" },
  "20": { name: "Structured Data", category: "workflow" },
};

const CATEGORY_ORDER: Category[] = ["read", "create", "edit", "delete", "workflow"];

function parseResults(activeSuites: string[]): Scenario[] {
  const scenarios: Scenario[] = [];

  for (const id of Object.keys(SCENARIO_META).sort()) {
    const meta = SCENARIO_META[id];
    const results: Record<string, BenchmarkResult | null> = {};

    for (const suite of activeSuites) {
      const suiteData = allResults[suite] || {};
      const path = Object.keys(suiteData).find((p) => p.includes(`/${id}-`));
      results[suite] = path ? suiteData[path] : null;
    }

    scenarios.push({
      id,
      name: meta.name,
      category: meta.category,
      results,
    });
  }

  return scenarios;
}

// Formatting
function formatCost(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toString();
}

function getInputTokens(usage: BenchmarkUsage): number {
  return usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
}

function getOutputTokens(usage: BenchmarkUsage): number {
  return usage.output_tokens;
}

function getCacheHit(usage: BenchmarkUsage): number {
  const total =
    usage.input_tokens +
    usage.cache_creation_input_tokens +
    usage.cache_read_input_tokens;
  if (total === 0) return 0;
  return usage.cache_read_input_tokens / total;
}

// Suite selector
function SuiteSelector({
  activeSuites,
  onToggle,
  onPreset,
  onClear,
}: {
  activeSuites: string[];
  onToggle: (suite: string) => void;
  onPreset: (suites: string[]) => void;
  onClear: () => void;
}) {
  return (
    <div className="suite-selector">
      <div className="preset-buttons">
        <button
          className={`preset-btn ${activeSuites.includes("haiku-local") && activeSuites.includes("haiku-codemode") && activeSuites.length === 2 ? "active" : ""}`}
          onClick={() => onPreset(["haiku-local", "haiku-codemode"])}
        >
          Haiku Comparison
        </button>
        <button
          className={`preset-btn ${activeSuites.includes("opus-local") && activeSuites.includes("opus-codemode") && activeSuites.length === 2 ? "active" : ""}`}
          onClick={() => onPreset(["opus-local", "opus-codemode"])}
        >
          Opus Comparison
        </button>
        <button
          className="preset-btn clear"
          onClick={onClear}
          disabled={activeSuites.length === 0}
        >
          Clear
        </button>
      </div>

      <div className="suite-toggles">
        {Object.entries(SUITES).map(([key, meta]) => (
          <label key={key} className={`suite-toggle ${activeSuites.includes(key) ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={activeSuites.includes(key)}
              onChange={() => onToggle(key)}
            />
            <span className="toggle-indicator" style={{ background: activeSuites.includes(key) ? meta.color : undefined }} />
            <span className="toggle-label">{meta.label}</span>
          </label>
        ))}
      </div>

      <style>{`
        .suite-selector {
          display: flex;
          flex-direction: column;
          gap: ${spacing.md};
          padding: ${spacing.lg};
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.lg};
          margin-bottom: ${spacing.xl};
        }

        .preset-buttons {
          display: flex;
          gap: ${spacing.sm};
        }

        .preset-btn {
          padding: ${spacing.sm} ${spacing.lg};
          font-family: ${typography.sans};
          font-size: ${typography.sm};
          font-weight: ${typography.medium};
          color: ${colors.text.secondary};
          background: ${colors.bg.base};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.md};
          cursor: pointer;
          transition: all 150ms ease;
        }

        .preset-btn:hover {
          background: ${colors.bg.hover};
          color: ${colors.text.primary};
        }

        .preset-btn.active {
          background: ${colors.winner.primarySoft};
          border-color: ${colors.winner.primary};
          color: ${colors.winner.primary};
        }

        .preset-btn.clear {
          margin-left: auto;
        }

        .preset-btn.clear:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .suite-toggles {
          display: flex;
          gap: ${spacing.md};
          flex-wrap: wrap;
        }

        .suite-toggle {
          display: flex;
          align-items: center;
          gap: ${spacing.sm};
          padding: ${spacing.sm} ${spacing.md};
          background: ${colors.bg.base};
          border: 1px solid ${colors.border.subtle};
          border-radius: ${radius.sm};
          cursor: pointer;
          transition: all 150ms ease;
        }

        .suite-toggle:hover {
          border-color: ${colors.border.strong};
        }

        .suite-toggle.active {
          border-color: ${colors.border.strong};
          background: ${colors.bg.hover};
        }

        .suite-toggle input {
          display: none;
        }

        .toggle-indicator {
          width: 10px;
          height: 10px;
          border-radius: 2px;
          background: ${colors.text.faint};
        }

        
        .toggle-label {
          font-size: ${typography.sm};
          color: ${colors.text.secondary};
        }

        .suite-toggle.active .toggle-label {
          color: ${colors.text.primary};
        }
      `}</style>
    </div>
  );
}

// Comparison bar for two values
function ComparisonBar({
  values,
  suites,
  formatFn,
  showLabel = false,
}: {
  values: Record<string, number>;
  suites: string[];
  formatFn: (n: number) => string;
  showLabel?: boolean;
}) {
  const nums = suites.map((s) => values[s] ?? 0);
  const max = Math.max(...nums);
  const min = Math.min(...nums.filter((n) => n > 0));
  const winnerIdx = nums.indexOf(min);

  return (
    <div className="comparison-cell">
      {suites.map((suite, idx) => {
        const val = values[suite] ?? 0;
        const pct = max > 0 ? (val / max) * 100 : 0;
        const isWinner = idx === winnerIdx && nums.filter((n) => n === min).length === 1;
        const meta = SUITES[suite];

        return (
          <div key={suite} className="comparison-row">
            {showLabel && <span className="suite-label">{meta.short}</span>}
            <span className={`value ${isWinner ? "winner" : ""}`}>{formatFn(val)}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${pct}%`,
                  background: meta.color,
                  opacity: isWinner ? 1 : 0.3,
                }}
              />
            </div>
          </div>
        );
      })}

      <style>{`
        .comparison-cell {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .comparison-row {
          display: flex;
          align-items: center;
          gap: ${spacing.sm};
        }

        .comparison-row .value {
          font-family: ${typography.mono};
          font-size: ${typography.sm};
          color: ${colors.text.muted};
          min-width: 55px;
          text-align: right;
        }

        .suite-label {
          font-family: ${typography.mono};
          font-size: 9px;
          color: ${colors.text.faint};
          width: 42px;
          flex-shrink: 0;
        }

        .comparison-row .value.winner {
          color: ${colors.text.primary};
          font-weight: ${typography.medium};
        }

        .bar-track {
          flex: 1;
          height: 5px;
          background: ${colors.bg.subtle};
          border-radius: 2px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          background: ${colors.text.faint};
          border-radius: 2px;
          transition: width 200ms ease;
        }

              `}</style>
    </div>
  );
}

function SummaryStats({ scenarios, activeSuites }: { scenarios: Scenario[]; activeSuites: string[] }) {
  const stats = useMemo(() => {
    const totals: Record<string, { cost: number; time: number; inputTokens: number; outputTokens: number; cacheRead: number; cacheTotal: number }> = {};

    for (const suite of activeSuites) {
      totals[suite] = { cost: 0, time: 0, inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheTotal: 0 };
    }

    for (const s of scenarios) {
      for (const suite of activeSuites) {
        const r = s.results[suite];
        if (r && !r.is_error) {
          totals[suite].cost += r.total_cost_usd;
          totals[suite].time += r.duration_ms;
          totals[suite].inputTokens += getInputTokens(r.usage);
          totals[suite].outputTokens += getOutputTokens(r.usage);
          totals[suite].cacheRead += r.usage.cache_read_input_tokens;
          totals[suite].cacheTotal += r.usage.input_tokens + r.usage.cache_creation_input_tokens + r.usage.cache_read_input_tokens;
        }
      }
    }

    return totals;
  }, [scenarios, activeSuites]);

  if (activeSuites.length === 0) return null;

  const costs: Record<string, number> = {};
  const times: Record<string, number> = {};
  const inputTokens: Record<string, number> = {};
  const outputTokens: Record<string, number> = {};
  const caches: Record<string, number> = {};

  for (const suite of activeSuites) {
    costs[suite] = stats[suite].cost;
    times[suite] = stats[suite].time;
    inputTokens[suite] = stats[suite].inputTokens;
    outputTokens[suite] = stats[suite].outputTokens;
    caches[suite] = stats[suite].cacheTotal > 0 ? stats[suite].cacheRead / stats[suite].cacheTotal : 0;
  }

  return (
    <div className="summary-section">
      <div className="summary-table-wrapper">
        <table className="summary-table">
          <thead>
            <tr>
              <th className="th-suite">Suite</th>
              <th className="th-metric">Cost</th>
              <th className="th-metric">Duration</th>
              <th className="th-metric">Input Tokens</th>
              <th className="th-metric">Output Tokens</th>
              <th className="th-cache">Cache</th>
            </tr>
          </thead>
          <tbody>
            {activeSuites.map((suite) => (
              <SummaryRow
                key={suite}
                suite={suite}
                costs={costs}
                times={times}
                inputTokens={inputTokens}
                outputTokens={outputTokens}
                caches={caches}
                activeSuites={activeSuites}
              />
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .summary-section {
          margin-bottom: ${spacing.xl};
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.lg};
          overflow: hidden;
        }

        .summary-table-wrapper {
          overflow-x: auto;
        }

        .summary-table {
          width: 100%;
          border-collapse: collapse;
        }

        .summary-table th {
          padding: ${spacing.md} ${spacing.lg};
          text-align: left;
          font-size: ${typography.xs};
          font-weight: ${typography.semibold};
          color: ${colors.text.muted};
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: ${colors.bg.base};
          border-bottom: 1px solid ${colors.border.subtle};
        }

        .summary-table th.th-metric {
          text-align: center;
          width: 200px;
        }

        .summary-table th.th-cache {
          text-align: center;
          width: 100px;
        }

        .summary-table td {
          padding: ${spacing.md} ${spacing.lg};
          border-bottom: 1px solid ${colors.border.subtle};
          vertical-align: middle;
        }

        .summary-table tbody tr:hover {
          background: ${colors.bg.hover};
        }

        .summary-table tbody tr:last-child td {
          border-bottom: none;
        }

        .suite-cell {
          display: flex;
          align-items: center;
          gap: ${spacing.sm};
        }

        .suite-indicator {
          width: 10px;
          height: 10px;
          border-radius: 2px;
        }

        .suite-name {
          font-size: ${typography.base};
          font-weight: ${typography.medium};
          color: ${colors.text.primary};
        }

        .summary-bar-cell {
          padding: ${spacing.sm} ${spacing.lg};
        }

        .summary-bar {
          display: flex;
          align-items: center;
          gap: ${spacing.sm};
        }

        .summary-bar .value {
          font-family: ${typography.mono};
          font-size: ${typography.sm};
          min-width: 60px;
          text-align: right;
        }

        .summary-bar .value.winner {
          color: ${colors.text.primary};
          font-weight: ${typography.medium};
        }

        .summary-bar .value:not(.winner) {
          color: ${colors.text.muted};
        }

        .summary-bar .bar-track {
          flex: 1;
          height: 6px;
          background: ${colors.bg.subtle};
          border-radius: 3px;
          overflow: hidden;
        }

        .summary-bar .bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 200ms ease;
        }

        .cache-cell {
          text-align: center;
          font-family: ${typography.mono};
          font-size: ${typography.sm};
          color: ${colors.text.muted};
        }
      `}</style>
    </div>
  );
}

function SummaryRow({
  suite,
  costs,
  times,
  inputTokens,
  outputTokens,
  caches,
  activeSuites,
}: {
  suite: string;
  costs: Record<string, number>;
  times: Record<string, number>;
  inputTokens: Record<string, number>;
  outputTokens: Record<string, number>;
  caches: Record<string, number>;
  activeSuites: string[];
}) {
  const meta = SUITES[suite];

  const isWinner = (values: Record<string, number>) => {
    const nums = activeSuites.map((s) => values[s]);
    const min = Math.min(...nums.filter((n) => n > 0));
    return values[suite] === min && nums.filter((n) => n === min).length === 1;
  };

  const getBarWidth = (values: Record<string, number>) => {
    const max = Math.max(...activeSuites.map((s) => values[s]));
    return max > 0 ? (values[suite] / max) * 100 : 0;
  };

  return (
    <tr>
      <td>
        <div className="suite-cell">
          <span className="suite-indicator" style={{ background: meta.color }} />
          <span className="suite-name">{meta.label}</span>
        </div>
      </td>
      <td className="summary-bar-cell">
        <div className="summary-bar">
          <span className={`value ${isWinner(costs) ? "winner" : ""}`}>
            {formatCost(costs[suite])}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${getBarWidth(costs)}%`,
                background: meta.color,
                opacity: isWinner(costs) ? 1 : 0.3,
              }}
            />
          </div>
        </div>
      </td>
      <td className="summary-bar-cell">
        <div className="summary-bar">
          <span className={`value ${isWinner(times) ? "winner" : ""}`}>
            {formatDuration(times[suite])}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${getBarWidth(times)}%`,
                background: meta.color,
                opacity: isWinner(times) ? 1 : 0.3,
              }}
            />
          </div>
        </div>
      </td>
      <td className="summary-bar-cell">
        <div className="summary-bar">
          <span className={`value ${isWinner(inputTokens) ? "winner" : ""}`}>
            {formatTokens(inputTokens[suite])}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${getBarWidth(inputTokens)}%`,
                background: meta.color,
                opacity: isWinner(inputTokens) ? 1 : 0.3,
              }}
            />
          </div>
        </div>
      </td>
      <td className="summary-bar-cell">
        <div className="summary-bar">
          <span className={`value ${isWinner(outputTokens) ? "winner" : ""}`}>
            {formatTokens(outputTokens[suite])}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{
                width: `${getBarWidth(outputTokens)}%`,
                background: meta.color,
                opacity: isWinner(outputTokens) ? 1 : 0.3,
              }}
            />
          </div>
        </div>
      </td>
      <td className="cache-cell">{(caches[suite] * 100).toFixed(0)}%</td>
    </tr>
  );
}

function ScenarioRow({ scenario, activeSuites }: { scenario: Scenario; activeSuites: string[] }) {
  const costs: Record<string, number> = {};
  const times: Record<string, number> = {};
  const inputTokens: Record<string, number> = {};
  const outputTokens: Record<string, number> = {};
  const caches: Record<string, number> = {};
  let hasError = false;

  for (const suite of activeSuites) {
    const r = scenario.results[suite];
    costs[suite] = r?.total_cost_usd ?? 0;
    times[suite] = r?.duration_ms ?? 0;
    inputTokens[suite] = r ? getInputTokens(r.usage) : 0;
    outputTokens[suite] = r ? getOutputTokens(r.usage) : 0;
    caches[suite] = r ? getCacheHit(r.usage) : 0;
    if (r?.is_error) hasError = true;
  }

  return (
    <tr className={hasError ? "has-error" : ""}>
      <td className="cell-name">
        <span className="scenario-id">{scenario.id}</span>
        <span className="scenario-name">{scenario.name}</span>
        {hasError && <span className="error-tag">ERR</span>}
      </td>
      <td className="cell-comparison">
        <ComparisonBar values={costs} suites={activeSuites} formatFn={formatCost} showLabel />
      </td>
      <td className="cell-comparison">
        <ComparisonBar values={times} suites={activeSuites} formatFn={formatDuration} />
      </td>
      <td className="cell-comparison">
        <ComparisonBar values={inputTokens} suites={activeSuites} formatFn={formatTokens} />
      </td>
      <td className="cell-comparison">
        <ComparisonBar values={outputTokens} suites={activeSuites} formatFn={formatTokens} />
      </td>
      <td className="cell-cache">
        <div className="cache-values">
          {activeSuites.map((suite) => (
            <div key={suite} className="cache-row">
              <span className="suite-label">{SUITES[suite].short}</span>
              <span>{(caches[suite] * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </td>
    </tr>
  );
}

function CategoryGroup({ category, scenarios, activeSuites }: {
  category: Category;
  scenarios: Scenario[];
  activeSuites: string[];
}) {
  const labels: Record<Category, string> = {
    read: "Read Operations",
    create: "Create Operations",
    edit: "Edit Operations",
    delete: "Delete Operations",
    workflow: "Workflows",
  };

  return (
    <tbody>
      <tr className="category-row">
        <td colSpan={6}>{labels[category]}</td>
      </tr>
      {scenarios.map((s) => (
        <ScenarioRow key={s.id} scenario={s} activeSuites={activeSuites} />
      ))}
    </tbody>
  );
}

export default function BenchmarkComparison() {
  const [activeSuites, setActiveSuites] = useState<string[]>(["haiku-local", "haiku-codemode"]);

  const scenarios = useMemo(() => parseResults(activeSuites), [activeSuites]);

  const grouped = useMemo(() => {
    const g: Record<Category, Scenario[]> = {
      read: [], create: [], edit: [], delete: [], workflow: [],
    };
    for (const s of scenarios) g[s.category].push(s);
    return g;
  }, [scenarios]);

  const handleToggle = (suite: string) => {
    setActiveSuites((prev) =>
      prev.includes(suite) ? prev.filter((s) => s !== suite) : [...prev, suite]
    );
  };

  const handlePreset = (suites: string[]) => {
    setActiveSuites(suites);
  };

  const handleClear = () => {
    setActiveSuites([]);
  };

  return (
    <div className="benchmark-page">
      <header className="page-header">
        <h1>Benchmark Comparison</h1>
        <p>Compare MCP implementations across models</p>
      </header>

      <SuiteSelector
        activeSuites={activeSuites}
        onToggle={handleToggle}
        onPreset={handlePreset}
        onClear={handleClear}
      />

      {activeSuites.length > 0 && (
        <>
          <SummaryStats scenarios={scenarios} activeSuites={activeSuites} />

          <div className="table-section">
            <div className="table-header">
              <h2>Per-Scenario Breakdown</h2>
              <div className="legend">
                {activeSuites.map((suite) => (
                  <div key={suite} className="legend-item">
                    <span className="legend-line" style={{ background: SUITES[suite].color }} />
                    <span>{SUITES[suite].label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th className="th-name">Scenario</th>
                    <th className="th-metric">Cost</th>
                    <th className="th-metric">Duration</th>
                    <th className="th-metric">Input Tokens</th>
                    <th className="th-metric">Output Tokens</th>
                    <th className="th-cache">Cache</th>
                  </tr>
                </thead>
                {CATEGORY_ORDER.map((cat) => (
                  <CategoryGroup
                    key={cat}
                    category={cat}
                    scenarios={grouped[cat]}
                    activeSuites={activeSuites}
                  />
                ))}
              </table>
            </div>
          </div>
        </>
      )}

      {activeSuites.length === 0 && (
        <div className="empty-state">
          <p>Select test suites to compare</p>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');

        .benchmark-page {
          min-height: 100vh;
          background: ${colors.bg.deep};
          padding: ${spacing.xxl};
          font-family: ${typography.sans};
        }

        .page-header {
          margin-bottom: ${spacing.xl};
        }

        .page-header h1 {
          font-size: ${typography.xxl};
          font-weight: ${typography.semibold};
          color: ${colors.text.primary};
          margin-bottom: ${spacing.xs};
        }

        .page-header p {
          font-size: ${typography.base};
          color: ${colors.text.muted};
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 200px;
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.lg};
          color: ${colors.text.muted};
          font-size: ${typography.base};
        }

        .table-section {
          background: ${colors.bg.elevated};
          border: 1px solid ${colors.border.default};
          border-radius: ${radius.lg};
          overflow: hidden;
        }

        .table-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: ${spacing.lg};
          border-bottom: 1px solid ${colors.border.subtle};
        }

        .table-header h2 {
          font-size: ${typography.lg};
          font-weight: ${typography.semibold};
          color: ${colors.text.primary};
        }

        .legend {
          display: flex;
          gap: ${spacing.lg};
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: ${spacing.sm};
          font-size: ${typography.xs};
          color: ${colors.text.muted};
        }

        .legend-line {
          width: 16px;
          height: 3px;
          border-radius: 1px;
          background: ${colors.text.faint};
        }

        .legend-line.local {
          background: ${colors.winner.primary};
        }

        .legend-line.codemode {
          background: ${colors.winner.secondary};
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          padding: ${spacing.md} ${spacing.lg};
          text-align: left;
          font-size: ${typography.xs};
          font-weight: ${typography.semibold};
          color: ${colors.text.muted};
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: ${colors.bg.base};
          border-bottom: 1px solid ${colors.border.subtle};
        }

        th.th-metric {
          text-align: center;
          width: 200px;
        }

        th.th-cache {
          text-align: center;
          width: 100px;
        }

        .category-row td {
          padding: ${spacing.sm} ${spacing.lg};
          font-size: ${typography.xs};
          font-weight: ${typography.semibold};
          color: ${colors.text.faint};
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: ${colors.bg.deep};
          border-bottom: 1px solid ${colors.border.subtle};
        }

        tr:not(.category-row):hover {
          background: ${colors.bg.hover};
        }

        tr.has-error {
          background: ${colors.errorSoft};
        }

        td {
          padding: ${spacing.md} ${spacing.lg};
          border-bottom: 1px solid ${colors.border.subtle};
          vertical-align: middle;
        }

        .cell-name {
          display: flex;
          align-items: center;
          gap: ${spacing.sm};
        }

        .scenario-id {
          font-family: ${typography.mono};
          font-size: ${typography.xs};
          color: ${colors.text.faint};
        }

        .scenario-name {
          font-size: ${typography.base};
          color: ${colors.text.primary};
        }

        .error-tag {
          font-size: 9px;
          font-weight: ${typography.semibold};
          color: ${colors.error};
          background: ${colors.errorSoft};
          padding: 2px 4px;
          border-radius: 2px;
        }

        .cell-comparison {
          padding: ${spacing.sm} ${spacing.lg};
        }

        .cell-cache {
          text-align: center;
        }

        .cache-values {
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .cache-row {
          display: flex;
          align-items: center;
          gap: ${spacing.sm};
        }

        .cache-row span:last-child {
          font-family: ${typography.mono};
          font-size: ${typography.sm};
          color: ${colors.text.muted};
        }

        @media (max-width: 1000px) {
          .benchmark-page {
            padding: ${spacing.lg};
          }

          th.th-metric {
            width: 160px;
          }
        }
      `}</style>
    </div>
  );
}
