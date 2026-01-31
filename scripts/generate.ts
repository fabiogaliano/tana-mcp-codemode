import { exec } from "child_process";
import { promisify } from "util";

const run = promisify(exec);

async function generate() {
  console.log("Generating types from OpenAPI spec...");
  await run("bunx openapi-typescript ./api-1.json -o ./src/generated/api.d.ts");
  console.log("✓ Generated src/generated/api.d.ts");
}

generate().catch(console.error);
