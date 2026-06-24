# Restore Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build Restore mode so users can paste redacted AI output into NoAI, have safe placeholder tokens restored locally on paste, edit the restored draft, and optionally save/load a private restore key.

**Architecture:** Add a small pure restore logic module that builds restore keys from the existing review model, scans drafts for tokens, and restores pasted text. Then extend `src/main.ts` with a `Redact | Restore` workspace mode that reuses the three-panel layout: AI Outputs, Restored Draft, Restore Map.

**Tech Stack:** Vite, TypeScript, browser DOM APIs, Vitest, existing redaction `ReviewModel` and `ReplacementEntry` types. No backend, no AI calls, no telemetry, no persistent storage of restore keys by default.

---

## Coordination Notes

- Work on the main worktree unless the user explicitly asks for worktrees.
- Inspect `git status --short` before editing. Do not revert changes you did not make.
- Use synthetic examples only.
- Use Phosphor Icons for any new icons.
- Do not write restore keys to localStorage, sessionStorage, IndexedDB, cookies, or a backend.
- Run `npm test` and `npm run build` before reporting completion.

## Task 1: Add Restore Logic Types And Safe Token Detection

**Files:**
- Create: `src/restore.ts`
- Create: `src/restore.test.ts`

**Step 1: Write failing tests**

Add tests covering safe and unsafe replacement labels:

```ts
import { describe, expect, it } from "vitest";
import { isSafeRestoreToken } from "./restore";

describe("restore token safety", () => {
  it("accepts machine-style tokens", () => {
    expect(isSafeRestoreToken("PERSON_001")).toBe(true);
    expect(isSafeRestoreToken("ORG_002")).toBe(true);
    expect(isSafeRestoreToken("CUSTOM_123")).toBe(true);
  });

  it("rejects human-friendly labels", () => {
    expect(isSafeRestoreToken("Client")).toBe(false);
    expect(isSafeRestoreToken("Company")).toBe(false);
    expect(isSafeRestoreToken("A")).toBe(false);
    expect(isSafeRestoreToken("Supplier")).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/restore.test.ts`

Expected: FAIL because `src/restore.ts` does not exist.

**Step 3: Implement minimal restore types and token detection**

Create `src/restore.ts`:

```ts
import type { CandidateKind, RedactionLevel, ReplacementEntry } from "./redactor/types";

export const RESTORE_KEY_KIND = "noai.restore-key";
export const RESTORE_KEY_VERSION = 1;

export interface RestoreEntry {
  replacement: string;
  value: string;
  kind: CandidateKind;
  reason: string;
  sources: string[];
  safe: boolean;
  ambiguous: boolean;
}

export interface RestoreKey {
  kind: typeof RESTORE_KEY_KIND;
  version: typeof RESTORE_KEY_VERSION;
  appVersion: string;
  engineVersion: string;
  createdAt: string;
  level: RedactionLevel;
  entries: RestoreEntry[];
}

export interface RestoreMatch {
  token: string;
  count: number;
  status: "restorable" | "unknown" | "unsafe" | "ambiguous";
  entry?: RestoreEntry;
}

export interface RestoreOutput {
  id: string;
  title: string;
  redactedInput: string;
  restoredDraft: string;
  createdAt: string;
  updatedAt: string;
}

export function isSafeRestoreToken(value: string): boolean {
  return /^[A-Z][A-Z0-9]*_(?:0{2}[1-9]|0[1-9]\d|[1-9]\d{2,})$/.test(value);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/restore.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/restore.ts src/restore.test.ts
git commit -m "feat(restore): add restore token primitives"
```

## Task 2: Build Restore Keys From Review Entries

**Files:**
- Modify: `src/restore.ts`
- Modify: `src/restore.test.ts`

**Step 1: Write failing tests**

Add tests that build entries from replacement metadata:

