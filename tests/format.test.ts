import { describe, it, expect } from "bun:test";
import { format } from "../src/api/format";

describe("format (unit)", () => {
  describe("SearchResult[]", () => {
    it("formats search results with tags and breadcrumb", () => {
      const data = [
        {
          id: "abc123",
          name: "Meeting notes",
          breadcrumb: ["Work", "Projects"],
          tags: [{ id: "t1", name: "meeting" }],
          tagIds: ["t1"],
          workspaceId: "ws1",
          docType: "node",
          created: "2025-01-01",
          inTrash: false,
        },
        {
          id: "def456",
          name: "Grocery list",
          breadcrumb: ["Personal"],
          tags: [],
          tagIds: [],
          workspaceId: "ws1",
          docType: "node",
          created: "2025-01-02",
          inTrash: false,
        },
      ];

      const result = format(data);
      expect(result).toBe(
        "2 results:\n" +
          "  [abc123] Meeting notes #meeting — Work > Projects\n" +
          "  [def456] Grocery list — Personal"
      );
    });

    it("does not include raw JSON fields", () => {
      const data = [
        {
          id: "x",
          name: "Node",
          breadcrumb: [],
          tags: [],
          tagIds: [],
          workspaceId: "ws1",
          docType: "node",
          description: "some desc",
          created: "2025-01-01",
          inTrash: false,
        },
      ];

      const result = format(data);
      expect(result).not.toContain('"inTrash"');
      expect(result).not.toContain('"docType"');
      expect(result).not.toContain('"workspaceId"');
      expect(result).not.toContain('"created"');
    });
  });

  describe("Children", () => {
    it("formats children with total and hasMore", () => {
      const data = {
        children: [
          {
            id: "c1",
            name: "Child 1",
            tags: [{ id: "t1", name: "task" }],
            tagIds: ["t1"],
            childCount: 3,
            docType: "node",
            created: "2025-01-01",
            inTrash: false,
          },
          {
            id: "c2",
            name: "Child 2",
            tags: [],
            tagIds: [],
            childCount: 0,
            docType: "node",
            created: "2025-01-01",
            inTrash: false,
          },
        ],
        total: 10,
        hasMore: true,
      };

      const result = format(data);
      expect(result).toBe(
        "10 children (showing 2, has more):\n" +
          "  [c1] Child 1 #task (3 children)\n" +
          "  [c2] Child 2"
      );
    });

    it("shows no 'has more' when complete", () => {
      const data = {
        children: [
          {
            id: "c1",
            name: "Only child",
            tags: [],
            tagIds: [],
            childCount: 0,
            docType: "node",
            created: "2025-01-01",
            inTrash: false,
          },
        ],
        total: 1,
        hasMore: false,
      };

      const result = format(data);
      expect(result).toStartWith("1 children (showing 1):");
    });
  });

  describe("ChildNode[]", () => {
    it("formats standalone child node array", () => {
      const data = [
        {
          id: "n1",
          name: "Node A",
          tags: [{ id: "t1", name: "project" }],
          tagIds: ["t1"],
          childCount: 5,
          docType: "node",
          created: "2025-01-01",
          inTrash: false,
        },
      ];

      const result = format(data);
      expect(result).toBe("1 nodes:\n  [n1] Node A #project (5 children)");
    });
  });

  describe("Tag[]", () => {
    it("formats tag list", () => {
      const data = [
        { id: "tag1", name: "task" },
        { id: "tag2", name: "meeting" },
        { id: "tag3", name: "project", color: "blue" },
      ];

      const result = format(data);
      expect(result).toBe(
        "3 tags:\n  [tag1] task\n  [tag2] meeting\n  [tag3] project"
      );
    });
  });

  describe("Workspace[]", () => {
    it("formats workspace list", () => {
      const data = [
        { id: "ws1", name: "Personal", homeNodeId: "home1" },
        { id: "ws2", name: "Work", homeNodeId: "home2" },
      ];

      const result = format(data);
      expect(result).toBe(
        "2 workspaces:\n  [ws1] Personal (home: home1)\n  [ws2] Work (home: home2)"
      );
    });
  });

  describe("ImportResult", () => {
    it("formats successful import", () => {
      const data = { success: true, nodeIds: ["n1", "n2", "n3"] };
      const result = format(data);
      expect(result).toBe("Import success: 3 nodes (n1, n2, n3)");
    });

    it("formats failed import", () => {
      const data = { success: false, error: "Invalid Tana Paste format" };
      const result = format(data);
      expect(result).toBe("Import failed: Invalid Tana Paste format");
    });

    it("handles success with no nodeIds", () => {
      const data = { success: true, nodeIds: [] };
      const result = format(data);
      expect(result).toBe("Import success: 0 nodes");
    });
  });

  describe("string passthrough", () => {
    it("passes through strings unchanged", () => {
      const markdown = "# Tag Schema\n- field1: plain\n- field2: date";
      expect(format(markdown)).toBe(markdown);
    });

    it("passes through empty string", () => {
      expect(format("")).toBe("");
    });
  });

  describe("empty arrays", () => {
    it("formats empty array as '0 results'", () => {
      expect(format([])).toBe("0 results");
    });
  });

  describe("edge cases", () => {
    it("handles null", () => {
      expect(format(null)).toBe("null");
    });

    it("handles undefined", () => {
      expect(format(undefined)).toBe("undefined");
    });

    it("falls back to JSON for unknown objects", () => {
      const data = { foo: "bar", count: 42 };
      const result = format(data);
      expect(result).toContain('"foo"');
      expect(result).toContain('"bar"');
    });

    it("falls back to JSON for unknown arrays", () => {
      const data = [{ x: 1 }, { x: 2 }];
      const result = format(data);
      expect(result).toContain('"x"');
    });
  });
});

