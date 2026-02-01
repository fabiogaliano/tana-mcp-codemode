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
import { executeSandbox } from "./sandbox/executor";
import { cleanupOldRuns, initDb } from "./storage/history";
import { TOOL_DESCRIPTION } from "./prompts";

async function main() {
  initDb();
  const cleaned = cleanupOldRuns(30);
  if (cleaned > 0) {
    console.error(`Cleaned up ${cleaned} old script runs`);
  }

  const client = createClient();
  const tana = createTanaAPI(client);

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