```ts
import type { ReplacementEntry } from "./redactor/types";
import { buildRestoreKey } from "./restore";

function entry(overrides: Partial<ReplacementEntry>): ReplacementEntry {
  return {
    id: "PERSON:Jane%20Smith",
    value: "Jane Smith",
    replacement: "PERSON_001",
    kind: "PERSON",
    level: "balanced",
    reason: "titled person",
    sources: ["sample.md"],
    count: 2,
    manual: false,
    matchCase: true,
    ...overrides,
  };
}

it("builds a restore key from countable entries", () => {
  const key = buildRestoreKey({
    appVersion: "0.0.0",
    engineVersion: "test-engine",
    level: "balanced",
    entries: [entry({})],
    now: () => new Date("2026-06-24T00:00:00.000Z"),
  });

  expect(key.entries).toEqual([
    expect.objectContaining({
      replacement: "PERSON_001",
      value: "Jane Smith",
      safe: true,
      ambiguous: false,
    }),
  ]);
});

it("marks duplicate replacement labels as ambiguous", () => {
  const key = buildRestoreKey({
    appVersion: "0.0.0",
    engineVersion: "test-engine",
    level: "balanced",
    entries: [
      entry({ value: "Jane Smith", replacement: "PERSON_001" }),
      entry({ id: "PERSON:John%20Smith", value: "John Smith", replacement: "PERSON_001" }),
    ],
    now: () => new Date("2026-06-24T00:00:00.000Z"),
  });

  expect(key.entries.every((item) => item.ambiguous)).toBe(true);
});

it("keeps unsafe labels in the key but does not mark them safe", () => {
  const key = buildRestoreKey({
    appVersion: "0.0.0",
    engineVersion: "test-engine",
    level: "balanced",
    entries: [entry({ replacement: "Client" })],
    now: () => new Date("2026-06-24T00:00:00.000Z"),
  });

  expect(key.entries[0]).toMatchObject({ replacement: "Client", safe: false });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/restore.test.ts`

Expected: FAIL because `buildRestoreKey` is missing.

**Step 3: Implement restore key building**

Add:

```ts
export interface BuildRestoreKeyOptions {
  appVersion: string;
  engineVersion: string;
  level: RedactionLevel;
  entries: ReplacementEntry[];
  now?: () => Date;
}

export function buildRestoreKey(options: BuildRestoreKeyOptions): RestoreKey {
  const counts = new Map<string, number>();
  for (const entry of options.entries) {
    if (entry.count <= 0) continue;
    counts.set(entry.replacement, (counts.get(entry.replacement) ?? 0) + 1);
  }

  return {
    kind: RESTORE_KEY_KIND,
    version: RESTORE_KEY_VERSION,
    appVersion: options.appVersion,
    engineVersion: options.engineVersion,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
    level: options.level,
    entries: options.entries
      .filter((entry) => entry.count > 0)
      .map((entry) => ({
        replacement: entry.replacement,
        value: entry.value,
        kind: entry.kind,
        reason: entry.reason,
        sources: entry.sources,
        safe: isSafeRestoreToken(entry.replacement),
        ambiguous: (counts.get(entry.replacement) ?? 0) > 1,
      })),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/restore.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/restore.ts src/restore.test.ts
git commit -m "feat(restore): build private restore keys"
```

## Task 3: Restore Pasted Text And Scan Draft Matches

**Files:**
- Modify: `src/restore.ts`
- Modify: `src/restore.test.ts`

**Step 1: Write failing tests**

Add:

```ts
import { restorePastedText, scanRestoreMatches } from "./restore";

it("restores safe known tokens in pasted text", () => {
  const key = buildRestoreKey({
    appVersion: "0.0.0",
    engineVersion: "test-engine",
    level: "balanced",
    entries: [entry({})],
    now: () => new Date("2026-06-24T00:00:00.000Z"),
  });

  expect(restorePastedText("PERSON_001 signed.", key)).toBe("Jane Smith signed.");
});

it("leaves unknown, unsafe, and ambiguous labels unchanged", () => {
  const key = buildRestoreKey({
    appVersion: "0.0.0",
    engineVersion: "test-engine",
    level: "balanced",
    entries: [
      entry({ replacement: "Client" }),
      entry({ value: "Jane Smith", replacement: "PERSON_001" }),
      entry({ id: "PERSON:John%20Smith", value: "John Smith", replacement: "PERSON_001" }),
    ],
    now: () => new Date("2026-06-24T00:00:00.000Z"),
  });

  expect(restorePastedText("Client PERSON_001 PERSON_999", key)).toBe(
    "Client PERSON_001 PERSON_999",
  );
});

it("scans draft text for restorable and unknown tokens", () => {
  const key = buildRestoreKey({
    appVersion: "0.0.0",
    engineVersion: "test-engine",
    level: "balanced",
    entries: [entry({})],
    now: () => new Date("2026-06-24T00:00:00.000Z"),
  });

  expect(scanRestoreMatches("PERSON_001 PERSON_001 ORG_999", key)).toEqual([
    expect.objectContaining({ token: "PERSON_001", count: 2, status: "restorable" }),
    expect.objectContaining({ token: "ORG_999", count: 1, status: "unknown" }),
  ]);
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/restore.test.ts`

