import "./styles.css";
import { readFiles } from "./fileReaders";
import { redactDocuments } from "./redactor/engine";
import {
  CandidateKind,
  RedactionLevel,
  ReplacementEntry,
  ReviewModel,
} from "./redactor/types";

/* ------------------------------------------------------------------ *
 * NoAI review workspace (frontend track)
 *
 * The UI only manages files, user edits, and interactions. All
 * deterministic detection, matching, and export text come from the
 * logic layer via `redactDocuments(inputs, { level, entries })`.
 *
 * No AI calls, no backend uploads, no telemetry, no persistent storage
 * of document contents. Source text lives in memory for the session.
 * ------------------------------------------------------------------ */

/* ----------------------------- State ------------------------------ */

interface LoadedDocument {
  id: string;
  fileName: string;
  text: string;
  warnings: string[];
}

interface AppState {
  documents: LoadedDocument[];
  selectedDocumentId: string | null;
  /** User-controlled entries. Re-passed to the engine on every rebuild so
   *  edits and manual terms survive re-detection. */
  entries: ReplacementEntry[];
  /** Entry ids deleted by the user, so automatic detections stay out. */
  removedEntryIds: Set<string>;
  level: RedactionLevel;
  review: ReviewModel | null;
  query: string;
  collapsedKinds: Set<string>;
  documentsCollapsed: boolean;
  busy: boolean;
  /** Entry id currently shown in the preview popover. */
  selectedEntryId: string | null;
}

const state: AppState = {
  documents: [],
  selectedDocumentId: null,
  entries: [],
  removedEntryIds: new Set(),
  level: "balanced",
  review: null,
  query: "",
  collapsedKinds: new Set(),
  documentsCollapsed: false,
  busy: false,
  selectedEntryId: null,
};

let docCounter = 0;
function nextDocId(): string {
  docCounter += 1;
  return `local-${docCounter}`;
}

const LEVEL_DESCRIPTIONS: Record<RedactionLevel, string> = {
  light: "Direct identifiers only; best readability.",
  balanced: "Names, orgs, dates, amounts; default review.",
  strict: "More aggressive; strongest privacy pass.",
};

import "@phosphor-icons/web/regular";

const icon = {
  alert: '<i class="ph ph-warning" aria-hidden="true"></i>',
  chevronLeft:
    '<i class="button-icon ph ph-caret-left" aria-hidden="true"></i>',
  chevronRight:
    '<i class="button-icon ph ph-caret-right" aria-hidden="true"></i>',
  chevronDown: '<i class="ph ph-caret-down" aria-hidden="true"></i>',
  x: '<i class="button-icon ph ph-x" aria-hidden="true"></i>',
  sidebar: '<i class="ph ph-sidebar-simple" aria-hidden="true"></i>',
};

/* ----------------------------- Dev mode ---------------------------- */

/**
 * Local development convenience. Gated on Vite's DEV flag so these affordances
 * are dead-code-eliminated from production builds; the runtime path (no uploads,
 * no AI, no telemetry) is unchanged.
 *
 * - Auto-loads a synthetic sample document on boot so the review UI is populated
 *   without dragging a file in each time.
 * - Shows a bottom-left FAB to reload the sample.
 *
 * Disable in `.env` with VITE_DEV_SAMPLE=false.
 */
const DEV_MODE =
  import.meta.env.DEV && import.meta.env.VITE_DEV_SAMPLE !== "false";
const DEV_SAMPLE_PATH: string =
  import.meta.env.VITE_DEV_SAMPLE_PATH || "/dev-sample.md";
const EMBEDDED_DEV_SAMPLE = `From: Morgan Vale
To: Priya Shah
Cc: Northwind Trading Ltd.
Date: 28 November 2025
Re: Project Lighthouse response letter
File No. 001-39940
Registration No. 333-901023
Direct Dial No.: (212) 555-0148
Email: morgan.vale@example.com

Dear Ms. Shah:

The company reviewed Risk Management and Use of Proceeds comments with
Jordan Price and Dana Frost. Please send notices to 221 Baker Street,
Suite 400, London SW1A 1AA.

Sincerely,

/s/ Morgan Vale
Name: Morgan Vale
Title: General Counsel
`;

/* --------------------------- DOM scaffold -------------------------- */

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App root was not found.");

