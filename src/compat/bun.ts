import { Database } from "bun:sqlite";
import type { CompatDatabase, CompatOps, CompatStatement } from "./types";

function wrapStatement(stmt: ReturnType<Database["prepare"]>): CompatStatement {
  return {
    run(...params: unknown[]) {
      const result = stmt.run(...(params as Parameters<typeof stmt.run>));
      return { changes: result.changes };
    },
    all(...params: unknown[]) {
      return stmt.all(...(params as Parameters<typeof stmt.all>)) as unknown[];
    },
  };
}

function wrapDatabase(db: Database): CompatDatabase {
  return {
    exec(sql: string) {
      db.run(sql);
    },
    prepare(sql: string) {
      return wrapStatement(db.prepare(sql));
    },
    close() {
      db.close();
    },
  };
}

export const bunCompat: CompatOps = {
  createDatabase(path: string): CompatDatabase {
    return wrapDatabase(new Database(path, { create: true }));
  },

  transpileTS(code: string): string {
    const transpiler = new Bun.Transpiler({ loader: "ts" });
    return transpiler.transformSync(code);
  },
};
