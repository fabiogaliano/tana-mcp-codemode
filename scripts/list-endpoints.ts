/**
 * List all API endpoints from the OpenAPI spec
 *
 * Usage: bun run scripts/list-endpoints.ts
 *
 * Outputs a markdown summary of all endpoints that can be used
 * to keep prompts.ts in sync with the API.
 */

import spec from "../api-1.json";

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
}

interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
}

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: { type?: string };
}

interface RequestBody {
  content?: {
    "application/json"?: {
      schema?: {
        properties?: Record<string, { description?: string }>;
      };
    };
  };
}

const paths = spec.paths as Record<string, PathItem>;

console.log("# Tana Local API Endpoints\n");
console.log(`Generated from OpenAPI spec v${spec.info.version}\n`);

const methods = ["get", "post", "put", "delete"] as const;

for (const [path, pathItem] of Object.entries(paths)) {
  for (const method of methods) {
    const op = pathItem[method];
    if (!op) continue;

    const opId = op.operationId || `${method} ${path}`;
    console.log(`## \`${method.toUpperCase()} ${path}\``);
    console.log(`**Operation**: \`${opId}\`\n`);

    if (op.summary) {
      console.log(`${op.summary}\n`);
    }

    // Path/Query parameters
    const params = op.parameters?.filter((p) => p.in === "path" || p.in === "query");
    if (params?.length) {
      console.log("**Parameters:**");
      for (const p of params) {
        const req = p.required ? " (required)" : "";
        console.log(`- \`${p.name}\`${req}: ${p.schema?.type || "any"}`);
      }
      console.log();
    }

    // Request body
    const bodyProps = op.requestBody?.content?.["application/json"]?.schema?.properties;
    if (bodyProps) {
      console.log("**Body:**");
      for (const [name, prop] of Object.entries(bodyProps)) {
        console.log(`- \`${name}\`: ${prop.description || ""}`);
      }
      console.log();
    }

    console.log("---\n");
  }
}

console.log("\n✓ Use this output to verify prompts.ts is up to date");
