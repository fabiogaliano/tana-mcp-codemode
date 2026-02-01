# Tana MCP Server

A codemode MCP server for [Tana](https://tana.inc) knowledge management. AI writes TypeScript code that executes against the Tana Local API.

## Features

- **Codemode Pattern** — AI writes executable TypeScript, not structured API calls
- **Tana Local API** — Workspaces, nodes, tags, fields, calendar, import
- **Top-level Await** — `await tana.workspaces.list()` works directly
- **Timeout Protection** — 10s max execution prevents infinite loops
- **Script History** — SQLite persistence for debugging and replay
- **Retry Logic** — Exponential backoff for transient failures
- **Debug UI** — WebSocket-based dashboard for testing scripts

## Requirements

- [Bun](https://bun.sh) runtime
- [Tana Desktop](https://tana.inc) with Local API enabled
- API token from Tana (Settings → API → Generate Token)

## Installation

### Option 1: bun (recommended)

```bash
# Requires Bun runtime
bun add -g tana-mcp-codemode
```

### Option 2: From source

```bash
git clone https://github.com/fabiogaliano/tana-mcp-codemode
cd tana-mcp-codemode
bun install
```

## Configuration

| Variable            | Default                 | Description                             |
| ------------------- | ----------------------- | --------------------------------------- |
| `TANA_API_TOKEN`    | (required)              | Bearer token from Tana Desktop          |
| `TANA_API_URL`      | `http://127.0.0.1:8262` | Tana Local API URL                      |
| `TANA_TIMEOUT`      | `10000`                 | Request timeout in ms                   |
| `TANA_HISTORY_PATH` | (platform default)      | Custom path for SQLite history database |

## MCP Integration

Add to your MCP client's configuration:

```json
{
  "mcpServers": {
    "tana": {
      "command": "tana-mcp-codemode",
      "env": {
        "TANA_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

| Client            | Config Location                                             |
| ----------------- | ----------------------------------------------------------- |
| Claude Desktop    | `claude_desktop_config.json`                                |
| Claude Code       | `.mcp.json` (project) or `~/.claude/settings.json` (global) |
| Cursor / Windsurf | IDE MCP settings                                            |

**If installed from source**, use `bun` as the command:

```json
{
  "mcpServers": {
    "tana": {
      "command": "bun",
      "args": ["run", "/path/to/tana-mcp-codemode/src/index.ts"],
      "env": {
        "TANA_API_TOKEN": "your_token_here"
      }
    }
  }
}
```

> **Tip**: Add `TANA_HISTORY_PATH` to `env` to customize where the SQLite history database is stored.

## Examples

### Search for nodes

```typescript
const results = await tana.nodes.search({
  textContains: "meeting notes"
});
console.log("Found:", results.length, "nodes");
```

### Complex query

```typescript
const tasks = await tana.nodes.search({
  and: [
    { hasType: "taskTagId" },
    { is: "todo" },
    { created: { last: 7 } }
  ]
});
console.log({ tasks });
```

### Import content

```typescript
await tana.import(parentNodeId, `
- Project Alpha #[[^projectTagId]]
  - [[^statusFieldId]]:: Active
  - [[^dueDateFieldId]]:: [[date:2024-03-15]]
`);
```

## Debug UI

A WebSocket-based dashboard for testing scripts:

```bash
# Start debug server
bun run src/debug-server.ts

# Open http://localhost:3333
```

**Routes:**
- `http://localhost:3333/#debug` — Script execution console
- `http://localhost:3333/#benchmark` — Codemode vs tana-local performance comparison

**Features:**
- Real-time script execution
- Workflow event timeline
- Error display with suggestions
- Benchmark results visualization (cost, speed, token usage)

### workflow Helper (Debug UI only)

Track multi-step operations with a timeline view:

```typescript
workflow.start("Processing nodes");
workflow.step("Fetching workspaces");
workflow.progress(5, 100, "Processing");
workflow.complete("Done!");
// Or: workflow.abort("Error message");
```

> **Note**: `workflow` is only available in the Debug UI. It's not exposed in the production MCP prompt.

### Building the React UI (optional)

```bash
cd ui
bun install
bun run build
cd ..
bun run src/debug-server.ts
```

## Architecture

```
src/
├── index.ts              # MCP server entry
├── prompts.ts            # Tool description
├── types.ts              # TypeScript interfaces
├── debug-server.ts       # WebSocket debug UI
├── api/
│   ├── client.ts         # HTTP client (auth, retry, timeouts)
│   ├── tana.ts           # API wrapper → `tana` object
│   └── types.ts          # API type definitions
├── sandbox/
│   ├── executor.ts       # Code execution engine
│   └── workflow.ts       # Progress tracking
├── storage/
│   └── history.ts        # SQLite script history
└── generated/
    └── api.d.ts          # Generated OpenAPI types

ui/                       # React debug dashboard
```

### How It Works

1. AI sends TypeScript code to the `execute` tool
2. `executor.ts` creates an AsyncFunction for top-level await
3. Code runs with injected `tana` and `console` objects
4. 10s timeout via Promise.race prevents hangs
5. `console.log()` output is captured and returned
6. Script run is saved to SQLite history

## Script History

Runs are persisted to SQLite:

| Platform | Location                                            |
| -------- | --------------------------------------------------- |
| macOS    | `~/Library/Application Support/tana-mcp/history.db` |
| Windows  | `%APPDATA%/tana-mcp/history.db`                     |
| Linux    | `~/.local/share/tana-mcp/history.db`                |

Old runs (>30 days) are automatically cleaned up on startup.

### What Gets Saved

Each script run records:

| Field               | Description                           |
| ------------------- | ------------------------------------- |
| `script`            | The TypeScript code that was executed |
| `output`            | Captured `console.log()` output       |
| `error`             | Error message if execution failed     |
| `api_calls`         | Which Tana API methods were called    |
| `node_ids_affected` | Node IDs that were read/modified      |
| `workspace_id`      | Workspace used (if detected)          |
| `duration_ms`       | Execution time                        |

## Development

```bash
# Dev mode with watch
bun run dev

# Type check
bun run typecheck

# Regenerate API types from OpenAPI spec
bun run generate

# Run debug server
bun run debug
```

## API Reference

The server exposes a single `execute` tool. AI writes TypeScript code with access to the `tana` object:

### Workspaces

```typescript
const workspaces = await tana.workspaces.list();
// → Workspace[] (id, name, homeNodeId)
```

### Nodes

```typescript
await tana.nodes.search(query, options?)     // → SearchResult[]
await tana.nodes.read(nodeId, maxDepth?)     // → string (markdown)
await tana.nodes.getChildren(nodeId, opts?)  // → { children, total, hasMore }
await tana.nodes.edit({ nodeId, name?, description? })
await tana.nodes.trash(nodeId)
await tana.nodes.check(nodeId)               // mark done
await tana.nodes.uncheck(nodeId)             // mark undone
```

### Tags (Supertags)

```typescript
await tana.tags.list(workspaceId, limit?)
await tana.tags.getSchema(tagId, includeEditInstructions?)
await tana.tags.modify(nodeId, action, tagIds)  // action: "add" | "remove"
await tana.tags.create({ workspaceId, name, description?, extendsTagIds?, showCheckbox? })
await tana.tags.addField({ tagId, name, dataType, ... })
await tana.tags.setCheckbox({ tagId, showCheckbox, doneStateMapping? })
```

### Fields

```typescript
await tana.fields.setOption(nodeId, attributeId, optionId)   // dropdown fields
await tana.fields.setContent(nodeId, attributeId, content)   // text/date/url fields
```

### Calendar

```typescript
await tana.calendar.getOrCreate(workspaceId, granularity, date?)
// granularity: "day" | "week" | "month" | "year"
```

### Import (Tana Paste)

```typescript
await tana.import(parentNodeId, tanaPasteContent)
// → { success, nodeIds?, error? }
```

### Utility

```typescript
await tana.health()  // → { status: "ok" }
```

## License

MIT
