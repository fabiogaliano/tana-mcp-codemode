/**
 * Tool Description - Markdown Documentation
 *
 * This serves as the tool's description that AI models see.
 * Comprehensive examples help the AI understand how to use the API.
 */

export const TOOL_DESCRIPTION = `Execute TypeScript code to interact with Tana.

## Available APIs

### Workspaces
\`\`\`typescript
await tana.workspaces.list()  // → Workspace[] (id, name, homeNodeId)
\`\`\`

### Nodes
\`\`\`typescript
await tana.nodes.search(query, options?)     // → SearchResult[]
await tana.nodes.read(nodeId, maxDepth?)     // → string (markdown)
await tana.nodes.getChildren(nodeId, opts?)  // → { children, total, hasMore }
await tana.nodes.edit({ nodeId, name?, description? })  // → { success }
await tana.nodes.trash(nodeId)               // → { success }
await tana.nodes.check(nodeId)               // → { success } (mark done)
await tana.nodes.uncheck(nodeId)             // → { success } (mark undone)
\`\`\`

### Tags (Supertags)
\`\`\`typescript
await tana.tags.list(workspaceId, limit?)    // → Tag[]
await tana.tags.getSchema(tagId, includeEditInstructions?)  // → string (markdown)
await tana.tags.modify(nodeId, action, tagIds)  // action: "add" | "remove"
await tana.tags.create({ workspaceId, name, description?, extendsTagIds?, showCheckbox? })
await tana.tags.addField({ tagId, name, dataType, ... })
await tana.tags.setCheckbox({ tagId, showCheckbox, doneStateMapping? })
\`\`\`

### Fields
\`\`\`typescript
await tana.fields.setOption(nodeId, attributeId, optionId)   // for dropdown fields
await tana.fields.setContent(nodeId, attributeId, content)   // for text/date/url fields
\`\`\`

### Calendar
\`\`\`typescript
await tana.calendar.getOrCreate(workspaceId, granularity, date?)
// granularity: "day" | "week" | "month" | "year"
\`\`\`

### Import (Tana Paste)
\`\`\`typescript
await tana.import(parentNodeId, tanaPasteContent)  // → { success, nodeIds?, error? }
\`\`\`

### Utility
\`\`\`typescript
await tana.health()  // → { status: "ok" }
\`\`\`

### stdin() - Input Data Helper
Pass data to scripts via the \`input\` parameter, then access it with \`stdin()\`:
\`\`\`typescript
// Parse JSON input
const data = stdin().json<{ ids: string[] }>();
console.log("Processing", data.ids.length, "items");

// Get lines (for lists)
const lines = stdin().lines();
for (const line of lines) {
  console.log("Line:", line);
}

// Raw text
const text = stdin().text();

// Check if input exists
if (stdin().hasInput()) {
  // process input
}
\`\`\`

### workflow - Progress Tracking
Track multi-step operations with timeline events:
\`\`\`typescript
workflow.start("Processing nodes");
workflow.step("Fetching workspaces");
const workspaces = await tana.workspaces.list();
workflow.progress(1, workspaces.length, "Processing");
// ... do work ...
workflow.complete("Done!");
// Or on failure: workflow.abort("Error: could not connect");
\`\`\`

---

## Search Query Examples

**Find by text:**
\`\`\`typescript
const results = await tana.nodes.search({ textContains: "meeting notes" });
\`\`\`

**Find by tag:**
\`\`\`typescript
const projects = await tana.nodes.search({ hasType: "projectTagId" });
\`\`\`

**Complex query (AND):**
\`\`\`typescript
const results = await tana.nodes.search({
  and: [
    { hasType: "taskTagId" },
    { is: "todo" },
    { created: { last: 7 } }
  ]
});
\`\`\`

**Find with field value:**
\`\`\`typescript
const results = await tana.nodes.search({
  hasType: "bookTagId",
  field: { fieldId: "statusFieldId", stringValue: "Reading" }
});
\`\`\`

---

## Import Examples

**Simple nodes:**
\`\`\`typescript
await tana.import(parentNodeId, \`
- First item
  - Nested child
- Second item
\`);
\`\`\`

**With tags and fields:**
\`\`\`typescript
await tana.import(parentNodeId, \`
- Project Alpha #[[^projectTagId]]
  - [[^statusFieldId]]:: Active
  - [[^dueDateFieldId]]:: [[date:2024-03-15]]
\`);
\`\`\`

**Task with checkbox:**
\`\`\`typescript
await tana.import(parentNodeId, \`
- [ ] Review proposal
- [x] Send email
\`);
\`\`\`

---

## Output

Use \`console.log()\` to return data. Only logged output is returned.

\`\`\`typescript
const workspaces = await tana.workspaces.list();
console.log({ workspaces });

const results = await tana.nodes.search({ textContains: "meeting" });
console.log("Found:", results.length, "nodes");
\`\`\`

## Passing Data to Scripts

Use the \`input\` parameter to pass data that scripts can read via \`stdin()\`:

\`\`\`typescript
// Tool call: { "code": "...", "input": "{\\"nodeIds\\": [\\"abc\\"]}" }

// In script:
const { nodeIds } = stdin().json<{ nodeIds: string[] }>();
for (const id of nodeIds) {
  const content = await tana.nodes.read(id);
  console.log(content);
}
\`\`\`
`;
