# MCP Prompt Optimization Findings

Analysis of `tana-mcp-codemode` sessions to identify inefficiency patterns and prompt improvement opportunities.

## Sessions Analyzed

| Session | ID | Task | Execute Calls | Key Finding |
|---|---|---|---|---|
| **Session A** | `b37a3f99` | Deep workspace/supertag analysis | ~32 | Massive waste: timeouts, raw dumps, broad searches |
| **Session C** | `a7e62b83` | Search for notes on "taste" | 2 | Good structure, but 35KB raw JSON dump |

For comparison, the same "taste" task was also run with `tana-local` (session `54c79fc9`) which required 31 tool calls vs codemode's 2 — demonstrating the codemode pattern's batching advantage.

---

## Findings Summary

### Waste by Category (Session A — workspace analysis)

| Category | Calls Wasted | Tokens Wasted | Time Wasted |
|---|---|---|---|
| `tags.list()` timeout retries | 3 + 2 collateral | ~0 | 30s |
| `search` with fake `offset` | 2 identical | ~5,000 | 10s |
| Full option dumps from `getSchema` | ~4 | ~30,000-40,000 | — |
| Library/Inbox/broad searches | 5 | ~15,000 | — |
| Duplicate `getSchema` fetches | 3 truly redundant | ~5,000 | — |
| `JSON.stringify(data, null, 2)` everywhere | all calls | ~10,000 | — |
| **Total** | | **~55,000-65,000 (36-43%)** | **~40s** |

### Waste by Category (Session C — taste search)

| Category | Calls Wasted | Tokens Wasted | Time Wasted |
|---|---|---|---|
| Raw JSON dump of 40 search results | 1 call | ~30,000 (35KB) | — |
| Reading 2 empty leaf nodes | part of batch | negligible | — |
| **Total** | | **~30,000** | **negligible** |

Session C was structurally efficient (2 calls, good batching, smart curation) but the raw dump pattern alone consumed ~30K tokens of context that a selective `.map()` would have reduced to ~3-4K.

---

## Failure Modes Catalog

### FM-1: `tags.list()` Timeout

**What happened**: AI called `tana.tags.list(wsId, limit)` three times (limits 100, 30, 10). All timed out at 10s. Reducing `limit` didn't help — the API computes full tag set before applying limit.

**Collateral damage**: Each call was paired with a parallel `nodes.read()` that got killed by Claude Code's "sibling tool call errored" behavior. Total: 5 calls lost (3 timeout + 2 collateral).

**Root cause**: The Tana Local API's `tags.list` endpoint is slow for large workspaces. No pagination/offset is available (OpenAPI spec confirms only `limit`, max 200).

**Fix**: Prompt warning + alternative approach guidance.

### FM-2: `search` with Non-Existent `offset`

**What happened**: AI searched `{ hasType: "SYS_T01" }` to find all supertags. Got 50 results. Tried `offset: 50` and `offset: 150` to paginate. Got identical results every time.

**Root cause**: The `/nodes/search` endpoint has NO `offset` parameter (OpenAPI spec confirms: only `query`, `workspaceIds`, `limit` with max 100). The API silently ignores unknown parameters.

**Fix**: Document in prompt that search has no pagination. Guide toward narrower queries instead.

### FM-3: Massive `getSchema` Option Dumps

**What happened**: The `#task` tag has an "it helps complete..." field with 250+ option values (every mission/project). `getSchema` returned ALL of them. Then `#todo` (which extends `#task`) returned the same 250+ options again via inherited fields.

**Data appeared 4+ times in context**, consuming ~30,000-40,000 tokens.

**Root cause**: `getSchema` returns full option values. `includeInheritedFields` defaults to `true`. The AI logged raw output without truncation.

**Fix**: Prompt guidance to summarize in code (log counts + 3 samples, not full lists). Consider server-side truncation. Expose `includeInheritedFields: false`.

### FM-4: Irrelevant Broad Searches

**What happened**: AI explored Inbox (random tweets, URLs), Library (clothing, shoes, drugs), and used `{ has: "tag" }` (returns any tagged node in workspace). None of this was relevant to the "understand supertags" task.

**Examples**:
- `tana.nodes.getChildren("4T1T-cLhpX_CAPTURE_INBOX", { limit: 15 })` → personal tweets, random URLs
- `tana.nodes.getChildren("4T1T-cLhpX_STASH", { limit: 20 })` → "train", "Veep", "art", "Japan", "shoes"
- `tana.nodes.search({ has: "tag" }, { limit: 30 })` → random tagged nodes
- `tana.nodes.read("4T1T-cLhpX_STASH", 1)` → entire Library at depth 1

**Root cause**: No prompt guidance on when/why to explore these entry points.

