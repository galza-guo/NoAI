# NoAI Factual Overview

NoAI is a public, browser-only deterministic redaction tool. It helps users prepare documents before sharing redacted text with external AI tools.

The core workflow is:

1. Add one or more documents in the browser.
2. Let NoAI detect likely sensitive details with deterministic rules.
3. Review, adjust, and add any custom redaction terms.
4. Export redacted Markdown for use with an AI assistant or other downstream tool.

## What NoAI Is For

NoAI is for people and small teams who want a fast "drop documents, get redacted Markdown" workflow before using AI tools such as ChatGPT, Claude, Gemini, or other assistants.

Typical document types include contracts, correspondence, pleadings, due diligence notes, internal business documents, and text that contains people, organizations, case references, addresses, dates, amounts, or other identifiers.

## Trust Boundaries

NoAI's redaction path is local, mechanical, and inspectable.

- It does not upload document contents to a backend.
- It does not call an AI model to inspect or redact documents.
- It does not use analytics, telemetry, crash reporting, advertising pixels, or conversion services that can inspect document contents.
- It does not intentionally store document contents on a server.
- It keeps selected document text in the browser session so the user can preview, edit, and export redactions.

The browser still requests normal website assets such as HTML, JavaScript, styles, icons, and fonts. Those requests load the app interface; they are not document uploads by NoAI.

## Redaction Model

NoAI uses layered deterministic detection rather than AI inference.

Direct patterns cover items such as emails, phone numbers, URLs, dates, monetary amounts, addresses, postcodes, business identifiers, case references, exhibit references, transcript references, and bank-style identifiers.

Contextual rules cover items such as titled names, parties, organizations, project names, locations, correspondence metadata, captions, contact blocks, and repeated document-specific terms.

Custom terms supplied by the user take priority and are redacted consistently.

## Redaction Levels

Light redaction targets direct identifiers and aims to preserve readability.

Balanced redaction is the default level for preparing documents for external AI tools. It includes direct identifiers plus broader names, organizations, dates, amounts, locations, and matter terms.

Heavy redaction is more aggressive and accepts lower readability for stronger privacy reduction.

## Supported Inputs And Output

NoAI supports Markdown, plain text, Word documents, and text-based PDFs in the browser.

Scanned-image PDFs may not contain readable text. NoAI does not send them to remote OCR or conversion services.

Markdown is the primary export format because it preserves enough structure for AI assistants and agents while remaining plain text and easy to inspect.

## Limitations

NoAI is a first-pass preparation tool. It is not a legal-grade redaction system, anonymization guarantee, compliance tool, lawyer, privacy officer, or professional reviewer.

It can miss unusual names, implicit identifiers, rare address formats, industry-specific references, hidden context, and scanned PDF content. It can also redact text that is not sensitive, especially at heavier redaction levels.

Users should review the redacted output before sharing it. High-risk documents should receive human or professional review before disclosure.

## Source And License

Source code: https://github.com/galza-guo/NoAI

License: GNU Affero General Public License v3.0 only.
