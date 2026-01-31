# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

Codemode MCP server for Tana knowledge management. AI writes TypeScript code that executes against the Tana Local API.

- **Package**: `@tana/mcp-codemode`
- **License**: MIT
- **Runtime**: Bun (not Node.js)

## Quick Reference

```bash
# Run
TANA_API_TOKEN=xxx bun run src/index.ts   # Start MCP server

# Dev
bun install                                # Install deps
TANA_API_TOKEN=xxx bun run --watch src/index.ts  # Dev mode

# Quality
bunx tsc --noEmit                          # Type check
```

## Architecture

Single `execute` tool - AI writes TypeScript code that runs in a sandbox with injected `tana` object.

```
src/
├── index.ts        # MCP server entry point
├── tana-client.ts  # HTTP client (Bearer auth, abort/timeout)
├── tana-api.ts     # API wrapper → `tana` object
├── sandbox.ts      # Code execution + timeout + duration
├── history.ts      # SQLite script history
├── types.ts        # TypeScript interfaces
└── prompts.ts      # Tool description markdown
```

### How It Works

1. AI sends TypeScript code to the `execute` tool
2. `sandbox.ts` creates AsyncFunction for top-level await support
3. Code executes with injected `tana` object (from `tana-api.ts`)
4. 10s timeout via Promise.race protects against infinite loops
5. `console.log()` output is captured and returned to AI
6. Script run is saved to SQLite history (fire-and-forget)

### Key Features

- **Codemode Pattern**: AI writes code, not structured API calls
- **Top-level Await**: `await tana.workspaces.list()` works directly
- **Timeout Protection**: 10s max execution time
- **Duration Tracking**: Every result includes `durationMs`
- **Script History**: SQLite persistence for debugging/replay

## API Namespaces

| Namespace | Purpose |
|-----------|---------|
| `tana.workspaces` | List available workspaces |
| `tana.nodes` | Search, read, edit, trash, check/uncheck |
| `tana.tags` | List, schema, create, modify, add fields |
| `tana.fields` | Set option or content values |
| `tana.calendar` | Get/create calendar nodes |
| `tana.import()` | Import Tana Paste content |
| `tana.health()` | API health check |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TANA_API_URL` | `http://127.0.0.1:8262` | Tana Local API URL |
| `TANA_API_TOKEN` | (required) | Bearer token from Tana Desktop |
| `TANA_TIMEOUT` | `10000` | Request timeout (ms) |

## History Database

Script runs are persisted to SQLite at platform-specific paths:

- **macOS**: `~/Library/Application Support/tana-mcp/history.db`
- **Windows**: `%APPDATA%/tana-mcp/history.db`
- **Linux**: `~/.local/share/tana-mcp/history.db`

Old runs (>30 days) are automatically cleaned up on startup.

## Adding New API Methods

1. Add method to appropriate namespace in `src/tana-api.ts`
2. Add types to `src/types.ts` (interfaces, options)
3. Update `TOOL_DESCRIPTION` in `src/prompts.ts` with examples
4. Run `bunx tsc --noEmit` to verify types
