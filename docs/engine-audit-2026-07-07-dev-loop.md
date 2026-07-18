# NoAI Ruleset & Dev-Loop Audit — 2026-07-07

**Scope:** English/general and Chinese rulesets (sampled, not exhaustive), the
NAIR benchmark process, and the self-evolving dev loop — specifically why
recent loop output was mostly rejected at audit.
**Engine at audit time:** 1.6.0 (general r32, chinese r24).
**Companion changes:** this audit landed alongside a Chinese ruleset bug fix
(chinese r25), a hard round gate (`benchmarking/harness/gate-dev-round.mjs`),
a consensus-based rework of `compare-dev-round.mjs`, the
`benchmarking/rejected-patterns.md` gallery, and process/prompt/skill updates.

---

## 1. Ruleset findings (both languages)

### 1.1 Label-list monoculture

Nearly all recent growth is per-domain label vocabulary: mortgage (NMLS, Loan
ID), clinical (NPI, NCT, MRN), federal procurement (CAGE, UEI, DUNS), Chinese
VAT-invoice signers, physician labels, HR family-relation labels. The English
engine has ~116 direct patterns and ~50 line-label patterns across 22
detectors; Chinese `PERSON_LABELS` alone is ~140 entries. Each addition is
individually defensible, but the aggregate is an unbounded lookup table whose
coverage equals the list of domains dev rounds happened to visit. There is no
coverage map, so unvisited domains predictably leak, silently.

### 1.2 Collision-guard whack-a-mole

Roughly 30 comments in `engine.ts` document the "X was mislabeled PHONE" fix
class. The generic phone regex is too greedy, and each collision is patched
with another suppression guard (`CHINESE_REF_LABEL_BEFORE_PHONE_RE` enumerates
18 labels). The root causes — a permissive phone pattern and an undocumented
`KIND_PRIORITY` ranking — remain unfixed. The June 19 audit's recommendation
to document the priority rationale was never completed.

### 1.3 Stopword classifier, second generation

The corpus-specific `KNOWN_ORGS`/`MATTER_TERMS` baggage flagged on June 19 was
removed (good). But `CONTRACT_DEFINED_TERM_TOKENS` (~670 entries) keeps
growing round-over-round, duplicates whole blocks of `ORG_NAME_TAIL_TOKENS`
(sync hazard), contains literal duplicates ("Bonus" twice), and still carries
arbitration-era leftovers ("Phoenix", "China", "Mainland" in
`SINGLE_PERSON_STOPWORDS`). It is a manually trained classifier with no
coverage guarantees.

### 1.4 All tuning happens at Balanced

Aggregate scores show the other levels are unvalidated promises: Chinese Light
span recall 9.9%; Chinese Heavy keep-clean 15.8%; English Heavy precision 35%.
No round gates on Light/Heavy.

### 1.5 Concrete bug found by sampling (now fixed, chinese r25)

`chinese.ts` date-numeral classes contained 染 (dye) where 柒 (formal seven)
belongs, so 大写 dates containing a seven (e.g. 贰零贰柒年) silently failed to
match. The amount class next to it was correct. The fix added a property-style
test exercising every 大写 digit in date positions. Lesson: label/character
tables need generated or property tests, not just hand-picked examples.

### 1.6 The structural ceiling is documented but was ignored

The Chinese loop's own final summary identified bare person/org/address names
in narrative prose as the structural ceiling (ORG recall unchanged at 36.8%
across rounds). English balanced recall moved 68.4% → 69.7% over ~25 rounds.
The remaining NAIR gap is mostly material that label-bound determinism
deliberately does not attempt. More labels cannot move it.

---

## 2. Why the dev loop stopped producing keepable results

Timeline (NAIR-v2 balanced span recall): flat at 68.4% for r8–r14; 69.6% at
r20; 69.7% at r32 — which hid an ORG-category regression visible only in the
by-label breakdown; then r33–r34 collapsed to 54.5%. The r32–r35 batch was
rejected wholesale; only r21–r31 were integrated.

1. **Saturation.** Early rounds harvested general fruit; later rounds found
   only narrow domain gaps. Marginal generality fell, so audit rejection rates
   rose. Nothing told the loop the seam was exhausted.
