/**
 * Script History - SQLite Storage
 *
 * Persists executed scripts for debugging and replay.
 * Uses bun:sqlite (built-in, no external dependency).
 * Fire-and-forget saves to avoid blocking execution.
 *
 * Configure database location via TANA_HISTORY_PATH env var.
 */

import { Database } from "bun:sqlite";
import { homedir } from "os";
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import type { ScriptRun } from "../types";

let db: Database | null = null;

function getDbPath(): string {
  // Allow custom path via env var
  if (process.env.TANA_HISTORY_PATH) {
    const customPath = process.env.TANA_HISTORY_PATH;
    const dir = dirname(customPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return customPath;
  }

  // Default platform-specific paths
  const platform = process.platform;
  let baseDir: string;

  if (platform === "darwin") {
    baseDir = join(homedir(), "Library", "Application Support", "tana-mcp");
  } else if (platform === "win32") {
    baseDir = join(process.env.APPDATA || homedir(), "tana-mcp");
  } else {
    baseDir = join(homedir(), ".local", "share", "tana-mcp");
  }

  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }

  return join(baseDir, "history.db");
}

function migrateDb(database: Database): void {
  // Get existing columns
  const columns = database
    .prepare("PRAGMA table_info(script_runs)")
    .all() as { name: string }[];
  const columnNames = new Set(columns.map((c) => c.name));

  // Add missing columns (SQLite doesn't support multiple ADD COLUMN in one statement)
  const newColumns = [
    { name: "input", type: "TEXT" },
    { name: "api_calls", type: "TEXT" },
    { name: "node_ids_affected", type: "TEXT" },
    { name: "workspace_id", type: "TEXT" },
  ];

  for (const col of newColumns) {
    if (!columnNames.has(col.name)) {
      database.run(`ALTER TABLE script_runs ADD COLUMN ${col.name} ${col.type}`);
    }
  }
}

export function initDb(): Database {
  if (db) return db;

  const dbPath = getDbPath();
  db = new Database(dbPath, { create: true });

  db.run(`
    CREATE TABLE IF NOT EXISTS script_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      script TEXT NOT NULL,
      success INTEGER NOT NULL,
      output TEXT NOT NULL,
      error TEXT,
      duration_ms INTEGER NOT NULL,
      session_id TEXT,
      input TEXT,
      api_calls TEXT,
      node_ids_affected TEXT,
      workspace_id TEXT
    )
  `);

  // Migrate existing databases
  migrateDb(db);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_script_runs_timestamp
    ON script_runs(timestamp DESC)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_script_runs_session
    ON script_runs(session_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_script_runs_workspace
    ON script_runs(workspace_id)
  `);

  return db;
}

export interface SaveScriptRunOptions {
  script: string;
  success: boolean;
  output: string;
  error: string | null;
  durationMs: number;
  sessionId: string | null;
  input?: string | null;
  apiCalls?: string[] | null;
  nodeIdsAffected?: string[] | null;
  workspaceId?: string | null;
}

export function saveScriptRun(options: SaveScriptRunOptions): void {
  // Fire-and-forget: don't await, don't block
  try {
    const database = initDb();
    const stmt = database.prepare(`
      INSERT INTO script_runs (
        timestamp, script, success, output, error, duration_ms, session_id,
        input, api_calls, node_ids_affected, workspace_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      Date.now(),
      options.script,
      options.success ? 1 : 0,
      options.output,
      options.error,
      options.durationMs,
      options.sessionId,
      options.input ?? null,
      options.apiCalls ? JSON.stringify(options.apiCalls) : null,
      options.nodeIdsAffected ? JSON.stringify(options.nodeIdsAffected) : null,
      options.workspaceId ?? null
    );
  } catch (e) {
    // Silently ignore history save errors - don't disrupt the main flow
    console.error("Failed to save script run to history:", e);
  }
}

export function getRecentRuns(limit = 50, sessionId?: string): ScriptRun[] {
  const database = initDb();

  const baseQuery = `
    SELECT
      id, timestamp, script, success, output, error,
      duration_ms as durationMs, session_id as sessionId,
      input, api_calls as apiCalls, node_ids_affected as nodeIdsAffected,
      workspace_id as workspaceId
    FROM script_runs
  `;

  if (sessionId) {
    const stmt = database.prepare(`
      ${baseQuery}
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(sessionId, limit) as ScriptRun[];
  }

  const stmt = database.prepare(`
    ${baseQuery}
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(limit) as ScriptRun[];
}

export function cleanupOldRuns(daysOld = 30): number {
  const database = initDb();
  const cutoff = Date.now() - daysOld * 24 * 60 * 60 * 1000;

  const stmt = database.prepare(`
    DELETE FROM script_runs WHERE timestamp < ?
  `);
  const result = stmt.run(cutoff);
  return result.changes;
}

/** Get the current database path (for debugging) */
export function getDbLocation(): string {
  return getDbPath();
}
