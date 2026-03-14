import { describe, it, expect, beforeAll, afterEach } from "bun:test";
import { initCompat, createDatabase } from "../src/compat";
import { bunCompat } from "../src/compat/bun";
import { join } from "path";
import { rmSync, existsSync } from "fs";
import { tmpdir } from "os";

const testDbPath = join(tmpdir(), `compat-test-${Date.now()}.db`);

describe("compat layer (bun adapter)", () => {
  beforeAll(() => {
    initCompat(bunCompat);
  });

  afterEach(() => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
  });

  it("creates a database and runs exec", () => {
    const db = createDatabase(testDbPath);
    db.exec("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)");
    db.close();
    expect(existsSync(testDbPath)).toBe(true);
  });

  it("prepare + stmt.run returns changes", () => {
    const db = createDatabase(testDbPath);
    db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)");

    const stmt = db.prepare("INSERT INTO items (value) VALUES (?)");
    const result = stmt.run("hello");

    expect(result.changes).toBe(1);
    db.close();
  });

  it("stmt.all returns rows", () => {
    const db = createDatabase(testDbPath);
    db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)");
    db.prepare("INSERT INTO items (value) VALUES (?)").run("foo");
    db.prepare("INSERT INTO items (value) VALUES (?)").run("bar");

    const rows = db.prepare("SELECT value FROM items ORDER BY id").all() as Array<{ value: string }>;

    expect(rows).toHaveLength(2);
    expect(rows[0].value).toBe("foo");
    expect(rows[1].value).toBe("bar");
    db.close();
  });

  it("delete stmt.run returns correct changes count", () => {
    const db = createDatabase(testDbPath);
    db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)");
    db.prepare("INSERT INTO items (value) VALUES (?)").run("a");
    db.prepare("INSERT INTO items (value) VALUES (?)").run("b");

    const result = db.prepare("DELETE FROM items").run();
    expect(result.changes).toBe(2);
    db.close();
  });
});

describe("bunCompat.transpileTS", () => {
  it("strips TypeScript types", () => {
    const tsCode = `const x: number = 42; console.log(x);`;
    const jsCode = bunCompat.transpileTS(tsCode);
    expect(jsCode).not.toContain(": number");
    expect(jsCode).toContain("42");
  });

  it("handles async/await", () => {
    const tsCode = `async function foo(): Promise<void> { await Promise.resolve(); }`;
    const jsCode = bunCompat.transpileTS(tsCode);
    expect(jsCode).toContain("async");
    expect(jsCode).toContain("await");
  });
});
