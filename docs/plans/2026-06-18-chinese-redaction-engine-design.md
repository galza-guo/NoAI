# Chinese Redaction Engine Design

## Goal

Add Chinese document support without weakening NoAI's core promise: document
contents stay in the browser, redaction stays deterministic, and every rule
remains auditable.

## Product Stance

Chinese support should start as a beta-quality deterministic layer. The first
release should be good at labeled fields and direct identifiers, not pretend to
fully anonymize every free-form Chinese sentence.

The shipped runtime must not call GLM, an LLM, OCR services, analytics, or any
backend. GLM may be used only offline as a development worker to inspect public
development-corpus documents and propose synthetic tests or general rule ideas.

## Architecture

Keep the current review, replacement, export, and custom-term machinery. Add a
separate Chinese detector beside the existing English-heavy detector.

```text
Browser-only redaction pipeline
+-- shared candidate/replacement/review/export core
+-- common direct detectors
+-- existing English detector
+-- Chinese detector
+-- custom user terms
```

The Chinese detector should live in its own module, for example
`src/redactor/chinese.ts`, and receive a narrow callback for adding candidates.
That keeps the new work inspectable and avoids rewriting the current monolithic
English detector in the same pass.

## Why A Separate Detector

The current engine relies on English clues such as spaces, title case, English
honorifics, and company suffixes like `Inc` or `Ltd`. Chinese text does not use
those signals. Names can be two or three characters, organization suffixes are
different, addresses are written from large-to-small geography, and dates,
amounts, legal references, and ID numbers have their own formats.

Forcing Chinese into the English rule lists would make both languages harder to
reason about. A separate detector lets each language use the clues that are
actually present in the text.

## First-Scope Coverage

Initial Chinese coverage should focus on high-confidence patterns:

- PRC resident identity numbers, preferably checksum-validated when possible.
- Unified Social Credit Codes after labels such as `统一社会信用代码`.
- Chinese mobile and landline numbers, especially after contact labels.
- Chinese dates such as `2026年6月18日` and `2026 年 6 月`.
- RMB amounts such as `人民币79.1万元`, `10万元`, `3.5亿元`, and `￥50,000`.
- Addresses after labels such as `住所`, `住址`, `注册地址`, `办公地址`,
  `联系地址`, and `地址`.
- Organization names ending in suffixes such as `有限公司`, `股份有限公司`,
  `有限合伙`, `律师事务所`, `会计师事务所`, `银行`, `证券`, `基金`,
  `委员会`, `法院`, `局`, `中心`, `大学`, and `医院`.
- Person names in labeled fields such as `姓名`, `联系人`, `法定代表人`,
  `负责人`, `经办律师`, `签字会计师`, `项目负责人`, and `授权代表`.
- Chinese legal/regulatory references such as `沪〔2026〕10号` and
  `案号：（2026）沪0101民初123号`.

Free-form Chinese person detection should come later. It is riskier because
short Chinese names often look like ordinary words unless context is strong.

## Redaction Levels

Light:

- Redact direct identifiers and user custom terms.
- Redact strongly labeled personal fields.

Balanced:

- Add labeled addresses, organizations, dates, amounts, and common business or
  legal references.
- This should become the default useful Chinese mode.

Heavy:

- Add broader CJK fallback behavior for unknown Chinese spans and repeated
  Chinese proper-looking terms.
- This replaces the current broad `NON_LATIN_TEXT` behavior as the "maximum
  safety, lower readability" option.

## Current `NON_LATIN_TEXT` Safety Net

The existing `NON_LATIN_TEXT` rule catches runs of CJK characters at Balanced.
That was useful when the engine was English-only, because it prevented a Chinese
duplicate line from leaking. It will make real Chinese support unusable because
it can redact almost every meaningful Chinese sentence.

The migration path is:

1. Add specific Chinese direct and label-bound detectors.
2. Move broad CJK quarantine to Heavy.
3. Keep replacement priority so specific Chinese candidates win over broad CJK
   fallback spans.

## Development Corpus

Use public, born-digital, text-extractable Chinese documents only as a
development corpus. Do not commit raw PDFs, extracted Markdown, private files,
or real client material.

The first batch is documented in `docs/redaction-corpus-chinese-rounds.md`.
Workers should convert misses into small synthetic tests in
`src/redactor/engine.test.ts`.

## Testing Strategy

Use synthetic tests first. Each rule needs:

- A positive Chinese example showing the leak that should be redacted.
- At least one counterexample that should stay readable.
- Mixed Chinese-English examples, because public Mainland and Hong Kong
  documents often include English names, URLs, emails, stock codes, and Latin
  company names.

Run:

```bash
npm test
npm run build
node scripts/check-engine-version.mjs
```

for any engine behavior change.

## Success Criteria

- Existing English regression tests pass unchanged.
- Balanced Chinese output remains readable instead of quarantining whole
  paragraphs.
- Direct identifiers and labeled fields from the first development batch become
  synthetic regression tests.
- The engine changelog clearly says Chinese support is deterministic beta
  coverage and lists known limitations.
