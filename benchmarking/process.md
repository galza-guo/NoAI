# NAIR Benchmark Governance Process

## Purpose

NAIR means Non-AI Redaction. It is NoAI's sealed benchmark for measuring whether
the deterministic redaction engine performs well across representative business
and legal documents.

NAIR is a release signal, not a development corpus. It should answer: "Did this
engine version perform better or worse than the previous one on a frozen exam?"

This document is the authoritative process design for NAIR.

## Core Separation

Use three separate artifact classes:

| Class | Purpose | May guide engine rules? | Committed? |
| --- | --- | --- | --- |
| Synthetic regression tests | Lock known behavior in small invented examples | Yes | Yes |
| Development corpus | Real/public examples for research rounds | Yes, through generalized synthetic tests | No raw documents |
| NAIR benchmark suite | Frozen exam for scoring engine versions | No | Harness/schema only |

## Generalization Principle

Every engine improvement may be prompted by specific sample documents, but it
must be designed for broader robustness across business and legal documents in
general. The goal is not to perform perfectly on the latest sample, development
round, document source, or benchmark category. The goal is to make the
deterministic engine more dependable when it faces unseen real-world business
and legal material.

Before accepting a rule, ask:

- What general document pattern does this rule cover?
- What non-sensitive business/legal text could it accidentally redact?
- Is the rule anchored by context, labels, structure, or distinctive format?
- Do synthetic tests include both the new leak/over-redaction and at least one
  counterexample?
- Would this still make sense if the triggering sample were removed from view?

Reject changes that merely fit the latest sample or raise a narrow score while
making the engine less reliable elsewhere.

## Two Different Loops

NAIR has two distinct workflows. Keep them separate.

### Suite Creation / Gold-Answer Generation

This happens occasionally, for example when creating `nair-v1.0` or replacing a
contaminated/retired document.

1. Gather representative public business/legal documents.
2. Reject blank templates, low-text OCR scans, and documents that do not contain
   meaningful filled-in sensitive fields.
3. Convert each document to the exact Markdown text that will be scored.
4. Ask two or more frontier models to propose annotations in the standard
   format.
5. Adjudicate proposals into a frozen gold answer.
6. Freeze the suite version, hashes, manifest, and gold files.

After this point, the suite is sealed.

### Engine Improvement / Release Evaluation

This is the repeatable loop and can run many times against the same frozen NAIR
suite.

1. In a dedicated improvement thread, gather fresh development-corpus documents
   that are not in NAIR.
2. Give those development documents to a worker to find general redaction
   improvements and implement engine changes.
3. Audit the worker's changes for scope, generality, and overfitting.
4. Run unit tests, build, and engine-version checks.
5. Run NAIR scoring against the frozen suite.
6. Decide whether to adopt, partially keep, or discard the round.

The worker must never see NAIR documents, NAIR gold annotations, model
proposals, or span-level benchmark failures. NAIR results may guide release
decisions and broad future-development priorities, but not direct rule writing.

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

Do not use blank templates as benchmark documents. Forms, templates, and sample
guides can be useful development-corpus material, but the sealed benchmark
should favor real public documents with actual parties, contacts, addresses,
dates, identifiers, amounts, signatures, or filing/reference metadata. A form is
acceptable only if it is a real filed/issued document and contains meaningful
filled-in values.

## Versioning

Each suite gets a stable ID, for example `nair-v1.0`. Existing local candidate
folders may use `benchmark-v1.0` during setup, but frozen/public references
should use the NAIR name.

Do not compare scores across different suite versions without saying so. If a
document is added, removed, replaced, or re-extracted, create a new suite
version.

Each document record must include:

- Source URL or provenance note.
- Local original/PDF/Markdown paths.
- SHA-256 hash of the exact Markdown used for scoring.
- Document category.
- License/provenance notes.
- Frozen/contaminated/retired status.

## Annotation

Use character offsets against the exact extracted Markdown that the engine will
score. Store the exact span text beside offsets so validation can catch drift.
The extracted `.md` files are pure document text; prompts and instructions live
separately under `benchmarking/prompts/`.

Annotations have two actions:

- `redact`: a span that should be removed or replaced.
- `keep`: a span that should remain readable and counts against over-redaction
  if the engine masks it.

Gold annotations should be produced by adjudicating two or more model proposals,
not by blindly accepting one model's answer.

## Contamination Rules

NAIR benchmark documents are sealed exam papers.

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
3. Run NAIR scoring against the sealed suite.
4. Compare against the previous engine version.
5. Report aggregate movement:
   - Overall score.
   - Omissions by severity and label.
   - Over-redactions by label and `keep` span.
   - Movement by document category.
6. Decide whether to keep, partially keep, or revert the round.

If a score drops in a category, gather fresh development-corpus documents from
that category and refine from those. Do not tune against the benchmark document.

## Adoption Guidance

Do not treat NAIR as the only truth. It is an indicator for release decisions.

Default decisions:

- Adopt a round if it improves or preserves NAIR score, has no new critical
  omissions, and the code audit shows general rules with good synthetic tests.
- Partially keep a round if some changes are clearly general but others are
  broad, fragile, or score-chasing.
- Discard or revert a round if it improves one narrow category by damaging
  general behavior, introduces corpus-specific rules, or relies on benchmark
  details.

If NAIR reveals a broad weakness, gather new non-NAIR development documents in
that area and improve from those. Do not inspect the benchmark document to write
the rule unless you are willing to mark it contaminated and replace it.