app.innerHTML = `
  <main class="app-shell">
    <header class="topbar">
      <div>
        <img src="/logo.png" alt="NoAI Logo" style="display: block; height: 26px; margin-bottom: 4px;" />
      </div>
    </header>

    <section class="workspace">

      <!-- Empty state: large dropzone shown before any document is loaded -->
      <section class="panel empty-state" id="empty-state">
        <label class="dropzone" data-dropzone>
          <input type="file" multiple accept=".md,.markdown,.txt,.docx,.pdf" data-file-input />
          <span class="drop-title">Drop documents or choose files</span>
          <span class="drop-meta">Markdown, text, Word, and text-based PDF — read locally, never uploaded</span>
        </label>
      </section>

      <!-- Loaded state: three-panel review workspace -->
      <section class="workspace-grid" id="workspace-grid" hidden aria-live="polite">

        <section class="panel files-panel">
          <div class="panel-head">
            <h2>Documents</h2>
            <div class="panel-actions">
              <button id="documents-toggle" type="button" class="icon-button" aria-expanded="true" aria-label="Collapse documents sidebar">${icon.sidebar}</button>
            </div>
          </div>
          <div class="files-content" id="files-content">
            <div class="files-scroll-area">
              <div class="files-body" id="files-body"></div>
              <label class="dropzone dropzone-small" data-dropzone>
                <input type="file" multiple accept=".md,.markdown,.txt,.docx,.pdf" data-file-input />
                <span class="drop-title">Add more documents</span>
                <span class="drop-meta">Drop or click — added to the same session</span>
              </label>
            </div>
            <div class="document-controls">
              <fieldset class="level-control" aria-label="Redaction level">
                <legend>Redaction level</legend>
                <div class="level-options">
                  <button type="button" class="level-option" data-level="light" aria-pressed="false">
                    <span class="level-icon level-icon-light" aria-hidden="true">
                      <span><b>Q</b><b>Z</b><b>V</b><b>X</b><b>R</b></span>
                      <span><b>M</b><b>T</b><b>A</b><b>K</b><b>P</b></span>
                      <span><b>L</b><b>Y</b><b>S</b><b>N</b><b>D</b></span>
                    </span>
                    <span class="level-copy">
                      <span class="level-title">Light</span>
                      <span class="level-desc">Direct identifiers only; best readability.</span>
                    </span>
                  </button>
                  <button type="button" class="level-option" data-level="balanced" aria-pressed="true">
                    <span class="level-icon level-icon-balanced" aria-hidden="true">
                      <span><b>Q</b><b>Z</b><b>V</b><b>X</b><b>R</b></span>
                      <span><b>M</b><b>T</b><b>A</b><b>K</b><b>P</b></span>
                      <span><b>L</b><b>Y</b><b>S</b><b>N</b><b>D</b></span>
                    </span>
                    <span class="level-copy">
                      <span class="level-title">Balanced</span>
                      <span class="level-desc">Names, orgs, dates, amounts; default review.</span>
                    </span>
                  </button>
                  <button type="button" class="level-option" data-level="strict" aria-pressed="false">
                    <span class="level-icon level-icon-strict" aria-hidden="true">
                      <span><b>Q</b><b>Z</b><b>V</b><b>X</b><b>R</b></span>
                      <span><b>M</b><b>T</b><b>A</b><b>K</b><b>P</b></span>
                      <span><b>L</b><b>Y</b><b>S</b><b>N</b><b>D</b></span>
                    </span>
                    <span class="level-copy">
                      <span class="level-title">Strict</span>
                      <span class="level-desc">More aggressive; strongest privacy pass.</span>
                    </span>
                  </button>
                </div>
                <p class="level-active-desc" id="level-active-desc"></p>
              </fieldset>
              <button id="download-button" type="button" class="download-action" disabled>
                <i class="download-icon ph ph-download-simple" aria-hidden="true"></i>
                <span>Combined Markdown</span>
              </button>
            </div>
          </div>
        </section>

        <section class="panel preview-panel">
          <div class="resizer resizer-left" id="resizer-left" aria-hidden="true"></div>
          <div class="resizer resizer-right" id="resizer-right" aria-hidden="true"></div>
          <div class="panel-head">
            <h2 id="preview-title">Preview</h2>
            <div class="panel-actions">
              <button id="copy-doc-button" type="button" class="icon-button" disabled title="Copy redacted text">
                <i class="ph ph-copy" aria-hidden="true"></i>
              </button>
              <button id="download-doc-button" type="button" class="icon-button download-action" disabled title="Download this document">
                <i class="download-icon ph ph-download-simple" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="preview-body" id="preview-body"></div>
        </section>

        <section class="panel replacements-panel">
          <div class="panel-head">
            <h2>Replacements</h2>
            <span class="panel-count" id="replacements-count"></span>
          </div>
          <div class="replacements-controls">
            <label class="sr-only" for="search-input">Search replacements</label>
            <input id="search-input" type="search" name="replacement-search" placeholder="Search terms, replacements, sources…" autocomplete="off" />
            <div class="add-term">
              <label class="sr-only" for="add-term-input">Add manual redaction term</label>
              <input id="add-term-input" type="text" name="manual-redaction-term" placeholder="Add term…" autocomplete="off" />
              <button id="add-term-button" type="button" class="ghost-button">Add</button>
            </div>
          </div>
          <div class="replacements-body" id="replacements-body"></div>
        </section>

      </section>
    </section>
  </main>

  <!-- Floating popover for redacted span actions -->
  <div class="popover" id="entry-popover" hidden role="dialog" aria-label="Redaction actions">
    <div class="popover-arrow"></div>
    <button type="button" class="popover-close" id="popover-close" aria-label="Close">${icon.x}</button>
    <div class="popover-field">
      <span class="popover-label">Original</span>
      <code class="popover-original" id="popover-original"></code>
    </div>
    <div class="popover-field">
      <label class="popover-label" for="popover-replacement">Replacement</label>
      <input id="popover-replacement" type="text" autocomplete="off" />
    </div>
    <div class="popover-actions">
      <button type="button" class="ghost-button" id="popover-delete">Delete</button>
      <button type="button" class="ghost-button" id="popover-find">Find in list</button>
    </div>
  </div>

  <!-- Floating Redact button for text selection -->
  <button type="button" class="redact-selection" id="redact-selection" hidden>Redact Selection</button>

  <!-- Overlay notifications. Never render status inside the Documents panel. -->
  <div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="false"></div>
`;

/* --------------------------- Element refs -------------------------- */

