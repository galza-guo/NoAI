# Release Pages Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a release-page scaffold for FAQ, About, Privacy, Terms, Version History, and a first-time notice without changing NoAI's redaction behavior.

**Architecture:** Add a small hash router to the existing `src/main.ts` single-page app. The redaction workspace remains the default view, while info pages render from a shared scaffold model into a reusable reading layout. Styles live in `src/styles.css` and reuse the current design tokens.

**Tech Stack:** Vite, TypeScript, browser DOM APIs, existing CSS variables, Phosphor Icons.

---

### Task 1: Add Route and Metadata Scaffolding

**Files:**
- Modify: `src/main.ts`

**Steps:**
1. Import `ENGINE_VERSION` and `ENGINE_VERSION_DATE` from `src/redactor/version.ts`.
2. Add route types for `workspace`, `faq`, `about`, `privacy`, `terms`, and `changelog`.
3. Add static scaffold metadata for each reading page.
4. Add helpers to parse `window.location.hash` and build hash links.

### Task 2: Add Top Menu, Workspace Notice, and Info View

**Files:**
- Modify: `src/main.ts`

**Steps:**
1. Update the top bar markup with a logo link and top-right menu button.
2. Add a menu popover containing links to all routes.
3. Add a dismissible first-time notice inside the workspace route.
4. Add an empty `info-view` container after the workspace.
5. Wire DOM references and event listeners for menu open/close, route changes, and notice dismissal.

### Task 3: Render Info Page Shells

**Files:**
- Modify: `src/main.ts`

**Steps:**
1. Implement `renderRoute()`.
2. Implement `renderInfoPage(route)`.
3. Render placeholders for page sections.
4. Show app and engine versions on About and Version History placeholders.
5. Render a footer only inside info pages.

### Task 4: Style the Shared Shell

**Files:**
- Modify: `src/styles.css`

**Steps:**
1. Add topbar brand/menu styles.
2. Add first-time notice styles.
3. Add info page layout, placeholder cards, footer, and responsive styles.
4. Ensure the main workspace remains full-height and footer-free.

### Task 5: Verify

**Commands:**
- `npm test`
- `npm run build`

**Manual checks:**
- `#/` shows the redaction workspace with no footer.
- Top-right menu opens and links to FAQ, About, Privacy, Terms, and Version History.
- Each info route shows the shared scaffold layout and footer.
- First-time notice can be dismissed and does not store document contents.
