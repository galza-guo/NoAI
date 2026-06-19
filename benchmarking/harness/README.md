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
and `comparison/round-summary.md`.

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