**Fix**: Prompt should explain what Inbox/Library contain and when they're useful.

### FM-5: Duplicate Schema Fetches

**What happened**: 56 total `getSchema` calls for 38 unique tag IDs = 18 duplicates. Most were justified (sibling error recovery), but 3 were truly redundant — fetching schemas that were already in context.

**Root cause**: No tracking of already-fetched data. AI didn't check previous results before re-fetching.

**Fix**: Prompt guidance to batch schemas in one execute call and track what's already fetched.

### FM-6: Raw JSON Dumps

**What happened**: Every `execute` call used `JSON.stringify(data, null, 2)` to dump full API responses including all metadata (breadcrumbs, tagIds, workspaceId, created timestamps, inTrash booleans).

**Root cause**: Prompt says `console.log() to return data` but gives no guidance on output formatting.

**Fix**: Add output discipline section to prompt.

### FM-7: Raw JSON Dump as Default Output (Sessions A + C)

**What happened**: In both codemode sessions, the AI defaulted to `JSON.stringify(data, null, 2)` for all output. In Session C (taste search), this produced 35KB of JSON for 40 search results when a `.map()` to `{ id, name, breadcrumb }` would have been ~4KB with the same information.

**Also observed in Session A**: Every execute call used the same pattern — full metadata dumps including breadcrumbs, tagIds, workspaceId, created timestamps, inTrash booleans.

**Root cause**: The prompt says `console.log() to return data` but gives no guidance on output formatting. The AI treats raw dumps as the safest default.

**Fix**: Add output discipline section with examples of selective logging patterns.

### FM-8: tana-local Comparison Notes

The same "taste" task was run with `tana-local` (session `54c79fc9`) for comparison. Key observations (not actionable for codemode but informative):
- Required 31 tool calls (9 main + 22 subagent) vs codemode's 2
- Subagents cannot access MCP tools — the librarian agent reverse-engineered the API from source code
- Individual `read_node` calls for leaf nodes wasted 5 of 8 reads (62%)
- Codemode's batching pattern (for-loop in one execute) avoids this entirely

### FM-9: Double Timeout Trap (Code Issue)

**What happened**: The HTTP client (`client.ts`) has a 3-retry loop with exponential backoff (1s, 2s, 4s delays). But the sandbox timeout (`executor.ts`) is also 10s. When `tags.list` takes >10s on the first HTTP attempt, the sandbox kills everything before the client can retry.

**Root cause**: Both timeout layers are set to 10s. The client's retry logic is dead code — it can never fire.

**Fix**: Either increase sandbox timeout to accommodate retries, remove client retries for sandbox context, or make client timeout shorter (e.g., 3s) so retries can fit within sandbox window.

---

## Improvement Plan

### Priority 1: Prompt Improvements (High Impact, Low Effort)

#### P1-A: Output Discipline Section

Add to `prompts.ts`:

```
## Output Discipline

console.log() output goes into LLM context. Every byte costs tokens.

- Summarize in code before logging. Never dump raw API responses.
- Tag schemas: log field names/types/option COUNTS, not full option lists.
- Search results: log id + name (+ tags if relevant), not full objects.
- Large results: use .slice(0, 5) and log total count separately.
- Use .map() to select only the fields you need before logging.
```

#### P1-B: Timeout Recovery Guidance

```
## Timeout (10s limit)

If execution times out, the operation was too expensive. Do NOT retry with smaller limit — break the approach:
- tags.list() is slow for large workspaces. Alternative: search({ hasType: "SYS_T01" }) for supertag discovery.
- Reduce maxDepth on node reads. Use getChildren with pagination instead.
- Split batch operations into smaller groups.
```

#### P1-C: API Limitations Section

```
## API Limitations

- search has NO offset/pagination. Max 100 results. To get more, use narrower queries.
- tags.list has NO offset. Max 200 results. Can be slow for large workspaces.
- getSchema returns ALL option values for option fields (can be 100s of items).
  Use includeInheritedFields=false when you only need the tag's own fields.
- getChildren is the only paginated endpoint (limit + offset).
```

#### P1-D: Batching Guidance

```
## Efficiency

Minimize execute calls. Batch work inside a single script:

// ONE call for all schemas (good)
const tags = await tana.tags.list(wsId, 50);
for (const tag of tags) {
  const schema = await tana.tags.getSchema(tag.id);
  console.log(`${tag.name}: ${schema.fields?.length ?? 0} fields`);
}

// 50 separate calls (bad) — don't call execute per tag
```

#### P1-E: Anti-Patterns Section

