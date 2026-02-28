/**
 * Explore includeInheritedFields — focused on child tags that extend field-rich parents
 *
 * Usage: bun run scripts/explore-inherited-fields-v2.ts
 *
 * The hypothesis: includeInheritedFields only matters when a parent tag
 * defines fields and the child inherits them. Test with tags like
 * friend→person, movie→media content, etc.
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

// 1. First, find parent tags that have fields
console.log("=".repeat(60));
console.log("1. PARENT TAGS WITH FIELDS");
console.log("=".repeat(60));

const allTags = await tana.tags.list(ws.id, 500);
console.log(`Total tags: ${allTags.length}\n`);

// Build map of tag schemas
const tagSchemas = new Map<string, string>();
for (const t of allTags) {
  try {
    const schema = await tana.tags.getSchema(t.id);
    tagSchemas.set(t.id, schema);
  } catch {}
}

// Find parent IDs referenced in Extends lines
const parentIds = new Set<string>();
const childToParents = new Map<string, { name: string; parentIds: string[] }>();

for (const t of allTags) {
  const schema = tagSchemas.get(t.id);
  if (!schema) continue;
  const extendsLine = schema.split("\n").find((l) => l.startsWith("Extends"));
  if (!extendsLine) continue;

  const parents = [...extendsLine.matchAll(/\(id:([^)]+)\)/g)].map((m) => m[1]);
  parents.forEach((p) => parentIds.add(p));
  childToParents.set(t.id, { name: t.name, parentIds: parents });
}

// Which parents have fields?
const parentsWithFields: { id: string; name: string; fieldCount: number }[] = [];
for (const pid of parentIds) {
  const schema = tagSchemas.get(pid);
  if (!schema) {
    // Parent might not be in our tag list — fetch directly
    try {
      const s = await tana.tags.getSchema(pid);
      const fields = s.match(/- \*\*(.+?)\*\*/g) || [];
      if (fields.length > 0) {
        const nameLine = s.split("\n")[0];
        const name = nameLine.replace(/# Tag definition: /, "").replace(/\s*\(id:.+\)/, "");
        parentsWithFields.push({ id: pid, name, fieldCount: fields.length });
      }
    } catch {}
  } else {
    const fields = schema.match(/- \*\*(.+?)\*\*/g) || [];
    if (fields.length > 0) {
      const t = allTags.find((x) => x.id === pid);
      parentsWithFields.push({ id: pid, name: t?.name || pid, fieldCount: fields.length });
    }
  }
}

console.log("Parent tags with fields:");
for (const p of parentsWithFields) {
  console.log(`  ${p.name} (${p.id}): ${p.fieldCount} fields`);
}

// 2. Test children of field-rich parents
console.log("\n" + "=".repeat(60));
console.log("2. CHILDREN OF FIELD-RICH PARENTS — TRUE vs FALSE");
console.log("=".repeat(60));

const fieldRichParentIds = new Set(parentsWithFields.map((p) => p.id));

for (const [childId, info] of childToParents) {
  const hasFieldRichParent = info.parentIds.some((pid) => fieldRichParentIds.has(pid));
  if (!hasFieldRichParent) continue;

  const schemaTrue = await tana.tags.getSchema(childId, false, true);
  const schemaFalse = await tana.tags.getSchema(childId, false, false);

  const trueFields = schemaTrue.match(/- \*\*(.+?)\*\*/g) || [];
  const falseFields = schemaFalse.match(/- \*\*(.+?)\*\*/g) || [];

  const parentNames = info.parentIds
    .map((pid) => parentsWithFields.find((p) => p.id === pid)?.name || pid)
    .join(", ");

  const diff = schemaTrue !== schemaFalse;
  const marker = diff ? "DIFFERENT" : "same";

  console.log(`\n  ${info.name} → extends [${parentNames}]`);
  console.log(`    TRUE:  ${trueFields.length} fields, ${schemaTrue.length} chars`);
  console.log(`    FALSE: ${falseFields.length} fields, ${schemaFalse.length} chars`);
  console.log(`    Result: ${marker}`);

  if (diff) {
    const trueSet = new Set(trueFields);
    const falseSet = new Set(falseFields);
    const inherited = trueFields.filter((f) => !falseSet.has(f));
    console.log(`    INHERITED fields:`);
    for (const f of inherited) console.log(`      ${f}`);
  }
}

// 3. Also try friend/person specifically
console.log("\n" + "=".repeat(60));
console.log("3. SPECIFIC TAGS — friend, doctor, actor, movie");
console.log("=".repeat(60));

const specific = ["friend", "doctor", "actor", "movie", "saving product", "movie review"];
for (const name of specific) {
  const tag = allTags.find((t) => t.name === name);
  if (!tag) {
    console.log(`\n  ${name}: NOT FOUND in tags.list`);
    continue;
  }

  const schemaTrue = await tana.tags.getSchema(tag.id, false, true);
  const schemaFalse = await tana.tags.getSchema(tag.id, false, false);

  console.log(`\n  --- ${name} (${tag.id}) ---`);
  console.log(`  TRUE (${schemaTrue.length} chars):`);
  console.log(schemaTrue.substring(0, 500));
  console.log(`\n  FALSE (${schemaFalse.length} chars):`);
  console.log(schemaFalse.substring(0, 500));
  console.log(`\n  IDENTICAL: ${schemaTrue === schemaFalse}`);
}
