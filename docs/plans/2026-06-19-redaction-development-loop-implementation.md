# Redaction Development Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable NoAI development loop that can take user-supplied or agent-sourced public documents, run independent annotations, compare them to the deterministic engine, and guide generalized engine improvements.

**Architecture:** Keep raw development artifacts in `benchmarking/private/dev-rounds/<round-id>/`, which is already gitignored. Add small Node harness scripts under `benchmarking/harness/` for repeatable mechanics, and create a repo-specific Codex skill at `/Users/guolite/.codex/skills/noai-redaction-dev-loop` to orchestrate the workflow. Keep AI usage development-only; no runtime product code may call Claude, Codex, or any remote model.

**Tech Stack:** Node.js ESM scripts, TypeScript engine bundle via existing `esbuild` pattern, existing benchmark annotation schema/prompts, `claude -p`, Codex/subagent annotation, Vitest for script utility tests.

---

### Task 1: Add Dev-Round Git Hygiene

**Files:**
- Modify: `.gitignore`
- Modify: `benchmarking/README.md`
- Modify: `benchmarking/harness/README.md`

**Step 1: Write the expected ignore rule**

Add or confirm these ignore rules:

```gitignore
benchmarking/private/*
!benchmarking/private/.gitignore
benchmarking/suites/*
!benchmarking/suites/.gitkeep
```

If these already exist, do not duplicate them. Add a short README note that `benchmarking/private/dev-rounds/` is the expected place for development-loop source documents, extracted Markdown, annotations, and reports.

**Step 2: Verify git hygiene**

Run:

```bash
mkdir -p benchmarking/private/dev-rounds/gitignore-smoke/source
printf 'private sample' > benchmarking/private/dev-rounds/gitignore-smoke/source/doc.txt
git status --short --ignored benchmarking/private/dev-rounds/gitignore-smoke/source/doc.txt
rm -rf benchmarking/private/dev-rounds/gitignore-smoke
```

Expected: the smoke file appears as ignored, not untracked.

**Step 3: Commit**

```bash
git add .gitignore benchmarking/README.md benchmarking/harness/README.md
git commit -m "docs: document redaction dev-round private artifacts"
```

Only include files actually changed.

### Task 2: Create Dev-Round Scaffold Script

**Files:**
- Create: `benchmarking/harness/create-dev-round.mjs`
- Create: `benchmarking/harness/create-dev-round.test.mjs`
- Modify: `benchmarking/harness/README.md`

**Step 1: Write failing tests**

Test behavior:

- creates `benchmarking/private/dev-rounds/<round-id>/`;
- creates `source/`, `model-input/`, `engine-output/`, `annotations/`, `comparison/`, and `scratch/`;
- creates `round-manifest.json` with round id, creation date, theme, source mode, and empty document list;
- rejects unsafe round ids containing path separators or `..`;
- preserves existing round folders unless `--force` is supplied.

Run:

```bash
npx vitest run benchmarking/harness/create-dev-round.test.mjs
```

Expected: FAIL because the script does not exist.

**Step 2: Implement the script**

Use Node standard library only. CLI shape:

```bash
node benchmarking/harness/create-dev-round.mjs \
  --round 2026-06-19-sec-correspondence \
  --theme "SEC correspondence names, addresses, and filing refs" \
  --source-mode user
```

Supported `--source-mode`: `user`, `public-search`, `mixed`.

**Step 3: Run tests and syntax check**

```bash
node --check benchmarking/harness/create-dev-round.mjs
npx vitest run benchmarking/harness/create-dev-round.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add benchmarking/harness/create-dev-round.mjs benchmarking/harness/create-dev-round.test.mjs benchmarking/harness/README.md
git commit -m "feat: scaffold redaction dev rounds"
```

### Task 3: Add Round Document Indexing

**Files:**
- Create: `benchmarking/harness/index-dev-round-docs.mjs`
- Create: `benchmarking/harness/index-dev-round-docs.test.mjs`
- Modify: `benchmarking/harness/README.md`

**Step 1: Write failing tests**

Test behavior:

- reads `.md` and `.txt` files from `source/`;
- copies normalized text into `model-input/doc-001.md`, `doc-002.md`, etc.;
- writes `model-input/document-index.json` with `docId`, `title`, `category`, `sourcePath`, `markdownPath`, `sourceTextSha256`, and optional `sourceUrl`;
- sorts documents deterministically by filename;
- rejects unsupported binary formats with a clear message for now.

Run:

```bash
npx vitest run benchmarking/harness/index-dev-round-docs.test.mjs
```

Expected: FAIL because the script does not exist.

**Step 2: Implement the script**

Initial version handles `.md` and `.txt`. Leave PDF/DOCX extraction to a later task or manual extraction path so the first loop is reliable.

CLI shape:

```bash
node benchmarking/harness/index-dev-round-docs.mjs \
  --round-dir benchmarking/private/dev-rounds/2026-06-19-sec-correspondence
```

**Step 3: Run tests and syntax check**

