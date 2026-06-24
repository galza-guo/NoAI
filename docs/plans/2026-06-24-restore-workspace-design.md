# Restore Workspace Design

## Goal

NoAI should support the second half of the redaction workflow: after a user sends redacted Markdown to an external AI tool, they should be able to paste the AI-generated output back into NoAI and locally restore safe placeholder tokens to the original private terms.

Restore must keep the same trust promise as Redact:

- No AI calls.
- No backend upload.
- No telemetry or content logging.
- No persistent storage of document contents or restore maps by default.
- All restoration is deterministic local text replacement.

The plain user story is: redact before AI, paste after AI, NoAI restores as you paste.

## Product Principles

- Make Restore feel like the second half of the same workspace, not a separate technical utility.
- Keep the default safe: the restore key lives only in the current browser session.
- Offer a private restore key download only as an explicit advanced backup path.
- Do not lead with "mapping sheet" language. A mapping contains originals and should be treated as a private restore key.
- Do not make users export and re-import Markdown just to work with AI output. Copy and paste between browser tabs should be the primary path.
- Avoid autocorrect-like behavior while the user is editing. Pasted redacted AI output can restore immediately; ordinary typing should remain stable.

## Workspace Model

Add a top-level mode switch inside the workspace:

```text
Redact | Restore
```

Redact remains the current default mode.

Restore reuses the three-panel workspace grammar:

```text
AI Outputs | Restored Draft | Restore Map
```

This mirrors the current Redact layout:

```text
Documents | Preview | Redactions
```

The left panel should mean "items I am working on." In Redact mode those items are source documents. In Restore mode those items are pasted AI outputs.

## Restore Journey

1. User adds source documents in Redact mode.
2. User reviews and edits redactions.
3. User copies or downloads redacted Markdown.
4. NoAI keeps the restore map in memory for the current session.
5. User sends the redacted Markdown to an external AI tool.
6. User copies the AI-generated output.
7. User switches NoAI to Restore mode.
8. User creates or selects an AI output item.
9. User pastes the AI output into the Restored Draft editor.
10. NoAI restores safe placeholder tokens in the pasted text immediately.
11. User edits the restored draft directly.
12. User copies or downloads the final restored draft.

If the session restore map is missing, Restore mode should let the user upload a previously downloaded private restore key.

## Left Panel: AI Outputs

In Restore mode, the left panel becomes "AI Outputs."

It should support:

- Creating a new empty output.
- Selecting an output.
- Renaming an output if needed.
- Removing an output from the current session.
- Showing a small status for each output, such as placeholder count or unknown token count.
- Adding multiple AI outputs in one session.

The initial empty state should invite direct paste into the center editor rather than file upload.

File import can be a later enhancement, but copy and paste is the primary workflow.

## Center Panel: Restored Draft

The center panel is an editable draft, not a read-only preview.

It should support:

- Pasting redacted AI output directly.
- Automatic restoration of safe tokens inside pasted text.
- Manual editing after restoration.
- Copying the current draft.
- Downloading the current draft as Markdown.
- Clearing the current draft with confirmation or undo.

The center panel should keep a session-only copy of the originally pasted redacted input for reference, but the user edits the restored version.

Optional view toggle:

- Restored Draft
- Redacted Input

The default view is Restored Draft.

## Right Panel: Restore Map

In Restore mode, the right panel becomes "Restore Map."

It should show the restore entries relevant to the current draft:

- Replacement token.
- Original value.
- Category.
- Count in the current draft.
- Source documents from the original redaction session.
- Unknown tokens found in the draft.
- Unsafe or ambiguous labels that cannot be restored automatically.

Because the Restore Map contains originals, originals should be treated with the same caution as original preview text. The panel can show originals because the data is already local, but it should not encourage users to download or share it casually.

## Restore Key Behavior

The current redaction session creates an in-memory restore key from replacement entries:

```text
PERSON_001 -> Jane Smith
ORG_002 -> Example Holdings Ltd
DATE_003 -> 2025-02-14
```

This key is needed to restore AI output later.

Default behavior:

- Keep the restore key only in memory.
- Do not write the key to localStorage, sessionStorage, IndexedDB, cookies, or a backend.
- If the tab closes, refreshes, crashes, or the browser discards the tab, the key can be lost.

Advanced backup:

- Offer "Download private restore key."
- Use clear warning language: this file contains original private text and should not be uploaded to AI tools.
- Importing that key later should restore the map locally in the browser.

Do not use "download mapping sheet" as the primary product language.

## Auto-Restore Rules

Auto-restore should happen on paste, not on every keystroke.

On paste:

- Inspect the pasted text.
- Replace safe known tokens immediately.
- Preserve the user's cursor as naturally as possible.
- Update the AI output item, draft text, and Restore Map counts.

During ordinary editing:

- Do not aggressively replace text on every keystroke.
- Scan the draft for known tokens and unknown tokens.
- Show restorable tokens in the right panel.
- Provide a lightweight action only if needed, such as "Restore remaining tokens."

This avoids making the editor feel like it is fighting the user.

## Safe Token Rules

Only machine-style placeholder tokens should restore automatically.

Examples that are safe:

- `PERSON_001`
- `ORG_002`
- `DATE_003`
- `CUSTOM_004`

Examples that should not auto-restore:

- `Client`
- `Company`
- `A`
- `Supplier`

Human-edited labels may be useful in the redacted Markdown, but they can be ordinary words in an AI-generated report. Restoring them automatically could corrupt normal text.

If more than one original value shares the same replacement label, mark it ambiguous and do not auto-restore that label.

## Data Model

Recommended new concepts:

- `RestoreEntry`: replacement token, original value, kind, sources, safe-to-restore flag, ambiguity state.
- `RestoreKey`: engine version, app version, created timestamp, entries, redaction level, optional source document display names.
- `RestoreOutput`: id, title, redactedInput, restoredDraft, created timestamp, updated timestamp.
- `RestoreMatch`: token, count, known or unknown state, safe or unsafe state.

The restore key can be derived from existing `ReplacementEntry` values where `count > 0`.

The restore key export should be structured data, likely JSON, not a spreadsheet. A spreadsheet invites casual sharing and editing, while JSON better communicates "this is a key for NoAI."

## Error Handling

Restore mode should handle:

- No restore key available: prompt user to return to Redact or import a private restore key.
- Invalid restore key file: explain that the file is not a NoAI restore key.
- Unknown tokens: show them in the Restore Map and leave them unchanged in the draft.
- Ambiguous labels: leave unchanged and explain why they are not safe.
- Unsafe custom labels: leave unchanged unless the user explicitly chooses a manual action later.

## Privacy Copy

Use short, plain copy near the relevant controls:

- "Keep this tab open to restore later."
- "Closing or refreshing this tab may lose the restore key."
- "Private restore keys contain original text. Do not upload them to AI tools."
- "Restore runs locally in your browser."

Avoid frightening users with constant warnings. Show warnings at the moment they matter: before leaving the page, before downloading a private restore key, and when no session key is available.

## Testing Strategy

Use synthetic documents only.

Logic tests should cover:

- Building a restore key from replacement entries.
- Restoring safe tokens.
- Leaving unknown tokens unchanged.
- Leaving unsafe human-friendly labels unchanged.
- Rejecting ambiguous replacement labels.
- Importing and validating a private restore key.

Frontend tests or manual checks should cover:

- Switching between Redact and Restore modes.
- Pasting AI output and seeing immediate restoration.
- Editing restored draft text without unwanted replacements.
- Managing multiple AI outputs.
- Copying and downloading restored drafts.
- Missing restore key empty state.
- Downloading and importing a private restore key.
- Mobile layout with the three panels stacked.

