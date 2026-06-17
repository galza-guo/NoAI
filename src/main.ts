import "./styles.css";
import { readFiles } from "./fileReaders";
import {
  formatHitMultiplier,
  formatReplacementTotals,
} from "./replacementStats";
import { redactDocuments } from "./redactor/engine";
import {
  CandidateKind,
  RedactionLevel,
  ReplacementEntry,
  ReviewModel,
} from "./redactor/types";
import { ENGINE_VERSION, ENGINE_VERSION_DATE } from "./redactor/version";

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

type AppRoute = "workspace" | "faq" | "about" | "privacy" | "terms" | "changelog";
type InfoRoute = Exclude<AppRoute, "workspace">;

interface AppState {
  route: AppRoute;
  infoMenuOpen: boolean;
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
  previewQuery: string;
  expandedKinds: Set<string>;
  documentsCollapsed: boolean;
  busy: boolean;
  /** Entry id currently shown in the preview popover. */
  selectedEntryId: string | null;
  showOriginalPreview: boolean;
  showPreviewSearch: boolean;
}

const APP_VERSION = "0.1.0";

const state: AppState = {
  route: routeFromHash(),
  infoMenuOpen: false,
  documents: [],
  selectedDocumentId: null,
  entries: [],
  removedEntryIds: new Set(),
  level: "balanced",
  review: null,
  query: "",
  previewQuery: "",
  expandedKinds: new Set(),
  documentsCollapsed: false,
  busy: false,
  selectedEntryId: null,
  showOriginalPreview: false,
  showPreviewSearch: false,
};

interface InfoPageScaffold {
  route: InfoRoute;
  title: string;
  summary: string;
  sections: string[];
}

const INFO_PAGE_SCAFFOLDS: Record<InfoRoute, InfoPageScaffold> = {
  faq: {
    route: "faq",
    title: "FAQ",
    summary:
      "Scaffold for plain-language answers about how NoAI works, what it can and cannot do, and how users should review output.",
    sections: [
      "How NoAI works",
      "Files and exports",
      "Redaction levels",
      "Accuracy and review limits",
      "Using the output with external AI tools",
    ],
  },
  about: {
    route: "about",
    title: "About",
    summary:
      "Scaffold for project purpose, maintainer details, support/contact information, version metadata, source, and license.",
    sections: [
      "What NoAI is",
      "Maintainer and contact",
      "Version information",
      "License and source",
    ],
  },
  privacy: {
    route: "privacy",
    title: "Privacy Policy",
    summary:
      "Scaffold for concrete privacy disclosures: local processing, no document upload path, no AI calls, storage, third parties, and contact.",
    sections: [
      "Information NoAI processes",
      "Local browser processing",
      "Network requests and third parties",
      "Storage and retention",
      "User choices and contact",
    ],
  },
  terms: {
    route: "terms",
    title: "User Agreement",
    summary:
      "Scaffold for user responsibilities, no legal advice, redaction limitations, acceptable use, warranty limits, and governing details.",
    sections: [
      "Using NoAI",
      "User responsibility",
      "No legal or professional advice",
      "No perfect-redaction guarantee",
      "License, warranty, and liability",
    ],
  },
  changelog: {
    route: "changelog",
    title: "Version History",
    summary:
      "Scaffold for release notes. The redaction engine history can be populated from docs/engine-changelog.md.",
    sections: [
      "Current versions",
      "Engine changelog",
      "App release notes",
    ],
  },
};

const SITE_LINKS: Array<{ route: AppRoute; label: string; icon: string }> = [
  { route: "workspace", label: "NoAI", icon: "ph-file-lock" },
  { route: "faq", label: "FAQ", icon: "ph-question" },
  { route: "about", label: "About", icon: "ph-info" },
  { route: "privacy", label: "Privacy", icon: "ph-shield-check" },
  { route: "terms", label: "Terms", icon: "ph-scroll" },
  { route: "changelog", label: "Version History", icon: "ph-clock-counter-clockwise" },
];

