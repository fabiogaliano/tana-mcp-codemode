# tana-mcp-codemode

Codemode MCP server for [Tana](https://tana.inc). AI writes TypeScript that executes directly against the Tana Local API.

**Requires:** Tana Desktop with Local API enabled + an API token (Settings → API).

## Install

**Binary** — download from [GitHub Releases](https://github.com/fabiogaliano/tana-mcp-codemode/releases), `chmod +x`, run.

**npm** (Node.js ≥ 20):
```bash
npm install -g tana-mcp-codemode
```

**From source** (Bun): `git clone` → `bun install` → `bun run src/entry-bun.ts`

## Setup

Run the interactive setup script — detects your installation, prompts for credentials, and configures Claude Code and/or Claude Desktop automatically:

```bash
bun run setup
# or for team-shared config:
bun run setup --scope project
```

## Manual MCP Configuration

```json
{
  "mcpServers": {
    "tana": {
      "command": "tana-mcp-codemode",
      "env": {
        "TANA_API_TOKEN": "your-token-here",
        "MAIN_TANA_WORKSPACE": "My Workspace"
      }
    }
  }
}
```

For binary: set `command` to the binary path. For source: `"command": "bun", "args": ["run", "/path/to/src/entry-bun.ts"]`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TANA_API_TOKEN` | required | Bearer token from Tana Desktop |
| `TANA_API_URL` | `http://127.0.0.1:8262` | Tana Local API URL |
| `MAIN_TANA_WORKSPACE` | — | Default workspace name or ID |
| `TANA_SEARCH_WORKSPACES` | — | Comma-separated workspaces for search scope |
| `TANA_TIMEOUT` | `10000` | Request timeout in ms |
| `TANA_HISTORY_PATH` | platform default | Custom SQLite history path |

## Usage Examples

```typescript
// Search nodes
const results = await tana.nodes.search("project ideas", {
  workspaceIds: [tana.workspace.id]
});

// Import with tags and fields
await tana.import(tana.workspace.id, `
%%tana%%
- Meeting notes #meeting
  - Date:: [[2024-01-15]]
  - Attendees:: Alice, Bob
`);
```

## API Reference

| Namespace | Methods |
|-----------|---------|
| `tana.workspace` | pre-resolved default workspace |
| `tana.workspaces` | `list()` |
| `tana.nodes` | `search()`, `read()`, `getChildren()`, `edit()`, `move()`, `trash()`, `check()`, `uncheck()`, `open()` |
| `tana.tags` | `listAll()`, `getSchema()`, `create()`, `modify()`, `addField()`, `setCheckbox()` |
| `tana.fields` | `setOption()`, `setContent()`, `getFieldOptions()` |
| `tana.calendar` | `getOrCreate()` |
| `tana.import()` | import Tana Paste content |
| `tana.health()` | API health check |

## Development

```bash
bun run start        # MCP server
bun run dev          # watch mode
bun run test         # tests
bun run build        # Node.js dist (tsup)
bun run build:binary # self-contained binary
bun run debug        # debug UI at :3333
```

## License

MIT
