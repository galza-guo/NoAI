# Interactive Redaction Review Design

## Goal

NoAI should become a browser-only redaction review workspace. The app should still read documents locally, detect sensitive terms deterministically, and export redacted Markdown, but users should now be able to inspect and control the replacement list before export.

The central object is a shared replacement list across all uploaded documents. Automatic detection creates the initial list. User edits, disabled entries, and manually added terms update the previews and exports for every document in the current browser session.

No replacement report is needed for this version.

## Product Principles

- Keep the redaction path local, deterministic, and inspectable.
- Do not add AI calls, backend document processing, analytics, telemetry, or content logging.
- Keep terms editable because users know their documents better than the detector.
- Show originals inside the local review UI when helpful, but never include originals in exported redacted Markdown.
- Optimize for non-technical users: use plain labels, predictable controls, and visible document/replacement state.

## Workspace Layout

The app should have three working areas.

### File Area

When no files are loaded, show the current large drop area.

After files are loaded, show:

- A compact list of uploaded documents.
- The selected document.
- A smaller add-more drop area or choose-documents control.
- A way to remove a document from the session.

Users can add files in multiple batches. The replacement list is shared across all current documents. Clicking a document changes the preview.

### Replacement List

Show detected and manual terms as categorized, collapsible groups. Keep existing categories such as person, organization, date, amount, address, custom, case reference, and other detector kinds.

Each replacement entry should show:

- Original term.
- Editable replacement.
- Category.
- Active or ignored state.
- Occurrence count.
- Source document names.
- Detection reason when available.
- Manual source label for user-added terms.

Category colors should be consistent in the list and in the preview. Manual entries should win over automatic entries. Manual matching should use case-insensitive exact phrase matching by default. Longer matches should win over shorter overlapping matches.

Users should be able to:

- Edit a replacement token, such as changing `PERSON_001` to `A`.
- Disable a redaction entry without deleting it.
- Add a new manual entry.
- Search/filter the replacement list.
- Expand and collapse categories.

### Interactive Preview

The preview should render the selected document as reviewable text, not as a read-only textarea.

Redacted terms should render as colored spans. The color should match the replacement list category. Hovering a redacted span should show the original term because the document is already local to the user. Clicking a redacted span should let the user:

- Edit the replacement.
- Disable that redaction entry.
- Jump to the replacement list item.

Selecting unredacted text in the preview should show a small Redact action near the selection. Clicking it should add the selected text as a manual replacement entry, then update the shared list, preview, and exports. The default replacement for a manual entry should be `CUSTOM_###`, editable by the user.

## Data Model

The engine should move from returning only final strings to returning a review model.

Recommended concepts:

- `ReplacementEntry`: stable id, original value, replacement, kind, source, reason, active flag, manual flag, match behavior, document ids, occurrence count.
- `RedactionDocument`: stable id, safe display name, original text, original length, warnings.
- `PreviewSegment`: text, optional replacement entry id, original value, replacement, kind, active state.
- `ReviewState`: documents, selected document id, entries, current redaction level.

The source document text can stay in memory for the session. Do not persist it to local storage or send it over the network.

## Data Flow

1. User uploads one or more files.
2. Browser reads files locally.
3. Detector builds automatic replacement entries across all loaded documents.
4. Existing user edits and manual entries are preserved where possible when more files are added or the redaction level changes.
5. Preview segments are generated from the current documents and current entries.
6. Download buttons export redacted Markdown generated from active entries only.

Changing a replacement should update previews and downloads immediately without rereading files. Adding files requires reading only the new files, then rebuilding detection against all current documents.

## Matching Rules

- Active entries replace matching text.
- Ignored entries do not replace text.
- Manual entries have priority over automatic entries.
- Longer matching values have priority over shorter values.
- Custom/manual phrase matching is case-insensitive by default.
- Automatic entries keep the detector's existing matching behavior unless changed deliberately by the logic agent.
- Exact phrase boundaries should avoid surprising partial-word replacements. For example, `Alex Li` should not automatically redact every `Li` unless there is a separate `Li` entry.

## Export Behavior

Exports should use the current replacement list.

Required exports:

- Per-document redacted Markdown.
- Combined redacted Markdown pack.

Exports must not include original terms, disabled replacement metadata, hover metadata, or replacement reports.

## Accessibility And Usability

- Replacement inputs should be keyboard accessible.
- Preview redaction spans should be focusable or have list-based equivalents for users who cannot use hover.
- Use clear active/ignored controls instead of destructive deletion as the main undo path.
- Keep the UI responsive for large replacement lists with category collapse and search.
- Explain session-only behavior in plain language: edits remain in this browser tab/session until files are removed or the page is refreshed.

## Testing Strategy

Use synthetic documents only.

Logic tests should cover:

- Entry generation across multiple documents.
- Editable replacements in generated Markdown.
- Disabled entries.
- Manual entries.
- Case-insensitive manual matching.
- Manual priority and longest-match priority.
- Preview segments with original and replacement metadata.

Frontend tests or manual browser checks should cover:

- Adding files in batches.
- Switching selected documents.
- Editing a replacement and seeing preview/export update.
- Disabling an entry and seeing originals return in preview only.
- Selecting text and adding a manual redaction.
- Category collapse/search behavior.

