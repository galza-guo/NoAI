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

## Required Workflow

1. Inspect the current engine/rules/tests before editing.
2. Run the current engine on the development documents.
3. Identify omissions and harmful over-redactions.
4. Convert generalizable findings into synthetic tests in
   `src/redactor/engine.test.ts`.
5. Patch only engine-related files unless explicitly instructed otherwise.
6. Update `src/redactor/version.ts` for engine behavior changes:
   - bump `ENGINE_VERSION` for shared engine/API/review-metadata changes;
   - bump `GENERAL_RULES_VERSION` for English/general rule changes;
   - bump `CHINESE_RULES_VERSION` for Chinese rule changes.
7. Update `docs/engine-changelog.md`.
8. Run:
   - `npm test`
   - `npm run build`
   - `node scripts/check-engine-version.mjs`

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

- Behavior changed.
- Tests added.
- Version bump.
- Verification results.
- Residual risks.
- Any files intentionally not touched.