const SITE_MENU_LINKS = SITE_LINKS.filter((link) => link.route !== "workspace");

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
import "@phosphor-icons/web/fill";

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
      <a class="brand-link" href="#/" aria-label="NoAI workspace">
        <img src="/logo.png" alt="NoAI Logo" class="brand-logo" />
      </a>
      <div class="site-menu-wrap">
        <button id="site-menu-toggle" type="button" class="icon-button site-menu-toggle" aria-expanded="false" aria-controls="site-menu" aria-label="Open site menu">
          <i class="ph ph-list" aria-hidden="true"></i>
        </button>
        <nav class="site-menu" id="site-menu" aria-label="NoAI pages" hidden>
          ${renderSiteMenuLinks()}
        </nav>
      </div>
    </header>

    <section class="workspace" id="workspace-view">

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
            <button id="documents-toggle" type="button" class="icon-button" aria-expanded="true" aria-label="Collapse documents sidebar">${icon.sidebar}</button>
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
                    <span class="level-icon" aria-hidden="true">
                      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <text x="20" y="34" class="redaction-a-base" text-anchor="middle">A</text>
                        <polygon class="redaction-strike" points="5,18 38,18 35,23 2,23" />
                      </svg>
                    </span>
                    <span class="level-copy">
                      <span class="level-title">Light</span>
                      <span class="level-desc">Direct identifiers only; best readability.</span>
                    </span>
                  </button>
                  <button type="button" class="level-option" data-level="balanced" aria-pressed="true">
                    <span class="level-icon" aria-hidden="true">
                      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <text x="20" y="34" class="redaction-a-base" text-anchor="middle">A</text>
                        <polygon class="redaction-strike" points="5,10 38,10 35,15 2,15" />
                        <polygon class="redaction-strike" points="5,26 38,26 35,31 2,31" />
                      </svg>
                    </span>
                    <span class="level-copy">
                      <span class="level-title">Balanced</span>
                      <span class="level-desc">Names, orgs, dates, amounts; default review.</span>
                    </span>
                  </button>
                  <button type="button" class="level-option" data-level="strict" aria-pressed="false">
                    <span class="level-icon" aria-hidden="true">
                      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <text x="20" y="34" class="redaction-a-base" text-anchor="middle">A</text>
                        <polygon class="redaction-strike" points="5,10 38,10 35,15 2,15" />
                        <polygon class="redaction-strike" points="5,18 38,18 35,23 2,23" />
                        <polygon class="redaction-strike" points="5,26 38,26 35,31 2,31" />
                      </svg>
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
            <div class="panel-title-actions">
              <h2 id="preview-title">Preview</h2>
              <button id="preview-visibility-toggle" type="button" class="icon-button preview-visibility-toggle" disabled aria-pressed="false" aria-label="Show original text" title="Show original text">
                <i class="ph ph-eye" aria-hidden="true"></i>
              </button>
            </div>
            <div class="panel-actions">
              <button id="preview-search-toggle" type="button" class="icon-button preview-search-toggle" disabled aria-pressed="false" aria-label="Show preview search" title="Show preview search">
                <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
              </button>
              <button id="copy-doc-button" type="button" class="icon-button" disabled title="Copy redacted text">
                <i class="ph ph-copy" aria-hidden="true"></i>
              </button>
              <button id="download-doc-button" type="button" class="icon-button download-action" disabled title="Download this document">
                <i class="download-icon ph ph-download-simple" aria-hidden="true"></i>
              </button>
            </div>
          </div>
          <div class="preview-search" id="preview-search" hidden>
            <label class="sr-only" for="preview-search-input">Search preview text</label>
            <div class="preview-search-box">
              <i class="ph ph-magnifying-glass" aria-hidden="true"></i>
              <input id="preview-search-input" type="search" placeholder="Search redacted and original text" autocomplete="off" />
              <button id="preview-search-clear" type="button" class="icon-button preview-search-clear" aria-label="Clear preview search" hidden>${icon.x}</button>
            </div>
            <div class="preview-search-summary" id="preview-search-summary"></div>
            <div class="preview-search-results" id="preview-search-results" hidden></div>
          </div>
          <div class="preview-body" id="preview-body"></div>
        </section>

        <section class="panel replacements-panel">
          <div class="panel-head">
            <h2>Redactions</h2>
            <span class="panel-count" id="replacements-count"></span>
          </div>
          <div class="replacements-controls">
            <label class="sr-only" for="search-input">Search or add term</label>
            <div class="omnibox-container">
              <input id="search-input" type="text" name="replacement-search" placeholder="Search or Add term ..." autocomplete="off" />
              <span id="omnibox-add-action" class="omnibox-add-action" hidden>Add</span>
            </div>
          </div>
          <div class="replacements-body" id="replacements-body"></div>
        </section>

      </section>
    </section>

    <section class="info-view" id="info-view" hidden></section>
  </main>

  <!-- Floating popover for redacted span actions -->
  <div class="popover" id="entry-popover" hidden role="dialog" aria-label="Redaction actions">
    <div class="popover-arrow"></div>
    <div class="popover-field">
      <code class="popover-original" id="popover-original"></code>
    </div>
    <div class="popover-field">
      <input id="popover-replacement" type="text" autocomplete="off" aria-label="Replacement" />
    </div>
    <div class="popover-actions">
      <button type="button" class="text-button" id="popover-find">Find in list</button>
      <button type="button" class="ghost-button" id="popover-delete">Un-Redact</button>
    </div>
  </div>

  <!-- Floating Redact button for text selection -->
  <button type="button" class="redact-selection" id="redact-selection" hidden>
    <i class="ph-fill ph-highlighter" aria-hidden="true"></i>
    <span>Redact</span>
  </button>

  <!-- Overlay notifications. Never render status inside the Documents panel. -->
  <div class="toast-region" id="toast-region" aria-live="polite" aria-atomic="false"></div>
