/**
 * Explore search API for tag discovery
 *
 * Usage: bun run scripts/explore-search-tags.ts
 *
 * Can we get more tags from search by varying queries/limits?
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

// 1. Basic search with various limits
console.log("=".repeat(60));
console.log("1. search({ hasType: SYS_T01 }) — limit testing");
console.log("=".repeat(60));

for (const limit of [10, 50, 100, 200]) {
  try {
    const tags = await tana.nodes.search(
      { hasType: "SYS_T01" },
      { workspaceIds: [ws.id], limit }
    );
    console.log(`  limit=${limit}: got ${tags.length} tags`);
  } catch (e: any) {
    console.log(`  limit=${limit}: ERROR — ${e.message}`);
  }
}

// No limit at all
const noLimit = await tana.nodes.search(
  { hasType: "SYS_T01" },
  { workspaceIds: [ws.id] }
);
console.log(`  no limit: got ${noLimit.length} tags`);

// 2. Search with text filters — can we get different populations?
console.log("\n" + "=".repeat(60));
console.log("2. search with textContains — different populations?");
console.log("=".repeat(60));

const letters = "abcdefghijklmnopqrstuvwxyz".split("");
const allFoundIds = new Map<string, string>();

for (const letter of letters) {
  const tags = await tana.nodes.search(
    { and: [{ hasType: "SYS_T01" }, { textContains: letter }] },
    { workspaceIds: [ws.id], limit: 100 }
  );
  for (const t of tags) {
    allFoundIds.set(t.id, t.name);
  }
  if (tags.length > 0) {
    console.log(`  "${letter}": ${tags.length} tags (running total: ${allFoundIds.size})`);
  }
}

console.log(`\n  Total unique tags via letter-by-letter search: ${allFoundIds.size}`);

// 3. Compare with tags.list
console.log("\n" + "=".repeat(60));
console.log("3. Coverage comparison");
console.log("=".repeat(60));

const listTags = await tana.tags.list(ws.id, 200);
const listIds = new Set(listTags.map(t => t.id));

const onlyInSearch = [...allFoundIds.keys()].filter(id => !listIds.has(id));
const onlyInList = [...listIds].filter(id => !allFoundIds.has(id));

console.log(`  tags.list(200): ${listTags.length}`);
console.log(`  search (all letters): ${allFoundIds.size}`);

const combined = new Set([...listIds, ...allFoundIds.keys()]);
console.log(`  combined unique: ${combined.size}`);
console.log(`  only in search: ${onlyInSearch.length}`);
console.log(`  only in tags.list: ${onlyInList.length}`);

// 4. Check Extends in search-only tags
console.log("\n" + "=".repeat(60));
console.log("4. Extends in search-only tags");
console.log("=".repeat(60));

let searchOnlyExtends = 0;
for (const id of onlyInSearch) {
  const schema = await tana.tags.getSchema(id);
  if (schema.includes("Extends")) {
    searchOnlyExtends++;
    const name = allFoundIds.get(id);
    const line = schema.split("\n").find(l => l.startsWith("Extends"));
    console.log(`  ${name}: ${line}`);
  }
}
console.log(`\n  Search-only tags with Extends: ${searchOnlyExtends}/${onlyInSearch.length}`);

// 5. Check known ghost tags
console.log("\n" + "=".repeat(60));
console.log("5. Ghost tags — searchable by name?");
console.log("=".repeat(60));

const ghosts = [
  { name: "todo", id: "-v-cYE1F8thz" },
  { name: "task", id: "WZt6T_qPns9I" },
];

for (const g of ghosts) {
  const byName = await tana.nodes.search(
    { and: [{ hasType: "SYS_T01" }, { textContains: g.name }] },
    { workspaceIds: [ws.id], limit: 100 }
  );
  const found = byName.find(t => t.id === g.id);
  console.log(`  "${g.name}" search: ${byName.length} results, exact match: ${found ? "YES" : "NO"}`);
  if (byName.length > 0) {
    for (const t of byName) {
      console.log(`    - ${t.name} (${t.id})${t.id === g.id ? " ← THIS ONE" : ""}`);
    }
  }
}
