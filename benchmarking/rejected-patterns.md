# Rejected Patterns Gallery

This file is the dev loop's institutional memory. Every worker round prompt
includes it. When an integrator rejects or reverts a round (or part of one),
add an entry here explaining what was rejected and why, in general terms — no
sealed benchmark details, no span-level NAIR data, no raw dev-document facts.

Read this before proposing engine changes. If your planned change resembles a
rejected pattern, either redesign it or explain in your round report why it
does not repeat the mistake.

## How to add an entry

- Date, ruleset (English/general or Chinese), round id(s).
- What the change did, in one or two sentences.
- Why it was rejected (aggregate evidence only).
- The general lesson, phrased so a future worker can act on it.

## Rejected

### 2026-06-22 — English r32-r35: guard/logic changes rode along with vocabulary and regressed ORG recall

- What: r32 bundled new label vocabulary with detector-logic changes. One of
  the logic changes suppressed organization detection in contexts broader than
  the dev-round documents that motivated it. r33-r35 kept building on top.
- Why rejected: aggregate NAIR-v2 showed an ORG-category recall regression at
  r32 while overall span recall looked flat (+0.1pp). By r34 overall balanced
  span recall had collapsed from 69.7% to 54.5%. The whole batch was excluded
  at integration; only r21-r31 were accepted.
- Lesson 1: overall recall hides per-label damage. Gate every round with
  `gate-dev-round.mjs` (per-label, per-severity, per-category) before starting
  the next loop, and stop the line on FAIL — do not keep looping on top of an
  ungated round.
- Lesson 2: do not bundle logic changes (new guards, detector rewrites,
  priority changes) with vocabulary additions in one round. Vocabulary is
  cheap to audit and partially keep; a bundled logic regression forces the
  auditor to ditch everything.

### 2026-06-21 — English: bare-domain URL detection ("kraken.com" without scheme)

- What: proposed a word.tld rule so schemeless domains redact as URLs.
- Why rejected: a bare `word.tld` pattern is too risky for general prose —
  file names ("report.pdf"), version strings ("1.0"), and ordinary references
  ("python.org-style docs") over-redact. Scheme-prefixed URLs are already
  caught.
- Lesson: a distinctive-format anchor must actually be distinctive in
  ordinary business prose, not just in the dev-round documents. When the
  false-positive surface is open-ended, keep the value label-bound.

### Standing rejections (pattern classes, not single rounds)

- Corpus-specific entity dictionaries (`KNOWN_ORGS`-style lists) and one-off
  literal phrases from a dev document. Removed once already; do not
  reintroduce.
- Rules justified only by "the label is the trust anchor" where the label is
  a generic everyday word (e.g. 2-char Chinese function words like 经办 /
  复核 used bare). A label anchor must be unambiguous as a *label*, not just
  present in the sample.
- Turning an annotator's idiosyncratic span into a rule without checking the
  other annotator. Single-annotator spans are leads, not findings; headline
  dev metrics score consensus spans only.
- Score-chasing changes that raise one narrow category while making general
  behavior less predictable (broad new guards, loosened validators without
  counterexamples).

## Accepted-with-caution (watch list)

- Aggressive growth of `CONTRACT_DEFINED_TERM_TOKENS` and other stopword sets:
  each entry risks suppressing a real name. Before adding a token, check it is
  not a plausible surname/given name and note the collision check in the round
  report. Stopword additions are suppressive logic changes, not unlimited
  low-risk vocabulary; they consume the round's one logic-change allowance.
- New generic-word Chinese labels in `PERSON_LABELS` (e.g. 员工, 代表): keep
  them separator-bound (label + colon forms) and add a prose counterexample
  test showing the bare word does not trigger.
