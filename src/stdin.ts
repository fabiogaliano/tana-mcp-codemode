/**
 * stdin() Helper
 *
 * Provides convenient methods for handling input data passed to scripts.
 * In MCP context, this handles data passed via the `input` parameter.
 *
 * Usage in scripts:
 *   const data = stdin().json();   // Parse as JSON
 *   const lines = stdin().lines(); // Split into lines
 *   const text = stdin().text();   // Raw trimmed text
 */

export interface StdinHelper {
  /** Get raw input as trimmed string */
  text(): string;
  /** Split input into array of lines (empty lines filtered) */
  lines(): string[];
  /** Parse input as JSON (throws if invalid) */
  json<T = unknown>(): T;
  /** Parse input as JSON, return null if invalid */
  jsonSafe<T = unknown>(): T | null;
  /** Check if any input was provided */
  hasInput(): boolean;
}

export function createStdinHelper(input: string | undefined): () => StdinHelper {
  const rawInput = input ?? "";

  return () => ({
    text(): string {
      return rawInput.trim();
    },

    lines(): string[] {
      return rawInput
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    },

    json<T = unknown>(): T {
      const text = rawInput.trim();
      if (!text) {
        throw new Error("stdin is empty - no JSON to parse");
      }
      try {
        return JSON.parse(text) as T;
      } catch (e) {
        throw new Error(
          `Failed to parse stdin as JSON: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    },

    jsonSafe<T = unknown>(): T | null {
      const text = rawInput.trim();
      if (!text) return null;
      try {
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    },

    hasInput(): boolean {
      return rawInput.trim().length > 0;
    },
  });
}
