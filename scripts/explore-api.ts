/**
 * Explore Tana Local API responses directly
 *
 * Usage: bun run scripts/explore-api.ts [section]
 *
 * Sections: 1-7 (run individual), or no arg for all.
 * Reads credentials from ~/.mcp.json (tana-mcp-f server config).
 */

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { TanaClient } from "../src/api/client";
import { createTanaAPI } from "../src/api/tana";

const mcpPath = join(homedir(), ".mcp.json");
const mcp = JSON.parse(readFileSync(mcpPath, "utf-8"));
const server = mcp.mcpServers?.["tana-mcp-f"];
if (!server?.env?.TANA_API_TOKEN) {
  console.error("tana-mcp-f not found in ~/.mcp.json or missing TANA_API_TOKEN");
  process.exit(1);
}

const client = new TanaClient({
  baseUrl: process.env.TANA_API_URL || "http://127.0.0.1:8262",
  token: server.env.TANA_API_TOKEN,
  timeout: 10000,
});

const workspaces = await client.get<{ id: string; name: string }[]>("/workspaces");
const wsName = server.env.MAIN_TANA_WORKSPACE;
const ws = wsName
  ? workspaces.find((w: any) => w.name === wsName || w.id === wsName) || workspaces[0]
  : workspaces[0];

const tana = createTanaAPI(client, ws as any);
const section = process.argv[2] ? parseInt(process.argv[2]) : 0;

console.log(`Workspace: ${ws.name} (${ws.id})\n`);

// ============================================================
if (section === 0 || section === 1) {
  console.log("=".repeat(60));
  console.log("1. SEARCH vs TAGS.LIST — Tag Population Comparison");
  console.log("=".repeat(60));

  const searchTags = await tana.nodes.search(
    { hasType: "SYS_T01" },
    { workspaceIds: [ws.id] }
  );
  const listTags = await tana.tags.list(ws.id, 100);

  const searchIds = new Set(searchTags.map((t) => t.id));
  const listIds = new Set(listTags.map((t) => t.id));

  console.log(`\nsearch: ${searchTags.length} tags | tags.list: ${listTags.length} tags`);
  console.log(`Overlap: ${[...searchIds].filter((id) => listIds.has(id)).length}`);

  // Show all search tag names
  console.log(`\n--- search tags (${searchTags.length}) ---`);
  for (const t of searchTags) {
    const inList = listIds.has(t.id) ? " [also in tags.list]" : "";
    console.log(`  ${t.name} (${t.id})${inList}`);
  }

  // Show all tags.list tag names
  console.log(`\n--- tags.list tags (${listTags.length}) ---`);
  for (const t of listTags) {
    const inSearch = searchIds.has(t.id) ? " [also in search]" : "";
    console.log(`  ${t.name} (${t.id})${inSearch}`);
  }

  // Count Extends in each
  let searchExtends = 0;
  let listExtends = 0;
  for (const t of searchTags) {
    const schema = await tana.tags.getSchema(t.id);
    if (schema.includes("Extends")) searchExtends++;
  }
  for (const t of listTags) {
    const schema = await tana.tags.getSchema(t.id);
    if (schema.includes("Extends")) listExtends++;
  }
  console.log(`\nsearch Extends: ${searchExtends}/${searchTags.length}`);
  console.log(`tags.list Extends: ${listExtends}/${listTags.length}`);
}

// ============================================================
if (section === 0 || section === 2) {
  console.log("\n" + "=".repeat(60));
  console.log("2. RAW getSchema — Tags WITH Extends (first 5)");
  console.log("=".repeat(60));

  const listTags = await tana.tags.list(ws.id, 100);
  let shown = 0;
  for (const t of listTags) {
    const schema = await tana.tags.getSchema(t.id);
    if (schema.includes("Extends") && shown < 5) {
      console.log(`\n--- ${t.name} (${t.id}) ---`);
      console.log(schema.substring(0, 500));
      shown++;
    }
  }
}

// ============================================================
if (section === 0 || section === 3) {
  console.log("\n" + "=".repeat(60));
  console.log("3. RAW getSchema — Tags WITHOUT Extends (first 3 with fields)");
  console.log("=".repeat(60));

  const listTags = await tana.tags.list(ws.id, 100);
  let shown = 0;
  for (const t of listTags) {
    const schema = await tana.tags.getSchema(t.id);
    if (!schema.includes("Extends") && schema.includes("Template Fields") && shown < 3) {
      console.log(`\n--- ${t.name} (${t.id}) ---`);
      console.log(schema.substring(0, 400));
      shown++;
    }
  }
}

// ============================================================
if (section === 0 || section === 4) {
  console.log("\n" + "=".repeat(60));
  console.log("4. includeInheritedFields: TRUE vs FALSE");
  console.log("=".repeat(60));

  const listTags = await tana.tags.list(ws.id, 100);
  for (const t of listTags) {
    const schemaTrue = await tana.tags.getSchema(t.id, false, true);
    if (schemaTrue.includes("Extends") && schemaTrue.includes("Template Fields")) {
      const schemaFalse = await tana.tags.getSchema(t.id, false, false);
      console.log(`\nTag: ${t.name} (${t.id})`);
      console.log(`TRUE: ${schemaTrue.length} chars | FALSE: ${schemaFalse.length} chars`);
      console.log(`\n--- TRUE ---`);
      console.log(schemaTrue);
      console.log(`\n--- FALSE ---`);
      console.log(schemaFalse);
      break;
    }
  }
}

// ============================================================
if (section === 0 || section === 5) {
  console.log("\n" + "=".repeat(60));
  console.log("5. RAW SEARCH RESULT shape");
  console.log("=".repeat(60));

  const results = await tana.nodes.search(
    { textContains: "meeting" },
    { workspaceIds: [ws.id], limit: 3 }
  );
  for (const r of results) {
    console.log(JSON.stringify(r, null, 2));
  }
}

// ============================================================
if (section === 0 || section === 6) {
  console.log("\n" + "=".repeat(60));
  console.log("6. RAW TAGS.LIST RESULT shape");
  console.log("=".repeat(60));

  const listTags = await tana.tags.list(ws.id, 10);
  for (const t of listTags) {
    console.log(JSON.stringify(t, null, 2));
  }
}

// ============================================================
if (section === 0 || section === 7) {
  console.log("\n" + "=".repeat(60));
  console.log("7. FULL INHERITANCE TREE (from tags.list)");
  console.log("=".repeat(60));

  const listTags = await tana.tags.list(ws.id, 100);
  const allExtends: { child: string; childId: string; parents: string }[] = [];
  for (const t of listTags) {
    const schema = await tana.tags.getSchema(t.id);
    const line = schema.split("\n").find((l) => l.startsWith("Extends"));
    if (line) {
      allExtends.push({ child: t.name, childId: t.id, parents: line });
    }
  }

  console.log(`\n${allExtends.length} tags with inheritance:\n`);
  for (const e of allExtends) {
    console.log(`  ${e.child}: ${e.parents}`);
  }
}
