/**
 * Find exact search limit
 *
 * Usage: bun run scripts/explore-search-limit.ts
 */

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { TanaClient } from "../src/api/client";
import { createTanaAPI } from "../src/api/tana";

const mcpPath = join(homedir(), ".mcp.json");
const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
const server = mcp.mcpServers?.["tana-mcp-f"];
const client = new TanaClient({
  baseUrl: "http://127.0.0.1:8262",
  token: server.env.TANA_API_TOKEN,
  timeout: 10000,
});

const workspaces = await client.get<{ id: string; name: string }[]>("/workspaces");
const ws = workspaces.find((w: any) => w.name === server.env.MAIN_TANA_WORKSPACE) || workspaces[0];
const tana = createTanaAPI(client, ws as any);

console.log(`Workspace: ${ws.name} (${ws.id})\n`);

// Binary search for the exact limit
console.log("--- Finding exact search limit ---");
let low = 100;
let high = 200;

while (low < high) {
  const mid = Math.floor((low + high + 1) / 2);
  try {
    const tags = await tana.nodes.search(
      { hasType: "SYS_T01" },
      { workspaceIds: [ws.id], limit: mid }
    );
    console.log(`  limit=${mid}: OK (got ${tags.length})`);
    low = mid;
  } catch {
    console.log(`  limit=${mid}: REJECTED`);
    high = mid - 1;
  }
}

console.log(`\nExact search limit: ${low}`);

// Also test tags.list limit
console.log("\n--- Finding exact tags.list limit ---");
low = 200;
high = 300;

while (low < high) {
  const mid = Math.floor((low + high + 1) / 2);
  try {
    const tags = await tana.tags.list(ws.id, mid);
    console.log(`  limit=${mid}: OK (got ${tags.length})`);
    low = mid;
  } catch {
    console.log(`  limit=${mid}: REJECTED`);
    high = mid - 1;
  }
}

console.log(`\nExact tags.list limit: ${low}`);
