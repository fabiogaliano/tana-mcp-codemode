# tana-mcp-codemode

Codemode MCP server for [Tana](https://tana.inc). Instead of structured API calls, your AI writes TypeScript that executes directly against the Tana Local API.

## Install

### Binary (no runtime required)

Download from [GitHub Releases](https://github.com/fabiogaliano/tana-mcp-codemode/releases) for your platform:

| Platform | File |
|----------|------|
| macOS ARM | `tana-mcp-codemode-darwin-arm64` |
| macOS Intel | `tana-mcp-codemode-darwin-x64` |
| Linux x64 | `tana-mcp-codemode-linux-x64` |
| Linux ARM | `tana-mcp-codemode-linux-arm64` |
| Windows | `tana-mcp-codemode-windows-x64.exe` |

```bash
chmod +x tana-mcp-codemode-darwin-arm64
./tana-mcp-codemode-darwin-arm64
```

### npm (requires Node.js ≥ 20)

```bash
npm install -g tana-mcp-codemode
# or run without installing:
npx tana-mcp-codemode
```

### From source (requires Bun)

```bash
git clone https://github.com/fabiogaliano/tana-mcp-codemode
cd tana-mcp-codemode
bun install
bun run src/entry-bun.ts
```

## Prerequisites

- [Tana Desktop](https://tana.inc) with **Local API enabled** (Settings → Local API → Enable)
- An API token from Tana (Settings → API → Generate Token)

## MCP Configuration

Add to your MCP client config (e.g. `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "tana": {
      "command": "/path/to/tana-mcp-codemode-darwin-arm64",
      "env": {
        "TANA_API_TOKEN": "your-token-here",
        "MAIN_TANA_WORKSPACE": "My Workspace"
      }
    }
  }
}
```

For npm install, use `"command": "tana-mcp-codemode"`. For source, use `"command": "bun"` with `"args": ["run", "/path/to/src/entry-bun.ts"]`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TANA_API_TOKEN` | (required) | Bearer token from Tana Desktop |
| `TANA_API_URL` | `http://127.0.0.1:8262` | Tana Local API URL |
| `MAIN_TANA_WORKSPACE` | (none) | Default workspace name or ID |
| `TANA_SEARCH_WORKSPACES` | (none) | Comma-separated workspaces for search scope |
| `TANA_TIMEOUT` | `10000` | Request timeout in ms |
| `TANA_HISTORY_PATH` | (platform default) | Custom SQLite history path |

## Usage Examples

Search for nodes:

```typescript
const results = await tana.nodes.search("project ideas", {
  workspaceIds: [tana.workspace.id]
});
console.log(results.map(n => n.name));
```

Import content with tags and fields:

```typescript
await tana.import(tana.workspace.id, `
%%tana%%
- Meeting notes #meeting
  - Date:: [[2024-01-15]]
  - Attendees:: Alice, Bob
  - Summary:: Discussed Q1 roadmap
`);
```

## API Reference

| Namespace | Methods |
|-----------|---------|
| `tana.workspace` | Pre-resolved default workspace |
| `tana.workspaces` | `list()` |
| `tana.nodes` | `search()`, `read()`, `getChildren()`, `edit()`, `move()`, `trash()`, `check()`, `uncheck()`, `open()` |
| `tana.tags` | `listAll()`, `getSchema()`, `create()`, `modify()`, `addField()`, `setCheckbox()` |
| `tana.fields` | `setOption()`, `setContent()`, `getFieldOptions()` |
| `tana.calendar` | `getOrCreate()` |
| `tana.import()` | Import Tana Paste content |
| `tana.health()` | API health check |

## Development

```bash
bun install          # Install deps
bun run start        # Start MCP server
bun run dev          # Dev mode with watch
bun run test         # Run tests
bun run typecheck    # Type check
bun run build        # Build Node.js dist (tsup)
bun run build:binary # Build self-contained binary
bun run debug        # Debug UI at localhost:3333
```

## License

MIT
