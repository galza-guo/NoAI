# Chinese Engine Second-Pass Development Prompt

You are continuing work on NoAI's deterministic Chinese redaction detector.

Your first response was useful as a research inventory, but now you must move
from research mode into implementation-ready development support.

NoAI is a browser-only, rule-based redaction tool. Do not add AI/LLM calls,
backend uploads, telemetry, analytics, crash reporting, or opaque dependencies
to the redaction path. GLM is offline research support only.

## Current Correction Notes

Before proceeding, correct these assumptions:

- Do not claim a detection gap unless you have verified it against the current
  engine or mark it as `needs verification`.
- The current generic `PHONE` regex may already catch many bare Chinese mobile
  and landline numbers. Focus on cases it misses, mislabels, or overmatches.
- Chinese bank-account labels should map to `BANK_ACCOUNT`, not `BUSINESS_ID`.
- Amounts and dates should follow the current engine convention unless there is
  a clear reason to change it: most `AMOUNT` and `DATE` rules are Balanced,
  while direct identifiers can be Light.
- Bare 18-character USCC and PRC resident ID matching should only be proposed if
  checksum validation is included. Otherwise keep them label-bound.
- Do not suggest broad suffix-only organization rules until you include
  counterexamples for generic words like `银行`, `大学`, `医院`, `中心`, and
  quoted bare suffixes like `"有限公司"`.
- The first useful implementation is not "redact all Chinese"; it is "make
  Balanced Chinese output readable while catching labeled/direct sensitive
  fields."

## Repository Context

Relevant files:

- `src/redactor/engine.ts`
- `src/redactor/rules.ts`
- `src/redactor/types.ts`
- `src/redactor/engine.test.ts`
- `docs/plans/2026-06-18-chinese-redaction-engine-design.md`
- `docs/plans/2026-06-18-chinese-redaction-engine-implementation.md`
- `docs/redaction-corpus-chinese-rounds.md`

Current high-impact architectural decision:

- Add a separate `src/redactor/chinese.ts` detector module.
- Wire it into the existing detector through a narrow `addCandidate` callback.
- Move broad CJK `NON_LATIN_TEXT` quarantine from Balanced to Heavy after
  specific Chinese rules exist.

## Your Goal For This Pass

Produce implementation-ready material for the first Chinese detection set.

Do not write another broad research essay. Deliver exact tests, exact rules, and
open decisions.

## First Implementation Batch

Scope this batch to high-confidence, label-bound/direct patterns:

1. Move broad CJK quarantine to Heavy so Balanced Chinese prose stays readable.
2. `BUSINESS_ID`: Unified Social Credit Code after labels:
   - `统一社会信用代码`
   - `社会信用代码`
3. `NATIONAL_ID`: PRC resident ID after labels:
   - `身份证号`
   - `身份证件号码`
   - `居民身份证号`
4. `PHONE`: Chinese contact labels where generic phone matching is weak or
   mis-scoped:
   - `联系电话`
   - `联系方式`
   - `电话`
   - `手机`
   - `传真`
5. `DATE`: year-anchored Chinese dates:
   - `2026年6月18日`
   - `2026 年 6 月`
   - `2026年06月01日15时30分`
6. `AMOUNT`: Chinese RMB amounts:
   - `人民币12.5万元`
   - `3.5亿元`
   - `2379322.61元`
   - `￥50,000`
7. `ADDRESS`: values after:
   - `住所`
   - `住址`
   - `注册地址`
   - `办公地址`
   - `联系地址`
   - `地址`
8. `PERSON`: values after:
   - `姓名`
   - `联系人`
   - `法定代表人`
   - `负责人`
   - `经办律师`
   - `授权代表`
   - `项目负责人`
   - `签字会计师`
9. `ORG`: values after:
   - `供应商`
   - `采购人`
   - `代理机构`
   - `当事人`
   - `公司名称`
   - `机构全称`
   - `单位名称`
   - `中标人`
   - `投标人`
