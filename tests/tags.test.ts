import { describe, it, expect, mock } from "bun:test";
import { createTanaAPI, parseTagParents } from "../src/api/tana";
import type { TanaClient } from "../src/api/client";

// Extends lines as the Tana Local API returned them in eval runs
describe("parseTagParents", () => {
  it("returns no parents when the schema has no Extends line", () => {
    expect(parseTagParents("# Tag definition: note (id:abc)\n\n- **Status**")).toEqual([]);
  });

  it("parses a user-defined parent", () => {
    const md = "# Tag definition: bug (id:b1)\nExtends #task (id:oeFfqNwQvwtu)";
    expect(parseTagParents(md)).toEqual([
      { id: "oeFfqNwQvwtu", name: "task", baseType: false },
    ]);
  });

  // Haiku read "(base type)" as a circular reference when given the prose
  it("flags a built-in base type without folding it into the name", () => {
    const md = "# Tag definition: task (id:t1)\nExtends #task (base type) (id:SYS_T100)";
    expect(parseTagParents(md)).toEqual([
      { id: "SYS_T100", name: "task", baseType: true },
    ]);
  });

  it("parses several parents with formatted names", () => {
    const md =
      "# Tag definition: x (id:x1)\nExtends #▷<i>work</i> (id:521ZygBBwwZf), #▷<i>container option</i> (id:XjZpKbzGNxrE)";
    expect(parseTagParents(md)).toEqual([
      { id: "521ZygBBwwZf", name: "▷<i>work</i>", baseType: false },
      { id: "XjZpKbzGNxrE", name: "▷<i>container option</i>", baseType: false },
    ]);
  });
});

describe("tags.getParents", () => {
  it("fetches the schema and returns its parents as data", async () => {
    const get = mock(() =>
      Promise.resolve({ markdown: "# Tag definition: day (id:d1)\nExtends #day (base type) (id:SYS_T124)" })
    );
    const tana = createTanaAPI({ get } as unknown as TanaClient);

    expect(await tana.tags.getParents("d1")).toEqual([
      { id: "SYS_T124", name: "day", baseType: true },
    ]);
    expect(get).toHaveBeenCalledWith(
      "/tags/d1/schema?includeEditInstructions=false&includeInheritedFields=true"
    );
  });
});
