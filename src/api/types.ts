/**
 * API Types - Re-exports of generated OpenAPI types with friendly names
 *
 * These types are auto-generated from the Tana Local API OpenAPI spec.
 * Run `bun run generate` to regenerate from api-1.json.
 *
 * @see ./generated/api.d.ts for the full generated types
 */
import type { operations } from "../generated/api";

/** Health check response */
export type HealthResponse =
  operations["health.ping"]["responses"]["200"]["content"]["application/json"];

/** Workspace info */
export type Workspace =
  operations["workspaces.list"]["responses"]["200"]["content"]["application/json"][number];

/** Search result node */
export type SearchResult =
  operations["nodes.search"]["responses"]["200"]["content"]["application/json"][number];

/** Node read response (markdown content) */
export type NodeReadResponse =
  operations["nodes.read"]["responses"]["200"]["content"]["application/json"];

/** Children list response */
export type Children =
  operations["nodes.getChildren"]["responses"]["200"]["content"]["application/json"];

/** Child node in children response */
export type ChildNode = Children["children"][number];

/** Tag info */
export type Tag =
  operations["tags.list"]["responses"]["200"]["content"]["application/json"][number];

/** Tag schema response (markdown) */
export type TagSchemaResponse =
  operations["tags.getSchema"]["responses"]["200"]["content"]["application/json"];

/** Tag creation response */
export type CreateTagResponse =
  operations["tags.create"]["responses"]["200"]["content"]["application/json"];

/** Add field response */
export type AddFieldResponse =
  operations["tags.addField"]["responses"]["200"]["content"]["application/json"];

/** Set checkbox response */
export type SetCheckboxResponse =
  operations["tags.setCheckbox"]["responses"]["200"]["content"]["application/json"];

/** Calendar node response */
export type CalendarNodeResponse =
  operations["calendar.getNodeId"]["responses"]["200"]["content"]["application/json"];

/** Import response */
export type ImportResponse =
  operations["nodes.importTanaPaste"]["responses"]["200"]["content"]["application/json"];

/** Tag modification response */
export type ModifyTagsResponse =
  operations["nodes.updateTags"]["responses"]["200"]["content"]["application/json"];

/** Node update response */
export type NodeUpdateResponse =
  operations["nodes.update"]["responses"]["200"]["content"]["application/json"];

/** Trash node response */
export type TrashNodeResponse =
  operations["nodes.trash"]["responses"]["200"]["content"]["application/json"];

/** Set done response */
export type SetDoneResponse =
  operations["nodes.setDone"]["responses"]["200"]["content"]["application/json"];

/** Set field option response */
export type SetFieldOptionResponse =
  operations["nodes.setFieldOption"]["responses"]["200"]["content"]["application/json"];

/** Set field content response */
export type SetFieldContentResponse =
  operations["nodes.setFieldContent"]["responses"]["200"]["content"]["application/json"];

/** Search query structure */
export type SearchQuery = NonNullable<
  operations["nodes.search"]["parameters"]["query"]
>["query"];

/** Calendar granularity */
export type CalendarGranularity = NonNullable<
  operations["calendar.getNodeId"]["parameters"]["query"]
>["granularity"];

/** Field data type */
export type FieldDataType = NonNullable<
  operations["tags.addField"]["requestBody"]
>["content"]["application/json"]["dataType"];

/** Create tag request body */
export type CreateTagBody = NonNullable<
  operations["tags.create"]["requestBody"]
>["content"]["application/json"];

/** Add field request body */
export type AddFieldBody = NonNullable<
  operations["tags.addField"]["requestBody"]
>["content"]["application/json"];

/** Set checkbox request body */
export type SetCheckboxBody = NonNullable<
  operations["tags.setCheckbox"]["requestBody"]
>["content"]["application/json"];

/** Update tags request body */
export type UpdateTagsBody = NonNullable<
  operations["nodes.updateTags"]["requestBody"]
>["content"]["application/json"];

/** Node update request body */
export type NodeUpdateBody = NonNullable<
  operations["nodes.update"]["requestBody"]
>["content"]["application/json"];

/** Options for search */
export interface SearchOptions {
  limit?: number;
  workspaceIds?: string[];
}

/** Options for creating a tag */
export interface CreateTagOptions {
  workspaceId: string;
  name: string;
  description?: string;
  extendsTagIds?: string[];
  showCheckbox?: boolean;
}

/** Options for adding a field to a tag */
export interface AddFieldOptions {
  tagId: string;
  name: string;
  dataType: FieldDataType;
  description?: string;
  sourceTagId?: string;
  options?: string[];
  defaultValue?: string | boolean | number;
  isMultiValue?: boolean;
}

/** Options for configuring tag checkbox */
export interface SetCheckboxOptions {
  tagId: string;
  showCheckbox: boolean;
  doneStateMapping?: {
    fieldId: string;
    checkedValues: string[];
    uncheckedValues?: string[];
  };
}

/** Options for editing a node */
export interface EditNodeOptions {
  nodeId: string;
  name?: {
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  };
  description?: {
    old_string: string;
    new_string: string;
    replace_all?: boolean;
  };
}

/** Import result (simplified for API usage) */
export interface ImportResult {
  success: boolean;
  nodeIds?: string[];
  error?: string;
}

export type { operations } from "../generated/api";
export type { paths } from "../generated/api";
