# Interactive Redaction Review Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the full interactive redaction review workspace with a shared editable replacement list, multi-document file management, and interactive preview redaction.

**Architecture:** Split the work into a deterministic logic layer and a browser UI layer. The logic layer owns replacement entries, matching, preview segments, and export generation. The frontend layer owns files, list editing, preview interactions, and user session state.

**Tech Stack:** Vite, TypeScript, browser DOM APIs, Vitest, existing `mammoth` and `pdfjs-dist` file readers. No backend, no AI calls, no telemetry.

---

## Coordination Notes

- Work on the main worktree unless the user explicitly asks for worktrees.
- Inspect the current dirty worktree before editing. Do not revert changes you did not make.
- Keep source documents synthetic in tests.
- Run `npm test` and `npm run build` before reporting completion.
- The user plans to assign separate logic and frontend agents. Logic work should avoid UI styling. Frontend work should consume logic APIs instead of duplicating redaction behavior.

## Logic Track

### Task L1: Add Review Model Types

**Files:**
- Modify: `src/redactor/types.ts`
- Test: `src/redactor/engine.test.ts`

**Step 1: Add review-oriented types**

Add types like these, adjusting names only if the existing code needs a small variation:

```ts
export interface RedactionDocument {
  id: string;
  name: string;
  originalName?: string;
  originalLength: number;
  text: string;
}

export interface ReplacementEntry {
  id: string;
  value: string;
  replacement: string;
  kind: CandidateKind;
  level: RedactionLevel;
  reason: string;
  sources: string[];
  count: number;
  active: boolean;
  manual: boolean;
  matchCase: boolean;
}

export interface PreviewSegment {
  text: string;
  entryId?: string;
  value?: string;
  replacement?: string;
  kind?: CandidateKind;
}

export interface ReviewDocument {
  id: string;
  name: string;
  originalLength: number;
  sanitized: string;
  segments: PreviewSegment[];
}

export interface ReviewModel {
  documents: ReviewDocument[];
  combinedMarkdown: string;
  entries: ReplacementEntry[];
  counts: Record<string, number>;
}
```

Keep the existing exported types if other code still uses them. Prefer adding compatibility aliases over breaking everything at once.

**Step 2: Run typecheck/build**

Run: `npm run build`

Expected: It may fail until later logic tasks implement the new types. If it fails only because the new model is unused, continue.

### Task L2: Convert Candidates To Replacement Entries

**Files:**
- Modify: `src/redactor/engine.ts`
- Test: `src/redactor/engine.test.ts`

**Step 1: Add a test for entry metadata**

Add a Vitest case that calls `redactDocuments` on two synthetic documents:

```ts
const result = redactDocuments(
  [
    { name: "alpha.md", text: "Ms Ada Stone emailed ada@example.com." },
    { name: "beta.md", text: "Ada Stone met Beta Holdings Limited." },
  ],
  { level: "balanced" },
);

const person = result.entries.find((entry) => entry.value === "Ada Stone");
expect(person).toMatchObject({
  kind: "PERSON",
  active: true,
  manual: false,
});
expect(person?.replacement).toMatch(/^PERSON_/);
expect(person?.sources).toContain("alpha.md");
expect(person?.sources).toContain("beta.md");
expect(person?.count).toBeGreaterThanOrEqual(2);
```

**Step 2: Implement entry generation**

Refactor the existing serializable candidate mapping so every applicable candidate becomes a `ReplacementEntry`.

Important rules:

- Stable id can be deterministic, such as `${kind}:${normalized value}` encoded safely.
- Preserve existing replacement token behavior.
- `active` defaults to `true`.
- `manual` defaults to `false`.
- `matchCase` defaults to `true` for automatic entries.
- `count` should count occurrences across all input documents for the selected level.

**Step 3: Keep current tests green**

Run: `npm test`

Expected: Existing redaction tests still pass.

### Task L3: Add Manual Entries And Editable Overrides

**Files:**
- Modify: `src/redactor/types.ts`
- Modify: `src/redactor/engine.ts`
- Test: `src/redactor/engine.test.ts`