```
## Anti-patterns

- { has: "tag" } returns ANY tagged node. Almost never useful. Use { hasType: "specificId" }.
- Don't explore Inbox/Library to understand workspace structure — they contain user content, not schema info.
- Don't re-read a node at higher maxDepth unless the first read showed "[truncated]" markers.
- Don't retry timed-out operations with same approach — change strategy.
- search({ offset: N }) does nothing — offset is silently ignored.
```

#### P1-F: Exploration Workflow

```
## Workspace Discovery Pattern

1. Use tana.workspace (pre-resolved) or tana.workspaces.list()
2. Discover supertags:
   - FAST: tana.nodes.search({ hasType: "SYS_T01" }, { limit: 100 })
   - SLOW (may timeout): tana.tags.list(wsId)
3. For each tag: getSchema → log field names + types + option counts (not values)
4. Check tag inheritance (extends) to avoid fetching duplicate fields
5. Only read specific nodes when you need their content, not for schema discovery
```

#### P1-G: Default Workspace Usage

Already partially implemented. Enhance the existing section:

```
## Default Workspace

tana.workspace is pre-resolved from MAIN_TANA_WORKSPACE if configured.
Always prefer it over calling workspaces.list():

const ws = tana.workspace;
if (ws) {
  const tags = await tana.tags.list(ws.id);
  // ... use ws.id, ws.name, ws.homeNodeId
} else {
  const workspaces = await tana.workspaces.list();
  // ... fallback
}
```

### Priority 2: Code Improvements (Medium Effort)

#### P2-A: Fix Double Timeout

Options (pick one):
1. Reduce HTTP client timeout to 3s so 3 retries fit in 10s sandbox window
2. Remove client retry logic when running inside sandbox (separate config)
3. Increase sandbox timeout to 30s (but this delays error feedback)

Recommended: Option 1 — reduce per-request timeout in sandbox context.

#### P2-B: Truncate getSchema Options Server-Side

In `api/tana.ts`, post-process `getSchema` responses to truncate option lists:
- If an options field has >10 values, show first 5 + `(and N more)`
- Always show total count
- Keep full IDs available via a separate method if needed

#### P2-C: Expose `includeInheritedFields` Parameter

Currently `getSchema(tagId, includeEditInstructions)` — add `includeInheritedFields` as a third parameter. Default `false` in the codemode API to avoid duplicate field data from tag inheritance chains.

#### P2-D: Track Session State (workspace ID)

Already partially done with `tana.workspace`. Consider:
- Auto-setting `workspaceIds` filter on search when workspace is known
- Caching tag list results within a session (fire-and-forget to avoid re-fetching)

### Priority 3: Infrastructure / Architectural Notes

#### P3-A: Silent Parameter Ignoring

The Tana Local API silently ignores unknown parameters (like `offset` on search). This causes the AI to believe pagination is working when it isn't. No fix from our side — but documenting this in the prompt prevents the AI from trying.

---

## Implementation Checklist

- [x] **P1-A**: Add Output Discipline section — enhanced with tana.format() + task-aware patterns
- [x] **P1-B**: Add Timeout Recovery section — merged into Constraints section
- [x] **P1-C**: Add API Limitations section — merged into Constraints section
- [x] **P1-D**: Add Batching Guidance — Efficiency section
- [x] **P1-E**: Add Anti-patterns section — merged into Constraints section
- [x] **P1-F**: Add Exploration Workflow — Discovery section
- [x] **P1-G**: Enhance Default Workspace section — cleaner example
- [x] **NEW**: tana.format() helper — `src/api/format.ts`, integrated into TanaAPI + sandbox
- [x] **NEW**: Eval framework — `scripts/eval-prompts.sh`, `scripts/compare-eval.sh`, `tests/format.test.ts`
- [ ] **P2-A**: Fix double timeout (client vs sandbox)
- [ ] **P2-B**: Truncate getSchema option values
- [ ] **P2-C**: Expose `includeInheritedFields` parameter
- [ ] **P2-D**: Auto-set workspaceIds on search when workspace known
- [ ] **P3-A**: Document silent parameter ignoring

---

## What Was Done (Session: 2026-02-27)

### Design Decisions

1. **tana.format() over prompt-only approach**: We added a code-level helper (`src/api/format.ts`) alongside prompt changes because "pit of success" — making the right thing the easiest thing — is more reliable than prompt instructions alone. The AI can always ignore prompt guidance, but a well-designed API default is hard to bypass.

2. **Task-aware output over field-drop-lists**: Instead of hardcoding which fields to drop (fragile — workspaceId IS needed for cross-workspace search, created IS needed for time queries), the prompt teaches the AI to select fields based on its current task goal.

3. **Two-phase pattern as fundamental, not a tip**: Search returns identity (name, id, tags) but NOT field values — because fields belong to supertags and are part of the node graph. The two-phase search→read pattern is the natural grain of the API, not a workaround.

