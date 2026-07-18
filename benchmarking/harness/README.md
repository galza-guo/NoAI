# Benchmark Harness

This folder holds local benchmark utilities.

`validate-annotation-file.mjs` checks that a single-document annotation file is
structurally sane and that character spans match the source text.

`validate-batch-annotation-file.mjs` checks the batch JSON returned from
`prompts/model-annotation-prompt.md` against a private suite
`model-input/document-index.json` file and the pure extracted Markdown files.

`score-current-engine.mjs` runs the current deterministic NoAI engine against a
local frozen suite's gold annotations. It writes per-level JSON/Markdown score
reports and updates a local `reports/score-history.json` plus
`reports/score-history.md` ledger by default.

`create-dev-round.mjs` creates an ignored development-round folder under
`benchmarking/private/dev-rounds/` with the standard source, model-input,
engine-output, annotations, comparison, and scratch subfolders.

`index-dev-round-docs.mjs` indexes `.md` and `.txt` files from a dev round's
`source/` folder into deterministic `model-input/doc-NNN.md` files and writes a
`document-index.json` with SHA-256 hashes. Convert PDF/DOCX files to Markdown or
text before indexing for now.

`run-dev-round-engine.mjs` runs the current deterministic engine against a dev
round's indexed documents and writes `engine-output/<level>.json`.

`run-claude-annotator.mjs` builds a batch annotation prompt from the indexed dev
round documents and calls `claude -p`, writing
`annotations/claude.batch.json`. It is development-only and must not be wired
into the product runtime.

`compare-dev-round.mjs` compares independent Claude and second-agent annotation
batches against engine output, then writes `comparison/engine-gap-report.json`
and `comparison/round-summary.md`. Headline metrics score the engine against
annotator-consensus spans only: same document, action, label, and severity,
with spans overlapping by at least 50%. Boundary differences merge into the
shared intersection, so swapping annotator roles cannot change the target.
Overlapping label/severity disagreements and single-annotator leads are
reported separately for human judgment. Prediction support distinguishes
confirmed spans, uncertain spans backed by a lead or disagreement, and spans
unsupported by either annotator; character precision is shown as a
confirmed-to-possible range.

`gate-dev-round.mjs` is the hard gate between dev-loop rounds. It compares a
candidate NAIR score report against the last accepted score report for the
same suite/level and fails (exit 1) on regressions the overall recall number
hides: per-label covered-span losses, critical/high severity losses, document-
category losses, new keep-span violations, and precision drops. Loss
tolerances default to zero. Changed benchmark targets and invalid gate options
are configuration errors (exit 2); score reports carry a suite fingerprint for
identity checking. Explicitly tolerated losses produce `PASS WITH WARNINGS`
(exit 3), which stops unattended loops for integrator review. Only a clean
`PASS` exits 0. On acceptance, the integrator snapshots the candidate report
as the new accepted baseline (e.g. `reports/accepted-score-balanced.json`).

Example:

```bash
node benchmarking/harness/score-current-engine.mjs --level balanced
node benchmarking/harness/score-current-engine.mjs --level light
node benchmarking/harness/score-current-engine.mjs --level heavy
```

Dev-round example:

```bash
node benchmarking/harness/create-dev-round.mjs \
  --round 2026-06-19-sec-correspondence \
  --theme "SEC correspondence names, addresses, and filing refs" \
  --source-mode public-search

# Put .md/.txt source files in benchmarking/private/dev-rounds/<round>/source/

node benchmarking/harness/index-dev-round-docs.mjs \
  --round-dir benchmarking/private/dev-rounds/2026-06-19-sec-correspondence

node benchmarking/harness/run-dev-round-engine.mjs \
  --round-dir benchmarking/private/dev-rounds/2026-06-19-sec-correspondence \
  --levels balanced

node benchmarking/harness/run-claude-annotator.mjs \
  --round-dir benchmarking/private/dev-rounds/2026-06-19-sec-correspondence

# Write the independent second-agent batch to annotations/agent.batch.json.

node benchmarking/harness/compare-dev-round.mjs \
  --round-dir benchmarking/private/dev-rounds/2026-06-19-sec-correspondence \
  --level balanced
```

The score history is keyed by suite, combined engine/ruleset version label,
redaction level, and span coverage threshold. Rerunning the same label updates
the existing baseline row; bumping only the general or Chinese ruleset counter
creates a distinct row.

Future harness pieces should:

- Compare one combined engine/ruleset version label against another.
- Add optional gates for release checks, such as "no new critical omissions."
- Produce richer aggregate reports without requiring agents to inspect sealed
  document contents.

Do not make harness scripts upload documents or call remote models from the
product runtime. Development-only annotator helpers such as
`run-claude-annotator.mjs` are allowed inside ignored dev-round workflows.