`;

/* --------------------------- Element refs -------------------------- */

const appShell = document.querySelector<HTMLElement>(".app-shell")!;
const workspaceView = document.querySelector<HTMLElement>("#workspace-view")!;
const infoView = document.querySelector<HTMLElement>("#info-view")!;
const siteMenuToggle =
  document.querySelector<HTMLButtonElement>("#site-menu-toggle")!;
const siteMenu = document.querySelector<HTMLElement>("#site-menu")!;
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
const omniboxAddAction =
  document.querySelector<HTMLElement>("#omnibox-add-action")!;

const levelButtons =
  document.querySelectorAll<HTMLButtonElement>("[data-level]");
const levelActiveDesc =
  document.querySelector<HTMLElement>("#level-active-desc")!;
const previewTitle = document.querySelector<HTMLElement>("#preview-title")!;
const previewBody = document.querySelector<HTMLElement>("#preview-body")!;
const previewSearch = document.querySelector<HTMLElement>("#preview-search")!;
const previewSearchToggle = document.querySelector<HTMLButtonElement>(
  "#preview-search-toggle",
)!;
const previewSearchInput = document.querySelector<HTMLInputElement>(
  "#preview-search-input",
)!;
const previewSearchClear = document.querySelector<HTMLButtonElement>(
  "#preview-search-clear",
)!;
const previewSearchSummary = document.querySelector<HTMLElement>(
  "#preview-search-summary",
)!;
const previewSearchResults = document.querySelector<HTMLElement>(
  "#preview-search-results",
)!;
const previewVisibilityToggle = document.querySelector<HTMLButtonElement>(
  "#preview-visibility-toggle",
)!;
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

let pendingRedactionText = "";
let originalPreviewTimer: number | undefined;

/* ----------------------------- Routing ----------------------------- */

siteMenuToggle.addEventListener("click", (event) => {
  event.stopPropagation();
  setInfoMenuOpen(!state.infoMenuOpen);
});

siteMenu.addEventListener("click", () => setInfoMenuOpen(false));

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement;
  if (target.closest(".site-menu-wrap")) return;
  setInfoMenuOpen(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setInfoMenuOpen(false);
});

window.addEventListener("hashchange", () => {
  state.route = routeFromHash();
  setInfoMenuOpen(false);
  hidePopover();
  renderRoute();
});

function renderRoute(): void {
  const showingWorkspace = state.route === "workspace";
  workspaceView.hidden = !showingWorkspace;
  infoView.hidden = showingWorkspace;
  appShell.classList.toggle("info-page-active", !showingWorkspace);
  document.title =
    state.route === "workspace"
      ? "NoAI"
      : `${INFO_PAGE_SCAFFOLDS[state.route].title} - NoAI`;

  renderSiteMenuState();
  if (state.route !== "workspace") renderInfoPage(state.route);
}

function renderInfoPage(route: InfoRoute): void {
  const page = INFO_PAGE_SCAFFOLDS[route];
  const versionMeta =
    route === "about" || route === "changelog"
      ? `
        <dl class="version-grid">
          <div>
            <dt>App version</dt>
            <dd>${escapeHtml(APP_VERSION)}</dd>
          </div>
          <div>
            <dt>Engine version</dt>
            <dd>${escapeHtml(ENGINE_VERSION)}</dd>
          </div>
          <div>
            <dt>Engine date</dt>
            <dd>${escapeHtml(ENGINE_VERSION_DATE)}</dd>
          </div>
        </dl>
      `
      : "";

  infoView.innerHTML = `
    <article class="info-page" aria-labelledby="info-title">
      <header class="info-hero">
        <a class="info-back-link" href="#/">
          <i class="ph ph-arrow-left" aria-hidden="true"></i>
          <span>Back to workspace</span>
        </a>
        <h1 id="info-title">${escapeHtml(page.title)}</h1>
        <p>${escapeHtml(page.summary)}</p>
        ${versionMeta}
      </header>
      <div class="info-section-list">
        ${page.sections
          .map(
            (section) => `
              <section class="info-section">
                <h2>${escapeHtml(section)}</h2>
                <p>TODO: Draft this section.</p>
              </section>
            `,
          )
          .join("")}
      </div>
      <footer class="info-footer">
        ${SITE_LINKS.map(
          (link) =>
            `<a href="${routeHref(link.route)}">${escapeHtml(link.label)}</a>`,
        ).join("")}
      </footer>
    </article>
  `;
}

function setInfoMenuOpen(open: boolean): void {
  state.infoMenuOpen = open;
  renderSiteMenuState();
}

function renderSiteMenuState(): void {
  siteMenu.hidden = !state.infoMenuOpen;
  siteMenuToggle.setAttribute("aria-expanded", String(state.infoMenuOpen));
  siteMenuToggle.setAttribute(
    "aria-label",
    state.infoMenuOpen ? "Close site menu" : "Open site menu",
  );
  const menuIcon = siteMenuToggle.querySelector("i");
  if (menuIcon) {
    menuIcon.className = state.infoMenuOpen ? "ph ph-x" : "ph ph-list";
  }
  siteMenu
    .querySelectorAll<HTMLAnchorElement>("[data-route-link]")
    .forEach((link) => {
      const active = link.dataset.routeLink === state.route;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
}

function renderSiteMenuLinks(): string {
  return SITE_MENU_LINKS.map(
    (link) => `
      <a href="${routeHref(link.route)}" data-route-link="${link.route}">
        <i class="ph ${link.icon}" aria-hidden="true"></i>
        <span>${escapeHtml(link.label)}</span>
      </a>
    `,
  ).join("");
}

function routeFromHash(): AppRoute {
  const route = window.location.hash.replace(/^#\/?/, "");
  if (route === "faq") return "faq";
  if (route === "about") return "about";
  if (route === "privacy") return "privacy";
  if (route === "terms") return "terms";
  if (route === "changelog") return "changelog";
  return "workspace";
}

function routeHref(route: AppRoute): string {
  return route === "workspace" ? "#/" : `#/${route}`;
}

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

