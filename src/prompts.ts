/**
 * Tool Description - Markdown Documentation
 */

export const TOOL_DESCRIPTION = `Execute TypeScript code to interact with Tana.

## APIs

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

### Entry Points
inbox: \`\${workspaceId}_CAPTURE_INBOX\`
library: \`\${workspaceId}_STASH\`

### Helpers
stdin().json<T>() | .lines() | .text() | .hasInput()
workflow.start(msg) | .step(msg) | .progress(n, total, msg) | .complete(msg) | .abort(err)

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

## Output

console.log() to return data.
`;
