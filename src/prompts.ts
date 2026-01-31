/**
 * Tool Description - Markdown Documentation
 */

export const TOOL_DESCRIPTION = `Execute TypeScript code to interact with Tana.

## Available APIs

\`\`\`
await tana.health()  // → { status: "ok" }
await tana.workspaces.list()  // → Workspace[] (id, name, homeNodeId)
\`\`\`

### Nodes
\`\`\`
await tana.nodes.search(query, options?)     // → SearchResult[]
await tana.nodes.read(nodeId, maxDepth?)     // → string (markdown)
await tana.nodes.getChildren(nodeId, opts?)  // → { children, total, hasMore }
await tana.nodes.edit({ nodeId, name?, description? })  // → { success } (see Edit below)
await tana.nodes.trash(nodeId)               // → { success }
await tana.nodes.check(nodeId)               // → { success } (mark done)
await tana.nodes.uncheck(nodeId)             // → { success } (mark undone)
\`\`\`

### Tags (Supertags)
\`\`\`
await tana.tags.list(workspaceId, limit?)    // → Tag[]
await tana.tags.getSchema(tagId, includeEditInstructions?)  // → string (markdown)
await tana.tags.modify(nodeId, action, tagIds)  // action: "add" | "remove"
await tana.tags.create({ workspaceId, name, description?, extendsTagIds?, showCheckbox? })
await tana.tags.addField({ tagId, name, dataType, ... })
// dataType: "plain" | "number" | "date" | "url" | "email" | "checkbox" | "user" | "instance" | "options"
await tana.tags.setCheckbox({ tagId, showCheckbox, doneStateMapping? })
\`\`\`

### Fields
\`\`\`
await tana.fields.setOption(nodeId, attributeId, optionId)   // for dropdown fields
await tana.fields.setContent(nodeId, attributeId, content)   // for text/date/url fields
\`\`\`

### Calendar
\`\`\`
await tana.calendar.getOrCreate(workspaceId, granularity, date?)
// granularity: "day" | "week" | "month" | "year"
\`\`\`

### Import (Tana Paste)
\`\`\`
await tana.import(parentNodeId, tanaPasteContent)  // → { success, nodeIds?, error? }
\`\`\`

### Entry Points
\`\`\`
const inbox = \`\${workspaceId}_CAPTURE_INBOX\`;  // Quick capture inbox
const library = \`\${workspaceId}_STASH\`;        // Library/stash
\`\`\`

### Helpers
\`\`\`
// stdin() - access input parameter
stdin().json<T>()    // parse JSON
stdin().lines()      // split by newlines
stdin().text()       // raw string
stdin().hasInput()   // check if input exists

// workflow - progress tracking
workflow.start("msg")
workflow.step("msg")
workflow.progress(current, total, "msg")
workflow.complete("msg") // or workflow.abort("error")
\`\`\`

## Edit Node

Uses search-and-replace:
\`\`\`
await tana.nodes.edit({
  nodeId: "abc123",
  name: { old_string: "Draft:", new_string: "Final:" },
  description: { old_string: "", new_string: "Added" }  // empty matches absent
});
\`\`\`

## Search Query Reference

| Operator | Description |
|----------|-------------|
| \`textContains\` | Case-insensitive substring match |
| \`textMatches\` | Regex pattern (e.g., \`/meeting.*/i\`) |
| \`hasType\` | Find nodes with tag ID |
| \`field\` | Match field value: \`{ fieldId, stringValue?, numberValue?, nodeId?, state? }\` |
| \`compare\` | Compare field: \`{ fieldId, operator: "gt"\\|"lt"\\|"eq", value, type }\` |
| \`childOf\` | Children of nodes: \`{ nodeIds, recursive?, includeRefs? }\` |
| \`ownedBy\` | Owned by node: \`{ nodeId, recursive?, includeSelf? }\` |
| \`linksTo\` | Nodes linking to IDs: \`["nodeId1", "nodeId2"]\` |
| \`is\` | Node type: \`"done"\\|"todo"\\|"template"\\|"entity"\\|"calendarNode"\\|"search"\\|"inLibrary"\` |
| \`has\` | Has content: \`"tag"\\|"field"\\|"media"\\|"audio"\\|"video"\\|"image"\` |
| \`created\` | Created in last N days: \`{ last: 7 }\` |
| \`edited\` | Edited recently: \`{ last?: N, by?: email, since?: timestamp }\` |
| \`done\` | Completed in last N days: \`{ last: 7 }\` |
| \`onDate\` | On date: \`"2024-03-15"\` or \`{ date, fieldId?, overlaps? }\` |
| \`overdue\` | Tasks past due date: \`true\` |
| \`inLibrary\` | Nodes in library/stash: \`true\` |
| \`and\` | All conditions match: \`[...queries]\` |
| \`or\` | Any condition matches: \`[...queries]\` |
| \`not\` | Negate condition: \`{ ...query }\` |

## Examples

**Search:**
\`\`\`
await tana.nodes.search({ textContains: "meeting" });
await tana.nodes.search({ hasType: "tagId", field: { fieldId: "status", stringValue: "Active" } });
await tana.nodes.search({ and: [{ hasType: "taskId" }, { is: "todo" }, { created: { last: 7 } }] });
\`\`\`

**Import:**
\`\`\`
await tana.import(parentNodeId, \`
- Project Alpha #[[^projectTagId]]
  - [[^statusFieldId]]:: Active
  - [[^dueDateFieldId]]:: [[date:2024-03-15]]
- [ ] Task item
\`);
\`\`\`

## Output

Use \`console.log()\` to return data. Only logged output is returned.
`;
