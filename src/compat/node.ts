import { createRequire } from "node:module";
import type { CompatDatabase, CompatOps, CompatStatement } from "./types";

const require = createRequire(import.meta.url);

function getBetterSqlite3(): any {
  try {
    return require("better-sqlite3");
  } catch {
    throw new Error(
      "better-sqlite3 is required for Node.js. Install it: npm install better-sqlite3"
    );
  }
}

function getEsbuild(): any {
  try {
    return require("esbuild");
  } catch {
    throw new Error(
      "esbuild is required for Node.js. Install it: npm install esbuild"
    );
  }
}

function wrapStatement(stmt: any): CompatStatement {
  return {
    run(...params: unknown[]) {
      const result = stmt.run(...params);
      return { changes: result.changes };
    },
    all(...params: unknown[]) {
      return stmt.all(...params) as unknown[];
    },
  };
}

function wrapDatabase(db: any): CompatDatabase {
  return {
    exec(sql: string) {
      db.exec(sql);
    },
    prepare(sql: string) {
      return wrapStatement(db.prepare(sql));
    },
    close() {
      db.close();
    },
  };
}

export const nodeCompat: CompatOps = {
  createDatabase(path: string): CompatDatabase {
    const BetterSqlite3 = getBetterSqlite3();
    return wrapDatabase(new BetterSqlite3(path));
  },

  transpileTS(code: string): string {
    const esbuild = getEsbuild();
    return esbuild.transformSync(code, { loader: "ts" }).code;
  },
};
