# NoAI Redaction Engine — A First-Principles Audit

**Date:** 2026-06-19
**Engine version reviewed:** 1.4.6 (`src/redactor/version.ts`)
**Method:** Full read of `engine.ts` (3,646 lines), `rules.ts` (1,329 lines), `chinese.ts` (1,089 lines), `types.ts` (137 lines), `engine.test.ts` (3,788 lines), `docs/engine-changelog.md` (26 versions), and the benchmarking harness (`benchmarking/harness/README.md` + script inventory). No AI in the redaction path.

**Relation to the two prior audits.** This report is a third cut. It agrees with the diagnosis in `engine-audit-2026-06-19.md` and with most of the pushback in `engine-audit-2026-06-19-response.md`. Its contribution is different: it asks *what problem this engine is actually solving*, names the first principle the code already embodies, and re-roots every recommendation in that principle and in the `AGENTS.md` brief. It also foregrounds something both prior audits underweighted — the benchmarking harness — as the real strategic asset.

---

## 0. The thesis, up front

**Sensitive-value detection without an oracle is an information-theoretic problem, and NoAI has already found the right answer for its constraints.**

An ML redactor or a backend that holds a known-PII database has an oracle: it can ask "is this string a real person?" and trust the answer. NoAI has neither, by charter (`AGENTS.md`: no AI in the path, no uploads, no backend that sees contents). Without an oracle, the only honest way to decide whether `12345678` is a bank account, a quantity, a statute section, or a page number is to look at the **evidence around it**. The engine's central design choice — *identifiers are bound to the textual evidence that licenses them* — is not a workaround for the lack of an oracle. It is the **optimal response** to that lack.

Call this the **context-gating principle**: *a candidate becomes a redaction only when the local text produces enough independent evidence to license it, and every redaction must carry a human-readable record of that evidence.*

Once you accept that principle, most of the "problems" in the prior audits dissolve into consequences, and the real strategic question becomes clear and answerable: **how does NoAI compound precision over time without becoming an ML system or an opaque one?** The answer is in the repo already — it is the benchmarking harness — and this report is mostly an argument for making that harness the center of gravity.

---

## 1. What the engine actually is

Strip away the 3,600 lines and the engine is four things, in this order:

1. **An evidence collector.** A battery of detectors (`detectDirectPatterns`, `detectLabelValues`, `detectPeople`, `detectOrganizations`, `detectChinese`, …) each turn a piece of local textual evidence (a label, a title, a checksum, a verb, a suffix, a structural position) into a *candidate* with a `reason` string that names the evidence (`engine.ts:446-469`). The `reason` field is not decoration; it is the audit trail the context-gating principle demands.

2. **A confidence surface, expressed as three integer levels.** Light / Balanced / Heavy (`types.ts:3-7`) are not "settings." They are a **precision/recall frontier the user can walk along**: Light accepts only the highest-evidence candidates (`minLevel: 1`); Heavy accepts weak ones (`minLevel: 3`) at the cost of readability. Every candidate carries its own `minLevel`, so the frontier is per-evidence-type, not global. This is a clean, auditable stand-in for the confidence scores a probabilistic system would use — and it is strictly more inspectable.

3. **A consistency resolver.** When the same surface string is licensed by two different evidence types, `finalizeCandidates` (`engine.ts:2967-3007`) and `KIND_PRIORITY` (`engine.ts:253-282`) pick one winner so the reader sees one stable token. This is where "inspectable" gets hard, because the resolution rules are implicit.

4. **A span layout engine.** `buildSegments` (`engine.ts:3486-3580`) resolves overlapping matches into a non-overlapping set of redacted spans with a documented priority (manual > Latin > longer-wins). This is the part that produces the actual Markdown.

Everything else — the 80+ regexes, the 1,300 lines of stopword sets, the alias machinery — is content *inside* these four layers. The architecture is sound. The question is never "is the architecture wrong"; it is "which layer is being asked to carry weight it wasn't designed for."

---

## 2. The genius, named precisely

### 2.1 Label-binding is precision maximization under a no-oracle constraint

The single most important line of reasoning in the whole codebase is the comment pattern that repeats across the label-bound detectors: *"The label anchor is required because a bare number is usually a figure."* (e.g. `engine.ts:753-758`, `898-904`, `950-961`, `1014-1023`). This is the context-gating principle made operational.

