/**
 * Sandbox - Code Execution Engine
 *
 * Executes arbitrary TypeScript code with injected `tana` API object.
 * Features:
 * - AsyncFunction for top-level await support
 * - 10s timeout via Promise.race
 * - Duration tracking
 * - Automatic history persistence
 */

import type { TanaAPI, SandboxResult } from "./types";
import { saveScriptRun } from "./history";
import { createStdinHelper } from "./stdin";
import { createWorkflowHelper } from "./workflow";

const EXECUTION_TIMEOUT = 10_000; // 10 seconds

export async function executeSandbox(
  code: string,
  tana: TanaAPI,
  sessionId?: string,
  input?: string
): Promise<SandboxResult> {
  const startTime = performance.now();
  const logs: string[] = [];

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

  // Create helpers for script execution
  const stdin = createStdinHelper(input);
  const effectiveSessionId = sessionId ?? crypto.randomUUID();
  const workflow = createWorkflowHelper(effectiveSessionId);

  try {
    // Create async function to support top-level await
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const AsyncFunction = Object.getPrototypeOf(
      async function () {}
    ).constructor;

    const fn = new AsyncFunction("tana", "console", "stdin", "workflow", code);

    // Race between execution and timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timed out after ${EXECUTION_TIMEOUT}ms`));
      }, EXECUTION_TIMEOUT);
    });

    await Promise.race([fn(tana, sandboxConsole, stdin, workflow), timeoutPromise]);

    const durationMs = Math.round(performance.now() - startTime);
    const output = logs.join("\n");

    // Fire-and-forget save to history
    saveScriptRun(code, true, output, null, durationMs, effectiveSessionId);

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
    saveScriptRun(
      code,
      false,
      output,
      errorMessage,
      durationMs,
      effectiveSessionId
    );

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