previewSearchInput.addEventListener("input", () => {
  state.previewQuery = previewSearchInput.value.trim();
  renderPreview();
});

previewSearchToggle.addEventListener("click", () => {
  state.showPreviewSearch = !state.showPreviewSearch;
  renderPreview();
  if (state.showPreviewSearch) {
    window.requestAnimationFrame(() => previewSearchInput.focus());
  }
});

previewSearchClear.addEventListener("click", () => {
  state.previewQuery = "";
  previewSearchInput.value = "";
  renderPreview();
  previewSearchInput.focus();
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const trimmed = searchInput.value.trim();
    if (!trimmed) return;
    const showAdd = !state.entries.some(
      (entry) => entry.value.toLowerCase() === trimmed.toLowerCase()
    );
    if (showAdd) {
      event.preventDefault();
      addManualEntry(trimmed);
      searchInput.value = "";
      state.query = "";
      renderReplacements();
      searchInput.focus();
    }
  }
});

omniboxAddAction.addEventListener("click", () => {
  const trimmed = searchInput.value.trim();
  if (!trimmed) return;
  const showAdd = !state.entries.some(
    (entry) => entry.value.toLowerCase() === trimmed.toLowerCase()
  );
  if (showAdd) {
    addManualEntry(trimmed);
    searchInput.value = "";
    state.query = "";
    renderReplacements();
    searchInput.focus();
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

previewVisibilityToggle.addEventListener("click", () => {
  if (!selectedReviewDoc()) return;
  if (state.showOriginalPreview) {
    hideOriginalPreview();
  } else {
    showOriginalPreview();
  }
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

function addManualEntry(
  value: string,
  renderMode: "all" | "preview" = "all",
): { id: string; added: boolean } | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const id = manualEntryId(trimmed);
  const existing = state.entries.find((entry) => entry.id === id);
  if (existing) {
    recompute();
    if (renderMode === "preview") renderPreview();
    else renderAll();
    return { id, added: false };
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
  if (renderMode === "preview") renderPreview();
  else renderAll();
  setStatus(`Added manual redaction for "${trimmed}".`);
  return { id, added: true };
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
  hideOriginalPreview({ silent: true });
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
  hideOriginalPreview({ silent: true });
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
  replacementsCount.textContent = "";

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
  const footerText = formatReplacementTotals(filtered);

  replacementsBody.innerHTML = `
    ${orderedKinds
      .map((kind) => {
        const items = groups[kind];
        const collapsed = !state.expandedKinds.has(kind);
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
      .join("")}
    <div class="replacements-footer" aria-label="${escapeHtml(footerText)}">
      ${escapeHtml(footerText)}
    </div>
  `;

  replacementsBody
    .querySelectorAll<HTMLButtonElement>("[data-toggle-kind]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const kind = button.dataset.toggleKind!;
        const section = button.closest(".cat-group")!;
        const grid = section.querySelector(".cat-items-grid")!;
        if (state.expandedKinds.has(kind)) {
          state.expandedKinds.delete(kind);
          button.classList.add("collapsed");
          grid.classList.add("collapsed");
        } else {
          state.expandedKinds.add(kind);
          button.classList.remove("collapsed");
          grid.classList.remove("collapsed");
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
  updateOmniboxAddAction();
}

function updateOmniboxAddAction(): void {
  const trimmed = searchInput.value.trim();
  const showAdd = trimmed !== "" && !state.entries.some(
    (entry) => entry.value.toLowerCase() === trimmed.toLowerCase()
  );
  if (showAdd) {
    omniboxAddAction.removeAttribute("hidden");
  } else {
    omniboxAddAction.setAttribute("hidden", "");
  }
}

function renderEntryRow(entry: ReplacementEntry, index: number = 0): string {
  const style = kindStyle(entry.kind);
  const hitTitle = `${entry.count} ${entry.count === 1 ? "hit" : "hits"}`;
  return `
    <div class="entry-row" data-jump-entry="${escapeHtml(entry.id)}" style="--anim-index: ${index}">
      <span class="entry-hit-count" aria-label="${escapeHtml(hitTitle)}">${escapeHtml(formatHitMultiplier(entry))}</span>
      <div class="entry-source">
        <s class="entry-value" style="--strike-color: ${style.color}">${escapeHtml(entry.value)}</s>
      </div>
      <div class="entry-controls">
        <button
          type="button"
          class="entry-delete"
          data-delete-entry="${escapeHtml(entry.id)}"
          aria-label="Un-redact ${escapeHtml(entry.value)}"
        >${icon.x}</button>
        <input
          type="text"
          class="entry-replacement"
          data-replacement-input="${escapeHtml(entry.id)}"
          value="${escapeHtml(entry.replacement)}"
          aria-label="Replacement for ${escapeHtml(entry.value)}"
          autocomplete="off"
        />
      </div>
    </div>
  `;
}

function renderPreview(): void {
  const reviewDoc = selectedReviewDoc();
  previewTitle.textContent = "Preview";
  previewVisibilityToggle.disabled = !reviewDoc;
  previewVisibilityToggle.classList.toggle("active", state.showOriginalPreview);
  previewVisibilityToggle.setAttribute(
    "aria-pressed",
    String(state.showOriginalPreview),
  );
  previewVisibilityToggle.setAttribute(
    "aria-label",
    state.showOriginalPreview ? "Hide original text" : "Show original text",
  );
  previewVisibilityToggle.title = state.showOriginalPreview
    ? "Hide original text"
    : "Show original text";
  const toggleIcon = previewVisibilityToggle.querySelector("i");
  if (toggleIcon) {
    toggleIcon.className = state.showOriginalPreview
      ? "ph ph-eye-slash"
      : "ph ph-eye";
  }
  previewSearchToggle.disabled = !reviewDoc;
  previewSearchToggle.classList.toggle("active", state.showPreviewSearch);
  previewSearchToggle.setAttribute(
    "aria-pressed",
    String(state.showPreviewSearch),
  );
  previewSearchToggle.setAttribute(
    "aria-label",
    state.showPreviewSearch ? "Hide preview search" : "Show preview search",
  );
  previewSearchToggle.title = state.showPreviewSearch
    ? "Hide preview search"
    : "Show preview search";
  copyDocButton.disabled = !reviewDoc;
  downloadDocButton.disabled = !reviewDoc;
  previewSearchInput.disabled = !reviewDoc;
  previewSearchClear.hidden = state.previewQuery.length === 0;
  previewSearch.hidden = !reviewDoc || !state.showPreviewSearch;

  if (!reviewDoc) {
    previewBody.innerHTML = `<p class="placeholder">Select a document to review it.</p>`;
    renderPreviewSearch();
    return;
  }

  const fragment = document.createDocumentFragment();
  const query = state.showPreviewSearch ? state.previewQuery : "";
  const searchSource = state.showOriginalPreview ? "original" : "redacted";
  const hitIndex = { value: 0 };
  for (const segment of reviewDoc.segments) {
    if (state.showOriginalPreview) {
      appendHighlightedText(
        fragment,
        segment.value ?? segment.text,
        query,
        searchSource,
        hitIndex,
      );
    } else if (segment.entryId) {
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
      appendHighlightedText(
        span,
        segment.replacement ?? segment.text,
        query,
        searchSource,
        hitIndex,
      );
      fragment.appendChild(span);
    } else {
      appendHighlightedText(
        fragment,
        segment.text,
        query,
        searchSource,
        hitIndex,
      );
    }
  }
  previewBody.innerHTML = "";
  previewBody.appendChild(fragment);
  renderPreviewSearch();
}

function renderPreviewSearch(): void {
  const reviewDoc = selectedReviewDoc();
  const query = state.previewQuery.trim();
  if (!reviewDoc || !state.showPreviewSearch) {
    previewSearch.classList.remove("has-results");
    previewSearchSummary.hidden = false;
    previewSearchSummary.textContent = "";
    previewSearchResults.hidden = true;
    previewSearchResults.innerHTML = "";
    return;
  }

  if (!query) {
    previewSearch.classList.remove("has-results");
    previewSearchSummary.hidden = true;
    previewSearchSummary.textContent = "";
    previewSearchResults.hidden = true;
    previewSearchResults.innerHTML = "";
    return;
  }

  const buckets = previewSearchBuckets(reviewDoc, query);
  const totalHits =
    buckets.nonRedactedHits.length +
    buckets.redactedOriginalHits.length +
    buckets.redactionOnlyHits.length;
  if (totalHits === 0) {
    previewSearch.classList.remove("has-results");
    previewSearchSummary.hidden = false;
    previewSearchSummary.textContent =
      "No matches in the redacted output or original text.";
    previewSearchResults.hidden = true;
    previewSearchResults.innerHTML = "";
    return;
  }

  previewSearch.classList.add("has-results");
  previewSearchSummary.textContent = "";
  previewSearchSummary.hidden = true;
  previewSearchResults.hidden = false;
  previewSearchResults.innerHTML = renderPreviewSearchResults(buckets);
  previewSearchResults
    .querySelectorAll<HTMLButtonElement>("[data-search-jump]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        jumpToSearchHit(button.dataset.searchJump!);
      });
    });
  previewSearchResults
    .querySelectorAll<HTMLButtonElement>("[data-search-toggle-more]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        togglePreviewSearchMore(button);
      });
    });
}

function renderPreviewSearchResults(buckets: PreviewSearchBuckets): string {
  const {
    nonRedactedHits,
    redactedOriginalHits,
    redactionOnlyHits,
  } = buckets;
  const originalHitCount =
    nonRedactedHits.length + redactedOriginalHits.length;

  if (nonRedactedHits.length === 0 && redactionOnlyHits.length === 0) {
    return renderPreviewSearchGroup(
      `No matches in the redacted text. ${redactedOriginalStatus(redactedOriginalHits.length, true)}`,
      redactedOriginalHits,
      "success",
    );
  }

  if (originalHitCount === 0) {
    return renderPreviewSearchGroup(
      `No matches in original. ${redactionsOnlyStatus(redactionOnlyHits.length)}`,
      redactionOnlyHits,
    );
  }

  if (
    redactedOriginalHits.length === 0 &&
    redactionOnlyHits.length === 0
  ) {
    return renderPreviewSearchGroup(
      nonRedactedStatus(nonRedactedHits.length, true),
      nonRedactedHits,
      "danger",
    );
  }

  const sections: string[] = [];
  if (nonRedactedHits.length > 0) {
    sections.push(
      renderPreviewSearchGroup(
        nonRedactedStatus(nonRedactedHits.length, false),
        nonRedactedHits,
        "danger",
      ),
    );
  }
  if (redactedOriginalHits.length > 0) {
    sections.push(
      renderPreviewSearchGroup(
        redactedOriginalStatus(redactedOriginalHits.length, false),
        redactedOriginalHits,
      ),
    );
  }
  if (redactionOnlyHits.length > 0) {
    sections.push(
      renderPreviewSearchGroup(
        redactionsOnlyStatus(redactionOnlyHits.length),
        redactionOnlyHits,
      ),
    );
  }
  return sections.join("");
}

function renderPreviewSearchGroup(
  statusHtml: string,
  hits: PreviewSearchHit[],
  tone: "neutral" | "success" | "danger" = "neutral",
): string {
  const visibleLimit = 8;
  const remaining = Math.max(0, hits.length - visibleLimit);
  return `
    <div class="preview-search-block ${tone}">
      <p class="preview-search-status ${tone}">${statusHtml}</p>
      ${
        hits.length > 0
          ? hits
              .map((hit, index) =>
                renderPreviewSearchHit(hit, index >= visibleLimit),
              )
              .join("")
          : ""
      }
      ${
        remaining > 0
          ? `<button type="button" class="preview-search-more" data-search-toggle-more data-more-count="${remaining}" aria-expanded="false">${escapeHtml(`Show ${formatMoreMatches(remaining)}`)}</button>`
          : ""
      }
    </div>
  `;
}

function renderPreviewSearchHit(hit: PreviewSearchHit, hidden = false): string {
  const label =
    hit.context === "redaction-only"
      ? "Redaction"
      : hit.source === "redacted"
        ? "Visible"
        : "Redacted";
  return `
    <button type="button" class="preview-search-hit-row ${hit.source} ${hit.context}" data-search-jump="${escapeHtml(hit.id)}"${hidden ? " data-extra-hit hidden" : ""}>
      <span class="preview-search-source">${label}</span>
      <span class="preview-search-snippet">${renderSnippet(hit)}</span>
    </button>
  `;
}

function togglePreviewSearchMore(button: HTMLButtonElement): void {
  const block = button.closest(".preview-search-block");
  if (!block) return;
  const expanded = button.getAttribute("aria-expanded") === "true";
  const nextExpanded = !expanded;
  block
    .querySelectorAll<HTMLButtonElement>("[data-extra-hit]")
    .forEach((row) => {
      row.hidden = !nextExpanded;
    });
  button.setAttribute("aria-expanded", String(nextExpanded));
  const moreCount = Number(button.dataset.moreCount ?? "0");
  button.textContent = nextExpanded
    ? "Show less"
    : `Show ${formatMoreMatches(moreCount)}`;
}

function renderSnippet(hit: PreviewSearchHit): string {
  return `${hit.leadingEllipsis ? "..." : ""}${escapeHtml(hit.before)}<mark>${escapeHtml(hit.match)}</mark>${escapeHtml(hit.after)}${
    hit.trailingEllipsis ? "..." : ""
  }`;
}

interface PreviewSearchHit {
  id: string;
  source: "redacted" | "original";
  context: "non-redacted" | "redacted-original" | "redaction-only";
  before: string;
  match: string;
  after: string;
  leadingEllipsis: boolean;
  trailingEllipsis: boolean;
}

interface PreviewSearchBuckets {
  nonRedactedHits: PreviewSearchHit[];
  redactedOriginalHits: PreviewSearchHit[];
  redactionOnlyHits: PreviewSearchHit[];
}

interface PreviewSearchTextRange {
  start: number;
  end: number;
  redactedSegment: boolean;
}

interface PreviewSearchTextModel {
  text: string;
  ranges: PreviewSearchTextRange[];
}

function appendHighlightedText(
  parent: Node,
  text: string,
  query: string,
  source: "redacted" | "original",
  hitIndex: { value: number },
): void {
  const matches = findQueryMatches(text, query);
  if (matches.length === 0) {
    parent.appendChild(document.createTextNode(text));
    return;
  }
  let position = 0;
  for (const match of matches) {
    if (match.start > position) {
      parent.appendChild(
        document.createTextNode(text.slice(position, match.start)),
      );
    }
    const mark = document.createElement("mark");
    mark.className = "preview-search-mark";
    mark.dataset.searchResultId = `${source}-${hitIndex.value}`;
    mark.textContent = text.slice(match.start, match.end);
    parent.appendChild(mark);
    hitIndex.value += 1;
    position = match.end;
  }
  if (position < text.length) {
    parent.appendChild(document.createTextNode(text.slice(position)));
  }
}

function previewSearchBuckets(
  reviewDoc: NonNullable<ReturnType<typeof selectedReviewDoc>>,
  query: string,
): PreviewSearchBuckets {
  const redactedText = previewSearchTextModel(reviewDoc, "redacted");
  const originalText = previewSearchTextModel(reviewDoc, "original");
  const redactedHits = findSearchHits(redactedText, query, "redacted");
  const originalHits = findSearchHits(originalText, query, "original");
  return {
    nonRedactedHits: redactedHits.filter(
      (hit) => hit.context === "non-redacted",
    ),
    redactedOriginalHits: originalHits.filter(
      (hit) => hit.context === "redacted-original",
    ),
    redactionOnlyHits: redactedHits.filter(
      (hit) => hit.context === "redaction-only",
    ),
  };
}

function findSearchHits(
  model: PreviewSearchTextModel,
  query: string,
  source: "redacted" | "original",
): PreviewSearchHit[] {
  const hits: PreviewSearchHit[] = [];
  const { text, ranges } = model;
  for (const match of findQueryMatches(text, query)) {
    const { start, end } = match;
    const snippetStart = Math.max(0, start - 54);
    const snippetEnd = Math.min(text.length, end + 54);
    hits.push({
      id: `${source}-${hits.length}`,
      source,
      context: searchHitContext(source, ranges, start, end),
      before: text.slice(snippetStart, start),
      match: text.slice(start, end),
      after: text.slice(end, snippetEnd),
      leadingEllipsis: snippetStart > 0,
      trailingEllipsis: snippetEnd < text.length,
    });
  }
  return hits;
}

function findQueryMatches(
  text: string,
  query: string,
): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  if (!query) return matches;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let position = 0;
  while (position < text.length) {
    const start = lowerText.indexOf(lowerQuery, position);
    if (start === -1) break;
    const end = start + query.length;
    matches.push({ start, end });
    position = end;
  }
  return matches;
}

