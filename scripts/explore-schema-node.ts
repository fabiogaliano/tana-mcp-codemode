/**
 * Can we discover tags via getChildren on the Schema node?
 *
 * Usage: bun run scripts/explore-schema-node.ts
 *
 * Breadcrumb from search showed: "Root node > Schema > tagname"
 * If tags are children of a Schema node, getChildren has offset pagination.
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

// 1. Find the Schema node — search for a known tag and look at breadcrumb
console.log("--- Finding Schema node via tag breadcrumbs ---");
const tagSearch = await tana.nodes.search(
  { and: [{ hasType: "SYS_T01" }, { textContains: "product" }] },
  { workspaceIds: [ws.id], limit: 5 }
);

for (const t of tagSearch) {
  console.log(`  ${t.name} (${t.id})`);
  console.log(`    breadcrumb: ${JSON.stringify(t.breadcrumb)}`);
}

// 2. Try reading workspace home node children to find Schema
console.log("\n--- Workspace home node children ---");
const wsRead = await tana.nodes.read(ws.id, 1);
console.log(wsRead.substring(0, 500));

// 3. Try the Library/Stash node
const libraryId = `${ws.id}_STASH`;
console.log(`\n--- Library node (${libraryId}) children ---`);
try {
  const libChildren = await tana.nodes.getChildren(libraryId, { limit: 10 });
  console.log(`  total: ${libChildren.total}, hasMore: ${libChildren.hasMore}`);
  for (const c of libChildren.children.slice(0, 5)) {
    console.log(`    ${c.name} (${c.id})`);
  }
} catch (e: any) {
  console.log(`  ERROR: ${e.message}`);
}

// 4. Try known tag IDs as parent nodes — do tags have children?
console.log("\n--- Tag node children (do tags have child structure?) ---");
const knownTagId = "hqAiMhwYF65j"; // product tag
try {
  const tagChildren = await tana.nodes.getChildren(knownTagId, { limit: 10 });
  console.log(`  product tag children: total=${tagChildren.total}, hasMore=${tagChildren.hasMore}`);
  for (const c of tagChildren.children.slice(0, 5)) {
    console.log(`    ${c.name} (${c.id})`);
  }
} catch (e: any) {
  console.log(`  product tag children: ERROR — ${e.message}`);
}

// 5. Search for a "Schema" node directly
console.log("\n--- Search for 'Schema' node ---");
const schemaSearch = await tana.nodes.search(
  { textContains: "Schema" },
  { workspaceIds: [ws.id], limit: 10 }
);
for (const s of schemaSearch) {
  console.log(`  ${s.name} (${s.id}) — docType: ${s.docType}`);
  console.log(`    breadcrumb: ${JSON.stringify(s.breadcrumb)}`);
}

// 6. If we found Schema node, try getChildren with pagination
if (tagSearch.length > 0 && tagSearch[0].breadcrumb.length >= 2) {
  // The breadcrumb format is ["Root node for file:wsId", "Schema", "tagname"]
  // We need the Schema node ID, not name. Let's try reading the workspace root.
  console.log("\n--- Reading workspace root to find Schema node ---");
  try {
    const rootChildren = await tana.nodes.getChildren(ws.id, { limit: 50 });
    console.log(`  Root children: total=${rootChildren.total}`);
    for (const c of rootChildren.children) {
      console.log(`    ${c.name} (${c.id})`);
    }

    // Look for Schema among children
    const schemaNode = rootChildren.children.find(c => c.name === "Schema");
    if (schemaNode) {
      console.log(`\n--- Schema node found: ${schemaNode.id} ---`);

      // Page 1
      const page1 = await tana.nodes.getChildren(schemaNode.id, { limit: 100, offset: 0 });
      console.log(`  Page 1 (offset=0): ${page1.children.length} children, total=${page1.total}, hasMore=${page1.hasMore}`);
      for (const c of page1.children.slice(0, 10)) {
        console.log(`    ${c.name} (${c.id})`);
      }
      console.log(`    ... (showing first 10)`);

      // Page 2
      if (page1.hasMore) {
        const page2 = await tana.nodes.getChildren(schemaNode.id, { limit: 100, offset: 100 });
        console.log(`\n  Page 2 (offset=100): ${page2.children.length} children, total=${page2.total}, hasMore=${page2.hasMore}`);
        for (const c of page2.children.slice(0, 10)) {
          console.log(`    ${c.name} (${c.id})`);
        }
        console.log(`    ... (showing first 10)`);

        // Page 3
        if (page2.hasMore) {
          const page3 = await tana.nodes.getChildren(schemaNode.id, { limit: 100, offset: 200 });
          console.log(`\n  Page 3 (offset=200): ${page3.children.length} children, total=${page3.total}, hasMore=${page3.hasMore}`);
        }
      }

      // Check if known ghost tags are in here
      console.log("\n--- Ghost tag check in Schema children ---");
      let allSchemaChildren: any[] = [];
      let offset = 0;
      while (true) {
        const page = await tana.nodes.getChildren(schemaNode.id, { limit: 200, offset });
        allSchemaChildren = allSchemaChildren.concat(page.children);
        if (!page.hasMore) break;
        offset += 200;
      }
      console.log(`  Total Schema children (all pages): ${allSchemaChildren.length}`);

      const schemaChildIds = new Set(allSchemaChildren.map((c: any) => c.id));
      console.log(`  todo (-v-cYE1F8thz): ${schemaChildIds.has("-v-cYE1F8thz") ? "FOUND" : "NOT FOUND"}`);
      console.log(`  task (WZt6T_qPns9I): ${schemaChildIds.has("WZt6T_qPns9I") ? "FOUND" : "NOT FOUND"}`);
    }
  } catch (e: any) {
    console.log(`  ERROR: ${e.message}`);
  }
}
