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

/**
 * TanaAPI Interface
 *
 * The main interface exposed to sandbox code as the `tana` object.
 * Provides high-level methods organized by domain (workspaces, nodes, tags, etc.)
 */
export interface TanaAPI {
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
    /** List tags in a workspace */
    list(workspaceId: string, limit?: number): Promise<Tag[]>;
    /** Get tag schema */
    getSchema(tagId: string, includeEditInstructions?: boolean): Promise<string>;
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
}

export function createTanaAPI(client: TanaClient): TanaAPI {
  return {
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
        if (options?.workspaceIds) {
          options.workspaceIds.forEach((id, i) => {
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
      async list(workspaceId: string, limit = 50): Promise<Tag[]> {
        return client.get<Tag[]>(
          `/workspaces/${workspaceId}/tags?limit=${limit}`
        );
      },

      async getSchema(
        tagId: string,
        includeEditInstructions = false
      ): Promise<string> {
        const result = await client.get<{ markdown: string }>(
          `/tags/${tagId}/schema?includeEditInstructions=${includeEditInstructions}`
        );
        return result.markdown;
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
  };
}