const emptyState = document.querySelector<HTMLElement>("#empty-state")!;
const workspaceGrid = document.querySelector<HTMLElement>("#workspace-grid")!;
const documentsToggle =
  document.querySelector<HTMLButtonElement>("#documents-toggle")!;
const filesContent = document.querySelector<HTMLElement>("#files-content")!;
const filesBody = document.querySelector<HTMLElement>("#files-body")!;
const replacementsBody =
  document.querySelector<HTMLElement>("#replacements-body")!;
const replacementsCount = document.querySelector<HTMLElement>(
  "#replacements-count",
)!;
const searchInput = document.querySelector<HTMLInputElement>("#search-input")!;
const addTermInput =
  document.querySelector<HTMLInputElement>("#add-term-input")!;
const addTermButton =
  document.querySelector<HTMLButtonElement>("#add-term-button")!;
const levelButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-level]");
const levelActiveDesc =
  document.querySelector<HTMLElement>("#level-active-desc")!;
const previewTitle = document.querySelector<HTMLElement>("#preview-title")!;
const previewBody = document.querySelector<HTMLElement>("#preview-body")!;
const copyDocButton = document.querySelector<HTMLButtonElement>(
  "#copy-doc-button",
)!;
const downloadDocButton = document.querySelector<HTMLButtonElement>(
  "#download-doc-button",
)!;
const downloadButton =
  document.querySelector<HTMLButtonElement>("#download-button")!;
const toastRegion = document.querySelector<HTMLElement>("#toast-region")!;

const filesPanel = document.querySelector<HTMLElement>(".files-panel")!;
const replacementsPanel = document.querySelector<HTMLElement>(".replacements-panel")!;
const resizerLeft = document.querySelector<HTMLElement>("#resizer-left")!;
const resizerRight = document.querySelector<HTMLElement>("#resizer-right")!;

const popover = document.querySelector<HTMLElement>("#entry-popover")!;
const popoverClose =
  document.querySelector<HTMLButtonElement>("#popover-close")!;
const popoverOriginal =
  document.querySelector<HTMLElement>("#popover-original")!;
const popoverReplacement = document.querySelector<HTMLInputElement>(
  "#popover-replacement",
)!;
const popoverDelete =
  document.querySelector<HTMLButtonElement>("#popover-delete")!;
const popoverFind = document.querySelector<HTMLButtonElement>("#popover-find")!;

const redactSelectionBtn =
  document.querySelector<HTMLButtonElement>("#redact-selection")!;

/* ----------------------- Dropzone / file input --------------------- */

document.querySelectorAll<HTMLElement>("[data-dropzone]").forEach((zone) => {
  const input = zone.querySelector<HTMLInputElement>("[data-file-input]");
  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragging");
    const files = Array.from(event.dataTransfer?.files ?? []);
    void handleFiles(files);
  });
  if (input) {
    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      input.value = "";
      void handleFiles(files);
    });
  }
});

async function handleFiles(fileList: File[]): Promise<void> {
  const supported = fileList.filter(isSupportedFile);
  if (supported.length === 0) {
    if (fileList.length > 0) setStatus("Those file types are not supported.");
    return;
  }
  setBusy(true, "Reading files locally…");
  try {
    const readResults = await readFiles(supported);
    for (const result of readResults) {
      state.documents.push({
        id: nextDocId(),
        fileName: result.name,
        text: result.text,
        warnings: result.warnings,
      });
    }
    if (!state.selectedDocumentId && state.documents.length > 0) {
      state.selectedDocumentId = state.documents[0].id;
    }
    setStatus(`Read ${pluralize(readResults.length, "file")} locally.`);
    recompute();
    renderAll();
  } catch (error) {
    setStatus(
      error instanceof Error
        ? error.message
        : "Something went wrong while reading files.",
    );
  } finally {
    setBusy(false);
  }
}

/* --------------------------- Engine bridge ------------------------- */

/** Re-run detection across all loaded documents, merging current user entries.
 *  Updates `state.review` and `state.entries` but does not touch the DOM. */
function recompute(): void {
  if (state.documents.length === 0) {
    state.review = null;
    state.entries = [];
    state.removedEntryIds.clear();
    return;
  }
  const inputs = state.documents.map((doc) => ({
    name: doc.fileName,
    text: doc.text,
  }));
  const result = redactDocuments(inputs, {
    level: state.level,
    entries: state.entries,
    removedEntryIds: [...state.removedEntryIds],
  });
  state.review = result;
  state.entries = result.entries;
}

/* ----------------------------- Actions ----------------------------- */

levelButtons.forEach((button) => {
  button.addEventListener("click", () => {
    state.level = button.dataset.level as RedactionLevel;
    recompute();
    renderAll();
  });
});

searchInput.addEventListener("input", () => {
  state.query = searchInput.value.trim().toLowerCase();
  renderReplacements();
});

addTermButton.addEventListener("click", () => {
  const value = addTermInput.value.trim();
  if (!value) return;
  addManualEntry(value);
  addTermInput.value = "";
  addTermInput.focus();
});
addTermInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addTermButton.click();
  }
});

downloadButton.addEventListener("click", () => {
  if (!state.review) return;
  downloadText(state.review.combinedMarkdown, "redacted-document-pack.md");
});

copyDocButton.addEventListener("click", () => {
  const reviewDoc = selectedReviewDoc();
  if (!reviewDoc) return;
  navigator.clipboard.writeText(reviewDoc.sanitized).then(() => {
    showToast("Copied to clipboard!");
  }).catch(() => {
    showToast("Failed to copy text.");
  });
});

