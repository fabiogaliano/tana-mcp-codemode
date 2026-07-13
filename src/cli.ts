#!/usr/bin/env bun
/**
 * CLI entry point — pipe TypeScript to stdin or pass a file path as argument.
 *
 * Usage:
 *   echo 'console.log(await tana.workspaces.list())' | bun run src/cli.ts
 *   bun run src/cli.ts script.ts
 */

import { initCompat } from "./compat";
import { bunCompat } from "./compat/bun";
import { createClient } from "./api/client";
import { createTanaAPI } from "./api/tana";
import { executeSandbox } from "./sandbox/executor";
import { initDb, cleanupOldRuns } from "./storage/history";
import type { Workspace } from "./api/types";
import type { TanaClient } from "./api/client";

initCompat(bunCompat);

async function resolveWorkspace(client: TanaClient): Promise<Workspace | null> {
  const envValue = process.env.MAIN_TANA_WORKSPACE?.trim();
  if (!envValue) return null;

  let workspaces: Workspace[];
  try {
    workspaces = await client.get<Workspace[]>("/workspaces");
  } catch {
    return null;
  }

  const byId = workspaces.find((w) => w.id === envValue);
  if (byId) return byId;

  const lowerEnv = envValue.toLowerCase();
  return workspaces.find((w) => w.name.toLowerCase() === lowerEnv) ?? null;
}

async function resolveSearchWorkspaces(client: TanaClient): Promise<string[]> {
  const envValue = process.env.TANA_SEARCH_WORKSPACES?.trim();
  if (!envValue) return [];

  const values = envValue.split(",").map((v) => v.trim()).filter(Boolean);
  if (values.length === 0) return [];

  let workspaces: Workspace[];
  try {
    workspaces = await client.get<Workspace[]>("/workspaces");
  } catch {
    return [];
  }

  const resolvedIds: string[] = [];
  for (const value of values) {
    const byId = workspaces.find((w) => w.id === value);
    if (byId) { resolvedIds.push(byId.id); continue; }
    const byName = workspaces.find((w) => w.name.toLowerCase() === value.toLowerCase());
    if (byName) resolvedIds.push(byName.id);
  }
  return resolvedIds;
}

async function readCode(): Promise<string> {
  const filePath = process.argv[2];

  if (filePath) {
    const file = Bun.file(filePath);
    const exists = await file.exists();
    if (!exists) {
      console.error(`Error: file not found: ${filePath}`);
      process.exit(1);
    }
    return file.text();
  }

  // Read from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const code = Buffer.concat(chunks).toString("utf8").trim();

  if (!code) {
    console.error("Usage: bun run src/cli.ts [file.ts]");
    console.error("       echo '<code>' | bun run src/cli.ts");
    process.exit(1);
  }

  return code;
}

async function main() {
  initDb();
  const cleaned = cleanupOldRuns(30);
  if (cleaned > 0) {
    process.stderr.write(`Cleaned up ${cleaned} old script runs\n`);
  }

  const code = await readCode();
  const client = createClient();
  const workspace = await resolveWorkspace(client);
  const searchWorkspaceIds = await resolveSearchWorkspaces(client);
  const tana = createTanaAPI(client, workspace, searchWorkspaceIds);

  const result = await executeSandbox(code, tana);

  if (result.output) {
    process.stdout.write(result.output + "\n");
  }

  if (result.error) {
    process.stderr.write(`Error: ${result.error}\n`);
  }

  process.stderr.write(`[${result.durationMs}ms]\n`);
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});
