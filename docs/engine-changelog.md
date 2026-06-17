# Redaction Engine Changelog

The redaction engine uses semantic versioning independently from the app package.

## 1.0.0 - 2026-06-17

Initial versioned baseline after the first release-candidate refinement rounds.

This baseline includes deterministic detection for common English business/legal documents: direct identifiers, addresses, postcodes, national/business IDs, bank details, case and filing references, people, organizations, dates, amounts, locations, matter/project terms, correspondence metadata, litigation captions, legal contact blocks, and signature blocks.

Known trade-off: the engine is intentionally rule-based and inspectable, so unusual names, rare address formats, and context-only identifiers can still require human review.

## 1.0.1 - 2026-06-17

Updated engine coverage and quality after additional deterministic corpus rounds.

- Extended direct and contextual detectors for additional legal and business variants.
- Added normalization and boundary checks to reduce false positives.
- Strengthened replacement consistency for names, organizations, and reference IDs.
- Expanded tests to cover the new edge cases and expected redaction patterns.
