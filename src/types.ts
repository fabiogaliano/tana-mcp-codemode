/**
 * Internal Types (not from Tana API)
 *
 * These are types specific to the MCP server implementation,
 * not derived from the Tana Local API OpenAPI spec.
 *
 * For API types, see ./api-types.ts (generated from api-1.json)
 */

/** Result of sandbox code execution */
export interface SandboxResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

/** Record of a script execution in history */
export interface ScriptRun {
  id: number;
  timestamp: number;
  script: string;
  success: boolean;
  output: string;
  error: string | null;
  durationMs: number;
  sessionId: string | null;
  input: string | null;
  apiCalls: string | null; // JSON array of method names called
  nodeIdsAffected: string | null; // JSON array of node IDs
  workspaceId: string | null;
}