Expected: FAIL because restore/scan functions are missing.

**Step 3: Implement restore and scan helpers**

Add:

```ts
const TOKEN_RE = /\b[A-Z][A-Z0-9]*_\d{3,}\b/g;

function entryStatus(entry: RestoreEntry | undefined): RestoreMatch["status"] {
  if (!entry) return "unknown";
  if (entry.ambiguous) return "ambiguous";
  if (!entry.safe) return "unsafe";
  return "restorable";
}

function entryByReplacement(key: RestoreKey): Map<string, RestoreEntry> {
  const map = new Map<string, RestoreEntry>();
  for (const entry of key.entries) {
    map.set(entry.replacement, entry);
  }
  return map;
}

export function restorePastedText(text: string, key: RestoreKey | null): string {
  if (!key) return text;
  const entries = entryByReplacement(key);
  return text.replace(TOKEN_RE, (token) => {
    const entry = entries.get(token);
    return entry && entry.safe && !entry.ambiguous ? entry.value : token;
  });
}

export function scanRestoreMatches(text: string, key: RestoreKey | null): RestoreMatch[] {
  const counts = new Map<string, number>();
  for (const match of text.matchAll(TOKEN_RE)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  const entries = key ? entryByReplacement(key) : new Map<string, RestoreEntry>();
  return [...counts.entries()]
    .map(([token, count]) => {
      const entry = entries.get(token);
      return { token, count, status: entryStatus(entry), entry };
    })
    .sort((a, b) => a.token.localeCompare(b.token));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/restore.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/restore.ts src/restore.test.ts
git commit -m "feat(restore): restore pasted placeholder tokens"
```

## Task 4: Validate Private Restore Key Import

**Files:**
- Modify: `src/restore.ts`
- Modify: `src/restore.test.ts`

**Step 1: Write failing tests**

Add:

```ts
import { parseRestoreKey } from "./restore";

it("parses a valid restore key JSON file", () => {
  const key = buildRestoreKey({
    appVersion: "0.0.0",
    engineVersion: "test-engine",
    level: "balanced",
    entries: [entry({})],
    now: () => new Date("2026-06-24T00:00:00.000Z"),
  });

  expect(parseRestoreKey(JSON.stringify(key))).toEqual(key);
});

it("rejects invalid restore key JSON", () => {
  expect(() => parseRestoreKey("{}")).toThrow("not a NoAI private restore key");
  expect(() => parseRestoreKey("{")).toThrow("not valid JSON");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/restore.test.ts`

Expected: FAIL because `parseRestoreKey` is missing.

**Step 3: Implement parser**

Add conservative validation:

```ts
export function parseRestoreKey(source: string): RestoreKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("This restore key is not valid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as RestoreKey).kind !== RESTORE_KEY_KIND ||
    (parsed as RestoreKey).version !== RESTORE_KEY_VERSION ||
    !Array.isArray((parsed as RestoreKey).entries)
  ) {
    throw new Error("This file is not a NoAI private restore key.");
  }

  const key = parsed as RestoreKey;
  for (const item of key.entries) {
    if (
      typeof item.replacement !== "string" ||
      typeof item.value !== "string" ||
      typeof item.kind !== "string" ||
      typeof item.reason !== "string" ||
      !Array.isArray(item.sources) ||
      typeof item.safe !== "boolean" ||
      typeof item.ambiguous !== "boolean"
    ) {
      throw new Error("This file is not a NoAI private restore key.");
    }
  }

  return key;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/restore.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/restore.ts src/restore.test.ts
git commit -m "feat(restore): validate private restore keys"
```