The payoff is enormous and quantifiable: it is the reason a table of quantities, a list of statute sections, and a column of version numbers all survive a Balanced-level pass. A shape-based detector (any 8-digit number is an account) would recall more accounts and shred every table in every document. The engine instead trades a *known, bounded* recall loss (bare numbers in prose leak) for a *near-elimination* of the worst false-positive class. Given the product's promise — *trust* — that is the correct trade. **Preserve this at all costs. Any future change that weakens label-binding to chase bare-number recall is moving away from the product's core value.**

### 2.2 Checksums are the engine's purest expression

`isValidUscc` (`chinese.ts:442`) and `isValidPrcId` (`chinese.ts:455`) are the cleanest things in the repo. A checksum is an oracle you carry with you: it turns a *shape match* into a *proven match* without any backend and without any ML. The PRC ID validator goes further and rejects embedded dates outside 1900–2099 (`chinese.ts:464`), which the changelog credits with cutting the bare-PRC-ID false-positive rate from ~9% to ~0.03%. **That is the model for every future "bare X" detector**: never go bare unless you have a mathematical guard of comparable strength. The engine already states this discipline in its deferrals — HK ID and HK BR bare detection are deliberately off (`chinese.ts:198-201`, `764-768`) precisely because their checksums are unverified. That is the right call, and it should be written down as a rule, not just lived as a habit.

### 2.3 The alias system is the one place the engine does *evidence combination*

`addPersonAliases` (`engine.ts:2786-2965`) is the most advanced subsystem and the template for the engine's future. A full name like "Michael Hollan Messinger" is licensed once (by a title, a signature block, a witness verb). From that single strong license, the engine *derives* weaker surface forms — surname-only ("Messinger"), given-name ("Michael"), first+last ("Michael Messinger"), title+surname ("Mr. Messinger") — and then re-licenses each derived form **only when a second, independent piece of evidence appears near it** (a communication verb, a response heading, a witness verb). The `isAliasToken` filter (`engine.ts:2808-2811`) and the `AMBIGUOUS_PERSON_TOKENS` guard stop common words from being promoted.

This is the deep idea: **one strong signal licenses an identity; a derived surface form of that identity is re-licensed only by a second independent signal.** It is Bayesian update expressed in deterministic code, and it is why the alias system can redact "Messinger said…" without redacting every capitalized word in the document. No other subsystem does this. *Most of the engine's future improvement is generalizing this pattern to other candidate types.* (See §6.4.)

### 2.4 The level system is an inspectable confidence frontier

Because every candidate carries `minLevel` and a `reason`, a user (or auditor) can answer "why was this redacted at Balanced?" by reading one string. A scoring model would replace that string with a float and a tunable threshold — strictly less auditable, in direct tension with `AGENTS.md`'s "Prefer explicit rule-based logic over opaque dependencies." The three-level system is the correct abstraction for this product. The prior-response audit is right to defend it; this audit goes further and says it should be *celebrated as a feature*, not apologized for.

---

## 3. Where the engine departs from its own principle

These are the genuine problems. Each is a case where the engine is either (a) violating the context-gating principle, (b) hiding the evidence trail the principle requires, or (c) carrying weight that belongs in a different layer.

### 3.1 Corpus-specific data is a *trust* defect, and it is the only finding that touches the product's core value — VIOLATION of context-gating

`KNOWN_ORGS` (`rules.ts:254-306`, 51 entries), `MATTER_TERMS` (`rules.ts:311-398`, 86 entries), and `CORPUS_LOCATIONS` (`rules.ts:424-435`, 10 entries) are not evidence. They are a **lookup table seeded from one arbitration matter**. When the engine redacts a case-specific project or matter term, no local textual evidence licensed that redaction — a hardcoded memory of a past case did.

This breaks the context-gating principle in the most dangerous way: silently. A user redacting an unrelated document cannot tell that a term was redacted because it appears in a list, not because the text around it licensed it. The `reason` field says `"known organization"` (`engine.ts:2482`) — accurate, but a user who doesn't read source has no way to know that list exists, or that it came from someone else's arbitration.

