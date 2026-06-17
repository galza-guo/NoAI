# Redaction Benchmark Scaffold Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a benchmark governance scaffold for sealed NoAI redaction-engine evaluation.

**Architecture:** Keep benchmark process, schemas, prompts, and validation scripts in `benchmarking/`. Keep actual benchmark documents, proposals, gold annotations, and reports in gitignored local folders.

**Tech Stack:** Markdown docs, JSON Schema, Node.js standard library scripts.

---

### Task 1: Add Benchmark Privacy Boundaries

**Files:**
- Modify: `.gitignore`
- Create: `benchmarking/private/.gitignore`
- Create: `benchmarking/suites/.gitkeep`

**Steps:**
1. Add ignore rules for `benchmarking/private/*` while allowing its `.gitignore`.
2. Ignore suite subfolders containing documents, extracted text, PDFs, model proposals, gold annotations, and reports.
3. Keep `benchmarking/suites/.gitkeep` committed so the local suite root exists.

**Verification:**
Run `git status --short` and confirm future private benchmark artifacts would be ignored.

### Task 2: Add Governance Documentation

**Files:**
- Create: `benchmarking/README.md`
- Create: `benchmarking/process.md`
- Create: `docs/plans/2026-06-17-redaction-benchmark-governance-design.md`

**Steps:**
1. Document the sealed-exam rule.
2. Distinguish regression tests, development corpora, and benchmark suites.
3. Define contamination and suite-versioning rules.
4. Document the standard round-evaluation workflow.

**Verification:**
Read the docs and confirm they do not instruct workers to inspect benchmark failures.

### Task 3: Add Schemas

**Files:**
- Create: `benchmarking/schemas/annotation.schema.json`
- Create: `benchmarking/schemas/benchmark-manifest.schema.json`

**Steps:**
1. Define annotation files with `redact` and `keep` actions.
2. Define suite manifests with document categories, hashes, local paths, and contamination status.
3. Use character spans and exact span text.

**Verification:**
Run JSON parsing checks against both schema files.

### Task 4: Add Prompt Templates

**Files:**
- Create: `benchmarking/prompts/model-annotation-prompt.md`
- Create: `benchmarking/prompts/adjudication-prompt.md`
- Create: `benchmarking/prompts/worker-round-prompt-template.md`

**Steps:**
1. Give frontier models one uniform annotation schema.
2. Give adjudicators rules for creating gold annotations.
3. Give refinement workers strict benchmark non-contamination rules.

**Verification:**
Review prompts for schema consistency and benchmark isolation.

### Task 5: Add Local Validation Script

**Files:**
- Create: `benchmarking/harness/README.md`
- Create: `benchmarking/harness/validate-annotation-file.mjs`

**Steps:**
1. Validate required annotation fields.
2. Validate labels, actions, severities, offsets, and duplicate IDs.
3. If source text is supplied, verify SHA-256 and exact span text.

**Verification:**
Run:

```bash
node --check benchmarking/harness/validate-annotation-file.mjs
node benchmarking/harness/validate-annotation-file.mjs
```

Expected: syntax check passes; no-argument run prints usage.
