/**
 * Tana MCP Server Types
 */

// ============================================================================
// API Response Types
// ============================================================================

export interface Workspace {
  id: string;
  name: string;
  homeNodeId: string;
}

export interface Node {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  docType?: string;
  breadcrumb?: string[];
  tags?: TagReference[];
  created?: number;
}

export interface TagReference {
  id: string;
  name: string;
  color?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  description?: string;
}

export interface TagSchema {
  id: string;
  name: string;
  description?: string;
  fields: FieldDefinition[];
  extendsTagIds?: string[];
  showCheckbox?: boolean;
}

export interface FieldDefinition {
  id: string;
  name: string;
  dataType: FieldDataType;
  description?: string;
  sourceTagId?: string;
  options?: FieldOption[];
  defaultValue?: string | boolean | number;
  isMultiValue?: boolean;
}

export type FieldDataType =
  | "plain"
  | "number"
  | "date"
  | "url"
  | "email"
  | "checkbox"
  | "user"
  | "instance"
  | "options";

export interface FieldOption {
  id: string;
  name: string;
}

export interface CalendarNode {
  id: string;
  date: string;
  granularity: "day" | "week" | "month" | "year";
}

export interface Children {
  children: Node[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchQuery {
  textContains?: string;
  textMatches?: string;
  hasType?: string | { typeId: string; includeExtensions?: boolean };
  field?: {
    fieldId: string;
    nodeId?: string;
    stringValue?: string;
    numberValue?: number;
    state?: "defined" | "undefined" | "set" | "notSet";
  };
  compare?: {
    fieldId: string;
    operator: "gt" | "lt" | "eq";
    value: string | number;
    type: "number" | "date" | "string";
  };
  childOf?: {
    nodeIds: string[];
    recursive?: boolean;
    includeRefs?: boolean;
  };
  ownedBy?: {
    nodeId: string;
    recursive?: boolean;
    includeSelf?: boolean;
  };
  linksTo?: string[];
  is?: NodeTypeFilter;
  has?: ContentFilter;
  created?: { last: number };
  edited?: { by?: string; last?: number; since?: number };
  done?: { last: number };
  onDate?: string | { date: string; fieldId?: string; overlaps?: boolean };
  and?: SearchQuery[];
  or?: SearchQuery[];
  not?: SearchQuery;
  overdue?: true;
  inLibrary?: true;
  inWorkspace?: string;
}

export type NodeTypeFilter =
  | "done"
  | "todo"
  | "template"
  | "field"
  | "published"
  | "entity"
  | "calendarNode"
  | "onDayNode"
  | "chat"
  | "search"
  | "command"
  | "inLibrary";

export type ContentFilter =
  | "tag"
  | "field"
  | "media"
  | "audio"
  | "video"
  | "image";

export interface SearchOptions {
  limit?: number;
  workspaceIds?: string[];
}

export interface SearchResult extends Node {
  // Inherits all Node fields
}

// ============================================================================
// Mutation Types
// ============================================================================

export interface CreateTagOptions {
  workspaceId: string;
  name: string;
  description?: string;
  extendsTagIds?: string[];
  showCheckbox?: boolean;
}

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

export interface SetCheckboxOptions {
  tagId: string;
  showCheckbox: boolean;
  doneStateMapping?: {
    fieldId: string;
    checkedValues: string[];
    uncheckedValues?: string[];
  };
}

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

export interface ImportResult {
  success: boolean;
  nodeIds?: string[];
  error?: string;
}

// ============================================================================
// API Interface
// ============================================================================

export interface TanaAPI {
  /** Check API health */
  health(): Promise<{ status: string }>;

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
    getSchema(
      tagId: string,
      includeEditInstructions?: boolean
    ): Promise<string>;
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

// ============================================================================
// Sandbox Types
// ============================================================================

export interface SandboxResult {
  success: boolean;
  output: string;
  error?: string;
  durationMs: number;
}

export interface ScriptRun {
  id: number;
  timestamp: number;
  script: string;
  success: boolean;
  output: string;
  error: string | null;
  durationMs: number;
  sessionId: string | null;
}
