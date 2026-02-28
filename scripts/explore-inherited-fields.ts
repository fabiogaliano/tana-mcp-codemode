/**
 * Explore includeInheritedFields effect on getSchema output
 *
 * Usage: bun run scripts/explore-inherited-fields.ts
 *
 * Compares getSchema(id, false, true) vs getSchema(id, false, false)
 * for tags with inheritance to see what actually changes.
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

// Get all tags with Extends via Schema pagination
const tags = await tana.tags.list(ws.id, 500);
console.log(`Total tags: ${tags.length}\n`);

// 1. Find tags where TRUE vs FALSE actually differ
console.log("=".repeat(60));
console.log("1. DIFF ANALYSIS — includeInheritedFields TRUE vs FALSE");
console.log("=".repeat(60));

let same = 0;
let different = 0;
const diffs: { name: string; id: string; trueLen: number; falseLen: number; trueSchema: string; falseSchema: string }[] = [];

for (const t of tags) {
  try {
    const schemaTrue = await tana.tags.getSchema(t.id, false, true);
    const schemaFalse = await tana.tags.getSchema(t.id, false, false);

    if (schemaTrue === schemaFalse) {
      same++;
    } else {
      different++;
      diffs.push({
        name: t.name,
        id: t.id,
        trueLen: schemaTrue.length,
        falseLen: schemaFalse.length,
        trueSchema: schemaTrue,
        falseSchema: schemaFalse,
      });
    }
  } catch {
    // skip errors (non-tag nodes)
  }
}

console.log(`\n  Identical output: ${same}`);
console.log(`  Different output: ${different}`);
console.log(`  Ratio: ${((different / (same + different)) * 100).toFixed(1)}% of tags affected\n`);

// 2. Show the actual diffs
console.log("=".repeat(60));
console.log("2. DETAILED DIFFS — What changes?");
console.log("=".repeat(60));

for (const d of diffs.slice(0, 5)) {
  console.log(`\n--- ${d.name} (${d.id}) ---`);
  console.log(`  TRUE length:  ${d.trueLen} chars`);
  console.log(`  FALSE length: ${d.falseLen} chars`);
  console.log(`  Delta: ${d.trueLen - d.falseLen} chars\n`);

  // Parse fields from each
  const trueFields = d.trueSchema.match(/- \*\*(.+?)\*\*/g) || [];
  const falseFields = d.falseSchema.match(/- \*\*(.+?)\*\*/g) || [];

  const trueSet = new Set(trueFields);
  const falseSet = new Set(falseFields);

  const inherited = trueFields.filter((f) => !falseSet.has(f));
  const own = falseFields.filter((f) => falseSet.has(f));

  if (inherited.length > 0) {
    console.log(`  INHERITED fields (only in TRUE):`);
    for (const f of inherited) console.log(`    ${f}`);
  }

  console.log(`  OWN fields (in both): ${own.length}`);
  console.log(`  TOTAL fields TRUE: ${trueFields.length}, FALSE: ${falseFields.length}`);
}

// 3. Show one full side-by-side for a tag with real diff
if (diffs.length > 0) {
  const best = diffs.reduce((a, b) => (a.trueLen - a.falseLen > b.trueLen - b.falseLen ? a : b));

  console.log("\n" + "=".repeat(60));
  console.log(`3. FULL COMPARISON — Biggest diff: ${best.name}`);
  console.log("=".repeat(60));

  console.log(`\n--- includeInheritedFields=TRUE (${best.trueLen} chars) ---`);
  console.log(best.trueSchema);
  console.log(`\n--- includeInheritedFields=FALSE (${best.falseLen} chars) ---`);
  console.log(best.falseSchema);
}

// 4. Summary stats
if (diffs.length > 0) {
  console.log("\n" + "=".repeat(60));
  console.log("4. SUMMARY — Size impact");
  console.log("=".repeat(60));

  const avgDelta = diffs.reduce((sum, d) => sum + (d.trueLen - d.falseLen), 0) / diffs.length;
  const maxDelta = Math.max(...diffs.map((d) => d.trueLen - d.falseLen));
  const minDelta = Math.min(...diffs.map((d) => d.trueLen - d.falseLen));

  console.log(`\n  Tags with different output: ${diffs.length}`);
  console.log(`  Avg size increase (TRUE vs FALSE): ${avgDelta.toFixed(0)} chars`);
  console.log(`  Max increase: ${maxDelta} chars`);
  console.log(`  Min increase: ${minDelta} chars`);
  console.log(`\n  Tags affected:`);
  for (const d of diffs) {
    console.log(`    ${d.name}: +${d.trueLen - d.falseLen} chars (${d.falseLen}→${d.trueLen})`);
  }
}