function previewSearchTextModel(
  reviewDoc: NonNullable<ReturnType<typeof selectedReviewDoc>>,
  source: "redacted" | "original",
): PreviewSearchTextModel {
  let text = "";
  const ranges: PreviewSearchTextRange[] = [];
  for (const segment of reviewDoc.segments) {
    const segmentText =
      source === "original"
        ? segment.value ?? segment.text
        : segment.replacement ?? segment.text;
    const start = text.length;
    text += segmentText;
    ranges.push({
      start,
      end: text.length,
      redactedSegment: Boolean(segment.entryId),
    });
  }
  return { text, ranges };
}

function searchHitContext(
  source: "redacted" | "original",
  ranges: PreviewSearchTextRange[],
  start: number,
  end: number,
): PreviewSearchHit["context"] {
  const overlapsRedactedSegment = ranges.some(
    (range) =>
      range.redactedSegment && start < range.end && end > range.start,
  );
  if (!overlapsRedactedSegment) return "non-redacted";
  return source === "original" ? "redacted-original" : "redaction-only";
}

function jumpToSearchHit(id: string): void {
  const source = id.startsWith("original-") ? "original" : "redacted";
  if (source === "original" && !state.showOriginalPreview) {
    showOriginalPreview();
  } else if (source === "redacted" && state.showOriginalPreview) {
    hideOriginalPreview({ silent: true });
  }
  window.requestAnimationFrame(() => {
    const mark = previewBody.querySelector<HTMLElement>(
      `[data-search-result-id="${cssEscape(id)}"]`,
    );
    if (!mark) return;
    mark.scrollIntoView({ block: "center", behavior: "smooth" });
    mark.classList.add("flash");
    window.setTimeout(() => mark.classList.remove("flash"), 900);
  });
}

