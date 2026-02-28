/**
 * Full tag enumeration via Schema node + getChildren pagination
 *
 * Usage: bun run scripts/explore-schema-children.ts
 *
 * Tests whether getChildren on ${wsId}_SCHEMA gives us complete
 * tag coverage with Extends info — bypassing tags.list/search limits.
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

const schemaNodeId = `${ws.id}_SCHEMA`;
console.log(`Workspace: ${ws.name} (${ws.id})`);
console.log(`Schema node: ${schemaNodeId}\n`);

// 1. Paginate all children
console.log("=".repeat(60));
console.log("1. FULL PAGINATION — All Schema children");
console.log("=".repeat(60));

const allTags: { id: string; name: string }[] = [];
let offset = 0;
const pageSize = 200;

while (true) {
  const page = await tana.nodes.getChildren(schemaNodeId, { limit: pageSize, offset });
  allTags.push(...page.children.map((c: any) => ({ id: c.id, name: c.name })));
  console.log(`  offset=${offset}: ${page.children.length} children (total=${page.total}, hasMore=${page.hasMore})`);
  if (!page.hasMore) break;
  offset += pageSize;
}

console.log(`\n  Total tags via Schema pagination: ${allTags.length}`);

// 2. Get schemas for ALL tags and count Extends
console.log("\n" + "=".repeat(60));
console.log("2. EXTENDS ANALYSIS — All tags");
console.log("=".repeat(60));

const withExtends: { name: string; id: string; extends: string }[] = [];
const withoutExtends: string[] = [];
let errors = 0;

for (const t of allTags) {
  try {
    const schema = await tana.tags.getSchema(t.id);
    const line = schema.split("\n").find(l => l.startsWith("Extends"));
    if (line) {
      withExtends.push({ name: t.name, id: t.id, extends: line });
    } else {
      withoutExtends.push(t.name);
    }
  } catch {
    errors++;
  }
}

console.log(`\n  With Extends: ${withExtends.length}/${allTags.length}`);
console.log(`  Without Extends: ${withoutExtends.length}/${allTags.length}`);
console.log(`  Errors: ${errors}`);

console.log("\n  All inheritance relationships:");
for (const t of withExtends) {
  console.log(`    ${t.name} (${t.id}): ${t.extends}`);
}

// 3. Compare coverage vs tags.list(200)
console.log("\n" + "=".repeat(60));
console.log("3. COVERAGE COMPARISON — Schema children vs tags.list(200)");
console.log("=".repeat(60));

const listTags = await tana.tags.list(ws.id, 200);
const schemaIds = new Set(allTags.map(t => t.id));
const listIds = new Set(listTags.map(t => t.id));

const onlyInSchema = allTags.filter(t => !listIds.has(t.id));
const onlyInList = listTags.filter(t => !schemaIds.has(t.id));
const extendsInSchemaOnly = withExtends.filter(t => !listIds.has(t.id));

console.log(`\n  Schema children: ${allTags.length}`);
console.log(`  tags.list(200): ${listTags.length}`);
console.log(`  Only in Schema: ${onlyInSchema.length}`);
console.log(`  Only in tags.list: ${onlyInList.length}`);
console.log(`  Extends in Schema-only tags: ${extendsInSchemaOnly.length}`);

if (extendsInSchemaOnly.length > 0) {
  console.log("\n  Inheritance relationships MISSED by tags.list(200):");
  for (const t of extendsInSchemaOnly) {
    console.log(`    ${t.name}: ${t.extends}`);
  }
}

// 4. Ghost tags check
console.log("\n" + "=".repeat(60));
console.log("4. GHOST TAGS — Previously unreachable");
console.log("=".repeat(60));

const ghosts = [
  { name: "todo", id: "-v-cYE1F8thz" },
  { name: "task", id: "WZt6T_qPns9I" },
];

for (const g of ghosts) {
  const inSchema = schemaIds.has(g.id);
  const inList = listIds.has(g.id);
  console.log(`  ${g.name} (${g.id}): schema=${inSchema}, tags.list=${inList}`);
}

// 5. Timing comparison
console.log("\n" + "=".repeat(60));
console.log("5. TIMING — Schema pagination vs tags.list");
console.log("=".repeat(60));

const t1 = performance.now();
await tana.tags.list(ws.id, 200);
const listTime = performance.now() - t1;

const t2 = performance.now();
let off = 0;
while (true) {
  const page = await tana.nodes.getChildren(schemaNodeId, { limit: 200, offset: off });
  if (!page.hasMore) break;
  off += 200;
}
const schemaTime = performance.now() - t2;

console.log(`\n  tags.list(200): ${listTime.toFixed(0)}ms for 200 tags`);
console.log(`  Schema pagination: ${schemaTime.toFixed(0)}ms for ${allTags.length} tags`);