downloadDocButton.addEventListener("click", () => {
  const loaded = selectedLoadedDoc();
  const reviewDoc = selectedReviewDoc();
  if (!loaded || !reviewDoc) return;
  downloadText(reviewDoc.sanitized, sanitizedFilename(loaded.fileName));
});

documentsToggle.addEventListener("click", () => {
  state.documentsCollapsed = !state.documentsCollapsed;
  renderFiles();
});

/* --------------------------- Resizing ------------------------------ */

let isResizing = false;
let currentResizer: "left" | "right" | null = null;
let startX = 0;
let startWidth1 = 0;
let startWidth3 = 0;

resizerLeft.addEventListener("mousedown", (e) => {
  if (state.documentsCollapsed) return;
  isResizing = true;
  currentResizer = "left";
  resizerLeft.classList.add("active");
  startX = e.clientX;
  startWidth1 = filesPanel.getBoundingClientRect().width;
  document.body.classList.add("resizing-col");
});

resizerRight.addEventListener("mousedown", (e) => {
  isResizing = true;
  currentResizer = "right";
  resizerRight.classList.add("active");
  startX = e.clientX;
  startWidth3 = replacementsPanel.getBoundingClientRect().width;
  document.body.classList.add("resizing-col");
});

window.addEventListener("mousemove", (e) => {
  if (!isResizing || !currentResizer) return;
  const dx = e.clientX - startX;
  if (currentResizer === "left") {
    const newWidth = Math.max(200, Math.min(startWidth1 + dx, 800));
    workspaceGrid.style.setProperty("--col-1-width", `${newWidth}px`);
  } else {
    // For right resizer, moving left (negative dx) increases right panel width
    const newWidth = Math.max(250, Math.min(startWidth3 - dx, 800));
    workspaceGrid.style.setProperty("--col-3-width", `${newWidth}px`);
  }
});

window.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    currentResizer = null;
    resizerLeft.classList.remove("active");
    resizerRight.classList.remove("active");
    document.body.classList.remove("resizing-col");
  }
});

/* ----- Replacement edits (keep focus, only refresh preview) ----- */

let previewUpdateTimer: number | undefined;
function schedulePreviewUpdate(): void {
  window.clearTimeout(previewUpdateTimer);
  previewUpdateTimer = window.setTimeout(() => {
    recompute();
    renderPreview();
  }, 120);
}

function setEntryReplacement(id: string, replacement: string): void {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  entry.replacement = replacement;
  schedulePreviewUpdate();
}

function deleteEntry(id: string): void {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  state.removedEntryIds.add(id);
  state.entries = state.entries.filter((item) => item.id !== id);
  if (state.selectedEntryId === id) hidePopover();
  recompute();
  renderAll();
  setStatus(`Deleted replacement for "${entry.value}".`);
}

/* --------------------------- Manual entries ------------------------ */

function addManualEntry(value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const id = manualEntryId(trimmed);
  const existing = state.entries.find((entry) => entry.id === id);
  if (existing) {
    recompute();
    renderAll();
    return;
  }
  state.removedEntryIds.delete(id);
  const entry: ReplacementEntry = {
    id,
    value: trimmed,
    replacement: nextCustomReplacement(),
    kind: "CUSTOM",
    level: "light",
    reason: "manual",
    sources: ["manual"],
    count: 0,
    manual: true,
    matchCase: false,
  };
  state.entries.push(entry);
  recompute();
  renderAll();
  setStatus(`Added manual redaction for "${trimmed}".`);
}

function manualEntryId(value: string): string {
  return `CUSTOM:${encodeURIComponent(value)}`;
}

