# Annotation Adjudication Prompt

You are adjudicating model proposals for a NoAI sealed benchmark document.

Your job is to produce the gold annotation file. Do not use NoAI engine output.
Do not optimize for any current engine behavior. Decide what a careful human
reviewer would expect to be redacted or kept readable.

## Inputs

You will receive:

1. The exact document text.
2. The benchmark metadata.
3. Two or more model annotation proposals in the standard schema.

## Adjudication Rules

- Use zero-based character offsets against the exact document text.
- Verify that each annotation's `text` equals `documentText.slice(start, end)`.
- Merge duplicate or equivalent spans.
- Prefer one complete span over several fragmented spans when the whole phrase
  is the useful redaction unit.
- Preserve useful labels, but correctness of redaction/keep action is more
  important than label perfection.
- Add missing obvious sensitive spans even if every model missed them.
- Remove speculative spans that are not sensitive in business/legal context.
- Add `keep` spans for important boilerplate where over-redaction would damage
  usefulness.
- Output JSON only.

## Output

Return one annotation file in `schemas/annotation.schema.json` format.

Set:

- `annotator`: `adjudicated-gold`
- `schemaVersion`: `1.0.0`
- `suiteId`, `docId`, and `sourceTextSha256` exactly as provided.

Include short reasons for every span. Use stable IDs: `gold-0001`,
`gold-0002`, etc.
