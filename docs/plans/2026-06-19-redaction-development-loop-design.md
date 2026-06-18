# Redaction Development Loop Design

## Goal

Create a repeatable, low-human-involvement development loop for improving
NoAI's deterministic redaction engine from small batches of development
documents. The loop should let an agent take either user-supplied documents or
fresh public documents, annotate them with independent AI passes, find engine
misses and over-redactions, and convert only generalizable findings into
synthetic tests and deterministic rule changes.

## Scope

This is an engine-development workflow, not a product runtime feature. It may
use external AI tools such as `claude -p` during development, but it must not add
AI calls, uploads, telemetry, logging, or remote services to the browser
redaction path.

Raw development documents, extracted Markdown, model annotations, comparison
reports, and temporary prompts remain gitignored working material. The committed
artifacts are limited to workflow instructions, harness scripts, prompt
templates, synthetic tests, deterministic engine changes, version bumps, and
changelog entries.

## Document Intake

The loop supports two intake paths:

- User-supplied documents: the user provides PDFs, DOCX, Markdown, text, or
  extracted text files for a round.
- Agent-sourced public documents: when the user asks the agent to gather
  documents, the agent locates public business/legal documents that contain
  filled-in sensitive fields such as names, addresses, emails, phones, identity
  or business identifiers, account-like values, dates, amounts, case references,
  or signatures.

Good public-source categories include public-company filings, SEC
correspondence, court or regulator filings, procurement notices, award notices,
public contracts, invoices or payment-instruction examples, HR/governance
filings, Chinese corporate disclosures, and government procurement pages.

For public sourcing, the agent records source URLs and provenance in the local
round manifest, but the downloaded originals and extracted text remain in an
ignored development folder.

## Local Round Layout

Each round should live under:

```text
benchmarking/private/dev-rounds/<YYYY-MM-DD-theme>/
```

Suggested structure:

```text
source/
  original downloaded or user-supplied documents
model-input/
  document-index.json
  doc-001.md
  doc-002.md
engine-output/
  light.json
  balanced.json
  heavy.json
annotations/
  claude.batch.json
  codex.batch.json
comparison/
  disagreement-report.md
  engine-gap-report.json
  round-summary.md
scratch/
  temporary notes and prompts
```

This directory is private working material and should not be committed.

## Annotation Model

Two independent annotators inspect the exact extracted Markdown:

- Annotator A: `claude -p`, using the existing batch annotation schema and
  prompt style.
- Annotator B: a Codex pass or Codex subagent, blind to both Claude's answer
  and the engine output.

Both annotators output character-span JSON with `redact` and `keep` actions.
They should annotate the source text only. The main agent validates offsets,
checks exact span text, compares the two annotation sets, and then compares the
adjudicated/de facto consensus against the current engine output.

The annotators are scouts, not rule authors. They identify likely sensitive
spans and important keep spans; they do not patch the engine.

## Failure Triage

The main agent groups issues by general pattern:

- missed direct identifiers, such as IDs, accounts, emails, phones, and business
  identifiers;
- missed context-bound values, such as names, organizations, addresses, case
  references, dates, amounts, projects, and document references;
- harmful over-redactions of headings, table headers, law names, role labels,
  generic business/legal boilerplate, and public-agency boilerplate;
- replacement or overlap problems where the final sanitized text leaks part of a
  sensitive value.

Accepted issues must be converted into synthetic regression tests with invented
values. Raw document facts should not be copied into committed tests.

## Engine Change Rules

Each accepted engine change should:

- explain the broader pattern it covers;
- be anchored by labels, structure, context, validation, or distinctive format;
- include at least one positive synthetic test and at least one counterexample;
- avoid corpus-specific entity dictionaries or one-off literal phrases;
- keep ambiguous bare values label-bound unless there is strong validation;
- update `src/redactor/version.ts` for behavior changes;
- update `docs/engine-changelog.md`;
- run `npm test`, `npm run build`, and
  `node scripts/check-engine-version.mjs`.

## Benchmark Separation

NAIR remains a sealed release exam. Development-round documents may guide engine
work; NAIR documents, gold annotations, model proposals, and span-level NAIR
failures must not be used to write rules.

After a development round, the agent may run NAIR scoring and report aggregate
movement only. If NAIR drops in a category, the next action is to gather fresh
non-NAIR development documents from that category.

## Skill Packaging

Create a repo-specific skill, tentatively named `noai-redaction-dev-loop`, that
orchestrates the workflow. The skill should be concise and should delegate
repeatable mechanics to scripts in `benchmarking/harness/`.

Useful scripts:

- create a dev-round directory and document index;
- run the current engine against round documents at selected levels;
- call `claude -p` with the annotation prompt and round inputs;
- validate batch annotation JSON;
- compare annotation spans against engine prediction spans;
- summarize issue clusters and suggested synthetic tests.

The skill should be triggered by requests such as "run a NoAI redaction
development round", "use these documents to improve the redactor", or "find
public documents and improve the engine from them".

## Success Criteria

- A user can provide a few documents, or ask the agent to gather public ones,
  and the agent can run the round with minimal further input.
- Raw/source development materials stay ignored by git.
- Claude and Codex annotation outputs are reproducible local artifacts.
- Engine work is driven by generalized issue clusters, not blind patching for a
  single document.
- Every committed engine change is represented by synthetic tests, versioning,
  changelog notes, and passing verification commands.