describe("format (integration)", () => {
  const apiUrl = process.env.TANA_API_URL ?? "http://localhost:8262";
  const apiToken = process.env.TANA_API_TOKEN;
  const workspaceId = "HfCy68zUUPM7";

  const canRunIntegration = async (): Promise<boolean> => {
    if (!apiToken) return false;
    try {
      const res = await fetch(`${apiUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  };

  const apiFetch = async <T>(path: string): Promise<T> => {
    const res = await fetch(`${apiUrl}${path}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  };

  it("formats real search results", async () => {
    if (!(await canRunIntegration())) {
      console.log("Skipping: Tana API not available");
      return;
    }

    const results = await apiFetch<unknown[]>(
      `/nodes/search?query[textContains]=test&limit=5&workspaceIds[0]=${workspaceId}`
    );

    const output = format(results);
    if (results.length > 0) {
      expect(output).toMatch(/^\d+ results:/);
      expect(output).not.toContain('"inTrash"');
      expect(output).not.toContain('"docType"');
    } else {
      expect(output).toBe("0 results");
    }
  });

  it("formats real tag list", async () => {
    if (!(await canRunIntegration())) {
      console.log("Skipping: Tana API not available");
      return;
    }

    const tags = await apiFetch<unknown[]>(
      `/workspaces/${workspaceId}/tags?limit=10`
    );

    const output = format(tags);
    if (tags.length > 0) {
      expect(output).toMatch(/^\d+ tags:/);
      expect(output).toContain("[");
    } else {
      expect(output).toBe("0 results");
    }
  });

  it("formats real workspace list", async () => {
    if (!(await canRunIntegration())) {
      console.log("Skipping: Tana API not available");
      return;
    }

    const workspaces = await apiFetch<unknown[]>("/workspaces");

    const output = format(workspaces);
    expect(output).toMatch(/^\d+ workspaces:/);
    expect(output).toContain("home:");
  });

  it("formats real children response", async () => {
    if (!(await canRunIntegration())) {
      console.log("Skipping: Tana API not available");
      return;
    }

    const homeNode = "L5LXruUwGET9";
    const children = await apiFetch<unknown>(
      `/nodes/${homeNode}/children?limit=5`
    );

    const output = format(children);
    expect(output).toMatch(/^\d+ children/);
    expect(output).not.toContain('"inTrash"');
  });
});
