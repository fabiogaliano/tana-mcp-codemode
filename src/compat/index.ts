import type { CompatDatabase, CompatOps } from "./types";

export type { CompatDatabase, CompatStatement, CompatOps } from "./types";

let ops: CompatOps | null = null;

export function initCompat(compatOps: CompatOps): void {
  if (ops) {
    console.warn("initCompat called multiple times — overwriting previous compat ops");
  }
  ops = compatOps;
}

function getOps(): CompatOps {
  if (!ops) {
    throw new Error(
      "compat not initialized — call initCompat() before using createDatabase or transpileTS"
    );
  }
  return ops;
}

export function createDatabase(path: string): CompatDatabase {
  return getOps().createDatabase(path);
}

export function transpileTS(code: string): string {
  return getOps().transpileTS(code);
}