10. `CASE_REF`: label-bound or rigid-shape references:
    - `沪〔2026〕001号`
    - `案号：（2026）沪0101民初001号`
    - `项目编号：FAKE-2026-0001`
    - `合同编号：HT-2026-0001`
11. `BANK_ACCOUNT`: label-bound only, preferably Heavy unless you can justify
    Balanced:
    - `账号`
    - `开户账号`
    - `银行账号`
    - `对公账号`

Do not include free-form Chinese person detection in this batch.

## Output Required

Return exactly these sections.

### 1. Verification Audit

Take the claims from the first report and divide them into:

- `confirmed`
- `already covered by existing English/common rules`
- `needs verification`
- `defer`

Keep this short. The goal is to prevent bad assumptions before coding.

### 2. Copy-Paste Vitest Tests

Write Vitest test blocks that can be pasted into `src/redactor/engine.test.ts`.

Rules:

- Use invented values only.
- Do not use values copied from public documents.
- For every broad rule, include at least one counterexample that should stay
  readable.
- Assert both `not.toContain(...)` for sensitive values and `toContain(...)` for
  readable Chinese boilerplate.
- Keep tests small and grouped by behavior.

Include tests for:

- Balanced keeps ordinary Chinese prose readable.
- Heavy still allows broad CJK quarantine.
- Chinese labeled direct identifiers redact.
- Chinese labeled people/orgs/addresses redact.
- Chinese dates and RMB amounts redact.
- Chinese case/procurement references redact.
- Bank account labels redact only if in scope.

### 3. Proposed `src/redactor/chinese.ts`

Provide TypeScript code for a new module with:

```ts
import { CandidateKind, RedactionInput } from "./types";

export type AddCandidate = (
  value: string,
  kind: CandidateKind,
  minLevel: number,
  reason: string,
  source: string,
  pos: number,
) => void;

export function detectChinese(doc: RedactionInput, add: AddCandidate): void {
  // ...
}
```

Requirements:

- Keep helpers small and auditable.
- Use explicit regexes and label lists.
- Avoid broad free-form matching.
- Prefer capture groups that redact the sensitive value while preserving the
  label when practical.
- Include a small `cleanChineseValue` helper if needed.
- Add comments only where a rule's false-positive boundary is not obvious.

### 4. Exact `engine.ts` Integration Patch

Describe the exact import and exact call site needed in `src/redactor/engine.ts`.

Also describe the exact change needed for the current `NON_LATIN_TEXT` pattern:

- It should move from Balanced to Heavy.
- Specific Chinese entries should beat broad CJK spans in replacement priority.

### 5. Risk Register

List remaining risks and how to defer them:

- Free-form Chinese names
- Traditional Chinese/HK documents
- Bare USCC/PRC ID checksums
- Organization suffix-only detection
- Bank account false positives
- Chinese numeral dates

### 6. Implementation Order

Give a tight implementation order for a developer:

1. Add failing tests.
2. Add `src/redactor/chinese.ts`.
3. Wire detector.
4. Move `NON_LATIN_TEXT` to Heavy.
5. Run tests.
6. Update `src/redactor/version.ts`: bump `CHINESE_RULES_VERSION` for
   Chinese ruleset-only behavior changes. Do not bump `ENGINE_VERSION` for a
   Chinese ruleset-only patch, even if narrow rule plumbing touches
   `src/redactor/engine.ts`. Bump `ENGINE_VERSION` only for shared
   engine/API/review-metadata changes that are not just the Chinese ruleset
   changing.
7. Update changelog.

Include exact commands:

```bash
npm test -- src/redactor/engine.test.ts
npm test
npm run build
node scripts/check-engine-version.mjs
```

## Hard Limits

- Do not paste raw public-document passages.
- Do not use real public names, addresses, phone numbers, IDs, or codes in
  tests.
- Do not propose model/AI behavior in NoAI runtime.
- Do not write a broad essay. Produce implementation-ready artifacts.
- If you are uncertain, say `needs verification` instead of inventing certainty.
