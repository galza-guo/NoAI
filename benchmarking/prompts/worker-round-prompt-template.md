# Engine Refinement Worker Prompt Template

You are refining NoAI's deterministic redaction engine.

NoAI is a browser-only, rule-based redaction tool. Do not add AI calls,
backend uploads, telemetry, or opaque dependencies to the redaction path.

## Critical NAIR Benchmark Rule

You must not inspect, request, infer from, or tune against the sealed NAIR
benchmark suite. NAIR documents, gold annotations, model proposals, and
span-level benchmark failures are off limits.

Use only the development corpus supplied for this round and the existing
synthetic regression tests.

## Worktree Guardrails

This prompt is for English/general ruleset development only.
Long-running English/general rule-development rounds should run in the
persistent English/general rule worktree described in
`docs/rule-worktree-workflow.md`. Stay in that lane.

- Do not modify UI, file readers, benchmark harnesses, package scripts, or
  shared infrastructure unless the user explicitly asks.
- Treat `src/redactor/engine.test.ts`, `src/redactor/version.ts`, and
  `docs/engine-changelog.md` as shared conflict points.
- Do not run broad searches over `benchmarking/private/**` or
  `benchmarking/suites/**` while writing rules.
- You may commit in this rule worktree at the end of each accepted loop, and may
  run multiple loops with one commit per accepted loop. The main worktree
  integration agent reviews and merges/squashes/cherry-picks accepted work; do
  not merge this branch into `main`.

## Round Goal

Improve general redaction behavior for:

`<round-theme>`

Use the supplied development documents only as examples of general patterns.
Do not add corpus-specific allowlists or one-off rules unless the rule is
clearly general and auditable.

## Overarching Optimization Goal

Improve robustness for unseen business/legal documents in general. The supplied
documents are examples that reveal possible weaknesses; they are not targets to
fit. Every rule should explain the broader pattern it covers and the
counterexamples it must avoid.

Read `benchmarking/rejected-patterns.md` before proposing changes. It records
what past rounds got rejected for and why. If a planned change resembles a
rejected pattern, redesign it or justify explicitly why it does not repeat the
mistake.

## Two Change Lanes

Declare every change in your round report as one of two lanes:

- **Vocabulary lane**: positive label strings added to existing detector
  families (label lists and suffix tables). Lower risk, cheap to audit, and can
  be batch-merged. A vocabulary entry must still be a plausible label — not a
  generic everyday word used bare.
- **Logic lane**: new detectors, new guards/suppressions, validator changes,
  priority changes, regex rewrites, and suppressive/negative vocabulary such
  as stopword entries. High risk: a stopword can suppress a real name and
  cause a leak. At most ONE logic change per round, with at least one positive
  synthetic test, one counterexample, and a clean gate run at every level with
  an accepted baseline (currently Balanced).

Never bundle a logic change and vocabulary additions so tightly that they
cannot be kept or reverted separately.

## Metrics Discipline

- The dev-round headline target is the annotator-consensus spans from
  `compare-dev-round.mjs`. Single-annotator spans are leads: triage them with
  judgment, and drop the ones that look like one model's idiosyncrasy. Do not
  chase union recall.
- Overlapping label/severity disagreements also require judgment and are not
  headline targets. Prediction support reports confirmed, uncertain, and
  unsupported redactions; do not treat lead/disagreement support as a false
  positive.
- Prioritize critical/high-severity consensus misses over low-severity ones.

## Required Workflow

1. Inspect the current engine/rules/tests before editing.
2. Run the current engine on the development documents.
3. Identify omissions and harmful over-redactions.
4. Convert generalizable findings into synthetic tests in
   `src/redactor/engine.test.ts`.
5. Patch only engine-related files unless explicitly instructed otherwise.
6. Update `src/redactor/version.ts` for redaction behavior changes:
   - bump `GENERAL_RULES_VERSION` for English/general ruleset-only changes;
   - do not bump `ENGINE_VERSION` for English/general ruleset-only changes,
     even if the patch touches `src/redactor/engine.ts` for rule plumbing;
   - bump `ENGINE_VERSION` only for shared engine/API/review-metadata changes
     that are not just one language ruleset changing.
7. Update `docs/engine-changelog.md`.
8. Run:
   - `npm test`
   - `npm run build`
   - `node scripts/check-engine-version.mjs`
9. Score the sealed suite and run the hard gate before ending the round:
   - `node benchmarking/harness/score-current-engine.mjs --suite <suite> --level balanced --out <round-dir>/score/candidate-balanced.json --no-history`
   - `node benchmarking/harness/gate-dev-round.mjs --baseline <accepted-score-balanced.json> --candidate <round-dir>/score/candidate-balanced.json`
   - Repeat scoring and gating for any additional level that has an accepted
     baseline; Balanced is the only required level until those baselines exist.
   - If the gate FAILS, revert the round (or reduce it until the gate passes)
     before reporting. Do not start another loop on top of an ungated or
     failing round. `PASS WITH WARNINGS` requires explicit integrator review
     before continuing; only a clean `PASS` may advance unattended. Never
     inspect NAIR documents to fix a gate result — the gate output is
     aggregate-only and that is all you may use.

## Anti-Overfit Requirements

- Keep identifiers label-bound when bare values are ambiguous.
- Add counterexamples for every broad rule.
- Preserve legal/business boilerplate unless it is genuinely sensitive.
- Prefer several general examples over one document-specific phrase.
- Reject changes that only improve the supplied sample while making behavior
  less reliable for other business/legal document types.
- Do not commit raw development documents.
- Delete temporary probe scripts and scratch corpora before finishing.

## Final Report

Report:

- Behavior changed, split by lane (vocabulary vs logic).
- Tests added.
- Version bump.
- Verification results.
- Gate result (`PASS`, `PASS WITH WARNINGS`, or `FAIL`) with the gate report
  summary and any required integrator decision.
- Leads and disagreements triaged: which uncertain spans you accepted,
  rejected, or deferred, and why.
- Residual risks.
- Any files intentionally not touched.
