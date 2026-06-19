# NoAI Redaction Engine Audit — Response and Opinions

**Date:** 2026-06-19
**In Response To:** [engine-audit-2026-06-19.md](./engine-audit-2026-06-19.md)
**Engine Version Reviewed:** 1.4.6

---

## Verification Note

Before forming opinions, the following factual claims in the audit were checked against the source:

- `engine.ts` is **3,646 lines** (audit says ~3,200 — undercounts by ~12%)
- `engine.test.ts` is **3,788 lines** (audit says ~3,100 — undercounts by ~18%)
- `rules.ts` is **1,329 lines** (audit says ~1,300 — accurate)
- `chinese.ts` is **1,089 lines** (audit says ~1,100 — accurate)
- `ENGINE_VERSION` is `"1.4.6"` with date `2026-06-19` (accurate)
- `KIND_PRIORITY` contains all 28 kinds, `CUSTOM=0` … `PROPER_NOUN=27` (`engine.ts:253`) — accurate
- `KNOWN_ORGS` (`rules.ts:254`) contains case-specific organization names — accurate
- `CORPUS_LOCATIONS` (`rules.ts:424`) contains case-specific location terms — accurate
- The existing comment at `rules.ts:252` already says *"Consider moving these into an opt-in config when generalizing further"* — the audit is restating an acknowledged debt, not uncovering a secret.

Directionally, every specific claim in the audit holds up. The only inaccuracy is a consistent ~10-15% undercount of file sizes, which does not affect any conclusion.

---

## Where the Audit Is Right

### Label-bound is the thesis, not a limitation

The audit correctly identifies label-bound detection as the load-bearing design decision. It is why the engine can exist at all without ML: you trade recall (bare numbers leak) for precision (tables don't get shredded). This is not a flaw to fix in a future version; it is the premise the whole system rests on. §1.1 is the strongest part of the document.

### Corpus-specific baggage is real and is the most actionable finding

This is the only finding that touches NoAI's stated core value — **trust** (`AGENTS.md`: "The core value is trust. Keep the runtime path local, mechanical, and inspectable.") A user who does not know `KNOWN_ORGS` exists could reasonably believe the engine located their organization via general logic, when it is actually a lookup table seeded from one arbitration matter. That is a trust problem, not just an engineering debt.

### `KIND_PRIORITY` is genuinely under-documented

All 28 entries confirmed. The audit's specific puzzles are fair: why does `NATIONAL_ID` (1) beat `BANK_ACCOUNT` (2)? Why does `CASE_REF` (8) beat `ADDRESS` (14)? Why is `PERSON` (26) near the bottom, so a name that also matches a date pattern is classified as a date? None of these have a documented rationale. It works until it silently doesn't.

---

## Where I'd Push Back

### The "complexity ceiling" framing is overstated

~3,600 lines for a system covering email, phone, case references, addresses, dates, amounts, people, organizations, and Chinese identifiers across nine domains is not large. Many well-maintained parsers are 5-10x this size. The audit describes the monolith as a crisis ("approaching the limit of what can be maintained by a single developer"), but the actual evidence — a clean three-level system, tests organized by development round, a factored Chinese module — shows a codebase that *is* being maintained successfully. §8 of the audit even says so, contradicting its own §2.

### Recommendation F (scoring model) is the riskiest proposal and gets the softest treatment

The audit frames a confidence-scoring model as "eliminates the need for most stopword sets." It would actually:

- Throw away the system's core selling point — *inspectable, deterministic* logic — in exchange for floating-point confidences users cannot reason about
- Require re-tuning thresholds against the entire existing corpus to avoid regressing the 3,788-line test suite
- Add a tuning surface (per-level thresholds) that is *less* auditable than a stopword set

`AGENTS.md` says: "Prefer explicit rule-based logic over opaque dependencies." A scoring model is in direct tension with that instruction. This should be a research question, not a medium-term roadmap item.

### The Chinese person-name "gap" is a deliberate, correct boundary

The audit calls free-form Chinese name detection "the single largest coverage gap" but also acknowledges it is a deliberate trade-off. Chinese lacks a capitalization signal, so free-form name detection without ML means either massive false positives or a stopword list larger than the rest of the engine. The current choice — label-bound and agreement-heading-bound only — is correct. This is a documented boundary, not a gap to close.

### The plugin architecture (Recommendation E) undersells its cost

The `DetectorPlugin` interface sketch is clean. The hard part is not the interface — it is that detectors currently share state: the candidate map, exact-index lookups, alias generation that runs *after* person detection, and `KIND_PRIORITY` conflict resolution that runs *across* detectors. Decomposing the monolith means re-inventing that coordination. Worth wanting, but the audit treats it as a refactor when it is a rewrite.

---

## What I Would Actually Do, In Order

1. **Recommendation A, and only A.** Extract `KNOWN_ORGS`, `MATTER_TERMS`, `CORPUS_LOCATIONS` to an optional config object. Ship zero corpus knowledge by default. Roughly one day of work, immediately improves trust, and reversible without risk.
2. **Recommendation C (document `KIND_PRIORITY`).** Near-zero cost; prevents the silent-priority-bug class the audit correctly flags. Add a per-kind regression test as each rationale is written down.
3. **Recommendation B, but validators first.** `looksLikePersonName`, `isValidSignatureName`, `looksLikeContractDefinedTermCandidate` are pure functions called from many places — highest-leverage unit-test targets. Detector-level tests can follow later.
4. **Skip D, F, G until there is demonstrated need.**
   - No performance smoke test until a real batch is actually slow.
   - No scoring model until stopwords demonstrably fail on a new corpus.
   - No content-addressable token IDs until a real user complains about renumbering.

   All three currently solve problems the audit *anticipates* rather than *demonstrates*.

---

## One Thing the Audit Missed

The audit does not weigh its recommendations against the `AGENTS.md` constraints. Those constraints — "Redaction logic matters more than frontend polish for now," "Keep the code auditable," "Prefer explicit rule-based logic over opaque dependencies" — actively rule out parts of the long-term vision. A scoring model, and a declarative YAML format that users tune without understanding the engine, both cut against "auditable" and "explicit rule-based logic."

The §6 roadmap reads like it was written for a generic NLP library. It should have been written for *this* product, whose brief is mechanical, local, and inspectable. That is the audit's real weakness: technically thorough, but insufficiently opinionated about what NoAI is *for*.

---

## Summary

The audit is factually reliable and its §1-§2 diagnosis is sound. Treat §6 as a menu where most of the expensive items are premature for a tool whose explicit brief is *mechanical and inspectable*. Do Recommendation A, do Recommendation C, then stop until a real user complaint forces the next move.

The audit's greatest strength — a thorough, source-checked reading of a large codebase — is also its weakness: it catalogs everything that *could* be improved without enough discipline about what *should* be improved next, given what this product is.
