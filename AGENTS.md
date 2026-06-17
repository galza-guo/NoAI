# NoAI Agent Handover

NoAI is a public, browser-only deterministic redaction tool. Its promise is simple: help users prepare documents for external AI tools without sending the original documents to any server or AI model.

## Product Direction

- Target users are non-technical people and small teams who want a fast "drop documents, get redacted Markdown" workflow.
- The core value is trust. Keep the runtime path local, mechanical, and inspectable.
- Redaction logic matters more than frontend polish for now.
- Markdown is the primary export format because it is friendly to AI agents and chatbots.
- Batch processing and combined Markdown export are core features, not extras.

## Non-Negotiable Constraints

- Do not add AI/LLM calls to the redaction path.
- Do not upload document contents to a backend.
- Do not add analytics, telemetry, logging, crash reporting, or conversion services that can see document contents.
- Do not commit real client, legal, personal, or proprietary sample documents.
- Do not make privacy claims stronger than the implementation proves.
- Keep the code auditable. Prefer explicit rule-based logic over opaque dependencies.

## Current Architecture

- `src/fileReaders.ts` reads `.md`, `.txt`, `.docx`, and text-based `.pdf` in the browser.
- `src/redactor/engine.ts` detects and replaces sensitive candidates.
- `src/redactor/rules.ts` holds rule lists and stopwords.
- `src/redactor/engine.test.ts` contains the main regression suite.
- `src/main.ts` is the current minimal UI.

The app is built with Vite and TypeScript. It is intended to deploy as a static site.

## Development Commands

```bash
npm install
npm test
npm run build
npm run dev
```

Run `npm test` and `npm run build` before committing meaningful changes.

## Redaction Philosophy

Use layered deterministic detection:

- Direct patterns for emails, phone numbers, URLs, case references, exhibit references, transcript references, dates, amounts, addresses, and business IDs.
- Contextual patterns for titled names, legal parties, organizations, project names, locations, and document-specific terms.
- Custom terms from the user should always win and be redacted consistently.
- Replacement labels should preserve enough structure for the output to remain useful.

Support multiple redaction levels:

- Light: fewer false positives, more readable.
- Balanced: default for using external AI tools.
- Heavy: more aggressive, accepts lower readability for stronger privacy.

## Handover Notes

The current prototype was developed against real-world English legal/business documents, but those source documents must not be committed. Tests should use synthetic examples that capture the same patterns without preserving private facts.

The strongest next work is to improve the detector systematically: add failing synthetic cases, tune rules, and keep a human-readable explanation of what each rule is intended to catch. Frontend polish can come later.

## Frontend Development Guidelines

- **Typography**: Never allow elements to fall back to browser default fonts. All typography must be strictly defined by the design system variables (`--font-sans`, `--font-display`, `--font-mono`). Ensure form controls (`button`, `input`, `select`, `textarea`) and preformatted text (`code`, `pre`, `kbd`, `samp`) explicitly inherit or declare these variables, as they do not inherit from `body` by default.
- **Icons**: Always use Phosphor Icons as the default icon library. Only use alternative icons if subject to an explicit override. The `@phosphor-icons/web` package is installed and `regular` font weight is available. Use `<i class="ph ph-[icon-name]"></i>`.
