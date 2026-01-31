/**
 * Workflow Event Logging
 *
 * Tracks execution progress through multi-step operations.
 * Provides timeline view instead of flat pass/fail history.
 *
 * Usage in scripts:
 *   workflow.start("Processing nodes");
 *   workflow.step("Fetching workspaces");
 *   workflow.step("Found 3 workspaces");
 *   workflow.complete("Done!");
 */

import { Database } from "bun:sqlite";
import { initDb } from "../storage/history";

export type WorkflowEventType =
  | "start"
  | "step"
  | "progress"
  | "complete"
  | "abort";

export interface WorkflowEvent {
  id: number;
  sessionId: string;
  timestamp: number;
  eventType: WorkflowEventType;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface WorkflowHelper {
  /** Start a new workflow with description */
  start(message: string): void;
  /** Log an intermediate step */
  step(message: string): void;
  /** Log progress (e.g., "25/100 processed") */
  progress(current: number, total: number, message?: string): void;
  /** Mark workflow as successfully completed */
  complete(message?: string): void;
  /** Mark workflow as aborted/failed */
  abort(reason: string): void;
}

let workflowTableInitialized = false;

function ensureWorkflowTable(db: Database): void {
  if (workflowTableInitialized) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS workflow_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_workflow_session
    ON workflow_events(session_id, timestamp)
  `);

  workflowTableInitialized = true;
}

function saveWorkflowEvent(
  sessionId: string,
  eventType: WorkflowEventType,
  message: string,
  metadata?: Record<string, unknown>
): void {
  try {
    const db = initDb();
    ensureWorkflowTable(db);

    const stmt = db.prepare(`
      INSERT INTO workflow_events (session_id, timestamp, event_type, message, metadata)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      sessionId,
      Date.now(),
      eventType,
      message,
      metadata ? JSON.stringify(metadata) : null
    );
  } catch (e) {
    // Fire-and-forget - don't disrupt execution
    console.error("Failed to save workflow event:", e);
  }
}

export function createWorkflowHelper(sessionId: string): WorkflowHelper {
  return {
    start(message: string): void {
      saveWorkflowEvent(sessionId, "start", message);
    },

    step(message: string): void {
      saveWorkflowEvent(sessionId, "step", message);
    },

    progress(current: number, total: number, message?: string): void {
      const progressMsg = message
        ? `${message} (${current}/${total})`
        : `${current}/${total}`;
      saveWorkflowEvent(sessionId, "progress", progressMsg, { current, total });
    },

    complete(message?: string): void {
      saveWorkflowEvent(sessionId, "complete", message ?? "Completed");
    },

    abort(reason: string): void {
      saveWorkflowEvent(sessionId, "abort", reason);
    },
  };
}

export function getWorkflowEvents(
  sessionId: string,
  limit = 100
): WorkflowEvent[] {
  try {
    const db = initDb();
    ensureWorkflowTable(db);

    const stmt = db.prepare(`
      SELECT
        id,
        session_id as sessionId,
        timestamp,
        event_type as eventType,
        message,
        metadata
      FROM workflow_events
      WHERE session_id = ?
      ORDER BY timestamp ASC
      LIMIT ?
    `);

    const rows = stmt.all(sessionId, limit) as Array<{
      id: number;
      sessionId: string;
      timestamp: number;
      eventType: WorkflowEventType;
      message: string;
      metadata: string | null;
    }>;

    return rows.map((row) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  } catch {
    return [];
  }
}

export function getRecentWorkflows(limit = 20): Array<{
  sessionId: string;
  startTime: number;
  eventCount: number;
  lastEvent: string;
}> {
  try {
    const db = initDb();
    ensureWorkflowTable(db);

    const stmt = db.prepare(`
      SELECT
        session_id as sessionId,
        MIN(timestamp) as startTime,
        COUNT(*) as eventCount,
        (SELECT message FROM workflow_events w2
         WHERE w2.session_id = workflow_events.session_id
         ORDER BY timestamp DESC LIMIT 1) as lastEvent
      FROM workflow_events
      GROUP BY session_id
      ORDER BY startTime DESC
      LIMIT ?
    `);

    return stmt.all(limit) as Array<{
      sessionId: string;
      startTime: number;
      eventCount: number;
      lastEvent: string;
    }>;
  } catch {
    return [];
  }
}
