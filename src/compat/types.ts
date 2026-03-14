export interface CompatStatement {
  run(...params: unknown[]): { changes: number };
  all(...params: unknown[]): unknown[];
}

export interface CompatDatabase {
  exec(sql: string): void;
  prepare(sql: string): CompatStatement;
  close(): void;
}

export interface CompatOps {
  createDatabase(path: string): CompatDatabase;
  transpileTS(code: string): string;
}
