/**
 * Explore tag coverage across both APIs
 *
 * Usage: bun run scripts/explore-tags-coverage.ts
 *
 * How many unique tags can we get by combining tags.list + search?
 * What's the actual ceiling?
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

// 1. tags.list at various limits
console.log("--- tags.list at various limits ---");
for (const limit of [50, 100, 200]) {
  const tags = await tana.tags.list(ws.id, limit);
  console.log(`  limit=${limit}: got ${tags.length} tags`);
}

// 2. search({ hasType: "SYS_T01" }) — what's the max?
console.log("\n--- search for tags ---");
const searchTags = await tana.nodes.search(
  { hasType: "SYS_T01" },
  { workspaceIds: [ws.id] }
);
console.log(`  search (no limit): ${searchTags.length} tags`);

const searchTagsLimited = await tana.nodes.search(
  { hasType: "SYS_T01" },
  { workspaceIds: [ws.id], limit: 100 }
);
console.log(`  search (limit=100): ${searchTagsLimited.length} tags`);

// 3. Combine both at max limits
console.log("\n--- Combined coverage ---");
const list200 = await tana.tags.list(ws.id, 200);
const searchAll = await tana.nodes.search(
  { hasType: "SYS_T01" },
  { workspaceIds: [ws.id] }
);

const allIds = new Map<string, string>();
for (const t of list200) allIds.set(t.id, t.name);
const listOnlyCount = allIds.size;
for (const t of searchAll) allIds.set(t.id, t.name);

console.log(`  tags.list(200): ${list200.length} unique`);
console.log(`  search: ${searchAll.length} unique`);
console.log(`  combined (deduplicated): ${allIds.size} unique`);
console.log(`  search added ${allIds.size - listOnlyCount} new tags not in tags.list`);

// 4. How many of the combined set have Extends?
console.log("\n--- Extends coverage in combined set ---");
let extendsCount = 0;
let extendsInListOnly = 0;
let extendsInSearchOnly = 0;

const listIds = new Set(list200.map(t => t.id));
const searchIds = new Set(searchAll.map(t => t.id));

for (const [id, name] of allIds) {
  const schema = await tana.tags.getSchema(id);
  if (schema.includes("Extends")) {
    extendsCount++;
    if (listIds.has(id) && !searchIds.has(id)) extendsInListOnly++;
    if (!listIds.has(id) && searchIds.has(id)) extendsInSearchOnly++;
  }
}

console.log(`  Total with Extends: ${extendsCount}/${allIds.size}`);
console.log(`  Extends only in tags.list: ${extendsInListOnly}`);
console.log(`  Extends only in search: ${extendsInSearchOnly}`);

// 5. Are there tags we KNOW exist but aren't in either?
console.log("\n--- Known missing tags ---");
const knownTags = [
  { name: "todo", id: "-v-cYE1F8thz" },
  { name: "task", id: "WZt6T_qPns9I" },
];
for (const t of knownTags) {
  const inList = listIds.has(t.id);
  const inSearch = searchIds.has(t.id);
  const schema = await tana.tags.getSchema(t.id);
  const hasExtends = schema.includes("Extends");
  console.log(`  ${t.name} (${t.id}): list=${inList}, search=${inSearch}, extends=${hasExtends}`);
}
console.log("\n  These tags exist and have inheritance but appear in NEITHER API.");
console.log("  They're only accessible if you already know their ID.");
