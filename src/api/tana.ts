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
  Tag,
  CreateTagOptions,
  AddFieldOptions,
  SetCheckboxOptions,
  ImportResult,
} from "./types";
import { format } from "./format";

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
    /** Set a field to an option value */
    setOption(
      nodeId: string,
      attributeId: string,
      optionId: string
    ): Promise<{ success: boolean }>;
    /** Set a field to a string value */
    setContent(
      nodeId: string,
      attributeId: string,
      content: string
    ): Promise<{ success: boolean }>;
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
        // Build deep object query params (style: deepObject, explode: true)
        const params: string[] = [];

        function addQueryParams(obj: Record<string, unknown>, prefix: string) {
          for (const [key, value] of Object.entries(obj)) {
            const paramKey = prefix ? `${prefix}[${key}]` : key;
            if (value === null || value === undefined) continue;
            if (typeof value === "object" && !Array.isArray(value)) {
              addQueryParams(value as Record<string, unknown>, paramKey);
            } else if (Array.isArray(value)) {
              value.forEach((item, i) => {
                if (typeof item === "object") {
                  addQueryParams(item as Record<string, unknown>, `${paramKey}[${i}]`);
                } else {
                  params.push(`${encodeURIComponent(`${paramKey}[${i}]`)}=${encodeURIComponent(String(item))}`);
                }
              });
            } else {
              params.push(`${encodeURIComponent(paramKey)}=${encodeURIComponent(String(value))}`);
            }
          }
        }

        addQueryParams(query as unknown as Record<string, unknown>, "query");
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
      async setOption(
        nodeId: string,
        attributeId: string,
        optionId: string
      ): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; message: string }>(
          `/nodes/${nodeId}/fields/${attributeId}/option`,
          { optionId }
        );
        return { success: !!result.nodeId };
      },

      async setContent(
        nodeId: string,
        attributeId: string,
        content: string
      ): Promise<{ success: boolean }> {
        const result = await client.post<{ nodeId: string; message: string }>(
          `/nodes/${nodeId}/fields/${attributeId}/content`,
          { content }
        );
        return { success: !!result.nodeId };
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
      return client.post<ImportResult>(`/nodes/${parentNodeId}/import`, {
        content,
      });
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
