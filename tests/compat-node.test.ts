/**
 * Tests the Node.js compat adapter (better-sqlite3 + esbuild).
 * Skipped when better-sqlite3 native binary is unavailable (e.g. Bun CI without node-gyp).
 * Run these with Node.js after `npm install` to get the compiled native module.
 */
import { describe, it, expect, afterEach } from "bun:test";
import { join } from "path";
import { rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const betterSqliteAvailable = (() => {
  try {
    req("better-sqlite3");
    return true;
  } catch {
    return false;
  }
})();

const testDbPath = join(tmpdir(), `compat-node-test-${Date.now()}.db`);

afterEach(() => {
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }
});

describe("nodeCompat.createDatabase", () => {
  it.skipIf(!betterSqliteAvailable)("creates a database and runs exec", async () => {
    const { nodeCompat } = await import("../src/compat/node");
    const db = nodeCompat.createDatabase(testDbPath);
    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
    db.close();
    expect(existsSync(testDbPath)).toBe(true);
  });

  it.skipIf(!betterSqliteAvailable)("prepare + stmt.run returns changes", async () => {
    const { nodeCompat } = await import("../src/compat/node");
    const db = nodeCompat.createDatabase(testDbPath);
    db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)");

    const stmt = db.prepare("INSERT INTO items (value) VALUES (?)");
    const result = stmt.run("hello");

    expect(result.changes).toBe(1);
    db.close();
  });

  it.skipIf(!betterSqliteAvailable)("stmt.all returns rows", async () => {
    const { nodeCompat } = await import("../src/compat/node");
    const db = nodeCompat.createDatabase(testDbPath);
    db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)");
    db.prepare("INSERT INTO items (value) VALUES (?)").run("foo");
    db.prepare("INSERT INTO items (value) VALUES (?)").run("bar");

    const rows = db.prepare("SELECT value FROM items ORDER BY id").all() as Array<{ value: string }>;

    expect(rows).toHaveLength(2);
    expect(rows[0].value).toBe("foo");
    expect(rows[1].value).toBe("bar");
    db.close();
  });

  it.skipIf(!betterSqliteAvailable)("delete stmt.run returns correct changes count", async () => {
    const { nodeCompat } = await import("../src/compat/node");
    const db = nodeCompat.createDatabase(testDbPath);
    db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)");
    db.prepare("INSERT INTO items (value) VALUES (?)").run("a");
    db.prepare("INSERT INTO items (value) VALUES (?)").run("b");

    const result = db.prepare("DELETE FROM items").run();
    expect(result.changes).toBe(2);
    db.close();
  });
});

describe("nodeCompat.transpileTS", () => {
  it("strips TypeScript types", async () => {
    const { nodeCompat } = await import("../src/compat/node");
    const tsCode = `const x: number = 42; console.log(x);`;
    const jsCode = nodeCompat.transpileTS(tsCode);
    expect(jsCode).not.toContain(": number");
    expect(jsCode).toContain("42");
  });

  it("handles async/await", async () => {
    const { nodeCompat } = await import("../src/compat/node");
    const tsCode = `async function foo(): Promise<void> { await Promise.resolve(); }`;
    const jsCode = nodeCompat.transpileTS(tsCode);
    expect(jsCode).toContain("async");
    expect(jsCode).toContain("await");
  });
});
