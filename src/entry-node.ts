#!/usr/bin/env node
import { initCompat } from "./compat/index.js";
import { nodeCompat } from "./compat/node.js";
import { main } from "./main.js";

initCompat(nodeCompat);

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
