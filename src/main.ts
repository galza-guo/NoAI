import "./styles.css";
import { readFiles, ReadFileResult } from "./fileReaders";
import { redactDocuments } from "./redactor/engine";
import { RedactionLevel, RedactionResult } from "./redactor/types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root was not found.");
}

app.innerHTML = `
  <main class="app-shell">
    <section class="workspace">
      <header class="topbar">
        <div>
          <p class="eyebrow">AI Preflight Redactor</p>
          <h1>Prepare documents before using AI tools</h1>
        </div>
        <p class="trust-note">Runs in this browser. No AI call. No upload.</p>
      </header>

      <section class="panel controls">
        <label class="dropzone" id="dropzone">
          <input id="file-input" type="file" multiple accept=".md,.markdown,.txt,.docx,.pdf" />
          <span class="drop-title">Drop files or choose documents</span>
          <span class="drop-meta">Markdown, text, Word, and text-based PDF</span>
        </label>

        <div class="control-grid">
          <label>
            <span>Redaction level</span>
            <select id="level-select">
              <option value="balanced" selected>Balanced</option>
              <option value="light">Light</option>
              <option value="strict">Strict</option>
            </select>
          </label>
          <label>
            <span>Custom terms</span>
            <textarea id="custom-terms" rows="4" placeholder="One private term per line"></textarea>
          </label>
        </div>

        <div class="action-row">
          <button id="process-button" type="button" disabled>Process files</button>
          <button id="download-button" type="button" disabled>Download combined Markdown</button>
        </div>
      </section>

      <section class="status-strip" id="status">No files selected.</section>
      <section class="results" id="results"></section>
    </section>
  </main>
`;

const fileInput = document.querySelector<HTMLInputElement>("#file-input")!;
const dropzone = document.querySelector<HTMLLabelElement>("#dropzone")!;
const levelSelect = document.querySelector<HTMLSelectElement>("#level-select")!;
const customTermsInput = document.querySelector<HTMLTextAreaElement>("#custom-terms")!;
const processButton = document.querySelector<HTMLButtonElement>("#process-button")!;
const downloadButton = document.querySelector<HTMLButtonElement>("#download-button")!;
const statusNode = document.querySelector<HTMLElement>("#status")!;
const resultsNode = document.querySelector<HTMLElement>("#results")!;

let selectedFiles: File[] = [];
let lastResult: RedactionResult | null = null;

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files ?? []);
  lastResult = null;
  renderSelectedState();
});

dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropzone.classList.add("dragging");
});

dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragging");
});

dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropzone.classList.remove("dragging");
  selectedFiles = Array.from(event.dataTransfer?.files ?? []).filter(isSupportedFile);
  fileInput.value = "";
  lastResult = null;
  renderSelectedState();
});

processButton.addEventListener("click", async () => {
  await processSelectedFiles();
});

downloadButton.addEventListener("click", () => {
  if (!lastResult) return;
  downloadText(lastResult.combinedMarkdown, "redacted-document-pack.md");
});

function renderSelectedState(): void {
  processButton.disabled = selectedFiles.length === 0;
  downloadButton.disabled = true;
  resultsNode.innerHTML = "";
  statusNode.textContent = selectedFiles.length === 0 ? "No files selected." : `${selectedFiles.length} file(s) ready.`;
}

async function processSelectedFiles(): Promise<void> {
  if (selectedFiles.length === 0) return;
  setBusy(true);
  statusNode.textContent = "Reading files locally...";

  try {
    const readResults = await readFiles(selectedFiles);
    const customTerms = customTermsInput.value
      .split(/\r?\n/)
      .map((term) => term.trim())
      .filter(Boolean);
    statusNode.textContent = "Applying deterministic redaction rules...";
    lastResult = redactDocuments(readResults, {
      level: levelSelect.value as RedactionLevel,
      customTerms,
    });
    renderResults(lastResult, readResults);
    downloadButton.disabled = false;
    statusNode.textContent = `Processed ${readResults.length} file(s).`;
  } catch (error) {
    lastResult = null;
    downloadButton.disabled = true;
    resultsNode.innerHTML = "";
    statusNode.textContent = error instanceof Error ? error.message : "Something went wrong while processing files.";
  } finally {
    setBusy(false);
  }
}

function renderResults(result: RedactionResult, readResults: ReadFileResult[]): void {
  const warningLines = readResults.flatMap((file) => file.warnings.map((warning) => `${file.name}: ${warning}`));
  const countRows = Object.entries(result.counts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, count]) => `<li><strong>${escapeHtml(count.toString())}</strong><span>${escapeHtml(kind)}</span></li>`)
    .join("");
  const previews = result.documents
    .map(
      (doc, index) => `
        <article class="document-preview">
          <header>
            <h2>${escapeHtml(doc.name)}</h2>
            <button type="button" data-download-index="${index}">Download</button>
          </header>
          <textarea readonly spellcheck="false">${escapeHtml(doc.sanitized)}</textarea>
        </article>
      `,
    )
    .join("");

  resultsNode.innerHTML = `
    <section class="panel summary">
      <div>
        <p class="eyebrow">Detected and replaced</p>
        <ul class="count-list">${countRows || "<li><strong>0</strong><span>matches</span></li>"}</ul>
      </div>
      ${
        warningLines.length
          ? `<div class="warnings"><p class="eyebrow">Conversion warnings</p>${warningLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>`
          : ""
      }
    </section>
    ${previews}
  `;

  resultsNode.querySelectorAll<HTMLButtonElement>("[data-download-index]").forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.downloadIndex);
      const doc = result.documents[index];
      if (!doc) return;
      downloadText(doc.sanitized, sanitizedFilename(doc.name));
    });
  });
}

function setBusy(isBusy: boolean): void {
  processButton.disabled = isBusy || selectedFiles.length === 0;
  processButton.textContent = isBusy ? "Processing..." : "Process files";
}

function isSupportedFile(file: File): boolean {
  return /\.(?:md|markdown|txt|docx|pdf)$/i.test(file.name);
}

function sanitizedFilename(name: string): string {
  return `${name.replace(/\.[^.]+$/, "")}.redacted.md`;
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
