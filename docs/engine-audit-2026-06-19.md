# NoAI Redaction Engine Audit

**Date:** 2026-06-19
**Engine Version:** 1.4.6
**Audit Scope:** Full architecture, detection pipeline, rule system, test coverage, Chinese module

---

## Executive Summary

The NoAI redaction engine is a **remarkably thorough, battle-tested deterministic system** that has evolved through 15+ patch rounds across nine document domains (arbitration, SEC filings, litigation, procurement, stock exchange, regulatory enforcement, finance operations, HR/governance, and Chinese business documents). It achieves its core promise: redact sensitive values from legal/business documents without AI, without uploads, and with inspectable logic.

However, the engine has reached a **complexity ceiling**. The current architecture — a monolithic `Detector` class with ~3,200 lines, ~1,300 lines of hardcoded stopword sets, and dozens of hand-crafted regexes — is approaching the limit of what can be maintained, tested, and extended by a single developer. The next phase of the engine's life requires architectural transformation, not incremental patching.

This report diagnoses the current state from first principles and proposes a directional roadmap.

---

## 1. What the Engine Gets Right (Foundations to Preserve)

### 1.1 The Label-Bound Philosophy

The single most important design decision is that **identifiers are label-bound**. A bare number like `12345678` is not redacted; `CR No. 12345678` is. This eliminates the largest class of false positives (table quantities, version numbers, statute sections, line items) and is the reason the engine can operate at Light/Balanced levels with acceptable readability.

This principle must be preserved and strengthened in any future architecture.

### 1.2 The Three-Level System

Light / Balanced / Heavy is the right abstraction for user-facing control. It maps cleanly to use cases:

- **Light:** Direct identifiers only (emails, phones, SSNs, passport numbers, case refs). Safe for internal sharing.
- **Balanced:** Adds people, orgs, dates, amounts, addresses, locations. The default for AI tool use.
- **Heavy:** Adds repeated proper nouns, chronology localization, contact section quarantine. Maximum privacy at the cost of readability.

The level system is well-implemented: each candidate carries a `minLevel`, and the output pipeline filters by the user's chosen level. This is clean and extensible.

### 1.3 The Alias Generation System

The person alias system (`addPersonAliases`) is the most sophisticated subsystem. It derives:

- Surname-only references from full names (context-bound: "Li further explained…")
- Given-name references (context-bound: "copied to Jenny")
- First+last aliases from three-part names ("Michael Hollan Messinger" → "Michael Messinger")
- Title+surname forms ("Mr. Li")
- Possessive forms ("Blake's Response")

The context-binding (requiring a communication verb, response heading, or witness verb nearby) prevents the most common alias false positive: redacting a common word that happens to be someone's given name.

### 1.4 The Chinese Module

`chinese.ts` is a well-structured, independently testable module with:

- Proper checksum validation for USCC (GB 32100-2015) and PRC resident IDs (GB 11643-1999)
- Date validation on embedded YYYYMMDD in PRC IDs (reducing FP rate from 9.1% to ~0.033%)
- Label-bound detection for all Chinese identifier types
- Multi-line address continuation folding
- Context-org detection with strong-suffix allowlist
- Statute name protection (`《…》` book titles)
- Traditional Chinese / HK / TW label aliases

The decision to keep bare Chinese bank accounts Heavy-only (no checksum exists) and HK identifiers label-bound (checksum algorithms need verification) shows disciplined risk management.

### 1.5 The Test Suite

The test suite (~3,100 lines) is organized by development round, covers positive cases, counterexamples, and cross-round regression canaries. Each round's tests verify that new coverage doesn't break old behavior. This is the right testing philosophy for a rule-based system.

---

## 2. Architectural Problems (What Must Change)

### 2.1 The Monolithic Detector

The `Detector` class in `engine.ts` is ~3,200 lines and contains:

- 12 detection methods
- 8 validation/lookalike methods
- 3 indexing methods
- Alias generation
- Candidate finalization
- All regex pattern definitions

**Why this hurts:**

