# NoAI Benchmarking

This folder standardizes NoAI's sealed benchmark process.

The benchmark is an exam, not a training set. Use it to decide whether an
engine version is better or worse. Do not use benchmark documents or
benchmark-specific misses to write redaction rules.

## What Is Committed

- `process.md`: governance rules for benchmark creation, scoring, and contamination.
- `schemas/`: JSON formats for benchmark manifests and span annotations.
- `prompts/`: prompts for model annotation, adjudication, and worker rounds.
- `harness/`: local scripts for validating benchmark artifacts.
- `suites/.gitkeep`: placeholder for local benchmark-suite folders.

## What Is Private

The actual benchmark documents, extracted text, model proposals, gold
annotations, and score reports are ignored by git. Keep them under:

```text
benchmarking/private/
benchmarking/suites/<suite-id>/
```

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