## Task 5: Add Workspace Mode State And Markup Tests

**Files:**
- Modify: `src/main.ts`
- Create: `src/restoreWorkspaceMarkup.test.ts`

**Step 1: Write failing source-inspection tests**

Create `src/restoreWorkspaceMarkup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const mainSource = readFileSync("src/main.ts", "utf8");

describe("restore workspace markup", () => {
  it("adds a Redact and Restore workspace mode switch", () => {
    expect(mainSource).toContain('type WorkspaceMode = "redact" | "restore";');
    expect(mainSource).toContain('data-workspace-mode="redact"');
    expect(mainSource).toContain('data-workspace-mode="restore"');
  });

  it("uses restore panel labels that mirror the redaction workspace", () => {
    expect(mainSource).toContain("AI Outputs");
    expect(mainSource).toContain("Restored Draft");
    expect(mainSource).toContain("Restore Map");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/restoreWorkspaceMarkup.test.ts`

Expected: FAIL.

**Step 3: Add mode state and segmented control**

In `src/main.ts`, add:

```ts
type WorkspaceMode = "redact" | "restore";
```

Extend `AppState`:

```ts
workspaceMode: WorkspaceMode;
```

Initialize:

```ts
workspaceMode: "redact",
```

Add a compact mode switch near the top of the workspace, above `.workspace-grid`:

```html
<div class="workspace-mode-switch" role="tablist" aria-label="Workspace mode">
  <button type="button" class="mode-option selected" data-workspace-mode="redact" role="tab" aria-selected="true">
    <i class="ph ph-highlighter" aria-hidden="true"></i>
    <span>Redact</span>
  </button>
  <button type="button" class="mode-option" data-workspace-mode="restore" role="tab" aria-selected="false">
    <i class="ph ph-arrow-counter-clockwise" aria-hidden="true"></i>
    <span>Restore</span>
  </button>
</div>
```

Do not wire behavior yet.

**Step 4: Run test to verify it passes**

Run: `npm test -- src/restoreWorkspaceMarkup.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main.ts src/restoreWorkspaceMarkup.test.ts
git commit -m "feat(ui): add restore workspace mode switch"
```

## Task 6: Add Restore State To The Frontend

**Files:**
- Modify: `src/main.ts`
- Modify: `src/restoreWorkspaceMarkup.test.ts`

**Step 1: Write failing test**

Extend the test:

```ts
it("tracks restore outputs and selected restore output", () => {
  expect(mainSource).toContain("restoreOutputs: RestoreOutput[];");
  expect(mainSource).toContain("selectedRestoreOutputId: string | null;");
  expect(mainSource).toContain("restoreKey: RestoreKey | null;");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/restoreWorkspaceMarkup.test.ts`

Expected: FAIL.

**Step 3: Import restore types and extend state**

In `src/main.ts`, import:

```ts
import {
  RestoreKey,
  RestoreOutput,
  buildRestoreKey,
  parseRestoreKey,
  restorePastedText,
  scanRestoreMatches,
} from "./restore";
```

Extend `AppState`:

```ts
restoreKey: RestoreKey | null;
restoreOutputs: RestoreOutput[];
selectedRestoreOutputId: string | null;
showRedactedRestoreInput: boolean;
```

Initialize:

```ts
restoreKey: null,
restoreOutputs: [],
selectedRestoreOutputId: null,
showRedactedRestoreInput: false,
```

Add helpers:

```ts
function selectedRestoreOutput(): RestoreOutput | undefined {
  return state.restoreOutputs.find(
    (output) => output.id === state.selectedRestoreOutputId,
  );
}

function ensureSelectedRestoreOutput(): void {
  if (state.restoreOutputs.length === 0) {
    state.selectedRestoreOutputId = null;
    return;
  }
  if (!state.restoreOutputs.some((output) => output.id === state.selectedRestoreOutputId)) {
    state.selectedRestoreOutputId = state.restoreOutputs[0].id;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/restoreWorkspaceMarkup.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main.ts src/restoreWorkspaceMarkup.test.ts
git commit -m "feat(ui): add restore workspace state"
```

