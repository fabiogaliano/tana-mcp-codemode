/**
 * Sandbox - Code Execution Engine
 *
 * Executes arbitrary TypeScript code with injected `tana` API object.
 * Features:
 * - AsyncFunction for top-level await support
 * - 10s timeout via Promise.race
 * - Duration tracking
 * - Automatic history persistence with API call tracking
 */

import type { SandboxResult } from "../types";
import type { TanaAPI } from "../api/tana";
import { saveScriptRun } from "../storage/history";
import { createWorkflowHelper } from "./workflow";

const EXECUTION_TIMEOUT = 10_000; // 10 seconds

/**
 * Wraps the tana API to track which methods are called
 */
function createTrackedTanaAPI(
  tana: TanaAPI,
  tracker: { calls: string[]; nodeIds: Set<string>; workspaceId: string | null }
): TanaAPI {
  const track = <T>(method: string, fn: () => Promise<T>): Promise<T> => {
    tracker.calls.push(method);
    return fn();
  };

  const trackNodeId = (id: string) => tracker.nodeIds.add(id);

  return {
    workspace: tana.workspace,

    health: () => track("health", () => tana.health()),

    workspaces: {
      list: () => track("workspaces.list", () => tana.workspaces.list()),
    },

    nodes: {
      search: (query, options) => {
        if (options?.workspaceIds?.[0]) {
          tracker.workspaceId = options.workspaceIds[0];
        }
        return track("nodes.search", () => tana.nodes.search(query, options));
      },
      read: (nodeId, maxDepth) => {
        trackNodeId(nodeId);
        return track("nodes.read", () => tana.nodes.read(nodeId, maxDepth));
      },
      getChildren: (nodeId, options) => {
        trackNodeId(nodeId);
        return track("nodes.getChildren", () => tana.nodes.getChildren(nodeId, options));
      },
      edit: (options) => {
        trackNodeId(options.nodeId);
        return track("nodes.edit", () => tana.nodes.edit(options));
      },
      trash: (nodeId) => {
        trackNodeId(nodeId);
        return track("nodes.trash", () => tana.nodes.trash(nodeId));
      },
      check: (nodeId) => {
        trackNodeId(nodeId);
        return track("nodes.check", () => tana.nodes.check(nodeId));
      },
      uncheck: (nodeId) => {
        trackNodeId(nodeId);
        return track("nodes.uncheck", () => tana.nodes.uncheck(nodeId));
      },
    },

    tags: {
      list: (workspaceId, limit) => {
        tracker.workspaceId = workspaceId;
        return track("tags.list", () => tana.tags.list(workspaceId, limit));
      },
      getSchema: (tagId, includeEditInstructions) =>
        track("tags.getSchema", () => tana.tags.getSchema(tagId, includeEditInstructions)),
      modify: (nodeId, action, tagIds) => {
        trackNodeId(nodeId);
        return track("tags.modify", () => tana.tags.modify(nodeId, action, tagIds));
      },
      create: (options) => {
        tracker.workspaceId = options.workspaceId;
        return track("tags.create", () => tana.tags.create(options));
      },
      addField: (options) =>
        track("tags.addField", () => tana.tags.addField(options)),
      setCheckbox: (options) =>
        track("tags.setCheckbox", () => tana.tags.setCheckbox(options)),
    },

    fields: {
      setOption: (nodeId, attributeId, optionId) => {
        trackNodeId(nodeId);
        return track("fields.setOption", () => tana.fields.setOption(nodeId, attributeId, optionId));
      },
      setContent: (nodeId, attributeId, content) => {
        trackNodeId(nodeId);
        return track("fields.setContent", () => tana.fields.setContent(nodeId, attributeId, content));
      },
    },

    calendar: {
      getOrCreate: (workspaceId, granularity, date) => {
        tracker.workspaceId = workspaceId;
        return track("calendar.getOrCreate", () =>
          tana.calendar.getOrCreate(workspaceId, granularity, date)
        );
      },
    },

    import: (parentNodeId, content) => {
      trackNodeId(parentNodeId);
      return track("import", () => tana.import(parentNodeId, content));
    },
  };
}

export async function executeSandbox(
  code: string,
  tana: TanaAPI,
  sessionId?: string
): Promise<SandboxResult> {
  const startTime = performance.now();
  const logs: string[] = [];

  // Track API usage
  const tracker = {
    calls: [] as string[],
    nodeIds: new Set<string>(),
    workspaceId: tana.workspace?.id ?? null,
  };

  // Custom console that captures output
  const sandboxConsole = {
    log: (...args: unknown[]) => {
      logs.push(args.map(formatArg).join(" "));
    },
    error: (...args: unknown[]) => {
      logs.push(`[ERROR] ${args.map(formatArg).join(" ")}`);
    },
    warn: (...args: unknown[]) => {
      logs.push(`[WARN] ${args.map(formatArg).join(" ")}`);
    },
    info: (...args: unknown[]) => {
      logs.push(args.map(formatArg).join(" "));
    },
  };

  const effectiveSessionId = sessionId ?? crypto.randomUUID();
  const workflow = createWorkflowHelper(effectiveSessionId);

  // Wrap tana to track API calls
  const trackedTana = createTrackedTanaAPI(tana, tracker);

  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const AsyncFunction = Object.getPrototypeOf(
      async function () {}
    ).constructor;

    // Globals to shadow (will receive undefined to prevent accidental access)
    // Note: This is defense-in-depth, not a security sandbox
    const shadowedGlobals = [
      "process",
      "require",
      "Bun",
      "Deno",
      "globalThis",
      "global",
      "eval",
      "Function",
      "__dirname",
      "__filename",
      "module",
      "exports",
    ];

    const fn = new AsyncFunction(
      "tana",
      "console",
      "workflow",
      ...shadowedGlobals,
      code
    );

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timed out after ${EXECUTION_TIMEOUT}ms`));
      }, EXECUTION_TIMEOUT);
    });

    const undefinedArgs = shadowedGlobals.map(() => undefined);
    await Promise.race([
      fn(trackedTana, sandboxConsole, workflow, ...undefinedArgs),
      timeoutPromise,
    ]);

    const durationMs = Math.round(performance.now() - startTime);
    const output = logs.join("\n");

    // Fire-and-forget save to history
    saveScriptRun({
      script: code,
      success: true,
      output,
      error: null,
      durationMs,
      sessionId: effectiveSessionId,
      apiCalls: tracker.calls.length > 0 ? tracker.calls : null,
      nodeIdsAffected: tracker.nodeIds.size > 0 ? Array.from(tracker.nodeIds) : null,
      workspaceId: tracker.workspaceId,
    });

    return {
      success: true,
      output,
      durationMs,
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime);
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const output = logs.join("\n");

    // Fire-and-forget save to history
    saveScriptRun({
      script: code,
      success: false,
      output,
      error: errorMessage,
      durationMs,
      sessionId: effectiveSessionId,
      apiCalls: tracker.calls.length > 0 ? tracker.calls : null,
      nodeIdsAffected: tracker.nodeIds.size > 0 ? Array.from(tracker.nodeIds) : null,
      workspaceId: tracker.workspaceId,
    });

    return {
      success: false,
      output,
      error: errorMessage,
      durationMs,
    };
  }
}

function formatArg(arg: unknown): string {
  if (arg === null) return "null";
  if (arg === undefined) return "undefined";
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean") return String(arg);
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}
