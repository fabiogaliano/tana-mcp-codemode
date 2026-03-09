/**
 * Tana API Wrapper
 *
 * Creates the `tana` object that gets injected into the sandbox.
 * Maps high-level operations to Tana Local API HTTP endpoints.
 *
 * Types are generated from the Tana Local API OpenAPI spec.
 * Run `bun run generate` to regenerate types from api-1.json.
 */

import type { TanaClient } from "./client";
import type {
  Workspace,
  SearchQuery,
  SearchOptions,
  SearchResult,
  Children,
  EditNodeOptions,
  MoveNodeOptions,
  Tag,
  CreateTagOptions,
  AddFieldOptions,
  SetCheckboxOptions,
  ImportResult,
} from "./types";
import { format } from "./format";

/**
 * Build deep-object query params (style: deepObject, explode: true).
 * Used by search and getFieldOptions.
 */
function addQueryParams(params: string[], obj: Record<string, unknown>, prefix: string) {
  for (const [key, value] of Object.entries(obj)) {
    const paramKey = prefix ? `${prefix}[${key}]` : key;
    if (value === null || value === undefined) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      addQueryParams(params, value as Record<string, unknown>, paramKey);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === "object") {
          addQueryParams(params, item as Record<string, unknown>, `${paramKey}[${i}]`);
        } else {
          params.push(`${encodeURIComponent(`${paramKey}[${i}]`)}=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      params.push(`${encodeURIComponent(paramKey)}=${encodeURIComponent(String(value))}`);
    }
  }
}

/** Parse predetermined options: `  - Name <!-- node-id: ABC -->` */
function parseOptionsFromMarkdown(md: string): { id: string; name: string }[] {
  const results: { id: string; name: string }[] = [];
  const lines = md.split("\n");
  let inOptions = false;
  for (const line of lines) {
    if (line.includes("**Options**:")) { inOptions = true; continue; }
    if (inOptions) {
      const match = line.match(/^\s+- (.+?)\s*<!--\s*node-id:\s*(\S+)\s*-->/);
      if (match) {
        results.push({ id: match[2], name: match[1] });
      } else if (line.trim() && !line.startsWith("  ")) {
        break;
      }
    }
  }
  return results;
}

/** Parse `[name](tana:id)` references from markdown */
function parseRefsFromMarkdown(md: string): { id: string; name: string }[] {
  const results: { id: string; name: string }[] = [];
  const re = /\[([^\]]+)\]\(tana:([^)]+)\)/g;
  let match;
  while ((match = re.exec(md)) !== null) {
    results.push({ id: match[2], name: match[1] });
  }
  return results;
}

/**
 * Extract option values for a specific field from node markdown.
 * Scopes parsing to only the target field's section to avoid noise
 * from other fields, tags, and node names.
 */
function parseFieldValues(md: string, fieldName: string): { id: string; name: string }[] {
  const results: { id: string; name: string }[] = [];
  const lines = md.split("\n");
  let inField = false;
  let fieldIndent = -1;

  for (const line of lines) {
    // Detect the field section: "  - **FieldName**:" or "  - **FieldName**: value <!-- node-id: xxx -->"
    if (!inField && line.includes(`**${fieldName}**`)) {
      inField = true;
      fieldIndent = line.search(/\S/);

      // Inline single-value: "  - **Type**: negotiation <!-- node-id: xxx -->"
      const inlineMatch = line.match(
        new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*(.+?)\\s*<!--\\s*node-id:\\s*(\\S+)\\s*-->`)
      );
      if (inlineMatch) {
        results.push({ id: inlineMatch[2], name: inlineMatch[1].trim() });
      }
      // Also check for tana-link format: "  - **Type**: [value](tana:id)"
      const linkMatch = line.match(
        new RegExp(`\\*\\*${fieldName}\\*\\*:\\s*\\[([^\\]]+)\\]\\(tana:([^)]+)\\)`)
      );
      if (linkMatch) {
        results.push({ id: linkMatch[2], name: linkMatch[1] });
      }
      continue;
    }

    if (inField) {
      const currentIndent = line.search(/\S/);
      // Left the field's section (same or less indentation)
      if (line.trim() && currentIndent <= fieldIndent) break;

      // Child value: "    - value <!-- node-id: xxx -->"
      const childMatch = line.match(/^\s+- (.+?)\s*<!--\s*node-id:\s*(\S+)\s*-->/);
      if (childMatch) {
        results.push({ id: childMatch[2], name: childMatch[1].trim() });
        continue;
      }
      // Child value (tana-link): "    - [value](tana:id)"
      const childLinkMatch = line.match(/^\s+- \[([^\]]+)\]\(tana:([^)]+)\)/);
      if (childLinkMatch) {
        results.push({ id: childLinkMatch[2], name: childLinkMatch[1] });
      }
    }
  }
  return results;
}