- **Testability:** You cannot test `detectPeople` in isolation without constructing an entire `Detector` with fake documents. A bug in the person-list detector requires understanding the entire class.
- **Extensibility:** Adding a new detector (e.g., for medical record numbers) requires modifying the monolithic class and understanding all interactions with existing detectors.
- **Reviewability:** A code reviewer cannot understand what `detect()` does without reading 3,200 lines. The control flow is implicit in method call order.
- **Parallelism:** All detection runs sequentially on the main thread. With large document batches, this becomes a bottleneck.

### 2.2 The Stopword Explosion

`rules.ts` has grown to 1,329 lines of hardcoded sets:

| Set | Approximate Size | Purpose |
|-----|-----------------|---------|
| `CONTRACT_DEFINED_TERM_TOKENS` | ~700 entries | Prevent boilerplate from being redacted as people |
| `SINGLE_PERSON_STOPWORDS` | ~130 entries | Prevent role words from being standalone people |
| `PROPER_NOUN_STOP_TERMS` | ~100 entries | Prevent headings from being heavy-mode proper nouns |
| `ORG_NAME_TAIL_TOKENS` | ~90 entries | Prevent company names from being redacted as people |
| `KNOWN_ORGS` | ~55 entries | Corpus-specific organization names |
| `MATTER_TERMS` | ~85 entries | Corpus-specific project/agreement terms |

**Why this hurts:**

These sets are essentially a **manually trained classifier**. Each entry was added to fix a specific false positive found in a specific document. The sets have no systematic coverage guarantees — you cannot prove that a new document type won't trigger a new false positive that requires yet another entry.

The comment "Curated to exclude real surnames (Cooper, Davis, Walker, Mason, Young, Reed, Hale, ...)" on `ORG_NAME_TAIL_TOKENS` reveals the fundamental tension: every stopword you add risks suppressing a real name, and every stopword you don't add risks a false positive.

### 2.3 The Regex Proliferation

There are approximately **80+ regex patterns** defined across the engine, each hand-crafted for a specific format. Examples:

- 6 different phone number patterns (generic, dot-separated, mixed-separator, label-bound, Chinese, fax)
- 5 different address patterns (inline, full US, numbered street, UK full-line, PO Box)
- 8 different case reference patterns (arbitration, UK neutral citation, US docket, SEC civil action, HK court, matter tag, regulator matter, agency-prefixed)
- 12 different date patterns (numeric, written, day-month, month-day, slash, ISO, dash, quarter, fiscal year, birth year, Chinese, Chinese numeral)

**Why this hurts:**

Each regex is a single point of failure with no independent test. A regex change to fix one format can silently break another. The patterns interact through the `KIND_PRIORITY` system — a phone regex that's too broad will steal candidates from the postcode detector.

### 2.4 Corpus-Specific Baggage

The engine carries hardcoded knowledge from its arbitration prototype origins:

- `KNOWN_ORGS`: case-specific organization names
- `MATTER_TERMS`: case-specific project/agreement terms
- `CORPUS_LOCATIONS`: case-specific location terms

These are **not general-purpose redaction rules**. They are case-specific facts from one arbitration matter. A user redacting a completely different document will have these terms in their engine, potentially causing unexpected redactions or, worse, creating a false sense of security that the engine has general knowledge it does not actually have.

The former `GENERAL_ORGS` list was slightly better because it covered recognizable global organizations, but it was still an arbitrary allowlist that would miss most organizations while potentially redacting name-like text that happened to match.

### 2.5 The Kind Priority System

`KIND_PRIORITY` is a hardcoded ranking of 28 candidate kinds. When the same string is detected under multiple kinds, the lowest-numbered kind wins. This creates subtle bugs:

- `CUSTOM` (0) always wins — correct
- `NATIONAL_ID` (1) beats `BANK_ACCOUNT` (2) — is this always right?
- `EMAIL` (4) beats `PHONE` (5) — correct
- `CASE_REF` (8) beats `ADDRESS` (14) — a case reference that looks like an address?
- `PERSON` (26) is the lowest priority — a person name that also matches a date pattern will be classified as a date

The priority order encodes assumptions about which kind is "more specific" or "more important," but these assumptions are not documented or tested systematically.