The file's own comments already confess the debt (`rules.ts:252-253`: *"Consider moving these into an opt-in config when generalizing further"*; `rules.ts:422-423`: same). This is the **single highest-leverage change in the whole report**, and it is roughly one day of work. Everything else in §6 is optional; this one is not. See §6.1.

### 3.2 `KIND_PRIORITY` is an undocumented evidence-trail — HIDES the audit trail

The principle demands that every redaction carry a readable record of its evidence. `KIND_PRIORITY` (`engine.ts:253-282`) silently overrules that record whenever two evidence types collide. Why does `NATIONAL_ID` (1) beat `BANK_ACCOUNT` (2)? Why does `CASE_REF` (8) beat `ADDRESS` (14)? Why is `PERSON` (26) near the bottom, so a name that *also* matches a date regex is classified as a date?

Each of those orderings encodes a real belief about which evidence is more specific. None of them is documented, and none has a test that would fail if the ordering were changed. The PHONE guard at `engine.ts:501-510` (the ZIP+4 / SEC-file-number carve-outs) is a quiet acknowledgement of the problem: the priority ordering already misfires often enough that ad-hoc escape hatches had to be bolted onto the `add()` method. **This is the "inspectability" tax coming due.** The fix is cheap and the cost of not fixing it grows with every new detector. See §6.2.

### 3.3 The hot paths are quadratic, and the product's roadmap will find them — LAYER misplacement

`hasStrongerCandidate` (`engine.ts:3150-3157`) and `hasStrongerNonPersonCandidate` (`engine.ts:3159-3166`) do a full linear scan of *all candidates* for *each* proper-noun and person candidate, inside `finalizeCandidates`, which is already iterating all candidates. That is O(n²). `addPersonAliases` (`engine.ts:2838-2964`) re-scans every document for every surname, every given name, and every first+last alias — O(documents × aliases). `buildSegments` (`engine.ts:3536-3549`) allocates a boolean array the length of the *transformed text* and walks every span's range to test occupancy — O(spans × average span length), and the allocation is per-document.

None of this matters at 5–50 KB. All of it matters at the product's stated direction (`AGENTS.md`: *"Batch processing and combined Markdown export are core features, not extras"*). A 100-document batch of 100 KB each is already in the regime where `addPersonAliases` and `finalizeCandidates` will dominate. **This is not premature optimization — the product roadmap explicitly names the load case.** The fixes are mechanical (an inverted index from normalized-value → candidate-ids turns both `hasStronger*` calls into O(1); the alias scan can be value-keyed rather than alias-keyed). See §6.5.

### 3.4 Detection, finalization, and span-resolution are coupled in one file — LAYER misplacement

`engine.ts` contains (a) evidence collection, (b) cross-candidate consistency resolution, (c) token assignment, (d) level-policy transforms (chronology, contact-quarantine), (e) span layout, and (f) the public `redactDocuments` entry point. These are six distinct responsibilities with six distinct reasons to change, and they share mutable state (`this.candidates`, `this.exactIndex`, `this.normIndex`).

This is *not* the crisis the first audit made it sound like — 3,600 lines is a normal size for a real parser, and the code is in fact being maintained (26 shipped versions in three days, tests passing, clean module boundary for Chinese). But it *is* the reason two specific good things are hard:

- **You cannot unit-test a validator.** `looksLikePersonName` (`engine.ts:3017-3148`), `isValidSignatureName` (`engine.ts:2371-2388`), and `looksLikeContractDefinedTermCandidate` (`engine.ts:330-396`) are pure functions called from many detectors, and the test suite (`engine.test.ts`) can only reach them end-to-end through `redact()`. Every tuning change risks a regression the suite will catch late and explain poorly.
- **You cannot reason about detector interaction.** When a new label-bound rule is added, its author has to hold the entire `KIND_PRIORITY` table, the `finalizeCandidates` suppression passes, and the `buildSegments` span priority in their head to predict behavior. The coupling is what makes the priority table feel brittle.

The right move is **not** the full plugin rewrite the first audit proposed (the response audit is correct that this is a rewrite, not a refactor, because of the shared state). The right move is a **surgical extraction**: pull the *pure validators* out into `src/redactor/validators/` first, with their own unit tests. That recovers 80% of the testability benefit at ~5% of the risk, and it makes every later refactor cheaper. See §6.3.