function showOriginalPreview(): void {
  if (!selectedReviewDoc()) return;
  if (originalPreviewTimer !== undefined) {
    window.clearTimeout(originalPreviewTimer);
  }
  state.showOriginalPreview = true;
  hidePopover();
  renderPreview();
  showToast("", {
    durationMs: 10000,
    progress: true,
    countdownText: (secondsLeft) =>
      `Showing original text for ${secondsLeft}s.`,
  });
  originalPreviewTimer = window.setTimeout(() => {
    hideOriginalPreview();
  }, 10000);
}

function hideOriginalPreview(options: { silent?: boolean } = {}): void {
  if (originalPreviewTimer !== undefined) {
    window.clearTimeout(originalPreviewTimer);
    originalPreviewTimer = undefined;
  }
  if (!state.showOriginalPreview) {
    renderPreview();
    return;
  }
  state.showOriginalPreview = false;
  renderPreview();
  if (!options.silent) showToast("Preview is redacted again.");
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
  const style = kindStyle(entry.kind);
  popoverOriginal.textContent = entry.value;
  popoverOriginal.style.setProperty("--strike-color", style.color);
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
  state.expandedKinds.add(entry.kind);
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
  const trimmed = text.trim();
  if (!trimmed) {
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
  pendingRedactionText = trimmed;
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
redactSelectionBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  const selection = window.getSelection();
  const text = pendingRedactionText || selection?.toString().trim() || "";
  pendingRedactionText = "";
  const result = text ? addManualEntry(text, "preview") : null;
  selection?.removeAllRanges();
  hideRedactButton();
  if (result) revealManualEntry(result.id);
});