/**
 * TanaAPI Interface
 *
 * The main interface exposed to sandbox code as the `tana` object.
 * Provides high-level methods organized by domain (workspaces, nodes, tags, etc.)
 */
export interface TanaAPI {
  /** Pre-resolved default workspace (from MAIN_TANA_WORKSPACE env var), or null */
  workspace: Workspace | null;

  /** Check API health */
  health(): Promise<{ status: string; timestamp: string; nodeSpaceReady: boolean }>;

  workspaces: {
    /** List available workspaces */
    list(): Promise<Workspace[]>;
  };

  nodes: {
    /** Search for nodes */
    search(query: SearchQuery, options?: SearchOptions): Promise<SearchResult[]>;
    /** Read a node as markdown */
    read(nodeId: string, maxDepth?: number): Promise<string>;
    /** Get children of a node */
    getChildren(
      nodeId: string,
      options?: { limit?: number; offset?: number }
    ): Promise<Children>;
    /** Edit a node's name/description */
    edit(options: EditNodeOptions): Promise<{ success: boolean }>;
    /** Move node to a new parent */
    move(options: MoveNodeOptions): Promise<{ success: boolean }>;
    /** Open a node in the Tana UI */
    open(nodeId: string, openType?: "current" | "panel" | "tab"): Promise<{ success: boolean }>;
    /** Move node to trash */
    trash(nodeId: string): Promise<{ success: boolean }>;
    /** Check a node's checkbox */
    check(nodeId: string): Promise<{ success: boolean }>;
    /** Uncheck a node's checkbox */
    uncheck(nodeId: string): Promise<{ success: boolean }>;
  };

  tags: {
    /** List all tags in a workspace */
    listAll(workspaceId: string): Promise<Tag[]>;
    /** Get tag schema */
    getSchema(tagId: string, includeEditInstructions?: boolean, includeInheritedFields?: boolean): Promise<string>;
    /** Add/remove tags from a node */
    modify(
      nodeId: string,
      action: "add" | "remove",
      tagIds: string[]
    ): Promise<{ success: boolean }>;
    /** Create a new tag */
    create(options: CreateTagOptions): Promise<{ tagId: string }>;
    /** Add a field to a tag */
    addField(options: AddFieldOptions): Promise<{ fieldId: string }>;
    /** Configure tag checkbox */
    setCheckbox(options: SetCheckboxOptions): Promise<{ success: boolean }>;
  };

  fields: {
    /** Set a field to option value(s). Pass string[] for multi-value fields. */
    setOption(
      nodeId: string,
      attributeId: string,
      optionId: string | string[]
    ): Promise<{ success: boolean }>;
    /** Set a field to a string value, or null to clear it */
    setContent(
      nodeId: string,
      attributeId: string,
      content: string | null,
      mode?: "replace" | "append"
    ): Promise<{ success: boolean }>;
    /** Discover available options for an Options-type field */
    getFieldOptions(
      fieldId: string,
      options?: { tagId?: string; workspaceId?: string; limit?: number }
    ): Promise<{ id: string; name: string }[]>;
  };

  calendar: {
    /** Get or create a calendar node */
    getOrCreate(
      workspaceId: string,
      granularity: "day" | "week" | "month" | "year",
      date?: string
    ): Promise<{ nodeId: string }>;
  };

  /** Import Tana Paste formatted content */
  import(parentNodeId: string, content: string): Promise<ImportResult>;

