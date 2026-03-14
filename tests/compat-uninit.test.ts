/**
 * Tests compat behavior before initCompat() is called.
 * MUST be a separate file — Bun isolates module state per test file,
 * so this file sees ops=null while compat.test.ts calls initCompat in beforeEach.
 */
import { describe, it, expect } from "bun:test";
import { createDatabase, transpileTS } from "../src/compat";

describe("compat before initCompat", () => {
  it("createDatabase throws if not initialized", () => {
    expect(() => createDatabase("/tmp/never.db")).toThrow("compat not initialized");
  });

  it("transpileTS throws if not initialized", () => {
    expect(() => transpileTS("const x: number = 1")).toThrow("compat not initialized");
  });
});