### 2.6 Token Stability

Replacement tokens are numbered sequentially by first occurrence position (`PERSON_001`, `PERSON_002`, …). This means:

- Adding a new document to a batch can renumber all existing tokens
- A person who was `PERSON_005` becomes `PERSON_012` if the new document mentions 7 people before them
- User edits (custom replacements) are keyed by `entryId` which is `kind:encodedValue`, so they survive renumbering — but the visual instability erodes trust

### 2.7 Performance Characteristics

The engine has several O(n²) or worse patterns:

- `addPersonAliases` scans every document for every surname, every given name, and every first+last alias
- `hasStrongerCandidate` iterates all candidates for each proper noun
- `finalizeCandidates` iterates all exact-index entries and all candidates
- The `buildSegments` span conflict resolution is O(n²) in the number of spans

For small documents (typical legal letters are 5-50KB), this is fine. For large batches (100+ documents, 10MB+ total), it becomes noticeable.

---

## 3. The Chinese Module: Specific Observations

### 3.1 Strengths

- Checksum-gated bare detection for USCC and PRC ID is the right approach — it enables Light-level redaction of identifiers even without labels, while the mathematical guards keep false positives near zero
- The strong-suffix allowlist for context orgs (有限公司, 股份有限公司, 研究院, 医院, …) correctly excludes weak suffixes (公司, 局, 中心, 部) that would cause false positives on ordinary prose
- The common-noun prefix guard (我/本/该/此/其/各/全) correctly prevents "我公司" from being redacted as an org
- The statute name protection (`《…》`) is a thoughtful detail

### 3.2 Gaps

- **No free-form Chinese person name detection.** The only person detection is label-bound (法定代表人：张三) or agreement-heading-bound (由 X 与 Y 就). A Chinese name appearing in prose ("张三出席了会议") is not redacted. This is a deliberate trade-off (Chinese lacks capitalization as a signal), but it's the single largest coverage gap.
- **No Chinese organization detection without strong suffixes.** "华为技术有限公司" is caught; "华为" alone is not. This is correct for Balanced but means many org references in prose leak.
- **HK ID checksum not validated.** The changelog notes this requires verification. Until then, HK IDs are label-bound only, which means a bare HKID in prose leaks.
- **Fullwidth digits only in amounts.** Dates, phone numbers, and identifiers with fullwidth digits are not detected.

### 3.3 Architecture

The Chinese module is well-factored as a separate file with a clean callback interface (`AddCandidate`). It should serve as the template for future language modules.

---

## 4. Test Coverage: What's Missing

### 4.1 No Unit Tests for Individual Detectors

All tests are end-to-end: `redact("some text")` → check output. There are no tests for:

- `looksLikePersonName()` with specific edge cases
- `isValidSignatureName()` with various name formats
- `looksLikeContractDefinedTermCandidate()` with boundary cases
- `normalizeOrgSurface()` with leading conjunctions
- Individual regex patterns in isolation

### 4.2 No Performance Tests

There are no tests that verify the engine completes in reasonable time for large inputs (100 documents, 1MB total).

### 4.3 No Fuzzing

There are no tests that feed random/generated text to the engine and verify it doesn't crash, hang, or produce invalid output.

### 4.4 Limited Negative Testing

Most tests verify that specific strings ARE redacted. Fewer tests verify that specific strings are NOT redacted. The counterexample tests that exist are excellent but not systematic.

---

## 5. Paradigm Assessment: Where the Engine Sits

The current engine is best characterized as a **hand-crafted expert system**. It encodes domain knowledge (what emails look like, what addresses look like, what person names look like) as imperative regex rules with hardcoded exception lists.

This paradigm has served well for the prototype phase. It is:

- **Transparent:** Every redaction has a `reason` string explaining which rule fired
- **Debuggable:** You can add a `console.log` to any detector and see exactly what matched
- **Correctable:** A false positive can be fixed by adding one entry to a stopword set

But it has fundamental limits:

