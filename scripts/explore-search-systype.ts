/**
 * Test search({ hasType: "SYS_T01" }) behavior
 *
 * Usage: bun run scripts/explore-search-systype.ts
 *
 * Can models find a specific tag (e.g. "person") via search with hasType SYS_T01?
 * Or is tags.listAll the only reliable way?
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

// 1. Search for a specific tag by name + SYS_T01
console.log("=".repeat(60));
console.log('1. search({ hasType: "SYS_T01", textContains: "person" })');
console.log("=".repeat(60));

const personSearch = await tana.nodes.search(
  { and: [{ hasType: "SYS_T01" }, { textContains: "person" }] },
  { workspaceIds: [ws.id] }
);
console.log(`Results: ${personSearch.length}`);
for (const r of personSearch) {
  console.log(`  ${r.name} (${r.id}) — docType: ${r.docType}`);
}

// 2. Try other tags
console.log("\n" + "=".repeat(60));
console.log('2. search({ hasType: "SYS_T01", textContains: "todo" })');
console.log("=".repeat(60));

const todoSearch = await tana.nodes.search(
  { and: [{ hasType: "SYS_T01" }, { textContains: "todo" }] },
  { workspaceIds: [ws.id] }
);
console.log(`Results: ${todoSearch.length}`);
for (const r of todoSearch) {
  console.log(`  ${r.name} (${r.id}) — docType: ${r.docType}`);
}

// 3. Try "action"
console.log("\n" + "=".repeat(60));
console.log('3. search({ hasType: "SYS_T01", textContains: "action" })');
console.log("=".repeat(60));

const actionSearch = await tana.nodes.search(
  { and: [{ hasType: "SYS_T01" }, { textContains: "action" }] },
  { workspaceIds: [ws.id] }
);
console.log(`Results: ${actionSearch.length}`);
for (const r of actionSearch) {
  console.log(`  ${r.name} (${r.id}) — docType: ${r.docType}`);
}

// 4. Try "movie" — known to exist, has inheritance
console.log("\n" + "=".repeat(60));
console.log('4. search({ hasType: "SYS_T01", textContains: "movie" })');
console.log("=".repeat(60));

const movieSearch = await tana.nodes.search(
  { and: [{ hasType: "SYS_T01" }, { textContains: "movie" }] },
  { workspaceIds: [ws.id] }
);
console.log(`Results: ${movieSearch.length}`);
for (const r of movieSearch) {
  console.log(`  ${r.name} (${r.id}) — docType: ${r.docType}`);
}

// 5. Compare: does listAll find them?
console.log("\n" + "=".repeat(60));
console.log("5. COMPARISON — listAll vs search for these tags");
console.log("=".repeat(60));

const allTags = await tana.tags.listAll(ws.id);
const tagsByName = new Map(allTags.map((t) => [t.name.toLowerCase(), t]));

for (const name of ["person", "todo", "action", "movie"]) {
  const inList = tagsByName.get(name);
  const inSearch = await tana.nodes.search(
    { and: [{ hasType: "SYS_T01" }, { textContains: name }] },
    { workspaceIds: [ws.id] }
  );
  const exactMatch = inSearch.find((r) => r.name.toLowerCase() === name);
  console.log(`  ${name}: listAll=${inList ? "YES" : "NO"}, search=${exactMatch ? "YES" : "NO"}${exactMatch ? "" : ` (${inSearch.length} partial matches)`}`);
}
