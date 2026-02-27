/**
 * Tool Description - Markdown Documentation
 */

export const TOOL_DESCRIPTION = `Execute TypeScript code to interact with Tana.

## APIs

tana.workspace → Workspace | null (pre-resolved default workspace)
tana.health() → { status }
tana.workspaces.list() → Workspace[] { id, name, homeNodeId }

### Nodes
tana.nodes.search(query, options?) → SearchResult[]
tana.nodes.read(nodeId, maxDepth?) → string (markdown)
tana.nodes.getChildren(nodeId, { limit?, offset? }) → { children, total, hasMore }
tana.nodes.edit({ nodeId, name?, description? }) → { success }
tana.nodes.trash(nodeId) → { success }
tana.nodes.check(nodeId) / uncheck(nodeId) → { success }

### Tags
tana.tags.list(workspaceId, limit?) → Tag[]
tana.tags.getSchema(tagId, includeEditInstructions?) → string
tana.tags.modify(nodeId, "add"|"remove", tagIds[])
tana.tags.create({ workspaceId, name, description?, extendsTagIds?, showCheckbox? })
tana.tags.addField({ tagId, name, dataType: "plain"|"number"|"date"|"url"|"email"|"checkbox"|"user"|"instance"|"options", ... })
tana.tags.setCheckbox({ tagId, showCheckbox, doneStateMapping? })

### Fields
tana.fields.setOption(nodeId, attributeId, optionId)
tana.fields.setContent(nodeId, attributeId, content)

### Calendar
tana.calendar.getOrCreate(workspaceId, "day"|"week"|"month"|"year", date?)

### Import
tana.import(parentNodeId, tanaPasteContent) → { success, nodeIds? }

### Formatting
tana.format(data) → string (compact display of any API response)

### Entry Points
inbox: \`\${workspaceId}_CAPTURE_INBOX\`
library: \`\${workspaceId}_STASH\`

## Edit (search-and-replace)

tana.nodes.edit({ nodeId, name: { old_string, new_string }, description: { old_string, new_string } })
Empty old_string matches absent field.

## Search Query Operators

{ textContains: string } | { textMatches: "/regex/i" }
{ hasType: tagId } | { field: { fieldId, stringValue?, numberValue?, nodeId?, state? } }
{ compare: { fieldId, operator: "gt"|"lt"|"eq", value, type } }
{ childOf: { nodeIds[], recursive?, includeRefs? } } | { ownedBy: { nodeId, recursive?, includeSelf? } }
{ linksTo: nodeIds[] }
{ is: "done"|"todo"|"template"|"entity"|"calendarNode"|"search"|"inLibrary" }
{ has: "tag"|"field"|"media"|"audio"|"video"|"image" }
{ created: { last: N } } | { edited: { last?, by?, since? } } | { done: { last: N } }
{ onDate: "YYYY-MM-DD" | { date, fieldId?, overlaps? } }
{ overdue: true } | { inLibrary: true }
{ and: [...] } | { or: [...] } | { not: {...} }

## Default Workspace

tana.workspace is pre-resolved if MAIN_TANA_WORKSPACE is configured.
Always prefer it over workspaces.list():
\`\`\`
const ws = tana.workspace;
if (ws) { /* use ws.id, ws.name */ } else { const [ws] = await tana.workspaces.list(); }
\`\`\`

## Output

console.log() output becomes LLM context. Keep it compact:
- Use tana.format(data) for any API response, or .map() for task-specific fields
- Batch work in one execute call — a script with a loop beats multiple calls
- Never JSON.stringify API responses

## API Notes

- search: max 100 results, no pagination. Narrow the query to get different results.
- getChildren: supports limit + offset for pagination.
- 10s timeout per execute call. If something times out:
  - tags.list? → try search({ hasType: "SYS_T01" }) instead
  - node read? → reduce maxDepth or use getChildren

## Examples

Search: await tana.nodes.search({ and: [{ hasType: "tagId" }, { is: "todo" }] })

Import:
\`\`\`
await tana.import(parentNodeId, \`
- Node #[[^tagId]]
  - [[^fieldId]]:: value
- [ ] Todo item
\`)
\`\`\`

`;