function revealManualEntry(id: string): void {
  window.requestAnimationFrame(() => {
    const span = previewBody.querySelector<HTMLElement>(
      `[data-entry-id="${cssEscape(id)}"]`,
    );
    if (!span) {
      revealManualEntryControls(id);
      return;
    }
    span.scrollIntoView({ block: "center", behavior: "auto" });
    revealManualEntryControls(id);
  });
}

function revealManualEntryControls(id: string): void {
  state.expandedKinds.add("CUSTOM");
  renderReplacements();
  window.requestAnimationFrame(() => {
    flashReplacementRow(id);
    const span = previewBody.querySelector<HTMLElement>(
      `[data-entry-id="${cssEscape(id)}"]`,
    );
    if (span) openPopover(id, span);
  });
}

function flashReplacementRow(id: string): void {
  const row = replacementsBody.querySelector<HTMLElement>(
    `[data-jump-entry="${cssEscape(id)}"]`,
  );
  if (!row) return;
  row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  row.classList.add("flash");
  window.setTimeout(() => row.classList.remove("flash"), 900);
}

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

function showToast(
  message: string,
  options: {
    durationMs?: number;
    progress?: boolean;
    countdownText?: (secondsLeft: number) => string;
  } = {},
): void {
  const durationMs = options.durationMs ?? 2600;
  const startedAt = Date.now();
  const endsAt = startedAt + durationMs;
  const formatCountdownText = (): string => {
    const secondsLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    return options.countdownText?.(secondsLeft) ?? message;
  };
  const initialMessage = formatCountdownText();
  if (!initialMessage.trim()) return;
  const toast = document.createElement("div");
  toast.className = "toast-bubble";
  if (options.progress) {
    toast.classList.add("toast-bubble-timed");
    toast.style.setProperty("--toast-duration", `${durationMs}ms`);
  }
  const text = document.createElement("span");
  text.textContent = initialMessage;
  toast.appendChild(text);
  const countdownInterval = options.countdownText
    ? window.setInterval(() => {
        text.textContent = formatCountdownText();
      }, 250)
    : undefined;
  if (options.progress) {
    const progress = document.createElement("span");
    progress.className = "toast-progress";
    progress.setAttribute("aria-hidden", "true");
    toast.appendChild(progress);
  }
  toastRegion.appendChild(toast);
  window.setTimeout(() => {
    if (countdownInterval !== undefined) {
      window.clearInterval(countdownInterval);
    }
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 180);
  }, durationMs);
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