### 3.5 The test suite is excellent at *regression* and weak at *guarantee* — LAYER misplacement in tests

The suite is well-organized by development round, has ~188 cases, ~35% of them deliberate counterexamples, and three cross-round regression canaries (`engine.test.ts:1803`, `2381`, `2704`). This is the right philosophy for a rule-based system and it is being executed well.

What it lacks is exactly what a deterministic engine most needs in order to *compete with ML on quality claims*: **an independent oracle measuring precision and recall on held-out corpora.** That oracle exists — it is the benchmarking harness — but it lives outside the test suite and outside any quality claim the product makes. This is the biggest missed opportunity in the project, and it is the subject of §5.

---

## 4. What the two prior audits got right and wrong

A brief scorecard, so this report is accountable to the same evidence.

**Right, and worth repeating:**
- Label-binding is the load-bearing decision, not a limitation (first audit §1.1; response §"Label-bound is the thesis").
- Corpus-specific data is the most actionable finding (both audits agree).
- `KIND_PRIORITY` is under-documented and under-tested (both audits agree).
- The Chinese module is well-factored and should be the template for future language modules (first audit §3.3).

**Overstated by the first audit, correctly checked by the response:**
- "Complexity ceiling / approaching the limit of what one developer can maintain." The evidence (clean Chinese module, passing 3,788-line suite, 26 coherent releases) shows a codebase *being* maintained. The real issue is coupling and the priority table, not size.
- The scoring-model proposal (first audit §6.2-F). It is in direct tension with `AGENTS.md` and would trade the product's core differentiator (inspectability) for a tuning surface that is *less* auditable than a stopword set. **This audit rejects it outright** (see §7).
- The plugin-architecture proposal (first audit §6.2-E) as a "refactor." It is a rewrite because of shared state. The surgical alternative in §6.3 gets most of the benefit.

**Missed by both prior audits, and central to this one:**
- The **benchmarking harness** (`benchmarking/harness/`) — an oracle-based evaluation discipline with Claude annotation, second-agent cross-check, gold spans, and a versioned score history — is already built and is the project's strongest strategic asset. Neither prior audit treats it as more than a footnote. It is the subject of §5 and the spine of the recommendations.
- The alias system is the **generalizable pattern** (evidence combination), not just a sophisticated subsystem. Neither prior audit names the principle it embodies, which is the key to the engine's next phase.
- The **O(n²) hot paths** will bite specifically because of the stated batch-processing direction, not in some abstract future. The response audit says "skip perf until a real batch is slow"; this audit says the batch case is *already on the roadmap*, so a smoke test is justified now (§6.6).

---

## 5. The hidden strategic asset: the evaluation harness

This is the section I most want to land, because it reframes the whole project.

A deterministic engine has a structural disadvantage versus an ML redactor: the ML system can be shown to improve on a benchmark, and that number becomes a marketing and trust claim. A deterministic engine that ships "more rules" has no comparable claim — "we added 86 entries to `MATTER_TERMS`" is not a quality story.

**NoAI already has the machine that produces that claim, and it is sitting in `benchmarking/harness/`.** Read the README:

- `score-current-engine.mjs` runs the engine against a **frozen suite of gold annotations** and writes per-level score reports, updating a versioned `reports/score-history.json` ledger keyed by *suite × engine version × level × coverage threshold*.
- `run-claude-annotator.mjs` produces an **independent oracle** (Claude) annotation batch, kept strictly out of the runtime.
- `compare-dev-round.mjs` cross-checks the Claude oracle **and a second independent agent** against the engine output and emits an `engine-gap-report.json`.
- `create-dev-round.mjs` / `index-dev-round-docs.mjs` give every development round a reproducible, sealed structure (`source/`, `model-input/`, `engine-output/`, `annotations/`, `comparison/`).

This is an **oracle-based precision/recall evaluation discipline**, and it is exactly the thing that lets a deterministic system make a *measurable* quality claim without becoming probabilistic. The changelog shows it is already being used as the engine's real development loop (versions 1.4.4–1.4.6 each cite `benchmarking/private/dev-rounds/<date>-<corpus>/`).