  /** Compact formatter for any API response */
  format(data: unknown): string;
}

export function createTanaAPI(
  client: TanaClient,
  workspace?: Workspace | null,
  defaultSearchWorkspaceIds?: string[]
): TanaAPI {
  return {
    workspace: workspace ?? null,

    async health() {
      return client.get<{ status: string; timestamp: string; nodeSpaceReady: boolean }>("/health");
    },

    workspaces: {
      async list(): Promise<Workspace[]> {
        return client.get<Workspace[]>("/workspaces");
      },
    },

    nodes: {
      async search(
        query: SearchQuery,
        options?: SearchOptions
      ): Promise<SearchResult[]> {
        const params: string[] = [];
        addQueryParams(params, query as unknown as Record<string, unknown>, "query");
        if (options?.limit) params.push(`limit=${options.limit}`);
        const effectiveWorkspaceIds = options?.workspaceIds
          ?? (defaultSearchWorkspaceIds?.length ? defaultSearchWorkspaceIds : undefined);
        if (effectiveWorkspaceIds) {
          effectiveWorkspaceIds.forEach((id, i) => {
            params.push(`workspaceIds[${i}]=${encodeURIComponent(id)}`);
          });
        }

        return client.get<SearchResult[]>(`/nodes/search?${params.join("&")}`);
      },

      async read(nodeId: string, maxDepth = 1): Promise<string> {
        const result = await client.get<{ markdown: string; name?: string; description?: string }>(
          `/nodes/${nodeId}?maxDepth=${maxDepth}`
        );
        return result.markdown;
      },

      async getChildren(
        nodeId: string,
        options?: { limit?: number; offset?: number }
      ): Promise<Children> {
        const params = new URLSearchParams();
        if (options?.limit) params.set("limit", String(options.limit));
        if (options?.offset) params.set("offset", String(options.offset));
        const query = params.toString();
        return client.get<Children>(
          `/nodes/${nodeId}/children${query ? `?${query}` : ""}`
        );
      },

      async edit(options: EditNodeOptions): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; message: string }>(
          `/nodes/${options.nodeId}/update`,
          {
            name: options.name,
            description: options.description,
          }
        );
        return { success: !!result.nodeId };
      },

      async move(options: MoveNodeOptions): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; message: string }>(
          `/nodes/${options.nodeId}/move`,
          {
            targetNodeId: options.targetNodeId,
            keepSourceReference: options.keepSourceReference,
            position: options.position,
            referenceNodeId: options.referenceNodeId,
            sourceParentId: options.sourceParentId,
          }
        );
        return { success: !!result.nodeId };
      },

      async open(
        nodeId: string,
        openType: "current" | "panel" | "tab" = "current"
      ): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; message: string }>(
          `/nodes/${nodeId}/open`,
          { openType }
        );
        return { success: !!result.nodeId };
      },

      async trash(nodeId: string): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; message: string }>(
          `/nodes/${nodeId}/trash`,
          {}
        );
        return { success: !!result.nodeId };
      },

      async check(nodeId: string): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; done: boolean; message: string }>(
          `/nodes/${nodeId}/done`,
          { done: true }
        );
        return { success: result.done === true };
      },

      async uncheck(nodeId: string): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; done: boolean; message: string }>(
          `/nodes/${nodeId}/done`,
          { done: false }
        );
        return { success: result.done === false };
      },
    },

    tags: {
      async listAll(workspaceId: string): Promise<Tag[]> {
        const schemaNodeId = `${workspaceId}_SCHEMA`;
        const tags: Tag[] = [];
        let offset = 0;

        while (true) {
          const page = await client.get<Children>(
            `/nodes/${schemaNodeId}/children?limit=200&offset=${offset}`
          );
          for (const child of page.children) {
            if (child.docType === "tagDef") {
              tags.push({ id: child.id, name: child.name });
            }
          }
          if (!page.hasMore) break;
          offset += 200;
        }

        return tags;
      },

      async getSchema(
        tagId: string,
        includeEditInstructions = false,
        includeInheritedFields = true
      ): Promise<string> {
        const result = await client.get<{ markdown: string }>(
          `/tags/${tagId}/schema?includeEditInstructions=${includeEditInstructions}&includeInheritedFields=${includeInheritedFields}`
        );
        return truncateOptionLists(result.markdown);
      },

      async modify(
        nodeId: string,
        action: "add" | "remove",
        tagIds: string[]
      ): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; action: string; results: unknown[] }>(
          `/nodes/${nodeId}/tags`,
          { action, tagIds }
        );
        return { success: !!result.nodeId };
      },

      async create(options: CreateTagOptions): Promise<{ tagId: string }> {
        return client.post<{ tagId: string }>(
          `/workspaces/${options.workspaceId}/tags`,
          {
            name: options.name,
            description: options.description,
            extendsTagIds: options.extendsTagIds,
            showCheckbox: options.showCheckbox,
          }
        );
      },

      async addField(options: AddFieldOptions): Promise<{ fieldId: string }> {
        return client.post<{ fieldId: string }>(
          `/tags/${options.tagId}/fields`,
          {
            name: options.name,
            dataType: options.dataType,
            description: options.description,
            sourceTagId: options.sourceTagId,
            options: options.options,
            defaultValue: options.defaultValue,
            isMultiValue: options.isMultiValue,
          }
        );
      },

      async setCheckbox(
        options: SetCheckboxOptions
      ): Promise<{ success: boolean }> {
        const result = await client.post<{ tagId: string; showCheckbox: boolean; message: string }>(
          `/tags/${options.tagId}/checkbox`,
          {
            showCheckbox: options.showCheckbox,
            doneStateMapping: options.doneStateMapping,
          }
        );
        return { success: !!result.tagId };
      },
    },

    fields: {
      // Workaround: append mode is broken in Tana API (clears field instead of appending).
      // For arrays, we set first value via API, then import remaining into the field tuple.
      // See claudedocs/api-bugs.md
      async setOption(
        nodeId: string,
        attributeId: string,
        optionId: string | string[],
        _mode?: "replace" | "append"
      ): Promise<{ success: boolean }> {
        const ids = Array.isArray(optionId) ? optionId : [optionId];
        if (ids.length === 0) return { success: true };

        // Step 1: set first value via API (creates the field tuple)
        await client.post<{ nodeId: string; message: string }>(
          `/nodes/${nodeId}/fields/${attributeId}/option`,
          { optionId: ids[0], mode: "replace" }
        );

        if (ids.length === 1) return { success: true };

        // Step 2: find the field tuple via getChildren
        const { children } = await client.get<Children>(
          `/nodes/${nodeId}/children?limit=100`
        );
        let tupleId: string | null = null;
        for (const child of children) {
          if (child.docType === "tuple") {
            const sub = await client.get<Children>(
              `/nodes/${child.id}/children?limit=20`
            );
            if (sub.children.some(s => s.id === attributeId)) {
              tupleId = child.id;
              break;
            }
          }
        }
        if (!tupleId) return { success: false };

        // Step 3: import remaining values into the tuple
        const refs = ids.slice(1).map(id => `- [[^${id}]]`).join("\n");
        await client.post<ImportResult>(`/nodes/${tupleId}/import`, { content: refs });
        return { success: true };
      },

      async setContent(
        nodeId: string,
        attributeId: string,
        content: string | null,
        mode?: "replace" | "append"
      ): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; message: string }>(
          `/nodes/${nodeId}/fields/${attributeId}/content`,
          { content, mode }
        );
        return { success: !!result.nodeId };
      },

      async getFieldOptions(
        fieldId: string,
        options?: { tagId?: string; workspaceId?: string; limit?: number }
      ): Promise<{ id: string; name: string }[]> {
        const result = await client.get<{ markdown: string }>(
          `/nodes/${fieldId}?maxDepth=2`
        );
        const md = result.markdown;

        // Pattern A: Predetermined options (field definition lists them)
        if (md.includes("**Options**:")) {
          return parseOptionsFromMarkdown(md);
        }

        // Pattern B: Instance of supertag
        if (md.includes("Options from supertag")) {
          const sourceTagMatch = md.match(/\(tana:([^)]+)\)/);
          if (sourceTagMatch) {
            const params: string[] = [];
            addQueryParams(params, { hasType: sourceTagMatch[1] } as Record<string, unknown>, "query");
            if (options?.workspaceId) {
              params.push(`workspaceIds[0]=${encodeURIComponent(options.workspaceId)}`);
            }
            if (options?.limit) params.push(`limit=${options.limit}`);
            const results = await client.get<SearchResult[]>(`/nodes/search?${params.join("&")}`);
            return results.map(r => ({ id: r.id, name: r.name }));
          }
        }

        // Pattern C: Source search node
        const searchNodeMatch = md.match(/\*\*Options List\*\*:.*?\(tana:([^)]+)\)/);
        if (searchNodeMatch) {
          const searchResult = await client.get<{ markdown: string }>(
            `/nodes/${searchNodeMatch[1]}?maxDepth=1`
          );
          return parseRefsFromMarkdown(searchResult.markdown);
        }

        // Pattern D: Ad-hoc — sample from existing nodes that have this field set
        // Extract field name from definition for scoped parsing
        const fieldNameMatch = md.match(/^- (.+?) #field-definition/m);
        if (!fieldNameMatch) return [];

        const fieldName = fieldNameMatch[1];
        const limit = options?.limit ?? 10;
        const params: string[] = [];
        const query: Record<string, unknown> = options?.tagId
          ? { and: [{ hasType: options.tagId }, { field: { fieldId, state: "set" } }] }
          : { field: { fieldId, state: "set" } };
        addQueryParams(params, query, "query");
        if (options?.workspaceId) {
          params.push(`workspaceIds[0]=${encodeURIComponent(options.workspaceId)}`);
        }
        params.push(`limit=${limit}`);

        const searchResults = await client.get<SearchResult[]>(`/nodes/search?${params.join("&")}`);
        const seen = new Map<string, string>();
        for (const node of searchResults) {
          const nodeMd = await client.get<{ markdown: string }>(
            `/nodes/${node.id}?maxDepth=1`
          );
          for (const { id, name } of parseFieldValues(nodeMd.markdown, fieldName)) {
            if (!seen.has(id)) seen.set(id, name);
          }
        }
        return Array.from(seen, ([id, name]) => ({ id, name }));
      },
    },

    calendar: {
      async getOrCreate(
        workspaceId: string,
        granularity: "day" | "week" | "month" | "year",
        date?: string
      ): Promise<{ nodeId: string }> {
        const params = new URLSearchParams();
        params.set("granularity", granularity);
        if (date) params.set("date", date);
        return client.get<{ nodeId: string }>(
          `/workspaces/${workspaceId}/calendar/node?${params.toString()}`
        );
      },
    },

    async import(parentNodeId: string, content: string): Promise<ImportResult> {
      // API returns { createdNodes: [{id,name}], ... } — normalize to ImportResult
      const raw = await client.post<{
        createdNodes: { id: string; name: string }[];
        message: string;
      }>(`/nodes/${parentNodeId}/import`, { content });
      return {
        success: true,
        nodeIds: raw.createdNodes.map(n => n.id),
      };
    },

    format(data: unknown): string {
      return format(data);
    },
  };
}

const MAX_OPTIONS_SHOWN = 5;
const OPTION_LINE_RE = /^  - .+ \(id:/;

function truncateOptionLists(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let optionCount = 0;
  let inOptions = false;

  for (const line of lines) {
    if (OPTION_LINE_RE.test(line)) {
      if (!inOptions) {
        inOptions = true;
        optionCount = 0;
      }
      optionCount++;
      if (optionCount <= MAX_OPTIONS_SHOWN) {
        result.push(line);
      }
    } else {
      if (inOptions && optionCount > MAX_OPTIONS_SHOWN) {
        result.push(`  - ... (${optionCount - MAX_OPTIONS_SHOWN} more, ${optionCount} total)`);
      }
      inOptions = false;
      optionCount = 0;
      result.push(line);
    }
  }

  if (inOptions && optionCount > MAX_OPTIONS_SHOWN) {
    result.push(`  - ... (${optionCount - MAX_OPTIONS_SHOWN} more, ${optionCount} total)`);
  }

  return result.join("\n");
}
