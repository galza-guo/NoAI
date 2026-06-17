# Benchmark Governance Process

## Purpose

NoAI's benchmark measures whether the deterministic redaction engine performs
well across representative business and legal documents. It is a release signal,
not a development corpus.

## Core Separation

Use three separate artifact classes:

| Class | Purpose | May guide engine rules? | Committed? |
| --- | --- | --- | --- |
| Synthetic regression tests | Lock known behavior in small invented examples | Yes | Yes |
| Development corpus | Real/public examples for research rounds | Yes, through generalized synthetic tests | No raw documents |
| Benchmark suite | Frozen exam for scoring engine versions | No | Harness/schema only |

## Suite Selection

A benchmark suite should contain 10-20 documents, chosen for coverage rather
than volume. Each suite should cover a balanced mix of:

- Commercial contracts and engagement letters.
- Legal correspondence and email-like business correspondence.
- Litigation pleadings and procedural filings.
- Regulatory enforcement or compliance notices.
- Stock-exchange and listed-issuer documents.
- Procurement, RFP, bid, and public-contract materials.
- Invoices, remittance advice, bank/payment instructions, and AP documents.
- Employment, HR, board, shareholder, or governance documents.

Prefer born-digital documents with clean text extraction. The benchmark is for
word detection, not OCR.

## Versioning

Each suite gets a stable ID, for example `benchmark-v1.0`.

Do not compare scores across different suite versions without saying so. If a
document is added, removed, replaced, or re-extracted, create a new suite
version.

Each document record must include:

- Source URL or provenance note.
- Local original/PDF/extracted-text paths.
- SHA-256 hash of the exact text used for scoring.
- Document category.
- License/provenance notes.
- Frozen/contaminated/retired status.

## Annotation

Use character offsets against the exact extracted text that the engine will
score. Store the exact span text beside offsets so validation can catch drift.

Annotations have two actions:

- `redact`: a span that should be removed or replaced.
- `keep`: a span that should remain readable and counts against over-redaction
  if the engine masks it.

Gold annotations should be produced by adjudicating two or more model proposals,
not by blindly accepting one model's answer.

## Contamination Rules

Benchmark documents are sealed exam papers.

Allowed:

- Running the benchmark harness.
- Reading aggregate score summaries.
- Reporting scores by suite, category, label, and severity.
- Using broad observations to choose the next development-corpus area.

Not allowed:

- Giving benchmark documents to engine-refinement workers.
- Writing rules from benchmark-specific phrases.
- Turning benchmark misses directly into synthetic regression tests.
- Optimizing for benchmark score at the expense of generality.

If a benchmark document must be inspected to diagnose a release blocker, mark
it `contaminated` in the manifest and replace it in the next suite version.

## Round Evaluation

After a worker round:

1. Audit source changes for scope, generality, and overfitting.
2. Run unit tests, build, and engine-version checks.
3. Run the sealed benchmark.
4. Compare against the previous engine version.
5. Report aggregate movement:
   - Overall score.
   - Omissions by severity and label.
   - Over-redactions by label and `keep` span.
   - Movement by document category.
6. Decide whether to keep, partially keep, or revert the round.

If a score drops in a category, gather fresh development-corpus documents from
that category and refine from those. Do not tune against the benchmark document.
