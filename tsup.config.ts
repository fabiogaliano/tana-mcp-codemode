import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/entry-node.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  external: [
    "better-sqlite3",
    "esbuild",
    /^@modelcontextprotocol\/sdk/,
    "zod",
    "node:module",
  ],
});