function nextCustomReplacement(): string {
  let max = 0;
  for (const entry of state.entries) {
    const match = /^CUSTOM_(\d+)$/.exec(entry.replacement);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `CUSTOM_${String(max + 1).padStart(3, "0")}`;
}

/* ------------------------- Document actions ------------------------ */

function selectDocument(id: string): void {
  if (!state.documents.some((doc) => doc.id === id)) return;
  state.selectedDocumentId = id;
  hidePopover();
  renderFiles();
  renderPreview();
}

function removeDocument(id: string): void {
  const index = state.documents.findIndex((doc) => doc.id === id);
  if (index === -1) return;
  state.documents.splice(index, 1);
  if (state.selectedDocumentId === id) {
    const next = state.documents[index] ?? state.documents[index - 1] ?? null;
    state.selectedDocumentId = next ? next.id : null;
  }
  hidePopover();
  recompute();
  renderAll();
}

/* ---------------------------- Rendering ---------------------------- */

function renderAll(): void {
  renderEmptyState();
  renderFiles();
  renderLevelControl();
  renderReplacements();
  renderPreview();
}

function renderEmptyState(): void {
  const hasDocs = state.documents.length > 0;
  emptyState.hidden = hasDocs;
  workspaceGrid.hidden = !hasDocs;
  workspaceGrid.classList.toggle(
    "documents-collapsed",
    state.documentsCollapsed,
  );
  downloadButton.disabled = !hasDocs || !state.review;

  const downloadText = downloadButton.querySelector("span");
  if (downloadText) {
    downloadText.textContent =
      state.documents.length === 1 ? "Markdown" : "Combined Markdown";
  }
}

function selectedLoadedDoc(): LoadedDocument | undefined {
  return state.documents.find((doc) => doc.id === state.selectedDocumentId);
}

function selectedReviewDoc() {
  if (!state.review) return undefined;
  const loaded = selectedLoadedDoc();
  if (!loaded) return undefined;
  const index = state.documents.findIndex((doc) => doc.id === loaded.id);
  return state.review.documents[index];
}

function renderFiles(): void {
  workspaceGrid.classList.toggle(
    "documents-collapsed",
    state.documentsCollapsed,
  );
  documentsToggle.setAttribute(
    "aria-expanded",
    String(!state.documentsCollapsed),
  );
  documentsToggle.setAttribute(
    "aria-label",
    state.documentsCollapsed
      ? "Expand documents sidebar"
      : "Collapse documents sidebar",
  );
  if (state.documents.length === 0) {
    filesBody.innerHTML = `<p class="placeholder">No documents yet.</p>`;
    return;
  }
  filesBody.innerHTML = state.documents
    .map((doc) => {
      const selected = doc.id === state.selectedDocumentId ? " selected" : "";
      const warningLine =
        doc.warnings.length > 0
          ? `<span class="file-warning" title="${escapeHtml(doc.warnings.join("; "))}">${icon.alert}<span>${escapeHtml(String(doc.warnings.length))}</span></span>`
          : "";
      return `
        <div class="file-row${selected}" data-doc-id="${escapeHtml(doc.id)}">
          <button type="button" class="file-select" data-doc-id="${escapeHtml(doc.id)}">
            <span class="file-name">${escapeHtml(doc.fileName)}</span>
            ${warningLine}
          </button>
          <button type="button" class="file-remove" data-doc-id="${escapeHtml(doc.id)}" aria-label="Remove ${escapeHtml(doc.fileName)}">${icon.x}</button>
        </div>
      `;
    })
    .join("");

  filesBody
    .querySelectorAll<HTMLButtonElement>(".file-select")
    .forEach((button) => {
      button.addEventListener("click", () =>
        selectDocument(button.dataset.docId!),
      );
    });
  filesBody
    .querySelectorAll<HTMLButtonElement>(".file-remove")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        removeDocument(button.dataset.docId!);
      });
    });
}

function renderReplacements(): void {
  const entries = state.review
    ? state.review.entries.filter((entry) => entry.count > 0)
    : [];
  const filtered = entries.filter((entry) => matchesQuery(entry, state.query));

  const visibleCount = filtered.length;
  const totalCount = entries.length;
  replacementsCount.textContent =
    state.query && visibleCount !== totalCount
      ? `${visibleCount} / ${totalCount}`
      : String(totalCount);

  if (entries.length === 0) {
    replacementsBody.innerHTML = `<p class="placeholder">No replacements yet. Add documents or a manual term.</p>`;
    return;
  }
  if (filtered.length === 0) {
    replacementsBody.innerHTML = `<p class="placeholder">No replacements match "${escapeHtml(state.query)}".</p>`;
    return;
  }

  const groups = groupByKind(filtered);
  const orderedKinds = Object.keys(groups).sort(sortKinds);

  replacementsBody.innerHTML = orderedKinds
    .map((kind) => {
      const items = groups[kind];
      const collapsed = state.collapsedKinds.has(kind);
      const style = kindStyle(kind);
      return `
        <section class="cat-group" data-kind="${escapeHtml(kind)}">
          <button type="button" class="cat-head${collapsed ? " collapsed" : ""}" data-toggle-kind="${escapeHtml(kind)}">
            <span class="cat-name" style="${style.labelCss}">${escapeHtml(kindLabel(kind))}</span>
            <span class="cat-count">${items.length}</span>
            <span class="cat-chevron">${icon.chevronDown}</span>
          </button>
          <div class="cat-items-grid${collapsed ? " collapsed" : ""}">
            <div class="cat-items">${items.map((entry, i) => renderEntryRow(entry, i)).join("")}</div>
          </div>
        </section>
      `;
    })
    .join("");

  replacementsBody
    .querySelectorAll<HTMLButtonElement>("[data-toggle-kind]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.dataset.toggleKind!;
        const section = button.closest(".cat-group")!;
        const grid = section.querySelector(".cat-items-grid")!;
        if (state.collapsedKinds.has(kind)) {
          state.collapsedKinds.delete(kind);
          button.classList.remove("collapsed");
          grid.classList.remove("collapsed");
        } else {
          state.collapsedKinds.add(kind);
          button.classList.add("collapsed");
          grid.classList.add("collapsed");
        }
      });
    });

  replacementsBody
    .querySelectorAll<HTMLInputElement>("[data-replacement-input]")
    .forEach((input) => {
      input.addEventListener("input", () =>
        setEntryReplacement(input.dataset.replacementInput!, input.value),
      );
    });
  replacementsBody
    .querySelectorAll<HTMLButtonElement>("[data-delete-entry]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        deleteEntry(button.dataset.deleteEntry!);
      });
    });
  replacementsBody
    .querySelectorAll<HTMLElement>("[data-jump-entry]")
    .forEach((row) => {
      row.addEventListener("click", (event) => {
        if ((event.target as HTMLElement).closest("input, button")) return;
        const id = row.dataset.jumpEntry!;
        jumpToEntryInPreview(id);
      });
    });
}

