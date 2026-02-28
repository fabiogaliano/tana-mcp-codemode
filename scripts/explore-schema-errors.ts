/**
 * Investigate getSchema errors on Schema node children
 *
 * Usage: bun run scripts/explore-schema-errors.ts
 *
 * The Schema node (${workspaceId}_SCHEMA) contains all tag definitions.
 * Some children fail when calling tags.getSchema(). This script identifies
 * what those failing children are (system nodes, deleted tags, etc.)
 * and whether we need to filter them out.
 */

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { TanaClient } from "../src/api/client";
import { createTanaAPI } from "../src/api/tana";
import type { ChildNode } from "../src/api/types";

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

// 1. Paginate ALL children of the Schema node
const schemaNodeId = `${ws.id}_SCHEMA`;
console.log(`Schema node: ${schemaNodeId}`);
console.log("Paginating all children...\n");

let allChildren: ChildNode[] = [];
let offset = 0;
const PAGE_SIZE = 200;

while (true) {
  const page = await tana.nodes.getChildren(schemaNodeId, { limit: PAGE_SIZE, offset });
  allChildren = allChildren.concat(page.children);
  console.log(`  Page offset=${offset}: ${page.children.length} children (total=${page.total}, hasMore=${page.hasMore})`);
  if (!page.hasMore) break;
  offset += PAGE_SIZE;
}

console.log(`\nTotal Schema children: ${allChildren.length}\n`);

// 2. Try getSchema on each child, collect errors
interface ErrorEntry {
  child: ChildNode;
  errorMessage: string;
}

const errors: ErrorEntry[] = [];
let successCount = 0;

for (const child of allChildren) {
  try {
    await tana.tags.getSchema(child.id);
    successCount++;
  } catch (e: any) {
    errors.push({ child, errorMessage: e.message });
  }
}

console.log("=== SUMMARY ===");
console.log(`  Total children:  ${allChildren.length}`);
console.log(`  getSchema OK:    ${successCount}`);
console.log(`  getSchema ERROR: ${errors.length}`);
console.log();

// 3. Error breakdown by docType
console.log("=== ERRORS BY docType ===");
const byDocType = new Map<string, number>();
for (const e of errors) {
  const dt = e.child.docType || "(empty)";
  byDocType.set(dt, (byDocType.get(dt) || 0) + 1);
}
for (const [dt, count] of [...byDocType.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${dt}: ${count}`);
}
console.log();

// 4. Error breakdown by inTrash
console.log("=== ERRORS BY inTrash ===");
const trashedErrors = errors.filter(e => e.child.inTrash).length;
const notTrashedErrors = errors.length - trashedErrors;
console.log(`  inTrash=true:  ${trashedErrors}`);
console.log(`  inTrash=false: ${notTrashedErrors}`);
console.log();

// For comparison: how many successful ones are in trash?
const allTrashed = allChildren.filter(c => c.inTrash).length;
console.log(`  (For reference: ${allTrashed}/${allChildren.length} total children are inTrash)`);
console.log();

// 5. Error breakdown by childCount
console.log("=== ERRORS BY childCount ===");
const byChildCount = new Map<number, number>();
for (const e of errors) {
  const cc = e.child.childCount;
  byChildCount.set(cc, (byChildCount.get(cc) || 0) + 1);
}
for (const [cc, count] of [...byChildCount.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  childCount=${cc}: ${count}`);
}
console.log();

// 6. Error breakdown by tagIds presence
console.log("=== ERRORS BY tagIds ===");
const withTagIds = errors.filter(e => e.child.tagIds && e.child.tagIds.length > 0).length;
const withoutTagIds = errors.length - withTagIds;
console.log(`  Has tagIds:  ${withTagIds}`);
console.log(`  No tagIds:   ${withoutTagIds}`);
if (withTagIds > 0) {
  const tagIdFreq = new Map<string, number>();
  for (const e of errors) {
    for (const tid of e.child.tagIds || []) {
      tagIdFreq.set(tid, (tagIdFreq.get(tid) || 0) + 1);
    }
  }
  console.log("  Tag ID frequency among errors:");
  for (const [tid, count] of [...tagIdFreq.entries()].sort((a, b) => b[1] - a[1])) {
    const tagName = errors.find(e => e.child.tags?.some(t => t.id === tid))?.child.tags?.find(t => t.id === tid)?.name || "?";
    console.log(`    ${tid} (${tagName}): ${count}`);
  }
}
console.log();

// 7. Name pattern analysis
console.log("=== NAME PATTERNS IN ERRORS ===");
const emptyNames = errors.filter(e => !e.child.name || e.child.name.trim() === "").length;
console.log(`  Empty/blank names: ${emptyNames}`);

const nameFreq = new Map<string, number>();
for (const e of errors) {
  const name = e.child.name || "(empty)";
  nameFreq.set(name, (nameFreq.get(name) || 0) + 1);
}
if (nameFreq.size <= 20) {
  console.log("  All error names:");
  for (const [name, count] of [...nameFreq.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    "${name}": ${count}`);
  }
} else {
  console.log(`  Unique names: ${nameFreq.size} (showing top 20)`);
  for (const [name, count] of [...nameFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`    "${name}": ${count}`);
  }
}
console.log();

// 8. Error message patterns
console.log("=== ERROR MESSAGE PATTERNS ===");
const msgFreq = new Map<string, number>();
for (const e of errors) {
  msgFreq.set(e.errorMessage, (msgFreq.get(e.errorMessage) || 0) + 1);
}
for (const [msg, count] of [...msgFreq.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  [${count}x] ${msg}`);
}
console.log();

// 9. Show 10 example error children with full shape
console.log("=== EXAMPLE ERROR CHILDREN (up to 10) ===");
for (const entry of errors.slice(0, 10)) {
  const c = entry.child;
  console.log(`  ---`);
  console.log(`  id:          ${c.id}`);
  console.log(`  name:        "${c.name}"`);
  console.log(`  docType:     ${c.docType}`);
  console.log(`  childCount:  ${c.childCount}`);
  console.log(`  inTrash:     ${c.inTrash}`);
  console.log(`  created:     ${c.created}`);
  console.log(`  description: ${c.description ?? "(none)"}`);
  console.log(`  tagIds:      ${JSON.stringify(c.tagIds)}`);
  console.log(`  tags:        ${JSON.stringify(c.tags)}`);
  console.log(`  error:       ${entry.errorMessage}`);
}
console.log();

// 10. Compare docType distribution: errors vs successes
console.log("=== docType DISTRIBUTION: ALL CHILDREN ===");
const allByDocType = new Map<string, number>();
for (const c of allChildren) {
  const dt = c.docType || "(empty)";
  allByDocType.set(dt, (allByDocType.get(dt) || 0) + 1);
}
for (const [dt, count] of [...allByDocType.entries()].sort((a, b) => b[1] - a[1])) {
  const errorCount = byDocType.get(dt) || 0;
  console.log(`  ${dt}: ${count} total, ${errorCount} errors (${((errorCount / count) * 100).toFixed(0)}% fail rate)`);
}
