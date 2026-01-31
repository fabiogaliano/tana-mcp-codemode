/**
 * Script History - SQLite Storage
 *
 * Persists executed scripts for debugging and replay.
 * Uses bun:sqlite (built-in, no external dependency).
 * Fire-and-forget saves to avoid blocking execution.
 */

import { Database } from "bun:sqlite";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";
import type { ScriptRun } from "./types";

let db: Database | null = null;

function getDbPath(): string {
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
      session_id TEXT
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_script_runs_timestamp
    ON script_runs(timestamp DESC)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_script_runs_session
    ON script_runs(session_id)
  `);

  return db;
}

export function saveScriptRun(
  script: string,
  success: boolean,
  output: string,
  error: string | null,
  durationMs: number,
  sessionId: string | null
): void {
  // Fire-and-forget: don't await, don't block
  try {
    const database = initDb();
    const stmt = database.prepare(`
      INSERT INTO script_runs (timestamp, script, success, output, error, duration_ms, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      Date.now(),
      script,
      success ? 1 : 0,
      output,
      error,
      durationMs,
      sessionId
    );
  } catch (e) {
    // Silently ignore history save errors - don't disrupt the main flow
    console.error("Failed to save script run to history:", e);
  }
}

export function getRecentRuns(limit = 50, sessionId?: string): ScriptRun[] {
  const database = initDb();

  if (sessionId) {
    const stmt = database.prepare(`
      SELECT id, timestamp, script, success, output, error, duration_ms as durationMs, session_id as sessionId
      FROM script_runs
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(sessionId, limit) as ScriptRun[];
  }

  const stmt = database.prepare(`
    SELECT id, timestamp, script, success, output, error, duration_ms as durationMs, session_id as sessionId
    FROM script_runs
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
