# NAIR Benchmarking

This folder standardizes NAIR: the Non-AI Redaction benchmark process for
NoAI's deterministic redaction engine.

NAIR is an exam, not a training set. Use it to decide whether an engine version
is better or worse. Do not use benchmark documents or benchmark-specific misses
to write redaction rules.

The authoritative process design is `process.md`.

## What Is Committed

- `process.md`: governance rules for benchmark creation, scoring, and contamination.
- `schemas/`: JSON formats for benchmark manifests and span annotations.
- `prompts/`: prompts for model annotation, adjudication, and worker rounds.
- `harness/`: local scripts for validating benchmark artifacts.
- `suites/.gitkeep`: placeholder for local benchmark-suite folders.

## What Is Private

The actual benchmark documents, extracted Markdown, model proposals, gold
annotations, and score reports are ignored by git. Keep them under:

```text
benchmarking/private/
benchmarking/suites/<suite-id>/
```

Extracted Markdown files in a suite must contain only document text. Do not
embed the model prompt inside each document. Use one prompt from `prompts/` and
send the suite's extracted `.md` files as separate batch inputs.

Do not commit raw benchmark documents unless they are intentionally public
fixtures and the project owner explicitly approves committing them.

## Standard Workflow

1. Build a candidate suite from representative business/legal documents.
2. Convert each document into the exact text format the engine will score.
3. Ask two or more frontier models to annotate spans using
   `prompts/model-annotation-prompt.md`.
4. Adjudicate model proposals into one frozen gold file per document.
5. Freeze a suite version with document hashes and manifest metadata.
6. Score engine versions against the frozen suite.
7. Use score summaries for release decisions, not direct rule writing.

If a benchmark document is inspected in detail to fix an engine rule, mark it
contaminated and replace it in the next benchmark-suite version.

## Repeatable Improvement Loop

Once a NAIR suite is frozen, most engine-improvement rounds do not update the
benchmark. Run improvement rounds in a separate working thread using fresh
development-corpus documents. After the worker finishes, audit the engine
changes, run the normal test/build/version checks, run NAIR scoring, and decide
whether to adopt, partially keep, or discard the round.
