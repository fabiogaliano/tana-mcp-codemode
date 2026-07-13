import crypto from "crypto";
import { createClient } from "../src/api/client";

const EXPECTED_PATHS_HASH = "96cf1571";

async function main() {
  const client = createClient();
  console.log("Checking Tana Local API schema version...");
  
  try {
    const openapi = await client.get<any>("/openapi.json");
    if (!openapi || !openapi.paths) {
      console.error("Failed to fetch openapi.json or it is missing paths.");
      process.exit(1);
    }

    const pathsHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(Object.keys(openapi.paths).sort()))
      .digest("hex")
      .substring(0, 8);
    const version = openapi.info?.version || "unknown";

    if (pathsHash !== EXPECTED_PATHS_HASH) {
      console.error(
        `[WARNING] Tana API schema has changed! Expected hash ${EXPECTED_PATHS_HASH}, got ${pathsHash}.`
      );
      console.error(`[WARNING] Version reported: ${version}`);
      process.exit(1);
    } else {
      console.log(
        `✅ Connected to Tana Local API v${version} (schema hash verified: ${pathsHash})`
      );
    }
  } catch (err) {
    console.error(
      `Failed to check OpenAPI version: ${err instanceof Error ? err.message : err}`
    );
    process.exit(1);
  }
}

main();