function formatHits(count: number): string {
  return `${count} ${count === 1 ? "hit" : "hits"}`;
}

function formatMatches(count: number): string {
  return `${count} ${count === 1 ? "match" : "matches"}`;
}

function formatMoreMatches(count: number): string {
  return `${count} more ${count === 1 ? "match" : "matches"}`;
}

function hasHave(count: number): string {
  return count === 1 ? "has" : "have";
}

function isAre(count: number): string {
  return count === 1 ? "is" : "are";
}

function remainsRemain(count: number): string {
  return count === 1 ? "remains" : "remain";
}

function allMatchesSubject(count: number): string {
  return count === 1 ? "The 1 match" : `All ${count} matches`;
}

function warningText(value: string): string {
  return `<span class="preview-search-warning-word">${escapeHtml(value)}</span>`;
}

function nonRedactedStatus(count: number, allMatches: boolean): string {
  if (allMatches) {
    return `${allMatchesSubject(count)} ${isAre(count)} ${warningText("non-redacted")}.`;
  }
  return `${formatMatches(count)} ${remainsRemain(count)} ${warningText("non-redacted")}.`;
}

function redactedOriginalStatus(count: number, allMatches: boolean): string {
  if (allMatches) {
    return `${allMatchesSubject(count)} in original ${hasHave(count)} been redacted.`;
  }
  return `${formatMatches(count)} in original ${hasHave(count)} been redacted.`;
}

function redactionsOnlyStatus(count: number): string {
  return `${formatMatches(count)} in redactions only.`;
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
renderRoute();
if (DEV_MODE) initDevMode();
