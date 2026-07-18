# Dev-Loop Safety Tightening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make dev-round metrics annotator-neutral and make the accepted-baseline gate fail safely.

**Architecture:** Pair annotations symmetrically and score their shared intersection, while reporting disagreements and lead-supported predictions separately. Add structural and fingerprint comparability checks to the gate, then align the operating documentation with the stricter behavior.

**Tech Stack:** Node.js ES modules, Vitest, TypeScript/Vite documentation and harness scripts.

---

### Task 1: Neutral consensus and prediction support

**Files:**
- Modify: `benchmarking/harness/compare-dev-round.test.mjs`
- Modify: `benchmarking/harness/compare-dev-round.mjs`

1. Add a test that runs the same boundary-shifted annotations in both annotator orders and expects identical consensus boundaries and scores.
2. Run the targeted test and confirm it fails because the first annotator currently supplies the scored boundary.
3. Add deterministic symmetric pairing, intersection boundaries, and disagreement reporting.
4. Add a test where the engine covers a single-annotator lead and expect uncertain support rather than unsupported output.
5. Run the targeted test and confirm it fails under consensus-only prediction support.
6. Add confirmed, uncertain, and unsupported prediction-support totals and precision bounds.
7. Run the comparison tests and confirm they pass.

### Task 2: Fail-closed gate

**Files:**
- Modify: `benchmarking/harness/gate-dev-round.test.mjs`
- Modify: `benchmarking/harness/gate-dev-round.mjs`

1. Add tests requiring zero-loss defaults, rejection of changed benchmark totals, and rejection of invalid numeric options.
2. Run the gate tests and confirm the new cases fail.
3. Set strict defaults and validate report/config structure before comparison.
4. Add `PASS WITH WARNINGS` rendering for non-regression warnings.
5. Run the gate tests and confirm they pass.

### Task 3: Suite fingerprint

**Files:**
- Modify: `benchmarking/harness/score-current-engine.mjs`
- Modify or create test coverage for score report identity as appropriate.
- Modify: `benchmarking/harness/gate-dev-round.mjs`

1. Add a test showing different present suite fingerprints are rejected.
2. Run it and confirm it fails.
3. Hash the normalized document index and gold annotation payloads into new score reports.
4. Compare present fingerprints in the gate; warn when both legacy reports lack them.
5. Run targeted tests.

### Task 4: Process alignment

**Files:**
- Modify: `benchmarking/harness/README.md`
- Modify: `benchmarking/process.md`
- Modify: `benchmarking/prompts/worker-round-prompt-template.md`
- Modify: `benchmarking/rejected-patterns.md`
- Modify: `docs/engine-audit-2026-07-07-dev-loop.md`
- Modify: `/Users/guolite/.agents/skills/noai-redaction-dev-loop/SKILL.md`

1. Document strict defaults, warning adjudication, consensus intersections,
   disagreements, and precision bounds.
2. Reclassify stopword additions as logic/negative-vocabulary changes.
3. Replace the premature three-level requirement with all levels having an
   accepted baseline, currently Balanced.

### Task 5: Verification

1. Run targeted harness tests.
2. Run `npm test` and confirm all tests pass.
3. Run `npm run build` and confirm the production build succeeds.
4. Run `node scripts/check-engine-version.mjs` and confirm version metadata is valid.
5. Run `git diff --check` and inspect `git diff` and `git status --short`.
