/**
 * Compact Formatter for Tana API Responses
 *
 * Pure function — detects response shape and returns a compact string representation.
 * Designed to reduce token waste when AI logs API results via console.log(tana.format(data)).
 *
 * Shape detection uses discriminating fields from the OpenAPI spec:
 * - SearchResult[]: has `breadcrumb`
 * - Children: has `children` + `total` + `hasMore`
 * - ChildNode[]: has `childCount`
 * - Tag[]: has `id` + `name`, no `breadcrumb`/`childCount`/`homeNodeId`
 * - Workspace[]: has `homeNodeId`
 * - ImportResult: has `success` + (`nodeIds` or `error`)
 * - string: passthrough (read/getSchema already return markdown)
 */

function hasKey(obj: unknown, key: string): boolean {
  return typeof obj === "object" && obj !== null && key in obj;
}

function formatTags(tags: { id: string; name: string }[]): string {
  if (!tags || tags.length === 0) return "";
  return " " + tags.map((t) => `#${t.name}`).join(" ");
}

function formatSearchResults(data: unknown[]): string {
  const lines = data.map((r: any) => {
    const tags = formatTags(r.tags);
    const breadcrumb = r.breadcrumb?.length ? ` — ${r.breadcrumb.join(" > ")}` : "";
    return `  [${r.id}] ${r.name}${tags}${breadcrumb}`;
  });
  return `${data.length} results:\n${lines.join("\n")}`;
}

function formatChildren(data: any): string {
  const showing = data.children.length;
  const header = `${data.total} children (showing ${showing}${data.hasMore ? ", has more" : ""}):`;
  const lines = data.children.map((c: any) => {
    const tags = formatTags(c.tags);
    const kids = c.childCount > 0 ? ` (${c.childCount} children)` : "";
    return `  [${c.id}] ${c.name}${tags}${kids}`;
  });
  return `${header}\n${lines.join("\n")}`;
}

function formatChildNodes(data: unknown[]): string {
  const lines = data.map((c: any) => {
    const tags = formatTags(c.tags);
    const kids = c.childCount > 0 ? ` (${c.childCount} children)` : "";
    return `  [${c.id}] ${c.name}${tags}${kids}`;
  });
  return `${data.length} nodes:\n${lines.join("\n")}`;
}

function formatTags_(data: unknown[]): string {
  const lines = data.map((t: any) => `  [${t.id}] ${t.name}`);
  return `${data.length} tags:\n${lines.join("\n")}`;
}

function formatWorkspaces(data: unknown[]): string {
  const lines = data.map((w: any) => `  [${w.id}] ${w.name} (home: ${w.homeNodeId})`);
  return `${data.length} workspaces:\n${lines.join("\n")}`;
}

function formatImportResult(data: any): string {
  if (data.success) {
    const ids = data.nodeIds?.length ? ` (${data.nodeIds.join(", ")})` : "";
    return `Import success: ${data.nodeIds?.length ?? 0} nodes${ids}`;
  }
  return `Import failed: ${data.error ?? "unknown error"}`;
}

/**
 * Compact formatter for any Tana API response.
 *
 * Detects the shape of the data and returns a human-readable, token-efficient string.
 * Falls back to JSON.stringify for unrecognized shapes.
 */
export function format(data: unknown): string {
  if (typeof data === "string") return data;
  if (data === null || data === undefined) return String(data);

  // ImportResult: { success, nodeIds?, error? }
  if (hasKey(data, "success") && (hasKey(data, "nodeIds") || hasKey(data, "error"))) {
    return formatImportResult(data);
  }

  // Children: { children, total, hasMore }
  if (hasKey(data, "children") && hasKey(data, "total") && hasKey(data, "hasMore")) {
    return formatChildren(data);
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return "0 results";

    const first = data[0];

    // SearchResult[]: has `breadcrumb`
    if (hasKey(first, "breadcrumb")) {
      return formatSearchResults(data);
    }

    // ChildNode[]: has `childCount`
    if (hasKey(first, "childCount")) {
      return formatChildNodes(data);
    }

    // Workspace[]: has `homeNodeId`
    if (hasKey(first, "homeNodeId")) {
      return formatWorkspaces(data);
    }

    // Tag[]: has `id` + `name`, no discriminators for other types
    if (hasKey(first, "id") && hasKey(first, "name") && !hasKey(first, "breadcrumb") && !hasKey(first, "childCount") && !hasKey(first, "homeNodeId")) {
      return formatTags_(data);
    }
  }

  // Fallback: pretty JSON
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}
