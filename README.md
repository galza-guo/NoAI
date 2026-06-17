# NoAI

Browser-only deterministic redaction for preparing documents before they are sent to AI tools.

NoAI is for people who want to use AI assistants without first handing over raw private documents. The app reads files locally in the browser, applies inspectable rule-based redaction, and exports Markdown that can be pasted into other AI tools.

It does not upload files, call AI APIs, or store document contents.

## Why This Exists

Commercial AI tools are useful, but many people and small teams are uncomfortable pasting sensitive contracts, pleadings, correspondence, due diligence notes, or internal documents into them. Enterprise private AI servers are not realistic for everyone.

NoAI takes a simpler path: remove likely sensitive information before the document ever reaches an AI provider.

The goal is not perfect anonymization. The goal is a fast, understandable pre-processing step that reduces obvious privacy risk while keeping the resulting document readable enough for AI-assisted summarization, drafting, analysis, and search.

## Current Scope

- Input: `.md`, `.txt`, `.docx`, and text-based `.pdf`.
- Output: combined Markdown and per-document sanitized previews.
- Batch processing is supported: drop multiple files and export one combined Markdown pack.
- Levels:
  - Light: direct identifiers (emails, phone numbers, URLs, addresses, postcodes, national/business IDs, bank details, and case/registry references).
  - Balanced (default): Light plus people, organizations, matter names, dates, amounts, and locations.
  - Strict: Balanced plus aggressive repeated proper-noun capture and heavier table/contact quarantining.
- Custom terms are supported and replaced deterministically.

## Trust Model

The app is designed as a static browser app. Files are parsed and redacted in the user's browser process. The current prototype has no backend endpoint and no AI API call path.

This is the main design constraint:

- No server-side document processing.
- No AI/LLM calls in the redaction path.
- No analytics over document contents.
- No logging of document contents.
- No remote OCR or conversion service.

The source code should stay small and auditable so non-expert users can reasonably trust the public claim: documents are processed locally.

The redaction engine is rule-based:

- Direct patterns: emails, phone numbers, URLs, addresses, postcodes, national IDs (SSN, NI, passport), employer IDs, bank details (IBAN, SWIFT/BIC, sort code), case references (including UK neutral citations and US dockets), bundle/exhibit references, transcript references, procedural references, dates, amounts, and percentages.
- Context patterns: legal contact labels, addresses, titled names, witness-style aliases, all-caps party names, organization suffixes, known legal/finance organizations, locations, and matter-specific deal terms.
- Levels: Light keeps the output most readable, Balanced is the default for external AI use, and Strict adds aggressive repeated proper-noun capture and heavier table/contact quarantining. Dates are handled at Balanced because they are useful identifiers.

## What It Is Not

NoAI is not a legal-grade redaction system and should not be used as the only protection before publishing documents, producing documents in litigation, or disclosing information to counterparties. It can miss unusual names, implicit identifiers, rare address formats, and sensitive context that only a human would understand.

For high-risk use, review the output before sharing it.

## Verification Run

- Engine unit tests: `npm test`
- Production build: `npm run build`
- Dependency audit: `npm audit --audit-level=moderate`

During early development the detector was also tested against private English legal/business documents. Those documents are not part of this repository. Public regression tests should use synthetic examples that preserve the pattern without preserving private facts.

## Engine Versioning

The redaction engine is versioned separately from the app package. The current engine version lives in `src/redactor/version.ts`, and changes are summarized in `docs/engine-changelog.md`.

Use semantic versioning:

- Patch: narrow false-positive/false-negative fixes or small rule tuning.
- Minor: new document family coverage, new detector category, or compatible review metadata.
- Major: incompatible output, API, replacement-token, or redaction-level semantics changes.

To enable the local commit guard:

```bash
npm run hooks:install
```

After that, commits that change `src/redactor/engine.ts`, `src/redactor/rules.ts`, or `src/redactor/types.ts` must also stage an engine version bump and changelog entry.

## Development

```bash
npm install
npm test
npm run build
npm run dev
```

The dev server runs locally through Vite. The production build is a static site.

## Roadmap

- Improve English legal and business document detection rules.
- Add a clearer report showing what was redacted and why.
- Add safer PDF handling notes for scanned-image PDFs that need OCR before redaction.
- Add export options beyond Markdown only if they do not weaken the browser-only trust model.
- Improve the interface after the redaction logic is mature.

## Known Limits

This is deterministic software, not AI. It can miss unusual names and can over-redact capitalized legal phrases. The detection rules are intentionally inspectable and tested so users can audit what the tool does.

## License

GNU Affero General Public License v3.0 only (`AGPL-3.0-only`). See [LICENSE](./LICENSE).

In plain terms: you can use, study, modify, and share NoAI, but if you modify it and offer it to users over a network, you must make your modified source code available under the same license.