```bash
node --check benchmarking/harness/index-dev-round-docs.mjs
npx vitest run benchmarking/harness/index-dev-round-docs.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add benchmarking/harness/index-dev-round-docs.mjs benchmarking/harness/index-dev-round-docs.test.mjs benchmarking/harness/README.md
git commit -m "feat: index redaction dev-round documents"
```

### Task 4: Run Current Engine On Dev Round

**Files:**
- Create: `benchmarking/harness/run-dev-round-engine.mjs`
- Create: `benchmarking/harness/run-dev-round-engine.test.mjs`
- Reuse: `benchmarking/harness/run-current-engine-entry.ts`
- Modify: `benchmarking/harness/README.md`

**Step 1: Write failing tests**

Test behavior:

- reads `model-input/document-index.json`;
- runs the current redaction engine for one or more levels;
- writes `engine-output/<level>.json`;
- stores `engineVersion`, document ids, review documents, counts, and entries;
- reconstructs original text from segments and warns if offsets drift.

Run:

```bash
npx vitest run benchmarking/harness/run-dev-round-engine.test.mjs
```

Expected: FAIL because the script does not exist.

**Step 2: Implement the script**

Follow the existing `score-current-engine.mjs` approach: bundle
`run-current-engine-entry.ts` with `esbuild`, execute it in a temp directory, and
write stable JSON output.

CLI shape:

```bash
node benchmarking/harness/run-dev-round-engine.mjs \
  --round-dir benchmarking/private/dev-rounds/2026-06-19-sec-correspondence \
  --levels light,balanced,heavy
```

**Step 3: Run tests and syntax check**

```bash
node --check benchmarking/harness/run-dev-round-engine.mjs
npx vitest run benchmarking/harness/run-dev-round-engine.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add benchmarking/harness/run-dev-round-engine.mjs benchmarking/harness/run-dev-round-engine.test.mjs benchmarking/harness/README.md
git commit -m "feat: run engine for redaction dev rounds"
```

### Task 5: Add Claude Annotation Runner

**Files:**
- Create: `benchmarking/harness/run-claude-annotator.mjs`
- Create: `benchmarking/harness/run-claude-annotator.test.mjs`
- Modify: `benchmarking/harness/README.md`

**Step 1: Write failing tests**

Test behavior with a mocked command runner:

- builds a prompt from `benchmarking/prompts/model-annotation-prompt.md`;
- includes suite/round id, document index, and document texts;
- calls `claude -p` exactly once for the batch;
- writes raw stdout to `annotations/claude.batch.json`;
- fails clearly if `claude` is unavailable or returns non-JSON.

Run:

```bash
npx vitest run benchmarking/harness/run-claude-annotator.test.mjs
```

Expected: FAIL because the script does not exist.

**Step 2: Implement the script**

CLI shape:

```bash
node benchmarking/harness/run-claude-annotator.mjs \
  --round-dir benchmarking/private/dev-rounds/2026-06-19-sec-correspondence
```

Do not call Claude from tests. Inject or mock the command runner.

**Step 3: Run tests and syntax check**

```bash
node --check benchmarking/harness/run-claude-annotator.mjs
npx vitest run benchmarking/harness/run-claude-annotator.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add benchmarking/harness/run-claude-annotator.mjs benchmarking/harness/run-claude-annotator.test.mjs benchmarking/harness/README.md
git commit -m "feat: add Claude annotator runner"
```

### Task 6: Add Codex Annotation Instructions

**Files:**
- Create: `benchmarking/prompts/codex-dev-annotation-prompt.md`
- Modify: `benchmarking/harness/README.md`

**Step 1: Draft the prompt**

The prompt should instruct a Codex pass or subagent to:

- annotate the exact Markdown source;
- stay blind to Claude annotations and engine output;
- use the same batch JSON shape as `model-annotation-prompt.md`;
- include both `redact` and important `keep` spans;
- output JSON only.

**Step 2: Manually verify consistency**

Compare labels and severity wording against:

```bash
sed -n '1,180p' benchmarking/prompts/model-annotation-prompt.md
```

Expected: same labels and compatible output shape.

**Step 3: Commit**

```bash
git add benchmarking/prompts/codex-dev-annotation-prompt.md benchmarking/harness/README.md
git commit -m "docs: add Codex dev annotation prompt"
```

### Task 7: Compare Annotations To Engine Output

**Files:**
- Create: `benchmarking/harness/compare-dev-round.mjs`
- Create: `benchmarking/harness/compare-dev-round.test.mjs`
- Reuse: `benchmarking/harness/score-utils.mjs`
- Modify: `benchmarking/harness/README.md`

**Step 1: Write failing tests**

Test behavior:

- loads `annotations/claude.batch.json` and `annotations/codex.batch.json`;
- validates exact span text against `model-input/doc-*.md`;
- builds a consensus/de facto issue set:
  - high-confidence agreement spans;
  - Claude-only spans;
  - Codex-only spans;
  - keep-span violations;
- compares consensus spans against `engine-output/<level>.json`;
- writes `comparison/engine-gap-report.json` and `comparison/round-summary.md`;
- groups misses by label, severity, action, and document category.

Run:

```bash
npx vitest run benchmarking/harness/compare-dev-round.test.mjs
```

Expected: FAIL because the script does not exist.

**Step 2: Implement the script**

Use existing `extractPredictedSpans`, `scoreDocument`, and
`summarizeSuiteScores` where possible. Keep raw snippets in private comparison
files only; committed tests must use invented fixtures.

CLI shape:

```bash
node benchmarking/harness/compare-dev-round.mjs \
  --round-dir benchmarking/private/dev-rounds/2026-06-19-sec-correspondence \
  --level balanced
```

**Step 3: Run tests and syntax check**

```bash
node --check benchmarking/harness/compare-dev-round.mjs
npx vitest run benchmarking/harness/compare-dev-round.test.mjs
```

Expected: PASS.

**Step 4: Commit**

```bash
git add benchmarking/harness/compare-dev-round.mjs benchmarking/harness/compare-dev-round.test.mjs benchmarking/harness/README.md
git commit -m "feat: compare dev annotations to engine output"
```

### Task 8: Create The Codex Skill

**Files:**
- Create: `/Users/guolite/.codex/skills/noai-redaction-dev-loop/SKILL.md`
- Create: `/Users/guolite/.codex/skills/noai-redaction-dev-loop/agents/openai.yaml`

**Step 1: Initialize the skill**

Use the skill creator helper:

```bash
python /Users/guolite/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  noai-redaction-dev-loop \
  --path /Users/guolite/.codex/skills \
  --interface display_name="NoAI Redaction Dev Loop" \
  --interface short_description="Run NoAI redaction-engine development rounds from supplied or public documents." \
  --interface default_prompt="Run a NoAI redaction development round using the provided or publicly sourced documents."
```

If the exact script path differs, locate it under
`/Users/guolite/.codex/skills/.system/skill-creator/scripts/`.

**Step 2: Write `SKILL.md`**

Include:

- trigger description for NoAI redaction development rounds;
- requirement to read `/Users/guolite/GitHub/NoAI/AGENTS.md`;
- two intake paths: user-supplied docs and agent-sourced public docs;
- public sourcing guidance: search for public business/legal documents with
  filled-in sensitive fields, fetch them into the dev round, and record URLs in
  the local manifest;
- exact round workflow using the harness scripts;
- annotation rule: Claude and Codex annotators see source Markdown only, not
  engine output or each other's annotations;
- implementation rule: convert findings into synthetic tests before engine
  patches;
- verification commands: `npm test`, `npm run build`,
  `node scripts/check-engine-version.mjs`;
- NAIR separation rule.

**Step 3: Validate the skill**

```bash
python /Users/guolite/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  /Users/guolite/.codex/skills/noai-redaction-dev-loop
```

Expected: PASS.

**Step 4: Commit repo references only**

The skill itself lives outside this repo. Do not commit it here. If README docs
in the repo mention the skill, commit only those docs.

### Task 9: End-To-End Smoke Round

**Files:**
- Temporary ignored files under `benchmarking/private/dev-rounds/smoke-*`
- No committed source documents

**Step 1: Create a tiny synthetic private round**

Use two invented `.md` documents under a smoke round's `source/` folder. Include
one email, one address, one person, one case reference, and one keep span.

**Step 2: Run the local scripts**

```bash
node benchmarking/harness/create-dev-round.mjs --round smoke-dev-loop --theme "smoke" --source-mode user
node benchmarking/harness/index-dev-round-docs.mjs --round-dir benchmarking/private/dev-rounds/smoke-dev-loop
node benchmarking/harness/run-dev-round-engine.mjs --round-dir benchmarking/private/dev-rounds/smoke-dev-loop --levels balanced
```

For the annotation steps, either use small hand-authored fixture annotation JSON
inside the ignored smoke folder or run `claude -p` if available.

Then run:

```bash
node benchmarking/harness/compare-dev-round.mjs --round-dir benchmarking/private/dev-rounds/smoke-dev-loop --level balanced
```

Expected: comparison files are produced under the ignored smoke folder.

**Step 3: Run full verification**

```bash
npm test
npm run build
node scripts/check-engine-version.mjs
```

Expected: PASS.

**Step 4: Clean private smoke files**

```bash
rm -rf benchmarking/private/dev-rounds/smoke-dev-loop
```

Expected: no private smoke artifacts remain.

### Task 10: Final Review

**Files:**
- Review all modified committed files

**Step 1: Check status**

```bash
git status --short
```

Expected: only intentional uncommitted changes, if any. Do not stage unrelated
pre-existing package or benchmark changes unless they are part of this plan.

**Step 2: Review docs for operator clarity**

Read:

```bash
sed -n '1,220p' benchmarking/harness/README.md
sed -n '1,220p' /Users/guolite/.codex/skills/noai-redaction-dev-loop/SKILL.md
```

Expected: a future Codex session can run the loop from user-supplied or public
documents without rediscovering the process.

**Step 3: Final report**

Report:

- skill path;
- scripts added;
- verification results;
- how to run the first real round;
- any deferred limitations, especially PDF/DOCX extraction if not implemented.
