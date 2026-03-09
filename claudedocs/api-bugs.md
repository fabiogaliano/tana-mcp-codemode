# Tana Local API Bugs

## setOption append mode clears field instead of appending

**Status:** Active workaround in `src/api/tana.ts`

### Reproduction

```
POST /nodes/{nodeId}/fields/{fieldId}/option
{ "optionId": "opt1", "mode": "replace" }   → sets opt1 ✓

POST /nodes/{nodeId}/fields/{fieldId}/option
{ "optionId": "opt2", "mode": "append" }    → clears field, sets only opt2 ✗
```

Expected: field has [opt1, opt2]. Actual: field has [opt2] only.

### Workaround

`setOption` with `string[]` uses a tuple-import bypass:

1. Set first value via normal API (`mode: "replace"`)
2. Find the field's tuple node via `getChildren` (scan for `docType === "tuple"`, then verify sub-child matches `attributeId`)
3. Import remaining values as `[[^optionId]]` refs into the tuple

### Report for Tana team

The `setFieldOption` endpoint's `append` mode behaves identically to `replace` — it clears the existing field value before setting the new one, instead of adding to the existing values. Tested against Tana Local API with multi-value Options fields.
