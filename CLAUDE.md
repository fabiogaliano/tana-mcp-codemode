# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

Codemode MCP server for Tana knowledge management. AI writes TypeScript code that executes against the Tana Local API.

- **Package**: `@tana/mcp-codemode`
- **License**: MIT
- **Runtime**: Bun (not Node.js)

## Quick Reference

```bash
bun install          # Install deps
bun run start        # Start MCP server
bun run dev          # Dev mode with watch
bun run typecheck    # Type check
bun run generate     # Regenerate API types from OpenAPI spec
bun run debug        # Start debug UI server
```

## Architecture

Single `execute` tool - AI writes TypeScript code that runs in a sandbox with injected `tana` object.

```
src/
├── index.ts              # MCP server entry point
├── prompts.ts            # Tool description markdown
├── types.ts              # TypeScript interfaces
├── api/
│   ├── client.ts         # HTTP client (auth, retry, timeout)
│   ├── tana.ts           # API wrapper → `tana` object
│   └── types.ts          # API type definitions
├── sandbox/
│   ├── executor.ts       # Code execution + timeout
│   └── workflow.ts       # Progress tracking
├── storage/
│   └── history.ts        # SQLite script history
└── generated/
    └── api.d.ts          # Generated OpenAPI types
```

### How It Works

1. AI sends TypeScript code to the `execute` tool
2. `sandbox/executor.ts` creates AsyncFunction for top-level await
3. Code executes with injected `tana` object (from `api/tana.ts`)
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
| `tana.workspace` | Pre-resolved default workspace (from env) or null |
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
| `TANA_HISTORY_PATH` | (platform default) | Custom SQLite history path |
| `MAIN_TANA_WORKSPACE` | (none) | Default workspace name or ID, resolved at startup |

## History Database

Script runs are persisted to SQLite at platform-specific paths:

- **macOS**: `~/Library/Application Support/tana-mcp/history.db`
- **Windows**: `%APPDATA%/tana-mcp/history.db`
- **Linux**: `~/.local/share/tana-mcp/history.db`

Old runs (>30 days) are automatically cleaned up on startup.

## Adding New API Methods

1. Add method to appropriate namespace in `src/api/tana.ts`
2. Add types to `src/api/types.ts` (interfaces, options)
3. Update `TOOL_DESCRIPTION` in `src/prompts.ts` with examples
4. Run `bun run typecheck` to verify types
