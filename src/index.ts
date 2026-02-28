#!/usr/bin/env bun
/**
 * Tana MCP Server - Entry Point
 *
 * Codemode MCP server for Tana knowledge management.
 * AI writes TypeScript code that executes against the Tana Local API.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createClient } from "./api/client";
import { createTanaAPI } from "./api/tana";
import type { TanaClient } from "./api/client";
import type { Workspace } from "./api/types";
import { executeSandbox } from "./sandbox/executor";
import { cleanupOldRuns, initDb } from "./storage/history";
import { TOOL_DESCRIPTION } from "./prompts";

/**
 * Resolves the default workspace from MAIN_TANA_WORKSPACE env var.
 * Matches by ID first, then case-insensitive name.
 * Returns null if unset, unmatched, or API unreachable.
 */
async function resolveWorkspace(client: TanaClient): Promise<Workspace | null> {
  const envValue = process.env.MAIN_TANA_WORKSPACE?.trim();
  if (!envValue) return null;

  let workspaces: Workspace[];
  try {
    workspaces = await client.get<Workspace[]>("/workspaces");
  } catch (err) {
    console.error(
      `[workspace] Failed to fetch workspaces: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }

  const byId = workspaces.find((w) => w.id === envValue);
  if (byId) {
    console.error(`[workspace] Resolved "${envValue}" → ${byId.name} (${byId.id})`);
    return byId;
  }

  const lowerEnv = envValue.toLowerCase();
  const byName = workspaces.find((w) => w.name.toLowerCase() === lowerEnv);
  if (byName) {
    console.error(`[workspace] Resolved "${envValue}" → ${byName.name} (${byName.id})`);
    return byName;
  }

  const available = workspaces.map((w) => `${w.name} (${w.id})`).join(", ");
  console.error(
    `[workspace] No match for "${envValue}". Available: ${available || "none"}`
  );
  return null;
}

/**
 * Resolves TANA_SEARCH_WORKSPACES env var to an array of workspace IDs.
 * Each value can be an ID or case-insensitive name.
 * Unresolved values are logged and skipped.
 */
async function resolveSearchWorkspaces(client: TanaClient): Promise<string[]> {
  const envValue = process.env.TANA_SEARCH_WORKSPACES?.trim();
  if (!envValue) return [];

  const values = envValue.split(",").map((v) => v.trim()).filter(Boolean);
  if (values.length === 0) return [];

  let workspaces: Workspace[];
  try {
    workspaces = await client.get<Workspace[]>("/workspaces");
  } catch (err) {
    console.error(
      `[search-workspaces] Failed to fetch workspaces: ${err instanceof Error ? err.message : err}`
    );
    return [];
  }

  const resolvedIds: string[] = [];
  for (const value of values) {
    const byId = workspaces.find((w) => w.id === value);
    if (byId) {
      resolvedIds.push(byId.id);
      console.error(`[search-workspaces] Resolved "${value}" → ${byId.name} (${byId.id})`);
      continue;
    }
    const lowerValue = value.toLowerCase();
    const byName = workspaces.find((w) => w.name.toLowerCase() === lowerValue);
    if (byName) {
      resolvedIds.push(byName.id);
      console.error(`[search-workspaces] Resolved "${value}" → ${byName.name} (${byName.id})`);
      continue;
    }
    const available = workspaces.map((w) => `${w.name} (${w.id})`).join(", ");
    console.error(
      `[search-workspaces] No match for "${value}". Available: ${available || "none"}`
    );
  }

  return resolvedIds;
}

async function main() {
  initDb();
  const cleaned = cleanupOldRuns(30);
  if (cleaned > 0) {
    console.error(`Cleaned up ${cleaned} old script runs`);
  }

  const client = createClient();
  const workspace = await resolveWorkspace(client);
  const searchWorkspaceIds = await resolveSearchWorkspaces(client);
  const tana = createTanaAPI(client, workspace, searchWorkspaceIds);

  const server = new McpServer({
    name: "tana-mcp-codemode",
    version: "0.1.0",
  });

  server.registerTool(
    "execute",
    {
      description: TOOL_DESCRIPTION,
      inputSchema: {
        code: z.string().describe("TypeScript code to execute"),
        sessionId: z
          .string()
          .optional()
          .describe("Optional session ID for grouping script runs"),
      },
    },
    async ({ code, sessionId }) => {
      const result = await executeSandbox(code, tana, sessionId);

      let responseText = "";
      if (result.output) {
        responseText += result.output;
      }
      if (result.error) {
        responseText += responseText ? "\n\n" : "";
        responseText += `Error: ${result.error}`;
      }
      responseText += `\n\n[Executed in ${result.durationMs}ms]`;

      return {
        content: [
          {
            type: "text" as const,
            text: responseText,
          },
        ],
        isError: !result.success,
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Tana MCP server started");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