function renderEntryRow(entry: ReplacementEntry, index: number = 0): string {
  const style = kindStyle(entry.kind);
  const hitTitle = `${entry.count} ${entry.count === 1 ? "hit" : "hits"}`;
  return `
    <div class="entry-row" data-jump-entry="${escapeHtml(entry.id)}" style="--anim-index: ${index}">
      <s class="entry-value" style="--strike-color: ${style.color}" title="${escapeHtml(hitTitle)}">${escapeHtml(entry.value)}</s>
      <div class="entry-controls">
        <input
          type="text"
          class="entry-replacement"
          data-replacement-input="${escapeHtml(entry.id)}"
          value="${escapeHtml(entry.replacement)}"
          aria-label="Replacement for ${escapeHtml(entry.value)}"
          autocomplete="off"
        />
        <button
          type="button"
          class="entry-delete"
          data-delete-entry="${escapeHtml(entry.id)}"
          aria-label="Delete replacement for ${escapeHtml(entry.value)}"
        >${icon.x}</button>
      </div>
    </div>
  `;
}

function renderPreview(): void {
  const reviewDoc = selectedReviewDoc();
  previewTitle.textContent = "Preview";
  copyDocButton.disabled = !reviewDoc;
  downloadDocButton.disabled = !reviewDoc;

  if (!reviewDoc) {
    previewBody.innerHTML = `<p class="placeholder">Select a document to review it.</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const segment of reviewDoc.segments) {
    if (segment.entryId) {
      const style = kindStyle(segment.kind ?? "PROPER_NOUN");
      const span = document.createElement("span");
      span.className = "redacted";
      span.dataset.entryId = segment.entryId;
      span.title = `Original: ${segment.value ?? ""}`;
      span.setAttribute("tabindex", "0");
      span.setAttribute("role", "button");
      span.setAttribute(
        "aria-label",
        `Redacted term. Original: ${segment.value ?? ""}. Activate to edit.`,
      );
      span.setAttribute("style", style.spanCss);
      span.textContent = segment.replacement ?? segment.text;
      fragment.appendChild(span);
    } else {
      fragment.appendChild(document.createTextNode(segment.text));
    }
  }
  previewBody.innerHTML = "";
  previewBody.appendChild(fragment);
}

function renderLevelControl(): void {
  levelButtons.forEach((button) => {
    const selected = button.dataset.level === state.level;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  levelActiveDesc.textContent = LEVEL_DESCRIPTIONS[state.level];
}

/* --------------------- Preview interactions ------------------------ */

previewBody.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    ".redacted",
  );
  if (target) openPopover(target.dataset.entryId!, target);
});

previewBody.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = (event.target as HTMLElement).closest<HTMLElement>(
    ".redacted",
  );
  if (!target) return;
  event.preventDefault();
  openPopover(target.dataset.entryId!, target);
});

previewBody.addEventListener("scroll", hidePopover, { passive: true });

/* ------------------------- Entry popover --------------------------- */

function openPopover(entryId: string, anchor: HTMLElement): void {
  const entry = state.entries.find((item) => item.id === entryId);
  if (!entry) return;
  state.selectedEntryId = entryId;
  popoverOriginal.textContent = entry.value;
  popoverReplacement.value = entry.replacement;
  popover.hidden = false;
  positionPopover(anchor);
  popoverReplacement.focus();
  popoverReplacement.select();
}

function positionPopover(anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  popover.style.visibility = "hidden";
  popover.style.left = "0px";
  popover.style.top = "0px";
  const popRect = popover.getBoundingClientRect();
  const width = popRect.width || 260;
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(
    8 + window.scrollX,
    Math.min(left, window.innerWidth - width - 8 + window.scrollX),
  );
  let top = rect.bottom + 8 + window.scrollY;
  // If it would overflow the bottom, place above the anchor.
  const viewportBottom = window.scrollY + window.innerHeight;
  if (top + popRect.height > viewportBottom - 8) {
    top = rect.top - popRect.height - 8 + window.scrollY;
  }
  popover.style.left = `${Math.max(8, left)}px`;
  popover.style.top = `${Math.max(8, top)}px`;
  popover.style.visibility = "";
}

function hidePopover(): void {
  if (popover.hidden) return;
  popover.hidden = true;
  state.selectedEntryId = null;
}

popoverClose.addEventListener("click", () => {
  hidePopover();
  renderReplacements();
});

popoverReplacement.addEventListener("input", () => {
  if (!state.selectedEntryId) return;
  setEntryReplacement(state.selectedEntryId, popoverReplacement.value);
});

popoverDelete.addEventListener("click", () => {
  if (!state.selectedEntryId) return;
  deleteEntry(state.selectedEntryId);
});

popoverFind.addEventListener("click", () => {
  if (!state.selectedEntryId) return;
  const id = state.selectedEntryId;
  hidePopover();
  expandKindForEntry(id);
  renderReplacements();
  const input = replacementsBody.querySelector<HTMLInputElement>(
    `[data-replacement-input="${cssEscape(id)}"]`,
  );
  if (input) {
    const row = input.closest(".entry-row");
    row?.classList.add("flash");
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
    input.focus();
    input.select();
    window.setTimeout(() => row?.classList.remove("flash"), 900);
  }
});

function expandKindForEntry(id: string): void {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) return;
  state.collapsedKinds.delete(entry.kind);
}

document.addEventListener("click", (event) => {
  if (popover.hidden) return;
  const target = event.target as HTMLElement;
  if (popover.contains(target)) return;
  if (target.closest(".redacted")) return;
  hidePopover();
  renderReplacements();
});

window.addEventListener("resize", () => {
  if (!popover.hidden) hidePopover();
});

/* ----------------------- Selection to redact ----------------------- */

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    hideRedactButton();
    return;
  }
  const text = selection.toString();
  if (!text.trim()) {
    hideRedactButton();
    return;
  }
  const range = selection.getRangeAt(0);
  if (!previewBody.contains(range.commonAncestorContainer)) {
    hideRedactButton();
    return;
  }
  // Ignore selections anchored inside an already-redacted span.
  if (range.commonAncestorContainer.parentElement?.closest(".redacted")) {
    hideRedactButton();
    return;
  }
  showRedactButton(range);
});

function showRedactButton(range: Range): void {
  const rect = range.getBoundingClientRect();
  redactSelectionBtn.hidden = false;
  const btnRect = redactSelectionBtn.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - btnRect.width / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - btnRect.width - 8));
  redactSelectionBtn.style.left = `${left + window.scrollX}px`;
  redactSelectionBtn.style.top = `${rect.top - btnRect.height - 8 + window.scrollY}px`;
}

function hideRedactButton(): void {
  redactSelectionBtn.hidden = true;
}

redactSelectionBtn.addEventListener("mousedown", (event) =>
  event.preventDefault(),
);
redactSelectionBtn.addEventListener("click", () => {
  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? "";
  if (text) addManualEntry(text);
  selection?.removeAllRanges();
  hideRedactButton();
});

/* --------------- Preview ↔ list jump helpers ----------------------- */

function jumpToEntryInPreview(id: string): void {
  const span = previewBody.querySelector<HTMLElement>(
    `[data-entry-id="${cssEscape(id)}"]`,
  );
  if (span) {
    flashPreviewSpan(span);
    return;
  }

  const entry = state.entries.find((item) => item.id === id);
  const sourceDocument = entry?.sources
    .map((source) =>
      state.documents.find((document) => document.fileName === source),
    )
    .find((document): document is LoadedDocument => Boolean(document));

  if (!sourceDocument || sourceDocument.id === state.selectedDocumentId) return;

  selectDocument(sourceDocument.id);
  window.requestAnimationFrame(() => {
    const nextSpan = previewBody.querySelector<HTMLElement>(
      `[data-entry-id="${cssEscape(id)}"]`,
    );
    if (nextSpan) flashPreviewSpan(nextSpan);
  });
}

function flashPreviewSpan(span: HTMLElement): void {
  span.scrollIntoView({ block: "center", behavior: "smooth" });
  span.classList.add("flash");
  window.setTimeout(() => span.classList.remove("flash"), 900);
}

/* ------------------------------ Helpers ---------------------------- */

function setBusy(busy: boolean, message?: string): void {
  state.busy = busy;
  if (message) setStatus(message);
  document.body.classList.toggle("busy", busy);
}

function setStatus(message: string): void {
  showToast(message);
}

function showToast(message: string): void {
  if (!message.trim()) return;
  const toast = document.createElement("div");
  toast.className = "toast-bubble";
  toast.textContent = message;
  toastRegion.appendChild(toast);
  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 180);
  }, 2600);
}

function isSupportedFile(file: File): boolean {
  return /\.(?:md|markdown|txt|docx|pdf)$/i.test(file.name);
}

function sanitizedFilename(name: string): string {
  return `${name.replace(/\.[^.]+$/, "")}.redacted.md`;
}

function pluralize(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function downloadText(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

/** Minimal CSS escape for attribute selectors / data attribute values. */
function cssEscape(value: string): string {
  return value.replace(/["\\]/g, "\\$&");
}

function matchesQuery(entry: ReplacementEntry, query: string): boolean {
  if (!query) return true;
  if (entry.value.toLowerCase().includes(query)) return true;
  if (entry.replacement.toLowerCase().includes(query)) return true;
  if (entry.kind.toLowerCase().includes(query)) return true;
  if (entry.reason.toLowerCase().includes(query)) return true;
  if (kindLabel(entry.kind).toLowerCase().includes(query)) return true;
  return entry.sources.some((source) => source.toLowerCase().includes(query));
}

function groupByKind(
  entries: ReplacementEntry[],
): Record<string, ReplacementEntry[]> {
  const groups: Record<string, ReplacementEntry[]> = {};
  for (const entry of entries) {
    (groups[entry.kind] ??= []).push(entry);
  }
  return groups;
}

const KIND_ORDER: CandidateKind[] = [
  "CUSTOM",
  "PERSON",
  "PERSON_OR_ORG",
  "ORG",
  "ADDRESS",
  "POSTCODE",
  "EMAIL",
  "PHONE",
  "URL",
  "INTERNAL_LINK",
  "DATE",
  "AMOUNT",
  "CASE_REF",
  "BUNDLE_REF",
  "EXHIBIT_REF",
  "TRANSCRIPT_REF",
  "PROCEDURAL_REF",
  "NATIONAL_ID",
  "BANK_ACCOUNT",
  "BUSINESS_ID",
  "LOCATION",
  "BRAND",
  "CHANNEL",
  "PROJECT",
  "PROJECT_OR_ISSUE",
  "DOCUMENT",
  "NON_LATIN_TEXT",
  "PROPER_NOUN",
];

function sortKinds(a: string, b: string): number {
  const ia = KIND_ORDER.indexOf(a as CandidateKind);
  const ib = KIND_ORDER.indexOf(b as CandidateKind);
  const oa = ia === -1 ? Number.MAX_SAFE_INTEGER : ia;
  const ob = ib === -1 ? Number.MAX_SAFE_INTEGER : ib;
  if (oa !== ob) return oa - ob;
  return a.localeCompare(b);
}

const KIND_LABELS: Record<string, string> = {
  CUSTOM: "Manual / Custom",
  PERSON: "Person",
  PERSON_OR_ORG: "Person or Org",
  ORG: "Organization",
  ADDRESS: "Address",
  POSTCODE: "Postcode",
  EMAIL: "Email",
  PHONE: "Phone",
  URL: "URL",
  INTERNAL_LINK: "Internal link",
  DATE: "Date",
  AMOUNT: "Amount",
  CASE_REF: "Case reference",
  BUNDLE_REF: "Bundle reference",
  EXHIBIT_REF: "Exhibit reference",
  TRANSCRIPT_REF: "Transcript reference",
  PROCEDURAL_REF: "Procedural reference",
  NATIONAL_ID: "National ID",
  BANK_ACCOUNT: "Bank account",
  BUSINESS_ID: "Business ID",
  LOCATION: "Location",
  BRAND: "Brand",
  CHANNEL: "Channel",
  PROJECT: "Project",
  PROJECT_OR_ISSUE: "Project / Issue",
  DOCUMENT: "Document",
  NON_LATIN_TEXT: "Non-Latin text",
  PROPER_NOUN: "Proper noun",
};

function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? prettify(kind);
}

function prettify(kind: string): string {
  return kind
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

interface KindStyle {
  /** Inline CSS for small color dots. */
  dotCss: string;
  /** Inline CSS for category labels. */
  labelCss: string;
  /** Inline CSS for struck original values. */
  strikeCss: string;
  /** Inline CSS for redacted preview spans. */
  spanCss: string;
  /** Hex accent color. */
  color: string;
}

/** Consistent, accessible color per category, shared by the list and preview. */
const KIND_COLORS: Record<string, string> = {
  CUSTOM: "#a7342f",
  PERSON: "#245c96",
  PERSON_OR_ORG: "#5a4aa3",
  ORG: "#6a3f82",
  ADDRESS: "#7b5b21",
  POSTCODE: "#8a5b16",
  EMAIL: "#176c78",
  PHONE: "#287342",
  URL: "#52616f",
  INTERNAL_LINK: "#52616f",
  DATE: "#8a5b16",
  AMOUNT: "#9a4d14",
  CASE_REF: "#3f4f61",
  BUNDLE_REF: "#3f4f61",
  EXHIBIT_REF: "#3f4f61",
  TRANSCRIPT_REF: "#3f4f61",
  PROCEDURAL_REF: "#3f4f61",
  NATIONAL_ID: "#8f3159",
  BANK_ACCOUNT: "#8f3159",
  BUSINESS_ID: "#7b3d22",
  LOCATION: "#24724f",
  BRAND: "#9b3c69",
  CHANNEL: "#1f6f65",
  PROJECT: "#24724f",
  PROJECT_OR_ISSUE: "#245c96",
  DOCUMENT: "#52616f",
  NON_LATIN_TEXT: "#5f4592",
  PROPER_NOUN: "#5f6975",
};

function kindStyle(kind: string): KindStyle {
  const color = KIND_COLORS[kind] ?? "#5f6975";
  return {
    color,
    dotCss: `background:${color};`,
    labelCss: `background:${hexToRgba(color, 0.12)};color:${color};`,
    strikeCss: `text-decoration-color:${color};text-decoration-thickness:2px;`,
    spanCss: `color:${color};background:${hexToRgba(color, 0.1)};border-bottom:2px solid ${hexToRgba(color, 0.45)};`,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const value = match[1];
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ----------------------------- Dev mode ---------------------------- */

/** Fetch the synthetic sample and load it as a document. */
async function loadSampleDocument(replace: boolean): Promise<void> {
  setBusy(true, "Loading dev sample…");
  try {
    const response = await fetch(DEV_SAMPLE_PATH);
    const loadedFromFile = response.ok;
    const text = loadedFromFile
      ? await response.text()
      : EMBEDDED_DEV_SAMPLE;
    if (replace) {
      state.documents = [];
      state.selectedDocumentId = null;
      state.entries = [];
      state.removedEntryIds.clear();
    }
    state.documents.push({
      id: nextDocId(),
      fileName: loadedFromFile
        ? (DEV_SAMPLE_PATH.split("/").pop() ?? "dev-sample.md")
        : "embedded-dev-sample.md",
      text,
      warnings: [],
    });
    if (!state.selectedDocumentId && state.documents.length > 0) {
      state.selectedDocumentId = state.documents[0].id;
    }
    recompute();
    renderAll();
    setStatus(
      loadedFromFile
        ? "Loaded synthetic dev sample."
        : "Loaded embedded synthetic dev sample.",
    );
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not load dev sample.",
    );
  } finally {
    setBusy(false);
  }
}

/** Mount the bottom-left FAB that reloads the sample. */
function installDevFab(): void {
  const fab = document.createElement("button");
  fab.type = "button";
  fab.className = "dev-fab";
  fab.setAttribute("aria-label", "Reload synthetic dev sample document");
  fab.title = "Dev mode — reload the synthetic sample document";
  fab.innerHTML =
    '<i class="ph ph-flask" aria-hidden="true"></i><span>DEV</span>';
  fab.addEventListener("click", () => {
    void loadSampleDocument(true);
  });
  document.body.appendChild(fab);
}

function initDevMode(): void {
  installDevFab();
  if (state.documents.length === 0) {
    void loadSampleDocument(false);
  }
}

/* ------------------------------ Boot ------------------------------- */

renderAll();
if (DEV_MODE) initDevMode();
