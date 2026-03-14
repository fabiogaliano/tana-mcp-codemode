#!/usr/bin/env bun
/**
 * Installs tana-mcp-codemode into Claude Code / Claude Desktop via `claude mcp add`.
 *
 * Detects the best available command (global npm install → local binary → bun source).
 * Prompts for required env vars, then runs: claude mcp add tana ...
 *
 * Usage:
 *   bun run scripts/setup.ts
 *   bun run scripts/setup.ts --scope project   # write to .mcp.json instead
 */

import { spawnSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";
import { createInterface } from "readline";

const ROOT = resolve(import.meta.dir, "..");

// ── helpers ────────────────────────────────────────────────────────────────

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      process.stdout.write(question);
      process.stdin.setRawMode?.(true);
      let value = "";
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", function handler(ch: string) {
        if (ch === "\n" || ch === "\r") {
          process.stdin.setRawMode?.(false);
          process.stdin.removeListener("data", handler);
          process.stdout.write("\n");
          rl.close();
          resolve(value);
        } else if (ch === "\u0003") {
          process.exit();
        } else if (ch === "\u007F") {
          value = value.slice(0, -1);
        } else {
          value += ch;
          process.stdout.write("*");
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    }
  });
}

function getDesktopConfigPath(): string | null {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  } else if (platform === "win32") {
    return join(process.env.APPDATA ?? homedir(), "Claude", "claude_desktop_config.json");
  } else {
    return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
  }
}

function configureDesktop(
  cmd: string,
  args: string[],
  envVars: Record<string, string>
): void {
  const configPath = getDesktopConfigPath();
  if (!configPath) return;

  let config: any = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf8"));
    } catch {
      console.error(`  Warning: could not parse ${configPath}, will overwrite.`);
    }
  }

  config.mcpServers ??= {};
  config.mcpServers.tana = {
    command: cmd,
    ...(args.length > 0 ? { args } : {}),
    env: envVars,
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`  ✓ Written to ${configPath}`);
  console.log("  Restart Claude Desktop to apply changes.");
}

function which(cmd: string): boolean {
  const result = spawnSync("which", [cmd], { encoding: "utf8" });
  return result.status === 0;
}

function detectCommand(): { cmd: string; args: string[] } {
  // 1. Globally installed via npm
  if (which("tana-mcp-codemode")) {
    return { cmd: "tana-mcp-codemode", args: [] };
  }

  // 2. Local binary build
  const localBinary = join(ROOT, "dist", "tana-mcp-codemode");
  if (existsSync(localBinary)) {
    return { cmd: localBinary, args: [] };
  }

  // 3. Bun source (dev / contributor)
  const entryBun = join(ROOT, "src", "entry-bun.ts");
  if (existsSync(entryBun) && which("bun")) {
    return { cmd: "bun", args: ["run", entryBun] };
  }

  throw new Error(
    "Could not find tana-mcp-codemode. Install it:\n" +
    "  npm install -g tana-mcp-codemode\n" +
    "  OR  bun run build:binary"
  );
}

// ── main ───────────────────────────────────────────────────────────────────

const scope = process.argv.includes("--scope")
  ? process.argv[process.argv.indexOf("--scope") + 1]
  : "local";

console.log("\nTana MCP — Claude setup\n");

if (!which("claude")) {
  console.error("Error: `claude` CLI not found. Install Claude Code first: https://claude.ai/code");
  process.exit(1);
}

const token = await ask("TANA_API_TOKEN (from Tana Settings → API): ", true);
if (!token) {
  console.error("Token is required.");
  process.exit(1);
}

console.log("\nOptional — press Enter to use the default shown in brackets.\n");

const apiUrl     = await ask("TANA_API_URL            [http://127.0.0.1:8262]: ");
const workspace  = await ask("MAIN_TANA_WORKSPACE     [none] name or ID: ");
const searchWs   = await ask("TANA_SEARCH_WORKSPACES  [none] comma-separated: ");
const timeout    = await ask("TANA_TIMEOUT            [10000] ms: ");
const historyPath = await ask("TANA_HISTORY_PATH       [platform default] path: ");

const { cmd, args } = detectCommand();
const source = args.length === 0 ? "global/binary" : "bun source";
console.log(`\nUsing: ${[cmd, ...args].join(" ")} (${source})`);

const envFlags = [
  "--env", `TANA_API_TOKEN=${token}`,
  ...(apiUrl      ? ["--env", `TANA_API_URL=${apiUrl}`]                       : []),
  ...(workspace   ? ["--env", `MAIN_TANA_WORKSPACE=${workspace}`]             : []),
  ...(searchWs    ? ["--env", `TANA_SEARCH_WORKSPACES=${searchWs}`]           : []),
  ...(timeout     ? ["--env", `TANA_TIMEOUT=${timeout}`]                      : []),
  ...(historyPath ? ["--env", `TANA_HISTORY_PATH=${historyPath}`]             : []),
];

const claudeArgs = [
  "mcp", "add",
  "--scope", scope,
  "--transport", "stdio",
  ...envFlags,
  "tana",
  "--", cmd, ...args,
];

console.log(`\nRunning: claude ${claudeArgs.map(a => a.includes(" ") ? `"${a}"` : a).join(" ")}\n`);

const result = spawnSync("claude", claudeArgs, { stdio: "inherit" });

if (result.status !== 0) {
  console.error("\nSetup failed. You can add it manually:");
  console.error(`  claude mcp add --scope ${scope} ${envFlags.join(" ")} tana -- ${[cmd, ...args].join(" ")}`);
  process.exit(result.status ?? 1);
}

console.log(`\n✓ tana MCP server added to Claude Code (scope: ${scope})`);

// Build env record for Desktop config (same values, different format)
const envRecord: Record<string, string> = { TANA_API_TOKEN: token };
if (apiUrl)      envRecord.TANA_API_URL = apiUrl;
if (workspace)   envRecord.MAIN_TANA_WORKSPACE = workspace;
if (searchWs)    envRecord.TANA_SEARCH_WORKSPACES = searchWs;
if (timeout)     envRecord.TANA_TIMEOUT = timeout;
if (historyPath) envRecord.TANA_HISTORY_PATH = historyPath;

const desktopPath = getDesktopConfigPath();
if (desktopPath) {
  const configureForDesktop = await ask("\nAlso configure Claude Desktop? [y/N]: ");
  if (configureForDesktop.toLowerCase() === "y") {
    configureDesktop(cmd, args, envRecord);
  }
}

console.log();
