#!/usr/bin/env bun
import { initCompat } from "./compat";
import { bunCompat } from "./compat/bun";
import { main } from "./main";

initCompat(bunCompat);

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
