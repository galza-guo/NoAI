# Design: Release Pages Scaffold

## Context
NoAI needs release-facing trust and legal surfaces without cluttering the main redaction workspace. The app is a static Vite/TypeScript browser app, so the navigation should work without backend routing.

## Requirements
- Add scaffold pages for FAQ, About, Privacy, Terms, and Version History.
- Keep page layouts and styles consistent across the new reading pages.
- Put access to those pages behind a compact top-right context/menu button on the main page.
- Do not add a footer to the main redaction workspace.
- Include a first-time notice frame that can point users to key information.
- Keep all copy placeholder-level so page-specific content can be drafted later.

## Approach
Use a hash-based client route layer (`#/faq`, `#/about`, `#/privacy`, `#/terms`, `#/changelog`) inside the existing single-page app. The workspace remains the default route at `#/` and keeps the full-height tool layout. Reading pages share a simple content shell, footer, section placeholders, and version metadata where useful.

The top bar gains a single menu button with Phosphor icons. The menu links the workspace, FAQ, About, Privacy, Terms, and Version History pages. The main page has no footer; reading/legal pages render their own footer inside the content shell.

The first-time notice is a small dismissible panel on the workspace route. Its dismissal stores only a local acknowledgement flag, never document contents.