- **Completeness:** You cannot prove the engine catches all instances of a pattern. A new phone number format requires a new regex.
- **Correctness:** You cannot prove the engine doesn't over-redact. Each new document type may reveal new false positives.
- **Maintainability:** Each new rule interacts with all existing rules through the shared candidate map and priority system.
- **Scalability:** Adding a new language, a new document type, or a new identifier category requires touching the monolithic core.

---

## 6. Directional Recommendations

These are ordered by impact-to-effort ratio, not by importance.

### 6.1 Immediate (Next 1-2 Versions)

**A. Extract Corpus-Specific Data to Configuration**

Move `KNOWN_ORGS`, `MATTER_TERMS`, and `CORPUS_LOCATIONS` out of `rules.ts` and into an optional configuration object. The engine should ship with zero corpus-specific knowledge. Users who want arbitration-specific redaction can opt in.

```typescript
interface RedactionOptions {
  level: RedactionLevel;
  customTerms?: string[];
  entries?: ReplacementEntry[];
  removedEntryIds?: string[];
  // NEW:
  knownOrganizations?: string[];
  matterTerms?: string[];
  locations?: string[];
}
```

**B. Add Detector-Level Unit Tests**

Create `src/redactor/detectors/` with one file per detector, each with its own test file. Start with the validators:

- `looksLikePersonName.test.ts`
- `isValidSignatureName.test.ts`
- `looksLikeContractDefinedTermCandidate.test.ts`

This enables faster iteration and prevents regressions when tuning individual detectors.

**C. Document the Kind Priority Rationale**

Add a comment block above `KIND_PRIORITY` explaining the reasoning for each priority level. Example:

```
// NATIONAL_ID (1) beats BANK_ACCOUNT (2): a string matching both patterns
// (e.g., a 9-digit number that could be either) is more likely to be a
// national ID because bank accounts are label-bound at higher levels.
```

**D. Add Performance Smoke Tests**

Add a test that redacts a 1MB document in under 5 seconds. This establishes a baseline and catches accidental O(n²) regressions.

### 6.2 Medium-Term (Next 3-6 Versions)

**E. Plugin Architecture for Detectors**

Refactor the `Detector` class into a registry of detector plugins:

```typescript
interface DetectorPlugin {
  name: string;
  detect(doc: RedactionInput, add: AddCandidate, level: number): void;
}

class Engine {
  private plugins: DetectorPlugin[];

  detect(): Candidate[] {
    for (const doc of this.docs) {
      for (const plugin of this.plugins) {
        plugin.detect(doc, this.add.bind(this), this.level);
      }
    }
    // alias generation, finalization...
  }
}
```

Each current detection method becomes a plugin. This enables:

- Independent testing of each detector
- User-configurable detector enable/disable
- Third-party detector plugins
- Clearer documentation of what each detector does

**F. Replace Stopword Sets with a Scoring Model**

Instead of binary allowlist/blocklist decisions, assign confidence scores:

```typescript
interface ScoredCandidate {
  value: string;
  kind: CandidateKind;
  confidence: number; // 0.0 to 1.0
  reasons: string[];
}
```

The redaction level becomes a confidence threshold:

- Light: confidence ≥ 0.9
- Balanced: confidence ≥ 0.5
- Heavy: confidence ≥ 0.2

This eliminates the need for most stopword sets. A phrase like "Administrative Agent" gets a low person confidence (0.1) because it matches defined-term patterns. "Jordan Price" gets a moderate person confidence (0.6) because it has a title context. The threshold handles the decision.

**G. Content-Addressable Token IDs**

Replace sequential numbering with hash-based IDs:

```typescript
function stableTokenId(kind: CandidateKind, value: string): string {
  const hash = simpleHash(`${kind}:${normalizeForDedupe(value)}`);
  return `${kind}_${hash.toString(36).padStart(6, '0')}`;
}
```

This makes tokens stable across re-detection, batch changes, and document reordering. The user's custom replacement for `PERSON_a3f2b1` stays attached to the same person regardless of what other documents are added.

### 6.3 Long-Term (Vision)

**H. Document Structure Model**

Parse documents into a structured representation before detection:

```
Document
├── Header (letterhead, metadata)
├── Section "BACKGROUND"
│   ├── Paragraph
│   └── Paragraph
├── Section "TERMS"
│   ├── Table
│   │   ├── Row (header)
│   │   └── Row (data)
│   └── Paragraph
└── Footer (signature block, page numbers)
```

This enables:

- **Position-aware detection:** A capitalized phrase in a header is more likely to be a party name than the same phrase in body text
- **Table-aware detection:** A number in a table cell with a "Phone" column header is a phone number
- **No more cross-boundary stitching:** Detectors operate within structural units, not across them
- **Better replacement:** Headers can be replaced differently from body text

The challenge is that input documents are plain text or Markdown, not structured documents. A lightweight structural parser (heading detection, table detection, paragraph segmentation) would be a prerequisite.

**I. Declarative Rule Format**

Define detection rules in a declarative format that can be loaded, validated, and tested independently:

```yaml
rules:
  - id: email-address
    kind: EMAIL
    level: light
    pattern: '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b'
    description: Standard email address

  - id: us-ssn
    kind: NATIONAL_ID
    level: light
    pattern: '\b\d{3}-\d{2}-\d{4}\b'
    description: US Social Security number

  - id: person-title-led
    kind: PERSON
    level: balanced
    context: title
    pattern: '(Mr|Ms|Mrs|Dr|Prof)\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})'
    validators:
      - looksLikePersonName
      - notContractDefinedTerm
```

This separates the "what" (rule definitions) from the "how" (matching engine). Rules become auditable, testable, and user-customizable without touching TypeScript code.

**J. Multi-Language Framework**

Generalize the Chinese module's callback interface into a language plugin system:

```typescript
interface LanguagePlugin {
  language: string;
  detect(doc: RedactionInput, add: AddCandidate): void;
  hasText(text: string): boolean;
}
```

The engine auto-detects which language plugins to run based on text content. Adding Japanese, Korean, or Arabic support becomes a matter of writing a new plugin.

**K. Explainability Output**

Add an optional "explain" mode that produces a sidecar file explaining each redaction:

```json
{
  "redactions": [
    {
      "original": "john@example.com",
      "replacement": "EMAIL_001",
      "rule": "email-address",
      "confidence": 1.0,
      "context": "Found at position 45 in line 'Contact: john@example.com'"
    }
  ]
}
```

This builds user trust and helps with debugging false positives/negatives.

---

## 7. Risk Assessment

### 7.1 What Could Break

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| New document type triggers unknown false positive class | Medium | Medium | Add fuzzing, expand counterexample suite |
| Regex change breaks existing format | Medium | High | Add per-detector unit tests before refactoring |
| Stopword addition suppresses real name | Low | High | Move to scoring model (Recommendation F) |
| Performance degradation with large batches | Low | Medium | Add performance smoke tests (Recommendation D) |
| Chinese bare identifier false positive from edge-case checksum collision | Very Low | Low | Current guards are mathematically sound |

### 7.2 What's Already Robust

- Email, URL, and phone detection (well-established formats)
- Checksum-gated identifiers (USCC, PRC ID, ISIN)
- Label-bound business/person/address detection
- The three-level system
- The test suite's regression coverage

---

## 8. Summary

The NoAI redaction engine is a **production-quality expert system** that has been hardened through extensive real-world testing. It correctly implements its core philosophy: deterministic, label-bound, inspectable redaction.

The engine's current architecture is appropriate for its current scale. The recommendations in this report are not criticisms of the current implementation — they are a roadmap for the next order of magnitude in complexity.

The single most impactful change would be **Recommendation A** (extract corpus-specific data) because it immediately makes the engine more general and more trustworthy. The single most architecturally important change would be **Recommendation E** (plugin architecture) because it unlocks all other improvements.

The engine's greatest strength — its meticulous, hand-crafted rules — is also its greatest limitation. The path forward is to preserve the rules' precision while making them more systematic, more testable, and more configurable.

---

*This audit was conducted by reading the full engine source (~3,600 lines), the rules file (~1,300 lines), the Chinese module (~1,100 lines), the test suite (~3,100 lines), the type definitions, the version history, and the changelog (~520 lines). No AI was used in the redaction path during this audit.*