Here is the strategic reframe: **the harness is not a development convenience. It is the product's moat.** The right long-term ambition for NoAI is not "more regexes" or "a scoring model." It is:

> *The most trusted redaction tool, where "trusted" means: every release is measured against a growing frozen corpus, every quality claim is a number you can reproduce locally, and the redaction path never stops being deterministic, local, and inspectable.*

That ambition is *only* credible if the harness becomes a first-class part of how the project talks about itself and how it gates releases. Concrete moves in §6.7–6.8.

A note on the charter: using Claude as an *off-device, development-only oracle* to grade the engine does **not** violate "no AI in the redaction path" — the redaction path is what runs on the user's document, in their browser. The oracle grades the engine against *development corpora*, never touches a user's document, and the README already states this boundary explicitly (*"Do not make harness scripts upload documents or call remote models from the product runtime"*). The principle to hold is: **the oracle shapes the engine; the engine never calls the oracle.** That line is clean and defensible.

---

## 6. Directional recommendations, ordered by leverage

These are ordered by (impact on the product's core value) ÷ (effort and risk), and each is tied back to the context-gating principle and the `AGENTS.md` brief. Effort estimates are rough, single-developer days.

### 6.1 Extract corpus-specific data to opt-in config — DO FIRST *(~1 day, reversible, high impact)*

The `KNOWN_ORGS`, `MATTER_TERMS`, and `CORPUS_LOCATIONS` arrays leave `rules.ts` and become optional fields on `RedactionOptions` (`types.ts:62`). The engine ships with **zero** corpus knowledge by default. Private corpus profiles should live outside the public source tree and be supplied explicitly by the caller.

```typescript
interface RedactionOptions {
  level: RedactionLevel;
  customTerms?: string[];
  entries?: ReplacementEntry[];
  removedEntryIds?: string[];
  // NEW — opt-in corpus profiles. Empty by default.
  knownOrganizations?: string[];   // was KNOWN_ORGS
  matterTerms?: string[];          // was MATTER_TERMS
  locations?: string[];            // extra, merged with GENERAL_LOCATIONS
}
```

Why this is #1: it is the only recommendation that repairs a *trust* defect rather than an engineering one. After this change, every redaction is licensed by local evidence or by a list the user explicitly opted into — which is exactly what the context-gating principle promises. The `reason` field already distinguishes `"known organization"` from `"organization suffix"`, so the UI can even show the user *which* redactions came from their chosen profile.

Companion: add one `reason` value for profile-sourced redactions (e.g. `"profile: arbitration-hk"`) so the evidence trail stays honest.

### 6.2 Document and property-test `KIND_PRIORITY` *(~1 day, low risk)*

Write a comment block above `engine.ts:253` giving the rationale for each tier, in this form:

```
// NATIONAL_ID (1) beats BANK_ACCOUNT (2): when a digit string matches both
// patterns, the national-ID shape (SSN, PRC-ID) is more specific than a
// label-bound account number, so it is the safer classification.
```

Then add a **property test** for each non-obvious ordering: construct a string that matches two kinds, run it through `detect()`, and assert the winner. These tests are the regression net the priority table has never had. When the next detector is added and the author is tempted to slot it into the table by feel, the tests will tell them whether they broke a sibling.

This is the cheapest possible defense against the "silent priority bug" class, and it directly serves `AGENTS.md`'s "keep the code auditable."

### 6.3 Extract the pure validators (not the detectors) into a testable module *(~2 days, low risk)*

Create `src/redactor/validators/` and move the pure functions out of the `Detector` class:

- `looksLikePersonName` (`engine.ts:3017`)
- `looksLikeSinglePersonToken` (`engine.ts:3009`)
- `isValidSignatureName` (`engine.ts:2371`)
- `looksLikeContractDefinedTermCandidate` (`engine.ts:330`)
- `looksLikeGenericOrganizationPhrase` (`engine.ts:398`)
- `looksLikeDepartmentOrRole` (`engine.ts:2538`)

Each gets its own `.test.ts` with boundary cases (the `≥2 structural tokens` rule for contract terms, the function-word rejection, the role-ending rejection, the gov-agency-token rejection). These are the functions tuned most often and the ones where a unit test pays back fastest.

What this is *not*: it is not the plugin architecture from the first audit. The detectors stay where they are; only the *pure helpers* move. This respects the response audit's warning that the detectors share state and that decomposing them is a rewrite. Validators have no shared state, so they extract cleanly and immediately.

### 6.4 Generalize the alias system's evidence-combination pattern *(research → medium-term)*

The alias system is the engine's one piece of true evidence combination. The next paradigm for the engine is to apply the same shape elsewhere. Two concrete candidates:

- **Organization aliases.** Today, a suffix-licensed organization name does *not* automatically license its bare shorthand elsewhere, because `KNOWN_ORGS` was doing that job by brute force. Once corpus data moves to config (§6.1), the gap appears: a user who does *not* load a private profile loses bare-org recall. The alias pattern fills it: a suffix-licensed org name licenses its bare core *only when* a second signal appears nearby (a sentence-subject position, a "the Company" anaphora, a capitalization pattern). This is strictly more principled than a lookup table.
- **Document-section-aware evidence.** A capitalized phrase in a signature block, a caption, or a `To:`/`From:` header carries more person-evidence than the same phrase in body prose. The detectors already special-case some of these (`detectSignatureNames`, `detectCaptionPartyNames`, `detectAttentionBlocks`); the unifying step is a lightweight **structural pass** that tags each line with a section type (header / caption / signature / body / table / footer) and lets every detector read that tag as one more piece of evidence. This is a *small* version of the first audit's "document structure model" — small enough to be incremental, principled enough to be worth it.

The guiding rule, borrowed from the alias system: **one strong signal licenses an identity; a derived surface form is re-licensed only by a second independent signal.** Written down, that sentence is the engine's design doctrine for the next year.

### 6.5 Kill the O(n²) hot paths *(~2 days, low risk, gated on a smoke test)*

Three changes, each independently shippable:

1. **Inverted index for `hasStronger*`.** Build `Map<normalizedValue, Candidate[]>` once at the start of `finalizeCandidates`. Both suppression checks become O(candidates sharing that normalized value) instead of O(all candidates).
2. **Value-keyed alias scan.** In `addPersonAliases`, instead of scanning every document for every surname, scan once per document, tokenize, and look surnames up in a Set. Turns O(docs × aliases) into O(docs × tokens).
3. **Span occupancy via interval logic.** Replace the per-character boolean array in `buildSegments` with an interval-overlap check against the already-chosen spans (kept sorted). For typical span counts this is a wash; for large batches it avoids a per-document allocation of size `text.length`.

Do **not** do these speculatively. Do them behind the smoke test in §6.6 so the improvement is measured, not assumed.

### 6.6 Add one performance smoke test *(~half a day)*

Add a test that builds a synthetic 1 MB document (or a 100-document batch totaling ~1 MB) and asserts redaction completes under a generous budget (say, 5 s). This is the trip-wire that justifies (or postpones) §6.5. The response audit says "wait until a real batch is slow"; the counter-argument is that `AGENTS.md` *already commits* to batch processing as a core feature, so the regression net should exist before the feature, not after. The smoke test costs almost nothing and prevents a class of regressions that end-to-end correctness tests cannot catch.

### 6.7 Make the harness the release gate *(process, ongoing)*

Two policy changes, no code:

1. **No engine version ships without a score-history delta.** Every entry in `docs/engine-changelog.md` for a detector change links to the `reports/score-history.json` row that proves precision/recall did not regress on the frozen suites. A version that adds coverage but drops precision on an existing suite is either held or explicitly annotated.
2. **Grow the frozen suite deliberately.** Every "user-supplied corpus" round (the 1.4.4–1.4.6 pattern) graduates its synthetic fixtures into a committed, public frozen suite after sanitization. The suite is the only durable quality artifact; the detectors are ephemeral by comparison.

This is how the harness stops being a development convenience and becomes the product's quality story.

### 6.8 Publish the numbers *(aspirational, but cheap)*

Once §6.7 has a few versions of history, the README and the site can carry a line like: *"NoAI is measured against N frozen document suites. Current Balanced-level precision: X%; recall: Y%. Reproduce locally: `node benchmarking/harness/score-current-engine.mjs --level balanced`."* This is a trust claim that is *stronger* than what an ML redactor can honestly make, because it is **reproducible by the user on their own machine without uploading anything**. That is the inspirational endpoint: the no-oracle constraint, which looked like a weakness in §0, becomes the basis of the strongest possible trust claim — *you don't have to believe us, you can measure us yourself.*

---

## 7. What I would explicitly NOT do

Discipline matters as much as direction. These are from the prior audits or from common NLP instinct, and I would reject or defer them:

- **No confidence-scoring model** (first audit §6.2-F). It replaces an inspectable reason string with an opaque float and a tunable threshold, in direct tension with `AGENTS.md`. The three-level `minLevel` system already *is* the confidence surface, and it is strictly more auditable.
- **No declarative YAML rule format as a user-facing surface** (first audit §6.3-I). A rules file that non-engineers tune without understanding the engine cuts against "auditable" and "explicit rule-based logic." Internal declarative rule *organization* (grouping regexes by domain) is fine and cheap; exposing it to users is not.
- **No full plugin/detector rewrite** (first audit §6.2-E) until the validator extraction (§6.3) and the priority tests (§6.2) have been done and the coupling has actually been characterized. The shared state (`candidates`, `exactIndex`, `normIndex`, the `add()` guards, `finalizeCandidates`) makes this a rewrite; the benefit does not yet justify the risk.
- **No chasing free-form Chinese person-name detection in prose** (first audit §3.2). Without capitalization or an oracle, bare Chinese name detection means either a surname dictionary large enough to cause constant false positives, or an ML model. The current boundary (label-bound + agreement-heading-bound + signature-bound) is correct and should be documented as a *doctrine*, not lamented as a gap. The honest framing for users: *"NoAI redacts Chinese names where the document's structure licenses them; unstructured prose names require human review."*
- **No content-addressable token IDs** (first audit §6.2-G) until a real user complains about renumbering. The `entryId` (`engine.ts:3326-3328`) already survives re-detection for user edits; sequential display order is a cosmetic issue that does not yet justify the change.

---

## 8. The first 30 days, concretely

A sequence a single developer can execute, each step shippable on its own:

1. **Day 1–2:** §6.1 — extract corpus data to opt-in config; ship an "arbitration-hk" preset; update the changelog and the UI to expose profiles. *(This is the one that matters most.)*
2. **Day 3:** §6.2 — document `KIND_PRIORITY` and add property tests for the non-obvious orderings.
3. **Day 4–5:** §6.3 — extract the six pure validators into `src/redactor/validators/` with unit tests.
4. **Day 6:** §6.6 — add the 1 MB / 100-document performance smoke test.
5. **Day 7:** §6.7 (policy) — wire the score-history delta into the changelog template; graduate one dev-round corpus into a public frozen suite.
6. **Day 8–10:** §6.5 — behind the smoke test, land the inverted-index and value-keyed-alias optimizations and record the measured speedup.

After that: §6.4 (evidence combination for org aliases and section tagging) becomes the natural medium-term arc, and §6.8 (publishing the numbers) becomes possible once two or three score-history rows exist.

Total elapsed to "the engine is more general, more inspectable, faster at batch scale, and quality-gated by measurement": roughly two weeks. None of it requires a rewrite. None of it weakens the charter.

---

## 9. Closing

The first audit ended by calling the engine a "production-quality expert system approaching a complexity ceiling." That undersells what it is. NoAI is a **context-gated, evidence-bound redaction engine** that has already found the information-theoretically correct answer to the problem of detecting sensitive values without an oracle. Its label-binding, its checksums, its three-level confidence surface, and its alias machinery are not accidents accumulated over 26 versions — they are four expressions of one coherent idea.

The thing that is *not* yet coherent is the project's relationship to its own quality. The engine improves by the week; its quality is not measured, and its quality is therefore not claimable. The benchmarking harness is already built to fix exactly that, and it is the project's most underused asset. Making the harness the spine of the development loop and the basis of the public trust claim is how NoAI turns its central constraint — no oracle, no backend, no ML in the path — from a limitation into the strongest argument for using it.

The path forward is not to make the engine smarter. It is to make its smartness **measurable, and to let the user do the measuring.**

---

*Audit conducted 2026-06-19 against engine version 1.4.6. All file:line references are to the working tree at audit time.*
