# Chinese Redaction Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first deterministic Chinese redaction layer while preserving the existing English engine behavior.

**Architecture:** Keep the current shared redaction pipeline and add a Chinese detector module that contributes candidates through a narrow callback. Move broad CJK quarantine from Balanced to Heavy after specific Chinese rules exist.

**Tech Stack:** Vite, TypeScript, Vitest, browser-only regex/rule-based detection.

---

### Task 1: Add Baseline Chinese Failing Tests

**Files:**
- Modify: `src/redactor/engine.test.ts`

**Step 1: Write failing tests**

Add tests for Chinese direct and label-bound patterns:

```ts
it("redacts Chinese labeled direct identifiers and contact fields", () => {
  const output = redact(`
供应商：青杉数科有限公司
中标供应商统一社会信用代码：91320000MA0TEST12A
合同签订日期：2026年5月25日
合同总金额：人民币79.1万元
联系人：张明
联系方式：19900000000
地址：示例省示例市朝阳区星河路88号A座
`);

  for (const leaked of [
    "青杉数科有限公司",
    "91320000MA0TEST12A",
    "2026年5月25日",
    "人民币79.1万元",
    "张明",
    "19900000000",
    "示例省示例市朝阳区星河路88号A座",
  ]) {
    expect(output).not.toContain(leaked);
  }
});
```

Add a counterexample test that keeps generic Chinese boilerplate readable:

```ts
it("keeps generic Chinese business boilerplate readable at balanced level", () => {
  const output = redact(`
投标人应当按照招标文件的要求提交响应文件。
本项目采购信息发布媒体为中国政府采购网。
`);

  expect(output).toContain("投标人应当按照招标文件的要求提交响应文件");
  expect(output).toContain("本项目采购信息发布媒体为中国政府采购网");
});
```

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/redactor/engine.test.ts
```

Expected: the new direct/labeled Chinese test fails, and the boilerplate test may
fail today because `NON_LATIN_TEXT` redacts broad Chinese text at Balanced.

**Step 3: Commit**

Commit only after this task passes/fails as expected and no raw corpus documents
were added.

```bash
git add src/redactor/engine.test.ts
git commit -m "test(redactor): add baseline Chinese redaction cases"
```

### Task 2: Add A Chinese Detector Module

**Files:**
- Create: `src/redactor/chinese.ts`
- Modify: `src/redactor/engine.ts`

**Step 1: Define the detector interface**

Create a small module that does not import the whole `Detector` class:

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

export function hasHanText(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

export function detectChinese(doc: RedactionInput, add: AddCandidate): void {
  if (!hasHanText(doc.text)) return;
  detectChineseDirectPatterns(doc, add);
  detectChineseLabelValues(doc, add);
}
```

**Step 2: Wire it into `Detector.detect()`**

In `src/redactor/engine.ts`, import `detectChinese` and call it after common
direct patterns and before English people/organization passes:

```ts
this.detectDirectPatterns(doc);
detectChinese(doc, this.add.bind(this));
this.detectLabelValues(doc);
```

**Step 3: Run existing tests**

Run:

```bash
npm test -- src/redactor/engine.test.ts
```

Expected: behavior should not improve yet, but wiring should not break existing
tests.

### Task 3: Implement Chinese Direct Patterns

**Files:**
- Modify: `src/redactor/chinese.ts`
- Modify: `src/redactor/engine.test.ts`

**Step 1: Add direct patterns**

Implement these first:

- `NATIONAL_ID`: PRC resident ID numbers after labels such as `身份证号`.
- `BUSINESS_ID`: Unified Social Credit Codes after `统一社会信用代码`.
- `PHONE`: Chinese mobile and landline numbers after `电话`, `联系电话`,
  `联系方式`, or `手机`.
- `DATE`: `YYYY年M月D日`, `YYYY 年 M 月`, and `二〇二六年`-style years if
  easy to cover explicitly.
- `AMOUNT`: `人民币79.1万元`, `10万元`, `3.5亿元`, and `￥50,000`.

Keep ambiguous bare alphanumeric values label-bound.

**Step 2: Add counterexamples**

Examples that should stay readable:

```ts
expect(output).toContain("统一社会信用代码制度");
expect(output).toContain("联系电话发生变更时应及时通知");
expect(output).toContain("金额以合同约定为准");
```

**Step 3: Run focused tests**

Run:

```bash
npm test -- src/redactor/engine.test.ts
```

Expected: Chinese direct identifiers redact, counterexamples remain readable.