## Task 7: Derive The Session Restore Key From Redactions

**Files:**
- Modify: `src/main.ts`

**Step 1: Add restore key derivation after recompute**

Find the existing `recompute()` function in `src/main.ts`. After `state.review` is rebuilt, set `state.restoreKey` when a review exists:

```ts
function syncSessionRestoreKey(): void {
  if (!state.review) {
    state.restoreKey = null;
    return;
  }
  state.restoreKey = buildRestoreKey({
    appVersion: APP_VERSION,
    engineVersion: state.review.engineVersion,
    level: state.level,
    entries: state.review.entries,
  });
}
```

Call `syncSessionRestoreKey()` from `recompute()`, after `state.review = redactDocuments(...)`.

**Step 2: Preserve imported keys**

Add an extra state flag if needed:

```ts
restoreKeySource: "session" | "imported" | null;
```

If the user imports a key later, do not immediately overwrite it unless they return to Redact and recompute from documents. Keep this simple for the first pass:

- Redact recompute sets source to `"session"`.
- Import sets source to `"imported"`.
- Removing all documents clears only session-derived keys.

**Step 3: Run tests and build**

Run: `npm test -- src/restore.test.ts src/restoreWorkspaceMarkup.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(ui): derive session restore key"
```

## Task 8: Render Restore Mode Panels

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`
- Modify: `src/restoreWorkspaceMarkup.test.ts`

**Step 1: Write failing source test**

Add checks for renderer functions:

```ts
it("renders restore-specific panels", () => {
  expect(mainSource).toContain("function renderRestoreOutputs");
  expect(mainSource).toContain("function renderRestoredDraft");
  expect(mainSource).toContain("function renderRestoreMap");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/restoreWorkspaceMarkup.test.ts`

Expected: FAIL.

**Step 3: Add mode-specific render dispatch**

Refactor `renderAll()` enough to dispatch:

```ts
function renderAll(): void {
  if (state.workspaceMode === "restore") {
    renderRestoreWorkspace();
    return;
  }
  ensureSelectedDocument();
  renderWorkspaceState();
  renderFiles();
  renderLevelControl();
  renderReplacements();
  renderPreview();
}

function renderRestoreWorkspace(): void {
  ensureSelectedRestoreOutput();
  renderWorkspaceState();
  renderWorkspaceModeSwitch();
  renderRestoreOutputs();
  renderRestoredDraft();
  renderRestoreMap();
}
```

Keep existing panel DOM nodes and change their labels/content in Restore mode:

- Files panel title: `AI Outputs`
- Preview title: `Restored Draft`
- Redactions panel title: `Restore Map`

Use new functions to fill `filesBody`, `previewBody`, and `replacementsBody`.

**Step 4: Add CSS for the mode switch and restore editor**

Use existing design tokens and panel styles. Add only scoped classes:

```css
.workspace-mode-switch {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.mode-option {
  min-height: 36px;
  padding: 0 12px;
}

.restore-draft-editor {
  width: 100%;
  min-height: 100%;
  resize: none;
  border: 0;
  outline: 0;
  font-family: var(--font-mono);
}
```

Adjust token names to match the actual CSS variables if needed.

**Step 5: Run test and build**

Run: `npm test -- src/restoreWorkspaceMarkup.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/main.ts src/styles.css src/restoreWorkspaceMarkup.test.ts
git commit -m "feat(ui): render restore workspace panels"
```

## Task 9: Manage Multiple AI Outputs

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Add output creation helper**

Add:

```ts
function createRestoreOutput(text = ""): RestoreOutput {
  const now = new Date().toISOString();
  const nextNumber = state.restoreOutputs.length + 1;
  return {
    id: `restore-${crypto.randomUUID()}`,
    title: `AI Output ${String(nextNumber).padStart(3, "0")}`,
    redactedInput: text,
    restoredDraft: state.restoreKey ? restorePastedText(text, state.restoreKey) : text,
    createdAt: now,
    updatedAt: now,
  };
}
```

If `crypto.randomUUID()` causes compatibility concern, use the same id pattern already used for loaded documents.

**Step 2: Add list actions**

In `renderRestoreOutputs()` show:

- A selected row for each output.
- A remove button.
- A "New output" button.
- Empty state: `Paste AI output into the draft to start.`

Add click handlers to select, create, and remove outputs.

**Step 3: Update selected output status**

Use `scanRestoreMatches(output.restoredDraft, state.restoreKey)` to show status counts in each row:

- unknown count if any
- restorable token count if any
- otherwise "Draft"

**Step 4: Run build**

Run: `npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main.ts src/styles.css
git commit -m "feat(ui): manage restore AI outputs"
```

## Task 10: Add Editable Restored Draft With Paste Restore

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Render editor**

In `renderRestoredDraft()`, render:

```html
<textarea
  id="restore-draft-editor"
  class="restore-draft-editor"
  placeholder="Paste redacted AI output here."
  spellcheck="true"
></textarea>
```

Set its value after inserting HTML:

```ts
const editor = document.querySelector<HTMLTextAreaElement>("#restore-draft-editor");
if (editor && output) editor.value = state.showRedactedRestoreInput
  ? output.redactedInput
  : output.restoredDraft;
```

**Step 2: Add paste handler**

On paste:

- Read pasted plain text from `event.clipboardData`.
- Restore only the pasted text.
- Insert the restored text at the current selection.
- Append the raw pasted text to `redactedInput` in the same position if practical; for V1 it is acceptable to set `redactedInput` to the latest raw paste when starting from an empty output.
- Prevent the browser's default paste.

Implementation sketch:

```ts
function handleRestoreDraftPaste(event: ClipboardEvent): void {
  if (state.showRedactedRestoreInput) return;
  const editor = event.currentTarget as HTMLTextAreaElement;
  const pasted = event.clipboardData?.getData("text/plain") ?? "";
  if (!pasted) return;
  event.preventDefault();
  const restored = restorePastedText(pasted, state.restoreKey);
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const nextValue = `${editor.value.slice(0, start)}${restored}${editor.value.slice(end)}`;
  editor.value = nextValue;
  editor.selectionStart = editor.selectionEnd = start + restored.length;
  updateSelectedRestoreOutputDraft(nextValue, pasted);
}
```

**Step 3: Add input handler**

On ordinary input:

- Update `restoredDraft`.
- Do not call `restorePastedText` on the entire value.
- Re-render only the Restore Map or debounce if needed.

**Step 4: Add copy/download actions**

Reuse existing `downloadText()` and clipboard patterns:

- Copy restored draft.
- Download selected output as `ai-output-001.restored.md`.

**Step 5: Run build**

Run: `npm run build`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/main.ts src/styles.css
git commit -m "feat(ui): restore pasted AI output into editable drafts"
```

## Task 11: Render Restore Map Counts And Warnings

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Render matches**

In `renderRestoreMap()`:

- If no key, show: `No restore key yet. Return to Redact or import a private restore key.`
- If no selected output, show: `Create an AI output to start.`
- If no token matches, show: `No placeholder tokens found in this draft.`
- Otherwise render grouped rows from `scanRestoreMatches(output.restoredDraft, state.restoreKey)`.

Rows should show:

- token
- count
- original value for restorable tokens
- status label for unknown/unsafe/ambiguous

**Step 2: Add status language**

Use plain labels:

- `Restored`
- `Unknown`
- `Unsafe label`
- `Ambiguous`

**Step 3: Add a manual "Restore remaining tokens" action**

If `scanRestoreMatches` finds restorable tokens in the current restored draft because the user typed or pasted while viewing redacted input, show a small action:

```ts
function restoreRemainingTokens(): void {
  const output = selectedRestoreOutput();
  if (!output || !state.restoreKey) return;
  output.restoredDraft = restorePastedText(output.restoredDraft, state.restoreKey);
  output.updatedAt = new Date().toISOString();
  renderRestoredDraft();
  renderRestoreMap();
}
```

**Step 4: Run build**

Run: `npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main.ts src/styles.css
git commit -m "feat(ui): show restore map matches"
```

## Task 12: Add Private Restore Key Download And Import

**Files:**
- Modify: `src/main.ts`
- Modify: `src/styles.css`

**Step 1: Add controls**

In Restore Map panel header or footer:

- `Download private restore key`
- `Import private restore key`

Use a hidden file input for import:

```html
<input id="restore-key-input" type="file" accept="application/json,.json" hidden />
```

**Step 2: Download key**

Before downloading, show a browser `confirm()`:

```ts
const ok = window.confirm(
  "This private restore key contains original text. Do not upload it to AI tools.",
);
if (!ok) return;
downloadText(JSON.stringify(state.restoreKey, null, 2), "noai-private-restore-key.json");
```

If `downloadText()` always uses Markdown MIME type today, either:

- extend it to accept a MIME type, or
- add `downloadJson()`.

**Step 3: Import key**

Read file text locally with `file.text()`, parse with `parseRestoreKey()`, and set:

```ts
state.restoreKey = parseRestoreKey(source);
state.restoreKeySource = "imported";
```

Show success or error toast.

**Step 4: Run build**

Run: `npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main.ts src/styles.css
git commit -m "feat(ui): import and export private restore keys"
```

## Task 13: Add Leave Warning Only When Needed

**Files:**
- Modify: `src/main.ts`

**Step 1: Add condition helper**

Add:

```ts
function hasSessionRestoreRisk(): boolean {
  return Boolean(
    state.restoreKey &&
      state.restoreKeySource === "session" &&
      (state.documents.length > 0 || state.restoreOutputs.length > 0),
  );
}
```

**Step 2: Add beforeunload listener**

Add:

```ts
window.addEventListener("beforeunload", (event) => {
  if (!hasSessionRestoreRisk()) return;
  event.preventDefault();
  event.returnValue = "";
});
```

Do not promise this always works. Browser behavior varies.

**Step 3: Add in-app copy**

Show a small note in Restore mode when using a session key:

```text
Keep this tab open to restore later.
```

**Step 4: Run build**

Run: `npm run build`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat(ui): warn before losing session restore key"
```

## Task 14: Update Public Copy And Privacy/FAQ Text

**Files:**
- Modify: `README.md`
- Modify: `src/main.ts`

**Step 1: Update README**

Add a short Restore bullet near existing feature bullets:

```markdown
- **Local Restore:** Paste AI-generated output back into NoAI to restore safe placeholder tokens locally using the current session key or an imported private restore key.
```

Add a privacy note:

```markdown
Private restore keys contain original text. They are optional backup files for restoring later and should not be uploaded to external AI tools.
```

**Step 2: Update FAQ/privacy page data in `src/main.ts`**

Add an FAQ entry:

Question:

```text
What is Restore?
```

Answer:

```text
Restore lets you paste AI-generated output back into NoAI so placeholder tokens like PERSON_001 can be replaced with the original text locally in your browser.
```

Add another FAQ entry:

Question:

```text
What is a private restore key?
```

Answer:

```text
A private restore key is an optional file that lets NoAI restore later after the tab is closed. It contains original private text, so do not upload it to AI tools.
```

**Step 3: Run build**

Run: `npm run build`

Expected: PASS.

**Step 4: Commit**

```bash
git add README.md src/main.ts
git commit -m "docs: explain local restore workflow"
```

## Task 15: Final Verification

**Files:**
- No code edits unless verification finds a bug.

**Step 1: Run full tests**

Run: `npm test`

Expected: PASS.

**Step 2: Run production build**

Run: `npm run build`

Expected: PASS.

**Step 3: Manual browser check**

Run: `npm run dev`

Open the local dev URL and verify:

- Redact mode still loads.
- Add a synthetic document.
- Confirm redacted preview still works.
- Switch to Restore.
- Confirm AI Outputs, Restored Draft, and Restore Map panels appear.
- Paste `PERSON_001 wrote to ORG_999`.
- Known token restores if available; unknown token stays unchanged and appears in Restore Map.
- Edit ordinary text and confirm NoAI does not auto-replace every keystroke.
- Download/import private restore key using synthetic data.
- Check mobile viewport around 375px wide.

Stop the dev server before finishing.

**Step 4: Final commit if needed**

If verification required fixes:

```bash
git add <changed-files>
git commit -m "fix(ui): polish restore workspace"
```

