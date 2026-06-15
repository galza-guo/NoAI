# AI Preflight Redactor

Browser-only deterministic redaction for preparing documents before they are sent to AI tools.

The prototype does not upload files or call AI APIs. It reads files locally in the browser, extracts text where possible, applies rule-based redaction, and exports Markdown.

## Current Scope

- Input: `.md`, `.txt`, `.docx`, and text-based `.pdf`.
- Output: combined Markdown and per-document sanitized previews.
- Levels:
  - Light: direct identifiers.
  - Balanced: people, organizations, matter names, refs, amounts, and locations.
  - Strict: Balanced plus dates and heavier table/contact handling.
- Custom terms are supported and replaced deterministically.

## Trust Model

The app is designed as a static browser app. Files are parsed and redacted in the user's browser process. The current prototype has no backend endpoint and no AI API call path.

The redaction engine is rule-based:

- Direct patterns: emails, phone numbers, URLs, case references, bundle/exhibit references, transcript references, procedural references, amounts, and percentages.
- Context patterns: legal contact labels, addresses, titled names, witness-style aliases, all-caps party names, organization suffixes, known legal/finance organizations, locations, and matter-specific deal terms.
- Levels: Light keeps the output most readable, Balanced is the default for external AI use, and Strict adds heavier date/table/contact treatment.

## Verification Run

- Engine unit tests: `npm test`
- Production build: `npm run build`
- Dependency audit: `npm audit --audit-level=moderate`
- Real-document lab: 32 Python tests over the converted English legal corpus.
- Browser smoke tests: synthetic Markdown upload and a real `.docx` upload through the Vite app.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

## Known Limits

This is deterministic software, not AI. It can miss unusual names and can over-redact capitalized legal phrases. The detection rules are intentionally inspectable and tested so users can audit what the tool does.