### Task 4: Implement Chinese Label Values

**Files:**
- Modify: `src/redactor/chinese.ts`
- Modify: `src/redactor/engine.test.ts`

**Step 1: Add label-bound value detection**

Handle single-line labels:

- Person: `姓名`, `联系人`, `法定代表人`, `负责人`, `经办律师`, `授权代表`,
  `项目负责人`, `签字会计师`.
- Organization: `供应商`, `采购人`, `代理机构`, `当事人`, `公司名称`,
  `机构全称`, `单位名称`.
- Address: `住所`, `住址`, `注册地址`, `办公地址`, `联系地址`, `地址`.

Split person/org lists on `、`, `，`, `；`, `;`, `/`, and whitespace around
commas where appropriate.

**Step 2: Validate values before adding**

For person labels, accept two-to-four Han characters, optional middle dot, and
simple names with spaces introduced by PDF extraction. For organizations,
require a strong suffix or a strong label. For addresses, require either a
strong address label or address suffixes such as `省`, `市`, `区`, `县`, `路`,
`街`, `号`, `室`, `楼`, `大厦`, or `中心`.

**Step 3: Run focused tests**

Run:

```bash
npm test -- src/redactor/engine.test.ts
```

Expected: labeled Chinese values redact without turning generic headings into
people.

### Task 5: Move Broad CJK Quarantine To Heavy

**Files:**
- Modify: `src/redactor/engine.ts`
- Modify: `src/redactor/engine.test.ts`

**Step 1: Change the existing `NON_LATIN_TEXT` pattern level**

The current `NON_LATIN_TEXT` CJK pattern should become Heavy-only once specific
Chinese rules exist:

```ts
[
  "NON_LATIN_TEXT",
  /[\u3400-\u9fff][\u3400-\u9fff·]{1,}/g,
  3,
  "heavy non-Latin text quarantine",
],
```

**Step 2: Add a Heavy-mode test**

Verify Heavy still masks broad unknown Chinese text:

```ts
const output = redact("未经标记的内部项目代号青山计划反复出现。", "heavy");
expect(output).not.toContain("青山计划");
```

**Step 3: Run tests**

Run:

```bash
npm test -- src/redactor/engine.test.ts
```

Expected: Balanced Chinese prose remains readable unless a specific rule matches;
Heavy keeps broad fallback behavior.

### Task 6: Add Chinese Corpus-Derived Synthetic Cases

**Files:**
- Modify: `src/redactor/engine.test.ts`
- Read: `docs/redaction-corpus-chinese-rounds.md`

**Step 1: Give GLM the worker prompt**

Use `benchmarking/prompts/chinese-engine-worker-round-prompt-template.md` and
the Round 1 links from `docs/redaction-corpus-chinese-rounds.md`.

**Step 2: Convert only general findings**

For each GLM finding, add a synthetic example. Do not paste real names, real
addresses, real IDs, real phone numbers, or real document text into tests.

**Step 3: Run tests**

Run:

```bash
npm test -- src/redactor/engine.test.ts
```

Expected: all synthetic Chinese and existing English tests pass.

### Task 7: Version And Changelog

**Files:**
- Modify: `src/redactor/version.ts`
- Modify: `docs/engine-changelog.md`

**Step 1: Bump the engine version**

Increment the engine version for the behavior change.

**Step 2: Document behavior and limits**

Add a changelog entry that says:

- Chinese deterministic beta layer added.
- Balanced mode no longer quarantines all CJK text.
- Direct identifiers and labeled Chinese fields are covered.
- Free-form Chinese person detection remains limited.

**Step 3: Run required checks**

Run:

```bash
npm test
npm run build
node scripts/check-engine-version.mjs
```

Expected: all pass.

### Task 8: Review For Overfitting

**Files:**
- Review: `src/redactor/chinese.ts`
- Review: `src/redactor/engine.test.ts`
- Review: `docs/engine-changelog.md`

**Step 1: Audit rule generality**

Reject any rule that names a development-corpus-specific company, person,
project, or case. Keep patterns structural: labels, suffixes, formats, and
validated identifiers.

**Step 2: Check no raw corpus files were committed**

Run:

```bash
git status --short
rg -n "real-public-corpus-value-placeholder" src docs benchmarking
```

Expected: no raw public-corpus values in committed tests or source code. Source
candidate titles and URLs may appear in the corpus planning doc.

**Step 3: Final verification**

Run:

```bash
npm test
npm run build
node scripts/check-engine-version.mjs
```

Expected: all pass before release or commit.