**Step 1: Extend options**

Add options for user-controlled entries:

```ts
export interface RedactionOptions {
  level: RedactionLevel;
  customTerms?: string[];
  entries?: ReplacementEntry[];
}
```

Treat `customTerms` as legacy input that creates manual entries.

**Step 2: Add tests**

Test editable replacement:

```ts
const first = redactDocuments([{ name: "sample.md", text: "Ada Stone signed." }], {
  level: "balanced",
});
const ada = first.entries.find((entry) => entry.value === "Ada Stone")!;
const second = redactDocuments([{ name: "sample.md", text: "Ada Stone signed." }], {
  level: "balanced",
  entries: [{ ...ada, replacement: "A" }],
});
expect(second.combinedMarkdown).toContain("A signed.");
expect(second.combinedMarkdown).not.toContain("Ada Stone");
```

Test disabled entry:

```ts
const second = redactDocuments([{ name: "sample.md", text: "Ada Stone signed." }], {
  level: "balanced",
  entries: [{ ...ada, active: false }],
});
expect(second.combinedMarkdown).toContain("Ada Stone signed.");
```

Test manual case-insensitive phrase:

```ts
const result = redactDocuments([{ name: "sample.md", text: "Acme Ltd met ACME LTD." }], {
  level: "light",
  entries: [{
    id: "manual:acme-ltd",
    value: "Acme Ltd",
    replacement: "CLIENT",
    kind: "CUSTOM",
    level: "light",
    reason: "manual",
    sources: ["manual"],
    count: 0,
    active: true,
    manual: true,
    matchCase: false,
  }],
});
expect(result.combinedMarkdown).toContain("CLIENT met CLIENT.");
```

**Step 3: Implement merge behavior**

Merge incoming `entries` with freshly detected automatic entries:

- Existing entry ids preserve `replacement`, `active`, and `manual`.
- Manual entries are included even if the detector did not find them.
- Manual entries use case-insensitive exact phrase matching by default.
- Manual entries have priority over automatic entries.

**Step 4: Run tests**

Run: `npm test`

Expected: New and existing tests pass.

### Task L4: Generate Preview Segments

**Files:**
- Modify: `src/redactor/engine.ts`
- Test: `src/redactor/engine.test.ts`

**Step 1: Add segment test**

```ts
const result = redactDocuments([{ name: "sample.md", text: "Ada Stone emailed ada@example.com." }], {
  level: "balanced",
});
const doc = result.documents[0];
const redacted = doc.segments.filter((segment) => segment.entryId);
expect(redacted.length).toBeGreaterThanOrEqual(2);
expect(redacted[0]).toHaveProperty("value");
expect(redacted[0]).toHaveProperty("replacement");
expect(doc.sanitized).not.toContain("ada@example.com");
```

**Step 2: Implement segment rendering**

Replace the current repeated string replacement path with a shared function that can produce both:

- `segments`: ordered plain and redacted segments.
- `sanitized`: concatenation of segment text, where redacted segments use `replacement`.

Use priority sorting:

- Active entries only.
- Manual entries before automatic entries.
- Longer values before shorter values.
- Existing non-Latin and chronology/contact policies should still apply.

**Step 3: Run tests**

Run: `npm test`

Expected: Existing export behavior is unchanged, and segment metadata exists.

### Task L5: Preserve Session Edits When Files Are Added

**Files:**
- Modify: `src/redactor/engine.ts`
- Test: `src/redactor/engine.test.ts`

**Step 1: Add preservation test**

```ts
const first = redactDocuments([{ name: "one.md", text: "Ada Stone signed." }], {
  level: "balanced",
});
const ada = first.entries.find((entry) => entry.value === "Ada Stone")!;
const second = redactDocuments(
  [
    { name: "one.md", text: "Ada Stone signed." },
    { name: "two.md", text: "Ada Stone replied." },
  ],
  { level: "balanced", entries: [{ ...ada, replacement: "A" }] },
);
expect(second.combinedMarkdown).toContain("A signed.");
expect(second.combinedMarkdown).toContain("A replied.");
expect(second.entries.find((entry) => entry.id === ada.id)?.replacement).toBe("A");
```