4. **Merged P1-B + P1-C + P1-E into "Constraints"**: Avoids fragmentation and repetition in the prompt. All "don't do this" guidance lives in one place.

5. **Eval framework built on existing benchmark.sh pattern**: Same claude CLI invocation, same JSON output format, but 8 new scenarios specifically targeting failure modes FM-1 through FM-7.

### Key Context for Future Work

- **P2-A (double timeout)** is the most impactful remaining code fix. The client retry logic is effectively dead code. See FM-9 in findings.
- **P2-B (schema truncation)** would complement the prompt guidance in P1-A. Currently the prompt says "log counts not values" but getSchema still returns everything. Server-side truncation would enforce this at the source.
- **P2-C (includeInheritedFields)** already exists as an API parameter (confirmed in OpenAPI spec) but isn't exposed in tana.ts. Adding it would reduce duplicate field data when exploring tag hierarchies.
- **Tana docs** at `~/Core/dev/projects/text-experiments/docs-ext/tana_docs` contain comprehensive use case context (task mgmt, meetings, CRM, projects, daily notes, schema management).
- **Testing workspace** is "testing environment" (ID: `HfCy68zUUPM7`, home: `L5LXruUwGET9`). API at `localhost:8262` (requires Tana Desktop running). Safe to create/modify/delete in this workspace only. Integration tests and evals should always be scoped to this workspace.

---

## Appendix: Actual Code from Session A (Key Examples)

### Timeout Calls (FM-1)
```typescript
// Call #2 — timed out
const tags = await tana.tags.list("4T1T-cLhpX", 100);
console.log(JSON.stringify(tags, null, 2));

// Call #4 — timed out (just reduced limit)
const tags = await tana.tags.list("4T1T-cLhpX", 30);
console.log(JSON.stringify(tags, null, 2));

// Call #6 — timed out (even limit 10 doesn't help)
const tags = await tana.tags.list("4T1T-cLhpX", 10);
console.log(JSON.stringify(tags, null, 2));
```

### Fake Offset Pagination (FM-2)
```typescript
// Call #27 — got 50 results
const schemaTags = await tana.nodes.search(
  { and: [{ hasType: "SYS_T01" }] }, { limit: 50 }
);

// Call #28 — got IDENTICAL results (offset is ignored)
const schemaTags2 = await tana.nodes.search(
  { and: [{ hasType: "SYS_T01" }] }, { limit: 100, offset: 50 }
);

// Call #30 — still identical (offset 150 also ignored)
const more = await tana.nodes.search(
  { and: [{ hasType: "SYS_T01" }] }, { limit: 100, offset: 150 }
);
```

### Broad Irrelevant Search (FM-4)
```typescript
// Searched entire workspace for "any node with any tag"
const results = await tana.nodes.search({ has: "tag" }, { limit: 30 });
console.log(JSON.stringify(results.slice(0, 30), null, 2));
// Got: pizza recipes, random tweets, movie entries, job postings...
```

### Raw JSON Dump vs Proper Summary (FM-6 / FM-7)
```typescript
// BAD — what the AI did in Session A (full metadata dump)
const dims = await tana.nodes.search({ hasType: "1AS4cb4HQJeI" }, { limit: 20 });
console.log(JSON.stringify(dims, null, 2));

// BAD — what the AI did in Session C (35KB for 40 results)
const results = await tana.nodes.search({ textContains: "taste" });
console.log(JSON.stringify(results, null, 2));

// GOOD — selective output with same information
const results = await tana.nodes.search({ textContains: "taste" });
console.log(`Found ${results.length} results:`);
results.forEach(r => console.log(
  `  [${r.id}] ${r.name} — ${r.tags.map(t=>t.name).join(", ")||"no tags"} — ${r.breadcrumb.join(" > ")}`
));
```

### Good Pattern: Batched Reads (Session C)
```typescript
// GOOD — 7 reads in one execute call
const ids = [
  "Z8Y3PW5XBeBj",  // Cultivating taste
  "pMHkXXODYoVC",  // Good taste
  "Q6Er3mj_s7sc",  // Voice note on taste & AI
  "YKehLuMXpDjx",  // Future of Socioeconomy summary
  "g54HDPFmCFe4",  // Berlin & developing taste
  "IbObJSHCOg_F",  // developing taste: visual design
  "vhtXv0zFbgAM",  // "Taste is Power"
];
for (const id of ids) {
  const content = await tana.nodes.read(id, 3);
  console.log(`\n========== ${id} ==========`);
  console.log(content);
}
// Total: 65ms for all 7 reads — vs 7 separate execute calls
```