2. **Worker gate weaker than auditor gate.** Workers checked one aggregate
   number; the auditor read per-label movement. When acceptance is coarser
   than rejection, rejects are structurally guaranteed. Regressions were even
   recorded in score history while loops continued on top of them.
3. **Noisy target.** Dev-round recall was scored against the union of two LLM
   annotators keyed by exact offsets — inflating targets with per-model
   idiosyncrasies and boundary noise. Chasing union recall produced exactly
   the narrow rules audits reject.
4. **Asymmetric reward.** With ~957 gold spans, a good narrow rule moves
   recall ~0.1% (invisible) while one bad guard can cost 15 points. Wins were
   undetectable, losses compounded — long unsupervised chains drift downward.
5. **Throughput incentives.** One commit per loop, ~20 rounds in two days at
   peak, no small-batch integration. Quality collapsed exactly when cadence
   peaked.

---

## 3. Changes landed with this audit

| Change | Where |
| --- | --- |
| Hard round gate (per-label/severity/category/keep/precision, stop-the-line) | `benchmarking/harness/gate-dev-round.mjs` (+ tests) |
| Symmetric consensus-based dev-round target, disagreement/lead triage, prediction-support range | `benchmarking/harness/compare-dev-round.mjs` (+ tests) |
| Rejected-patterns gallery (loop feedback memory) | `benchmarking/rejected-patterns.md` |
| Gate + cadence + two-lane rules in governance | `benchmarking/process.md` |
| Worker prompts: lanes, metrics discipline, gate step, gallery | `benchmarking/prompts/worker-round-prompt-template.md`, `chinese-engine-worker-round-prompt-template.md` |
| Dev-loop skill runbook updated to match | `~/.agents/skills/noai-redaction-dev-loop/SKILL.md` |
| 染/柒 date-class bug fix + property test (chinese r25) | `src/redactor/chinese.ts`, `engine.test.ts` |

### Operating rules now in force

- Gate every round against the last **accepted** baseline report with zero-loss
  defaults and suite-identity checks; a failing gate reverts the round, while
  `PASS WITH WARNINGS` requires explicit integrator review before the next loop.
- On acceptance, snapshot the candidate score report as
  `reports/accepted-score-<level>.json`.
- Two lanes per round: unlimited positive label vocabulary, at most one logic
  change (including suppressive stopwords), separable in the diff.
- Integrate every 3-5 accepted loops.
- Record every rejection in the gallery; worker prompts include it.
- Saturation rule: flat category ⇒ stop label-mining it, file as structural.

### Post-review tightening — 2026-07-13

- Consensus matching is symmetric and scores the annotators' shared
  intersection; swapping annotator roles cannot change recall. Label/severity
  disagreements are triaged separately.
- Prediction support distinguishes confirmed, uncertain (lead or
  disagreement-backed), and unsupported redactions instead of treating every
  non-consensus detection as a false positive.
- Gate tolerances default to zero. Changed benchmark targets and invalid
  options are configuration errors; score reports include a suite fingerprint.
  Explicitly tolerated losses return `PASS WITH WARNINGS` and stop unattended
  loops for integrator review.
- Stopword additions are suppressive logic changes, not unlimited low-risk
  vocabulary.

---

## 4. Remaining recommendations (not done here)

1. **Document `KIND_PRIORITY` rationale** and add per-kind conflict tests;
   revisit the greedy phone regex instead of adding more suppression guards.
2. **Dedupe/normalize stopword sets** (`CONTRACT_DEFINED_TERM_TOKENS` vs
   `ORG_NAME_TAIL_TOKENS`; remove arbitration-era leftovers) behind
   regression tests.
3. **Move label vocabularies into data tables** with a lint (min length,
   generic-word denylist) and a generated fire-test per label.
4. **Score Light/Heavy in the gate** once accepted baselines exist for those
   levels; Chinese Heavy is currently unusable (15.8% keep-clean).
5. **NAIR-v3**: more documents per category for signal sensitivity; consider
   a rotation of held-out documents.
6. **Structural gap** (bare names in prose): treat as an architecture
   research question on the main thread — candidate directions include
   document-structure awareness (headers/tables/signature blocks) and
   cross-document alias propagation, not more labels.