**Step 2: Implement preservation**

Make entry ids stable enough that adding documents does not reset edited replacements.

**Step 3: Run verification**

Run:

```bash
npm test
npm run build
```

Expected: Both pass.

## Frontend Track

### Task F1: Introduce Browser Session State

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Define state in `src/main.ts`**

Create state for:

```ts
interface LoadedDocument {
  id: string;
  fileName: string;
  text: string;
  warnings: string[];
}

interface AppState {
  files: File[];
  documents: LoadedDocument[];
  selectedDocumentId: string | null;
  entries: ReplacementEntry[];
  level: RedactionLevel;
  review: ReviewModel | null;
  query: string;
  collapsedKinds: Set<string>;
}
```

Adjust the shape if the logic agent exposes slightly different names.

**Step 2: Replace one-shot result variables**

Replace `selectedFiles` and `lastResult` with session state. Keep all document text in memory only.

**Step 3: Verify build after wiring imports**

Run: `npm run build`

Expected: It may fail until the logic track is available. If so, leave a short note in the agent summary.

### Task F2: Build File List And Add-More Flow

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Update markup**

Replace the current single controls/results layout with:

- Header.
- File strip or file sidebar.
- Add-more dropzone.
- Replacement list panel.
- Preview panel.
- Status/download actions.

Do not create a marketing landing page. The app should open directly into the tool.

**Step 2: Implement add files**

File input and drop events should append supported files instead of replacing all files. After reading new files, select the first document if none is selected.

**Step 3: Implement remove/select document**

Each document row should:

- Show safe document name.
- Be clickable.
- Have a remove button.

Removing a document should rebuild review state from the remaining documents and existing entries.

**Step 4: Manual check**

Run `npm run dev`, open the Vite URL, and verify:

- Empty state has a large dropzone.
- Loaded state has document list plus smaller add-more area.
- Adding more files preserves existing files.
- Clicking files changes the preview target.

### Task F3: Build Categorized Replacement List

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Render grouped entries**

Group `review.entries` by `kind`. Sort categories alphabetically or by a fixed useful order:

`CUSTOM`, `PERSON`, `PERSON_OR_ORG`, `ORG`, `ADDRESS`, `EMAIL`, `PHONE`, `DATE`, `AMOUNT`, then the rest.

Each category header should show:

- Category label.
- Count of visible entries.
- Collapse/expand button.
- Category color marker.

**Step 2: Render entry controls**

Each entry row should include:

- Original value.
- Editable replacement input.
- Active checkbox or toggle.
- Count.
- Source document names.
- Reason/manual label.

**Step 3: Wire edits**

On input change or blur, update the matching entry in state and regenerate the review model immediately.

**Step 4: Add search**

Filter by original value, replacement, kind, reason, and source names.

**Step 5: Manual check**

Verify:

- Editing `PERSON_001` to `A` updates preview and downloads.
- Disabling an entry reveals the original in preview.
- Category collapse and search work.

### Task F4: Build Interactive Preview

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Render segments**

For the selected document, render `segments` into a preview container.

Plain segments render as text nodes. Redacted segments render as buttons or spans with:

- Replacement text visible.
- `data-entry-id`.
- Category class.
- Tooltip/title containing the original value.

Use `white-space: pre-wrap` so Markdown/text line breaks remain readable.

**Step 2: Click redacted segment actions**

Clicking a redacted segment should open a small inline action popover or selected-entry panel with:

- Replacement input.
- Ignore/restore control.
- Jump-to-list action.

Keep this simple and accessible.

**Step 3: Selection-to-redact**

Listen for text selection inside the preview container. If the selection is non-empty and belongs to the preview, show a small `Redact` button near the selection.

When clicked:

- Trim the selected text.
- Add a manual `CUSTOM` entry with `matchCase: false`.
- Default replacement should be the next `CUSTOM_###`.
- Regenerate review state.
- Clear the selection.

**Step 4: Manual check**

Verify:

- Hovering redacted terms shows originals.
- Clicking redacted terms allows editing or ignoring.
- Selecting unredacted text adds a manual entry.
- Manual entry updates every document where the phrase appears, case-insensitively.

### Task F5: Downloads And Session Messaging

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Wire downloads to current review**

Combined download should use `review.combinedMarkdown`.

Per-document download should use the selected/current `review.documents[index].sanitized`.

**Step 2: Add session-only notice**

Add a concise status line near controls:

`Edits stay in this browser session. Originals are only shown here for local review and are not included in redacted Markdown exports.`

**Step 3: Render warnings**

Keep existing conversion warnings and associate them with document names.

**Step 4: Final verification**

Run:

```bash
npm test
npm run build
npm run dev
```

Open the local app and verify the main workflow with synthetic `.txt` or `.md` files.

## Integration Checklist

After logic and frontend agents finish:

- Confirm no AI, backend, telemetry, or content logging was added.
- Confirm no real/private sample documents were committed.
- Run `npm test`.
- Run `npm run build`.
- Use the browser manually with two synthetic documents:
  - Add document one.
  - Add document two.
  - Edit a detected replacement.
  - Disable a detected replacement.
  - Select unredacted text and add a manual redaction.
  - Switch documents and verify shared list behavior.
  - Download combined Markdown and confirm originals are not present for active entries.

## Agent Prompt: Logic

```text
You are implementing the logic track for NoAI in /Users/guolite/GitHub/NoAI.

Read AGENTS.md and docs/plans/2026-06-16-interactive-redaction-review-design.md first. Then follow only the Logic Track in docs/plans/2026-06-16-interactive-redaction-review-implementation.md.

Scope:
- Modify the deterministic redaction engine and types only as needed.
- Do not implement UI behavior beyond keeping existing callers compiling if needed.
- Do not add AI calls, backend uploads, analytics, telemetry, content logging, or real/private sample documents.
- Preserve browser-only deterministic behavior.
- Use synthetic tests only.

Deliverables:
- Review model types.
- Editable ReplacementEntry support.
- Manual entries with case-insensitive exact phrase matching.
- Active/ignored entries.
- Stable entry ids that preserve edits when files are added.
- Preview segments with original/replacement metadata.
- Current combined Markdown and per-document sanitized exports still work.

Verification:
- Run npm test.
- Run npm run build.
- Report changed files, key behavior, and any frontend integration notes.
```

## Agent Prompt: Frontend

```text
You are implementing the frontend track for NoAI in /Users/guolite/GitHub/NoAI.

Read AGENTS.md and docs/plans/2026-06-16-interactive-redaction-review-design.md first. Then follow only the Frontend Track in docs/plans/2026-06-16-interactive-redaction-review-implementation.md.

Scope:
- Modify src/main.ts and src/styles.css primarily.
- Use the logic APIs exposed by the logic agent; do not duplicate redaction rules in the UI.
- Do not add AI calls, backend uploads, analytics, telemetry, content logging, or persistent storage of document contents.
- Build the actual review workspace as the first screen, not a landing page.

Deliverables:
- File list with add-more upload/drop flow.
- Shared categorized replacement list with collapse/search/edit/active controls.
- Selected document preview.
- Colored redacted preview spans with hover originals.
- Click actions for redacted spans.
- Select-text-to-redact flow that adds manual CUSTOM entries.
- Downloads generated from the current review state.

Verification:
- Run npm test.
- Run npm run build.
- Run npm run dev and manually verify with synthetic files:
  1. Add multiple documents in batches.
  2. Switch selected document.
  3. Edit a replacement and see preview/export update.
  4. Disable a replacement and see the original return in local preview.
  5. Select unredacted text and add it as a manual redaction.
  6. Confirm active originals do not appear in exported Markdown.

Report changed files, screenshots or manual check notes, and any logic API assumptions.
```

