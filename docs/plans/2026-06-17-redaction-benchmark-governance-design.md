# Redaction Benchmark Governance Design

## Goal

Create a sealed benchmark process for NoAI's deterministic redaction engine so
future engine versions can be scored without turning benchmark documents into a
training set.

## Design

The benchmark system separates three artifact classes:

- Synthetic regression tests, which are committed and used for development.
- Development corpora, which workers may inspect but must not commit as raw
  documents.
- Frozen benchmark suites, which are private exam materials used only for
  scoring.

The repository commits only process docs, schemas, prompts, and local harness
scripts. Raw benchmark documents, extracted text, model proposals, adjudicated
gold annotations, and reports remain under ignored private folders.

## Annotation Model

Annotations use zero-based character spans against the exact extracted text that
the engine scores. Each span stores its exact text as a drift check. Spans are
either `redact` or `keep`; `keep` spans let the benchmark measure harmful
over-redaction of legal/business boilerplate.

Gold annotations are created by adjudicating two or more frontier-model
proposals, not by accepting one model as authoritative.

## Governance

Benchmark documents are sealed. Agents may run benchmark scripts and read
aggregate results, but they must not use span-level benchmark failures to tune
rules. If a benchmark document must be inspected to fix a release blocker, mark
it contaminated and replace it in the next suite version.

## Success Criteria

- The repo explains how to create, freeze, annotate, and score benchmark suites.
- Private benchmark materials are ignored by git.
- Model annotation and adjudication prompts share a uniform schema.
- A local validation script catches malformed annotations and span drift.
