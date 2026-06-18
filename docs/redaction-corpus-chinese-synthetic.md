# Synthetic Chinese Redaction Torture Corpus

A fully invented, public-safe corpus for the Chinese redaction detector. Every
name, identifier, address, phone, account, and company code below is synthetic.
Nothing here is copied from a real client, regulator filing, prospectus, or
sealed benchmark.

Purpose: feed `src/redactor/engine.test.ts` with regression cases that exercise
labelled direct identifiers, contextual people/orgs, multi-line addresses, mixed
Latin/Chinese values, and a high density of false-positive traps. Codex should
convert each entry into one Vitest `it(...)` block following the existing
`redact(text, level)` helper style.

## How To Read Each Entry

- **Doc** — invented document text, 150–400 Chinese characters.
- **Must redact** — surface spans the detector is expected to mask, each tagged
  with a `CandidateKind` from `src/redactor/types.ts`. The `level` hint shows the
  shallowest level at which the redaction should fire (`B`=balanced, `H`=heavy).
- **Must stay readable** — spans that must survive at balanced level. Many of
  these are intentional false-positive traps.
- **Why useful** — what pattern or boundary this entry stresses.
- **Test idea** — a one-line Vitest case description, ready to drop in.

> Note on forward-looking cases: a few spans below are flagged `[aspirational]`
> because the detector may not catch them yet. As of engine v1.4.1, the
> following previously-aspirational items are now COVERED and should be encoded
> as positive assertions:
> - `股份代號：NNNNN.HK` and `.SH` / `.SZ` stock codes (label-bound).
> - Traditional-Chinese (繁體) strong-suffix orgs (大學/醫院/有限責任公司…).
> - Chinese-numeral dates (`二零二四年十二月三十一日`).
> - `发票号码` / `发票代码` and other finance/procurement reference labels.
>
> The items that REMAIN aspirational (encode as `expect(output).toContain(...)`
> counterexamples, or `it.skip(...)`, so the suite stays green) are:
> - Tabular-cell detection under headers (`姓名`, `证件号码`) — requires table
>   structure parsing, out of scope for the regex engine.
> - Bare Latin person names embedded in Chinese documents (`Lin Xi`, `Su
>   Mingyuan`) — high false-positive risk without segmentation.
> - Bare 8-char SWIFT/BIC codes — too ambiguous without a label.
> - Chinese-numeral amounts (`人民币壹万元整`) — distinct from numeral dates.

---

## Category 1 — Procurement Notice

### Doc 01 — 政府采购竞争性磋商公告

```
虚构市政府采购中心就办公设备更新项目（项目编号：FAKE-CG-2026-0107）组织竞争性磋商。
采购人：虚构市示例局。代理机构：示例招标有限公司。
开标时间：2026年07月09日14时30分。
预算金额：人民币48.5万元。
供应商应当于2026年07月08日前提交响应文件，逾期不予受理。
联系人：林汐，联系电话：19900000007，电子邮箱：linxi@example.org。
注册地址：见附件。详细清单不详。
依据《中华人民共和国政府采购法》及其实施条例。
```

- **Must redact:**
  - `FAKE-CG-2026-0107` — CASE_REF (B)
  - `虚构市示例局` — ORG (B)
  - `示例招标有限公司` — ORG (B)
  - `2026年07月09日14时30分` — DATE (B)
  - `2026年07月08日` — DATE (B)
  - `人民币48.5万元` — AMOUNT (B)
  - `林汐` — PERSON (B)
  - `19900000007` — PHONE (B)
  - `linxi@example.org` — EMAIL (B)
- **Must stay readable:** `注册地址：见附件`, `详细清单不详`, `《中华人民共和国政府采购法》`, `采购人：`, `代理机构：`, `联系人：`, `联系电话：`, `预算金额：`.
- **Why useful:** Dense label block mixing ORG/PERSON/PHONE/EMAIL/DATE/AMOUNT with `见附件` and `不详` placeholders right next to address and amount fields.
- **Test idea:** `it("redacts procurement notice identifiers while keeping 见附件/不详 placeholders and statute names readable")`.

### Doc 02 — 中央国家机关采购公告

```
全国示例信息服务中心2026年度软硬件集成项目（采购编号：ZY-FAKE-2026-0009）公开招标。
项目预算：3.2亿元，资金来源为单位自筹。
中标供应商：虚构云图科技有限公司。
中标金额：人民币2.96亿元。
项目负责人：陈砚之，联系电话010-00000010。
联系地址：北京市虚构区示例路9号院1号楼。
本公告同时在中国政府采购网发布。开户银行：见附件。
近20年同类项目经验者优先。
```

- **Must redact:**
  - `ZY-FAKE-2026-0009` — CASE_REF (B)
  - `3.2亿元` — AMOUNT (B)
  - `虚构云图科技有限公司` — ORG (B)
  - `人民币2.96亿元` — AMOUNT (B)
  - `陈砚之` — PERSON (B)
  - `010-00000010` — PHONE (B)
  - `北京市虚构区示例路9号院1号楼` — ADDRESS (B)
- **Must stay readable:** `开户银行：见附件`, `近20年`, `项目负责人：`, `联系电话`, `中国政府采购网`, `资金来源为单位自筹`, `公开招标`.
- **Why useful:** Stacks `亿元` amounts, `开户银行：见附件` (org-adjacent placeholder), `近20年` (false-positive date trap), and a label-free phone with area code.
- **Test idea:** `it("redacts yi-yuan amounts and labelled procurement contact block without touching 近20年 or 见附件")`.

---

## Category 2 — Procurement Contract

### Doc 03 — 政府采购合同正文片段

```
甲方（采购人）：虚构市示例局
乙方（供应商）：虚构云图科技有限公司
统一社会信用代码：91110108FAKE00007X
合同编号：HT-FAKE-2026-0312
合同总金额：人民币2379322.61元
双方于2026年05月20日签订本合同，自双方签字盖章之日起生效。
乙方应于合同签订后六十日内完成交付，单价1元/件仅作报价口径。
收款账号：6228480000000000000
开户银行：虚构银行示例支行
```

- **Must redact:**
  - `虚构市示例局` — ORG (B)
  - `虚构云图科技有限公司` — ORG (B)
  - `91110108FAKE00007X` — BUSINESS_ID (B)
  - `HT-FAKE-2026-0312` — CASE_REF (B)
  - `人民币2379322.61元` — AMOUNT (B)
  - `2026年05月20日` — DATE (B)
  - `6228480000000000000` — BANK_ACCOUNT (H)
- **Must stay readable:** `单价1元/件`, `甲方（采购人）：`, `乙方（供应商）：`, `统一社会信用代码：`, `合同编号：`, `合同总金额：`, `收款账号：`, `开户银行：`, `自双方签字盖章之日起生效`.
- **Why useful:** Classic contract header: `甲方/乙方` org labels, USCC, contract number, exact-yuan amount, and the `单价1元/件` slash trap that must NOT be redacted as an amount. Bank account label only fires at heavy.
- **Test idea:** `it("redacts contract header identifiers and keeps 单价1元/件 plus party/amount labels readable")`.

### Doc 04 — 合同签署页与定义条款

```
由 林汐 与 陈砚之 就本项目签署本合同。
授权代表：林汐（签字）。乙方授权代表：陈砚之（盖章）。
本合同所称"交付物"指乙方按本合同约定完成的产品与服务。
公司简介：本司专注于办公设备研发，近20年累计服务客户逾千家。
经办律师：苏明远，所属虚构律师事务所。
本合同一式两份，双方各执一份，具有同等法律效力。
生效日期：2026年06月30日。
```

- **Must redact:**
  - `林汐` — PERSON (B)
  - `陈砚之` — PERSON (B)
  - `苏明远` — PERSON (B)
  - `虚构律师事务所` — ORG (B)
  - `2026年06月30日` — DATE (B)
- **Must stay readable:** `由 ... 与 ... 就`, `本合同所称"交付物"`, `本司专注于`, `近20年`, `授权代表：`, `经办律师：`, `本合同一式两份`, `具有同等法律效力`, `生效日期：`.
- **Why useful:** `由 X 与 Y 就` agreement-party heading, role-label people, defined term `交付物`, generic `本司`/`公司简介`, and `近20年` again — proves context persons work without eating boilerplate.
- **Test idea:** `it("redacts agreement-party heading and role-labelled lawyers without touching defined terms or 本司 prose")`.

---

## Category 3 — IPO / Prospectus Excerpt

### Doc 05 — 招股说明书封面与联系方式

```
虚构星图科技股份有限公司首次公开发行股票并在主板上市招股说明书
发行人：虚构星图科技股份有限公司
统一社会信用代码：91350100FAKE00018K
法定代表人：周亦白
住所：福建省福州市虚构区示例大道18号
保荐人（主承销商）：示例证券股份有限公司
联系电话：0591-00001818
传真：0591-00001819
签署日期：2026年06月18日
投资者应认真阅读风险因素章节。
```

- **Must redact:**
  - `虚构星图科技股份有限公司` — ORG (B)
  - `91350100FAKE00018K` — BUSINESS_ID (B)
  - `周亦白` — PERSON (B)
  - `福建省福州市虚构区示例大道18号` — ADDRESS (B)
  - `示例证券股份有限公司` — ORG (B)
  - `0591-00001818` — PHONE (B)
  - `0591-00001819` — PHONE (B)
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `发行人：`, `统一社会信用代码：`, `法定代表人：`, `住所：`, `保荐人（主承销商）：`, `联系电话：`, `传真：`, `签署日期：`, `投资者应认真阅读风险因素章节`, `首次公开发行股票并在主板上市招股说明书`.
- **Why useful:** Prospectus cover block: dense ORG/ID/PERSON/ADDRESS/PHONE/DATE with two labelled landline phones and a `住所` address — the canonical Chinese disclosure contact layout.
- **Test idea:** `it("redacts prospectus cover identifiers and keeps risk-factor and underwriter-label prose readable")`.

### Doc 06 — 招股说明书风险与募投片段

```
本次发行拟募集资金人民币12.8亿元，用于研发中心建设项目及补充流动资金。
报告期内，公司营业收入由2023年度的人民币3.1亿元增长至2025年度的人民币7.6亿元。
实际控制人周亦白直接持有公司38.6%的股份。
公司位于福建省福州市虚构区，办公地址不详。
主要客户虚构光电科技有限公司贡献收入占比约21%。
风险因素：原材料价格波动、汇率变动、技术迭代风险。
近20年行业平均增速约9%。
```

- **Must redact:**
  - `人民币12.8亿元` — AMOUNT (B)
  - `2023年度` — DATE (B)
  - `人民币3.1亿元` — AMOUNT (B)
  - `2025年度` — AMOUNT-adjacent / DATE (B)
  - `人民币7.6亿元` — AMOUNT (B)
  - `周亦白` — PERSON (B)
  - `38.6%` — AMOUNT (B, if percent handling covers Chinese context)
  - `虚构光电科技有限公司` — ORG (B)
  - `福建省福州市虚构区` — LOCATION/ADDRESS (B)
- **Must stay readable:** `办公地址不详`, `风险因素：`, `原材料价格波动`, `汇率变动`, `技术迭代风险`, `研发中心建设项目`, `补充流动资金`, `近20年`, `报告期内`, `营业收入`.
- **Why useful:** Mixed bare-context ORG/PERSON inside prose, `办公地址不详` (address placeholder), `近20年`, `年度` date forms, and a standalone percentage.
- **Test idea:** `it("redacts contextual org/person in prospectus prose while keeping 办公地址不详 and risk-factor boilerplate")`.

---

## Category 4 — CSRC-Style Penalty Decision

### Doc 07 — 行政处罚决定书当事人段

```
当事人：虚构数据科技有限公司（住所：上海市虚构区示例环路99号）
统一社会信用代码：91310115FAKE00007H
法定代表人：周亦白
2026年3月，当事人披露的年度报告中虚增营业收入。
依据《中华人民共和国证券法》第一百九十七条的规定，我局决定：
对虚构数据科技有限公司责令改正，给予警告，并处以罚款人民币120万元。
直接负责的主管人员周亦白被处以罚款人民币40万元。
文号：沪〔2026〕FAKE号。
```

- **Must redact:**
  - `虚构数据科技有限公司` — ORG (B)
  - `上海市虚构区示例环路99号` — ADDRESS (B)
  - `91310115FAKE00007H` — BUSINESS_ID (B)
  - `周亦白` — PERSON (B)
  - `2026年3月` — DATE (B)
  - `人民币120万元` — AMOUNT (B)
  - `人民币40万元` — AMOUNT (B)
  - `沪〔2026〕FAKE号` — CASE_REF (B)
- **Must stay readable:** `《中华人民共和国证券法》`, `第一百九十七条`, `当事人：`, `住所：`, `统一社会信用代码：`, `法定代表人：`, `依据 ... 的规定`, `责令改正`, `给予警告`.
- **Why useful:** Regulatory decision with `当事人` org label, `住所` address, statute name in `《》`, section article number, and `沪〔2026〕FAKE号`-style document number — core batch-two regulatory coverage.
- **Test idea:** `it("redacts CSRC decision parties, fines, and 沪〔YYYY〕N号 document number, keeps statute and article readable")`.

### Doc 08 — 行政处罚决定书陈述申辩段

```
当事人周亦白在听证中提出申辩：其一，主观上无违法故意；其二，虚增金额已在次年更正。
经复核，我局对申辩意见不予采纳。理由如下：财务报告虚增比例达15.8%，
严重误导投资者。当事人住所：北京市虚构区示例路2号。
住址：详见附件。联系方式：暂无。
本案案号：（2026）沪01FAKE初007号。
决定书送达日期：2026年06月30日。
```

- **Must redact:**
  - `周亦白` — PERSON (B)
  - `15.8%` — AMOUNT (B)
  - `北京市虚构区示例路2号` — ADDRESS (B)
  - `（2026）沪01FAKE初007号` — CASE_REF (B)
  - `2026年06月30日` — DATE (B)
- **Must stay readable:** `住址：详见附件`, `联系方式：暂无`, `当事人 ... 在听证中提出申辩`, `经复核，我局对申辩意见不予采纳`, `理由如下`, `决定书送达日期：`, `其一`, `其二`, `次年更正`.
- **Why useful:** Court-style case number `（YYYY）...号`, percentages in regulatory prose, and a triple stack of address/contact placeholders (`详见附件`, `暂无`) that must stay readable next to real address spans.
- **Test idea:** `it("redacts court case number and percentage in penalty prose while keeping 详见附件/暂无 placeholders")`.

---

## Category 5 — Legal Opinion

### Doc 09 — 法律意见书结尾与签署

```
综上，本所律师认为，虚构星图科技股份有限公司本次股票发行符合
《中华人民共和国公司法》《中华人民共和国证券法》的有关规定。
本法律意见书正本一式伍份，经本所盖章及经办律师签字后生效。
经办律师：苏明远（执业证号：FAKE-BAR-2026-0033）
经办律师：林岚（执业证号：FAKE-BAR-2026-0034）
律师事务所：虚构天衡联合律师事务所
签署日期：2026年06月18日
```

- **Must redact:**
  - `虚构星图科技股份有限公司` — ORG (B)
  - `苏明远` — PERSON (B)
  - `FAKE-BAR-2026-0033` — BUSINESS_ID / CASE_REF (B)
  - `林岚` — PERSON (B)
  - `FAKE-BAR-2026-0034` — BUSINESS_ID / CASE_REF (B)
  - `虚构天衡联合律师事务所` — ORG (B)
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `综上，本所律师认为`, `《中华人民共和国公司法》`, `《中华人民共和国证券法》`, `本法律意见书正本一式伍份`, `经办律师：`, `律师事务所：`, `签署日期：`, `符合 ... 的有关规定`.
- **Why useful:** Legal-opinion signature block: multiple `经办律师` people, lawyer licence numbers as BUSINESS_ID/CASE_REF, two statute names in `《》`, and `本所`/`律师事务所` org prose.
- **Test idea:** `it("redacts legal-opinion signatories and lawyer licence numbers, keeps statute names and 本所 prose")`.

### Doc 10 — 法律意见书主体引用段

```
本所接受虚构星图科技股份有限公司的委托，就其2025年度股权激励计划出具本法律意见。
本所律师已对激励对象名单、授予价格人民币8.5元/股及归属条件进行了核查。
激励对象包括公司法定代表人周亦白及核心员工陈砚之。
本所同意将本法律意见书作为申请文件报送证券监督管理机构。
详见后附名单。激励计划尚需公司股东大会审议通过。
```

- **Must redact:**
  - `虚构星图科技股份有限公司` — ORG (B)
  - `2025年度` — DATE (B)
  - `人民币8.5元/股` — AMOUNT (B, per-share trap)
  - `周亦白` — PERSON (B)
  - `陈砚之` — PERSON (B)
- **Must stay readable:** `本所接受 ... 的委托`, `本所律师已对 ... 进行了核查`, `详见后附名单`, `激励对象`, `归属条件`, `授予价格`, `证券监督管理机构`, `股东大会审议通过`.
- **Why useful:** `详见后附名单` placeholder inside a real opinion, a per-share amount `元/股` that must still redact as AMOUNT (contrast with `单价1元/件` which must not), and bare contextual people.
- **Test idea:** `it("redacts per-share 元/股 amount and contextual people while keeping 详见后附名单 readable")`.

---

## Category 6 — Asset-Management Contract

### Doc 11 — 资产管理合同当事人与账户

```
资产管理人：虚构恒通资产管理有限公司
资产托管人：示例银行股份有限公司
委托人：周亦白
合同编号：FAKE-AM-2026-0078
计划名称：虚构恒通7号定向资产管理计划
管理期限：自2026年07月01日起至2028年06月30日止。
委托资产：人民币5,000万元。
托管账号：9999999999999999999
托管银行：示例银行虚构支行
管理人办公地址：上海市浦东新区虚构环路1号
```

- **Must redact:**
  - `虚构恒通资产管理有限公司` — ORG (B)
  - `示例银行股份有限公司` — ORG (B)
  - `周亦白` — PERSON (B)
  - `FAKE-AM-2026-0078` — CASE_REF (B)
  - `虚构恒通7号定向资产管理计划` — PROJECT/ORG (B)
  - `2026年07月01日` — DATE (B)
  - `2028年06月30日` — DATE (B)
  - `人民币5,000万元` — AMOUNT (B)
  - `9999999999999999999` — BANK_ACCOUNT (H)
  - `示例银行虚构支行` — ORG (B)
  - `上海市浦东新区虚构环路1号` — ADDRESS (B)
- **Must stay readable:** `资产管理人：`, `资产托管人：`, `委托人：`, `合同编号：`, `计划名称：`, `管理期限：`, `委托资产：`, `托管账号：`, `托管银行：`, `管理人办公地址：`, `定向资产管理计划`.
- **Why useful:** Asset-management contract with `委托人` as a real PERSON (not just an org), comma-grouped wan-yuan amount, date-range `自...起至...止`, and a real address with `浦东新区` (a genuine district name reused with fake street).
- **Test idea:** `it("redacts asset-management parties, plan name, date range, and grouped wan-yuan amount")`.

---

## Category 7 — Invoice / Payment Instruction

### Doc 12 — 增值税专用发票核心字段

```
购货单位：虚构示例商贸有限公司
统一社会信用代码：91310104FAKE000091
销货单位：虚构制造科技有限公司
货物名称：办公耗材，规格详见附件。
金额：人民币38,650.00元，税率13%，税额人民币5,024.50元。
价税合计：人民币43,674.50元。
开票日期：2026年06月18日。
收款人：林岚，复核：苏明远，开票人：周亦白。
备注：本发票单价1元/件仅用于核算示例。
```

- **Must redact:**
  - `虚构示例商贸有限公司` — ORG (B)
  - `91310104FAKE000091` — BUSINESS_ID (B)
  - `虚构制造科技有限公司` — ORG (B)
  - `人民币38,650.00元` — AMOUNT (B)
  - `13%` — AMOUNT (B)
  - `人民币5,024.50元` — AMOUNT (B)
  - `人民币43,674.50元` — AMOUNT (B)
  - `2026年06月18日` — DATE (B)
  - `林岚` — PERSON (B)
  - `苏明远` — PERSON (B)
  - `周亦白` — PERSON (B)
- **Must stay readable:** `购货单位：`, `销货单位：`, `货物名称：`, `规格详见附件`, `金额：`, `税率`, `税额`, `价税合计：`, `开票日期：`, `收款人：`, `复核：`, `开票人：`, `备注：`, `单价1元/件`, `核算示例`.
- **Why useful:** Invoice amount cascade (net/tax/total), VAT rate `13%` that must redact as AMOUNT but leave the label `税率` readable, and `单价1元/件` trap right next to a real `元` amount.
- **Test idea:** `it("redacts invoice net/tax/total amounts and VAT rate while keeping 单价1元/件 and 详见附件 readable")`.

### Doc 13 — 付款指令与银行账户

```
付款指令编号：PAY-FAKE-2026-0061
收款人：虚构示例商贸有限公司
收款账号：6227000000000000000
开户银行：虚构银行示例支行
付款金额：人民币43,674.50元
付款人：虚构星图科技股份有限公司
指令日期：2026年06月30日
请于到期日前完成支付，逾期按日计收违约金。
本指令一经发出不可撤销。银行系统将自动校验账户信息。
```

- **Must redact:**
  - `PAY-FAKE-2026-0061` — CASE_REF (B)
  - `虚构示例商贸有限公司` — ORG (B)
  - `6227000000000000000` — BANK_ACCOUNT (H)
  - `虚构银行示例支行` — ORG (B)
  - `人民币43,674.50元` — AMOUNT (B)
  - `虚构星图科技股份有限公司` — ORG (B)
  - `2026年06月30日` — DATE (B)
- **Must stay readable:** `付款指令编号：`, `收款人：`, `收款账号：`, `开户银行：`, `付款金额：`, `付款人：`, `指令日期：`, `本指令一经发出不可撤销`, `银行系统将自动校验账户信息`, `逾期按日计收违约金`.
- **Why useful:** Payment instruction with `收款账号`/`开户银行` (heavy-only BANK_ACCOUNT), a generic `银行系统` prose sentence (false-positive org trap), and a reference number that looks like a phone prefix but is a CASE_REF.
- **Test idea:** `it("redacts payment instruction references and bank account at heavy, keeps generic 银行系统 prose readable")`.

---

## Category 8 — Board / Shareholder Notice

### Doc 14 — 董事会决议通知

```
虚构星图科技股份有限公司关于召开第三届董事会第二十一次会议的通知。
会议时间：2026年07月15日09时00分。
会议地点：公司会议室（地址详见附件）。
参会董事：周亦白、陈砚之、林岚、苏明远、何砚秋。
会议议程：审议关于聘任总经理的议案、关于修订公司章程的议案。
独立董事意见详见后附名单。
联系人：何砚秋，联系电话010-00000021。
本次会议由董事长周亦白召集。
```

- **Must redact:**
  - `虚构星图科技股份有限公司` — ORG (B)
  - `2026年07月15日09时00分` — DATE (B)
  - `周亦白` — PERSON (B)
  - `陈砚之` — PERSON (B)
  - `林岚` — PERSON (B)
  - `苏明远` — PERSON (B)
  - `何砚秋` — PERSON (B)
  - `010-00000021` — PHONE (B)
- **Must stay readable:** `关于召开第三届董事会第二十一次会议的通知`, `会议时间：`, `会议地点：`, `公司会议室（地址详见附件）`, `会议议程：`, `关于聘任总经理的议案`, `关于修订公司章程的议案`, `独立董事意见详见后附名单`, `联系人：`, `联系电话`, `本次会议由董事长 ... 召集`.
- **Why useful:** Board notice with a 5-name `、`-separated director list (tests `splitChineseList`), two placeholders (`地址详见附件`, `详见后附名单`), and `董事长` as a person prefix. `公司` appears generically multiple times.
- **Test idea:** `it("redacts comma-separated director list and keeps 见附件/后附名单 placeholders and 公司 prose readable")`.

### Doc 15 — 股东大会通知与表决

```
虚构星图科技股份有限公司2025年年度股东大会会议决议。
会议于2026年06月20日在公司注册地址召开。
出席会议股东持有表决权股份占公司股份总数的68.2%。
审议通过《关于2025年度利润分配方案的议案》，同意比例99.1%。
法定代表人周亦白主持会议。
下次会议时间：2026年09月第三个星期五。
记录人：林岚。本决议经全体与会股东签字确认。
```

- **Must redact:**
  - `虚构星图科技股份有限公司` — ORG (B)
  - `2026年06月20日` — DATE (B)
  - `68.2%` — AMOUNT (B)
  - `《关于2025年度利润分配方案的议案》` — keep title readable but `2025年度` may be DATE; if redacted, redact the inner date only
  - `99.1%` — AMOUNT (B)
  - `周亦白` — PERSON (B)
  - `2026年09月第三个星期五` — DATE (B)
  - `林岚` — PERSON (B)
- **Must stay readable:** `2025年年度股东大会会议决议`, `公司注册地址`, `出席会议股东`, `表决权股份`, `审议通过`, `利润分配方案`, `法定代表人`, `记录人：`, `本决议经全体与会股东签字确认`, `下次会议时间：`.
- **Why useful:** Percentages as quorum/approval figures, a statute-like title inside `《》` that contains a date, a relative-date phrase `第三个星期五`, and `公司注册地址` (generic, must not be eaten as an address value).
- **Test idea:** `it("redacts quorum/approval percentages and meeting dates, keeps 议案 title and 公司注册地址 prose readable")`.

---

## Category 9 — Employment / HR Form

### Doc 16 — 员工入职登记表

```
姓名：林汐　　性别：女　　出生日期：1995年08月08日
身份证号：99999519950808999X
联系电话：19900000095
紧急联系人：陈砚之（关系：配偶）
家庭住址：江苏省南京市玄武区虚构路1号
入职部门：研发中心
岗位：高级工程师
合同期限：自2026年07月01日起三年
试用期工资：人民币12,000元/月，转正后人民币15,000元/月。
开户银行：见附件。学历：见附件。
```

- **Must redact:**
  - `林汐` — PERSON (B)
  - `1995年08月08日` — DATE (B)
  - `99999519950808999X` — NATIONAL_ID (B)
  - `19900000095` — PHONE (B)
  - `陈砚之` — PERSON (B)
  - `江苏省南京市玄武区虚构路1号` — ADDRESS (B)
  - `2026年07月01日` — DATE (B)
  - `人民币12,000元/月` — AMOUNT (B)
  - `人民币15,000元/月` — AMOUNT (B)
- **Must stay readable:** `姓名：`, `性别：`, `出生日期：`, `身份证号：`, `联系电话：`, `紧急联系人：`, `家庭住址：`, `入职部门：`, `岗位：`, `合同期限：`, `试用期工资：`, `开户银行：见附件`, `学历：见附件`, `研发中心`, `高级工程师`.
- **Why useful:** HR form with `身份证号` (NATIONAL_ID), `紧急联系人` (PERSON via split), two per-month amounts `元/月`, and two `见附件` placeholders on the same line as `开户银行`/`学历` labels.
- **Test idea:** `it("redacts HR form national ID, contacts, and per-month salaries, keeps 见附件 placeholders and department labels")`.

### Doc 17 — 员工薪酬与社保字段

```
员工编号：EMP-FAKE-2026-0102
所属单位：虚构示例科技有限公司
社保账号：FAKE-SI-2026-0102
公积金账号：FAKE-HF-2026-0102
发薪账号：6228480000000000001
开户银行：虚构银行示例支行
本月应发：人民币18,500.00元，社保扣除人民币1,850.00元。
个税：见附件。实发：人民币16,650.00元。
经办人：苏明远，制表：林岚，审批：周亦白。
统计周期：2026年06月。近20年工龄员工享受额外补贴。
```

- **Must redact:**
  - `EMP-FAKE-2026-0102` — CASE_REF/BUSINESS_ID (B)
  - `虚构示例科技有限公司` — ORG (B)
  - `FAKE-SI-2026-0102` — BUSINESS_ID (B)
  - `FAKE-HF-2026-0102` — BUSINESS_ID (B)
  - `6228480000000000001` — BANK_ACCOUNT (H)
  - `虚构银行示例支行` — ORG (B)
  - `人民币18,500.00元` — AMOUNT (B)
  - `人民币1,850.00元` — AMOUNT (B)
  - `人民币16,650.00元` — AMOUNT (B)
  - `苏明远` — PERSON (B)
  - `林岚` — PERSON (B)
  - `周亦白` — PERSON (B)
  - `2026年06月` — DATE (B)
- **Must stay readable:** `员工编号：`, `所属单位：`, `社保账号：`, `公积金账号：`, `发薪账号：`, `开户银行：`, `本月应发：`, `社保扣除`, `个税：见附件`, `实发：`, `经办人：`, `制表：`, `审批：`, `统计周期：`, `近20年`, `额外补贴`.
- **Why useful:** Payroll fields with multiple reference-style BUSINESS_IDs (社保/公积金), per-month amounts, `个税：见附件`, and a `所属单位` org label distinct from `开户银行`.
- **Test idea:** `it("redacts payroll reference IDs, salary cascade, and approver names, keeps 个税：见附件 and 近20年 readable")`.

---

## Category 10 — Mixed Chinese-English Contact Block

### Doc 18 — 中英文混排联系模块

```
联系人 / Contact: 林汐 (Lin Xi)
公司 / Company: 虚构星图科技股份有限公司 (Fuxing Star Map Tech Co., Ltd.)
电话 / Tel: +86-21-00001818
手机 / Mobile: +86 199 0000 0018
邮箱 / Email: lin.xi@fuxing-example.com
地址 / Address: Room 1801, Building A, 18 Fuxing Road, Shanghai
统一社会信用代码 / USCC: 91310101FAKE000181
开票资料见附件 / Billing info: see attachment.
Please reply before 2026-07-01. 单价1元/件 is reference only.
```

- **Must redact:**
  - `林汐` — PERSON (B)
  - `Lin Xi` — PERSON (B, if Latin-name detection covers this context)
  - `虚构星图科技股份有限公司` — ORG (B)
  - `Fuxing Star Map Tech Co., Ltd.` — ORG (B)
  - `+86-21-00001818` — PHONE (B)
  - `+86 199 0000 0018` — PHONE (B)
  - `lin.xi@fuxing-example.com` — EMAIL (B)
  - `Room 1801, Building A, 18 Fuxing Road, Shanghai` — ADDRESS (B)
  - `91310101FAKE000181` — BUSINESS_ID (B)
  - `2026-07-01` — DATE (B)
- **Must stay readable:** `联系人 / Contact:`, `公司 / Company:`, `电话 / Tel:`, `手机 / Mobile:`, `邮箱 / Email:`, `地址 / Address:`, `统一社会信用代码 / USCC:`, `开票资料见附件 / Billing info: see attachment.`, `Please reply before`, `单价1元/件 is reference only`.
- **Why useful:** Bilingual label-value pairs where Chinese and English sit on the same line; international phone formats; a fully English address line that must still redact in a Chinese document; `见附件` bilingual; and a slash-led `单价1元/件` that must NOT redact.
- **Test idea:** `it("redacts bilingual contact pairs, international phones, and English address line in a Chinese document")`.

### Doc 19 — 招股书英文简称与代码混排

```
Issuer: 虚构星图科技股份有限公司 (Stock Code: 600FAKE, Short Name: FUXING STAR)
保荐人 / Sponsor: 示例证券股份有限公司
Legal Adviser: 虚构天衡联合律师事务所 (Partner: 苏明远 / Su Mingyuan)
Auditor: 示例会计师事务所 (License No.: FAKE-CPA-2026-0011)
Listing Date: 2026-07-09
Offer Price: RMB 18.88 per share / 人民币18.88元/股
Registrar and Transfer Office: 示例证券登记有限公司
Contact: linxi@fuxing-example.com, +86-19900000018
```

- **Must redact:**
  - `虚构星图科技股份有限公司` — ORG (B)
  - `600FAKE` — BUSINESS_ID (B, stock code)
  - `FUXING STAR` — ORG (B, short name)
  - `示例证券股份有限公司` — ORG (B)
  - `虚构天衡联合律师事务所` — ORG (B)
  - `苏明远` — PERSON (B)
  - `Su Mingyuan` — PERSON (B)
  - `示例会计师事务所` — ORG (B)
  - `FAKE-CPA-2026-0011` — BUSINESS_ID/CASE_REF (B)
  - `2026-07-09` — DATE (B)
  - `RMB 18.88 per share` — AMOUNT (B)
  - `人民币18.88元/股` — AMOUNT (B)
  - `示例证券登记有限公司` — ORG (B)
  - `linxi@fuxing-example.com` — EMAIL (B)
  - `+86-19900000018` — PHONE (B)
- **Must stay readable:** `Issuer:`, `Stock Code:`, `Short Name:`, `保荐人 / Sponsor:`, `Legal Adviser:`, `Partner:`, `Auditor:`, `License No.:`, `Listing Date:`, `Offer Price:`, `per share`, `Registrar and Transfer Office:`, `Contact:`.
- **Why useful:** Listing announcement with mixed Chinese/English org and person names, a stock code after `Stock Code:`, bilingual per-share price (both `RMB ... per share` and `人民币...元/股` must redact), and an English partner name.
- **Test idea:** `it("redacts mixed Chinese/English issuer, stock code, bilingual per-share price, and partner name")`.

---

## Category 11 — Traditional Chinese / HK-Style Disclosure

### Doc 20 — 香港上市公司年報披露摘錄

```
騰訊控股有限公司（股份代號：00700.HK）二零二四年度報告摘錄。
董事會成員包括：馬化騰（主席）、劉熾平（行政總裁）及若干獨立非執行董事。
本公司截至二零二四年十二月三十一日止年度的收入為人民幣6,090億元。
主要營業地點：香港灣仔虚构道18號。
股份過戶登記處：香港中央證券登記有限公司。
聯絡電話：(852) 0000 1800。電郵：ir@fuxing-example.hk。
投資者應參閱《香港聯合交易所有限公司證券上市規則》。詳情請參閱附錄。
本公司業務遍及近20個國家及地區。
```

> Note: Traditional-Chinese person/org detection (`騰訊控股`, `馬化騰`, `劉熾平`) and the `股份代號：NNNNN.HK` form are flagged `[aspirational]` for the simplified-Chinese detector. The corpus lists them so Codex can decide whether to (a) add a Traditional pass, or (b) encode them as explicit `expect(output).toContain(...)` counterexamples until then. Chinese-numeral dates (`二零二四年十二月三十一日`) and `(852)` HK phone format are likewise aspirational.

- **Must redact [aspirational]:**
  - `騰訊控股有限公司` — ORG
  - `00700.HK` — BUSINESS_ID
  - `馬化騰` — PERSON
  - `劉熾平` — PERSON
  - `二零二四年十二月三十一日` — DATE
  - `人民幣6,090億元` — AMOUNT
  - `香港灣仔虚构道18號` — ADDRESS
  - `香港中央證券登記有限公司` — ORG
  - `(852) 0000 1800` — PHONE
  - `ir@fuxing-example.hk` — EMAIL
- **Must stay readable:** `股份代號：`, `董事會成員包括`, `主席`, `行政總裁`, `獨立非執行董事`, `本公司截至`, `止年度的收入為`, `主要營業地點：`, `股份過戶登記處：`, `聯絡電話：`, `電郵：`, `《香港聯合交易所有限公司證券上市規則》`, `詳情請參閱附錄`, `本公司業務遍及`, `近20個國家及地區`.
- **Why useful:** Traditional Chinese (繁體) disclosure with Chinese-numeral dates, `(852)` HK phone, `.HK` stock code, `人民幣` (traditional form of 人民币), and a statute-name-in-《》 plus `參閱附錄` placeholder. Decides whether batch-two opts in to a Traditional pass.
- **Test idea:** `it("[aspirational] redacts Traditional Chinese issuer, officers, numeral date, and HK contact block, keeps 上市規則 and 附錄 readable")`.

---

## Coverage Summary

| Kind | Docs exercising it |
| ---- | ------------------ |
| PERSON | 01, 02, 04, 05, 06, 07, 08, 09, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20 |
| ORG | 01, 02, 03, 05, 06, 07, 09, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20 |
| ADDRESS | 02, 05, 07, 08, 11, 16, 18, 20 |
| BUSINESS_ID | 03, 05, 07, 12, 17, 18, 19, 20 |
| NATIONAL_ID | 16 |
| PHONE | 01, 02, 05, 14, 16, 18, 19, 20 |
| EMAIL | 01, 18, 19, 20 |
| DATE | 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 |
| AMOUNT | 01, 02, 03, 06, 07, 08, 10, 11, 12, 13, 15, 16, 17, 19, 20 |
| CASE_REF | 01, 02, 03, 07, 08, 09, 11, 13, 17, 19 |
| BANK_ACCOUNT | 03, 11, 13, 17 |

## False-Positive Trap Index

These spans must survive at balanced level and are deliberately scattered across
the corpus:

- `见附件` / `详见附件` / `详见后附名单` / `详见附名单` — address/org/billing placeholders (01, 03, 08, 10, 14, 16, 18).
- `不详` — address/value placeholder (01).
- `暂无` — contact placeholder (08).
- `单价1元/件` — slash-led unit price, must NOT redact (03, 12, 18).
- `近20年` / `近20个` — false-positive date/number trap (02, 04, 06, 17, 20).
- `《...》` statute / 议案 names — must stay readable (01, 07, 08, 09, 15, 20).
- Generic `公司` / `本司` / `本所` / `银行系统` prose (04, 09, 13, 14, 15).
- Generic suffix uses `银行` / `大学` / `医院` / `中心` / `公司` as common nouns (06 `研发中心`, 13 `银行系统`, 16 `研发中心`).
- Headings: `第一章 总则`, `风险因素`, `目录`, `重要提示` style (reference Doc in existing suite; mirror here in 05/06/15).
- `公司注册地址` / `办公地址不详` — generic address-context prose, not address values (06, 15).
- Section/article numbers `第一百九十七条` (07) and meeting ordinal `第三届第二十一次` (14).
- Relative-date phrases such as `第三个星期五` and `第N个` ordinals (15).

## Conversion Notes For Codex

1. Use the existing `redact(text, level)` helper in `engine.test.ts`. Default
   `level` is `balanced`; only switch to `heavy` for BANK_ACCOUNT-only assertions.
2. For each doc, build one `it(...)` that asserts `not.toContain` for every
   "must redact" surface span and `toContain` for the "must stay readable" spans.
3. For aspirational spans (Traditional-Chinese 繁體 people/orgs, bare Latin
   person names like `Lin Xi` / `Su Mingyuan`, `股份代號：NNNNN.HK` stock codes,
   and Chinese-numeral dates `二零二四年...`), either:
   - add the deterministic rule first (batch two), then enable the assertion, or
   - encode as a counterexample `expect(output).toContain(<aspirational span>)`
     with a `// TODO(batch-two)` comment so the suite stays green.
4. Keep the synthetic USCC/PRC-ID/phone values obviously fake (`FAKE` infixes,
   `999...` ID ranges, `0000` phone blocks) so nothing can be mistaken for a
   real record.
5. Do not merge real PII. If any value accidentally resembles a real record,
   re-randomize before committing.

---

# Part Two — Extended Corpus (Extended Batches 1–3)

Part One covered Docs 01–20 organized by category. Part Two adds Docs 21–50,
organized in **batches of ten** per the continuation request, with a short
coverage summary after each batch. Categories are deliberately **mixed within
each batch** for variety; the four new categories added in this phase —
regulator notice, bank/payment form, shareholder register/cap table, and
litigation/court-style notice — appear here alongside refreshed examples of the
original eleven.

All identifiers are synthetic and now **structurally valid length**: USCC values
are 18 characters, PRC resident IDs are 18 characters, bank accounts are 16–19
digits. They still contain obvious `FAKE` infixes and `999…`/`0000` blocks so
they cannot be confused with real records, and they will not pass real
checksums — only the engine's structural regexes.

Per-entry layout mirrors Part One (text · must redact · must stay readable ·
why useful · test idea), with one added line — **Gaps stressed** — that calls
out known detector gaps the fixture is designed to surface (tabular cells,
Traditional Chinese, unlabelled bare IDs, spaced international phones, Chinese
numerals, etc.). Spans that depend on those gaps are tagged `[aspirational]`.

People names rotate through a fresh invented pool (顾屿, 沈知衡, 裴予安, 程九思,
温时晏, 江临舟, 纪砚书, 韩昭, 黎清越, 楚明远, 卓然, 萧景行, 谢知非, 阮清和,
闻人宥, 俞晚舟, 钟离白, 唐知意, 元嘉树, 段霁川) so nothing collides with
real public figures.

---

## Extended Batch 1 (Docs 21–30)

### Doc 21 — 监管问询函 (regulator notice, exchange inquiry)

```
虚构证券交易所关于对虚构星汉教育投资有限公司的问询函
公司部问询函〔2026〕第0218号
虚构星汉教育投资有限公司：
我部在对你公司2025年年度报告的事后审查中关注到如下事项，请予以核实并补充披露：
一、报告期内，你公司前五大客户合计收入占比达76.3%，请说明客户集中度较高的原因及合理性。
二、你公司应收账款余额为人民币3.8亿元，占营业收入比例达54.2%，请说明回款风险。
三、请你公司聘请的年审会计师示例会计师事务所（执业证号FAKE-CPA-2026-0218）发表专项意见。
请于2026年07月20日前将说明材料报送我部并对外披露。特此函告。
联系人：裴予安，电话021-00000218。
```

- **Must redact:**
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `公司部问询函〔2026〕第0218号` — CASE_REF (B)
  - `76.3%` — AMOUNT (B)
  - `3.8亿元` / `人民币3.8亿元` — AMOUNT (B)
  - `54.2%` — AMOUNT (B)
  - `示例会计师事务所` — ORG (B)
  - `FAKE-CPA-2026-0218` — BUSINESS_ID / CASE_REF (B)
  - `2026年07月20日` — DATE (B)
  - `裴予安` — PERSON (B)
  - `021-00000218` — PHONE (B)
- **Must stay readable:** `关于对…的问询函`, `我部在对你公司2025年年度报告的事后审查中关注到如下事项`, `请予以核实并补充披露`, `一、` / `二、` / `三、`, `客户集中度较高的原因及合理性`, `回款风险`, `请于…前将说明材料报送我部并对外披露`, `特此函告`, `联系人：`, `电话`, `年审会计师`, `前五大客户`.
- **Why useful:** Exchange inquiry letter — a notice type distinct from a penalty decision. Stacks percentages and `亿元` amounts inside regulatory prose.
- **Gaps stressed:** `公司部问询函〔2026〕第0218号` uses the `…〔YYYY〕第N号` form (with `第` before the digits); confirm the regulatory-doc-number rule swallows the `第`. `你公司`/`我部` must read as generic role prose, not orgs.
- **Test idea:** `it("redacts exchange inquiry reference, percentages, yi-yuan amount, and contact; keeps 你公司/我部 and 2025年年度报告 prose readable")`.

### Doc 22 — 税务事项通知书 (regulator notice, tax bureau)

```
国家税务总局虚构市虚构区税务局税务事项通知书
虚构税通〔2026〕0309号
纳税人：虚构远帆科技有限公司
统一社会信用代码：91330106FAKE00309L
应纳税额：人民币1,250,000.00元。
限缴日期：2026年07月31日前缴纳。
依据《中华人民共和国税收征收管理法》第三十二条规定，从滞纳之日起按日加收万分之五滞纳金。
开户银行：见附件。收款国库：虚构区支库。
经办人：沈知衡，联系电话：0571-00003090。
本通知自2026年06月18日起送达。如对本通知不服，可依法申请行政复议。
```

- **Must redact:**
  - `虚构税通〔2026〕0309号` — CASE_REF (B)
  - `虚构远帆科技有限公司` — ORG (B)
  - `91330106FAKE00309L` — BUSINESS_ID (B)
  - `人民币1,250,000.00元` — AMOUNT (B)
  - `2026年07月31日` — DATE (B)
  - `沈知衡` — PERSON (B)
  - `0571-00003090` — PHONE (B)
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `纳税人：`, `统一社会信用代码：`, `应纳税额：`, `限缴日期：`, `依据《中华人民共和国税收征收管理法》`, `第三十二条规定`, `按日加收万分之五滞纳金`, `开户银行：见附件`, `收款国库：虚构区支库`, `经办人：`, `联系电话`, `如对本通知不服，可依法申请行政复议`, `国家税务总局`.
- **Why useful:** Tax-bureau notice with statute name in `《》`, an article number, and `万分之五` (a fraction rate that must NOT be eaten as an amount).
- **Gaps stressed:** `万分之五` rate must survive; `收款国库：虚构区支库` is an institution-style value a naive suffix matcher might wrongly redact.
- **Test idea:** `it("redacts tax notice number, tax amount, and due date; keeps 万分之五 rate, 《税收征管法》, and 见附件 readable")`.

### Doc 23 — 借款合同 (bank/payment form, loan agreement)

```
中国虚构银行股份有限公司虚构分行人民币资金借款合同
借款人：虚构青澜文化传媒有限公司
贷款人：中国虚构银行股份有限公司虚构分行
合同编号：JK-FAKE-2026-0231
借款金额：人民币5,000万元整。
借款期限：自2026年08月01日起至2027年07月31日止，共12个月。
借款用途：补充流动资金，不得用于证券投资。
年利率：4.35%（固定利率）。
还款方式：按月结息，每月20日付息，到期还本。
放款账号：6228480000000000023
开户银行：中国虚构银行虚构支行
法定代表人：顾屿
签署地点：北京市虚构区示例大厦。
```

- **Must redact:**
  - `中国虚构银行股份有限公司虚构分行` — ORG (B)
  - `虚构青澜文化传媒有限公司` — ORG (B)
  - `JK-FAKE-2026-0231` — CASE_REF (B)
  - `人民币5,000万元整` — AMOUNT (B)
  - `2026年08月01日` — DATE (B)
  - `2027年07月31日` — DATE (B)
  - `4.35%` — AMOUNT (B)
  - `6228480000000000023` — BANK_ACCOUNT (H)
  - `中国虚构银行虚构支行` — ORG (B)
  - `顾屿` — PERSON (B)
  - `北京市虚构区示例大厦` — ADDRESS (B)
- **Must stay readable:** `借款人：`, `贷款人：`, `合同编号：`, `借款金额：`, `借款期限：`, `自…起至…止`, `共12个月`, `借款用途：`, `补充流动资金`, `不得用于证券投资`, `年利率：`, `固定利率`, `还款方式：`, `按月结息`, `每月20日付息`, `到期还本`, `放款账号：`, `开户银行：`, `法定代表人：`, `签署地点：`.
- **Why useful:** Loan contract with `整`-suffixed wan-yuan amount, a fixed annual rate, a date range, and the `每月20日付息` canary (sibling of the `每月25日` trap).
- **Gaps stressed:** `每月20日付息` and `共12个月` must not be parsed as dates; `整` must be left readable after the amount is masked.
- **Test idea:** `it("redacts loan parties, 万元整 amount, rate, dates, and account at heavy; keeps 每月20日付息 and 共12个月 readable")`.

### Doc 24 — 跨境汇款申请书 (bank/payment form, cross-border remittance)

```
跨境汇款申请书
汇款人：虚构星汉教育投资有限公司
汇款人地址：上海市虚构区示例环路231号
收款人名称：Fuxing Hanover Education Ltd.
收款人账号：6227000000000000024
收款银行：Hong Kong Example Bank, N.A.
收款银行SWIFT代码：EXHKHK2F
汇款币种及金额：USD 128,000.00
中间行手续费：USD 25.00（由汇款人承担）
汇款用途：咨询服务费，合同号FAKE-FX-2026-0244。
申请日期：2026年06月18日。
经办：程九思，复核：温时晏。
```

- **Must redact:**
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `上海市虚构区示例环路231号` — ADDRESS (B)
  - `Fuxing Hanover Education Ltd.` — ORG (B)
  - `6227000000000000024` — BANK_ACCOUNT (H)
  - `Hong Kong Example Bank, N.A.` — ORG (B)
  - `EXHKHK2F` — BUSINESS_ID (B) `[aspirational: bare 8-char SWIFT/BIC]`
  - `USD 128,000.00` — AMOUNT (B)
  - `USD 25.00` — AMOUNT (B)
  - `FAKE-FX-2026-0244` — CASE_REF (B)
  - `2026年06月18日` — DATE (B)
  - `程九思` — PERSON (B)
  - `温时晏` — PERSON (B)
- **Must stay readable:** `汇款人：`, `汇款人地址：`, `收款人名称：`, `收款人账号：`, `收款银行：`, `收款银行SWIFT代码：`, `汇款币种及金额：`, `中间行手续费：`, `由汇款人承担`, `汇款用途：`, `咨询服务费`, `合同号`, `申请日期：`, `经办：`, `复核：`.
- **Why useful:** Multi-currency remittance with Latin beneficiary/bank names, a SWIFT code, and a contract reference glued to `合同号`.
- **Gaps stressed:** bare `EXHKHK2F` SWIFT code and the `SWIFT代码` label; multi-currency `USD` amounts in a Chinese document.
- **Test idea:** `it("redacts cross-border remittance Latin names, SWIFT code [aspirational], USD amounts, and contract reference")`.

### Doc 25 — 股东名册 (shareholder register / cap table)

```
虚构星汉教育投资有限公司股东名册（截至2026年06月18日）
序号　股东姓名/名称　证件类型　证件号码　持股数（股）　持股比例
1　顾屿　居民身份证　999992198801010025　6,800,000　34.0%
2　裴予安　居民身份证　999993199203150036　5,100,000　25.5%
3　虚构远帆科技有限公司　营业执照　91330106FAKE00309L　4,000,000　20.0%
4　示例创投合伙企业（有限合伙）　营业执照　91310101FAKE00255P　2,600,000　13.0%
5　沈知衡　居民身份证　999994198507200047　1,500,000　7.5%
合计　—　—　20,000,000　100.0%
注：以上持股比例如有尾差，系四舍五入造成。详见附件。
```

- **Must redact:**
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `2026年06月18日` — DATE (B)
  - `顾屿` / `裴予安` / `沈知衡` — PERSON (B) `[aspirational: tabular cell under 姓名 header]`
  - `999992198801010025` / `999993199203150036` / `999994198507200047` — NATIONAL_ID (B) `[aspirational: tabular cell under 证件号码 header]`
  - `虚构远帆科技有限公司` / `示例创投合伙企业（有限合伙）` — ORG (B) `[aspirational: tabular cell]`
  - `91330106FAKE00309L` / `91310101FAKE00255P` — BUSINESS_ID (B) `[aspirational: tabular cell]`
  - `34.0%` / `25.5%` / `20.0%` / `13.0%` / `7.5%` / `100.0%` — AMOUNT (B)
- **Must stay readable:** `股东名册`, `序号`, `股东姓名/名称`, `证件类型`, `证件号码`, `持股数（股）`, `持股比例`, `居民身份证`, `营业执照`, `合计`, `注：以上持股比例如有尾差，系四舍五入造成。详见附件。`, the six share-count figures (`6,800,000` … `20,000,000`).
- **Why useful:** True tabular cap table — the canonical hard case for column-header-driven detection. The `持股数` column looks like amounts but is share counts and must survive.
- **Gaps stressed:** all `证件号码` and `姓名` cells depend on associating a column header with body cells; the current inline label-value matcher will miss them. `100.0%` total is a borderline percentage.
- **Test idea:** `it("redacts cap-table people/IDs/percentages [aspirational tabular]; keeps 持股数 share counts and 详见附件 readable")`.

### Doc 26 — 限制性股票授予登记表 (cap table, equity grants)

```
虚构星汉教育投资有限公司2025年限制性股票激励计划授予登记表
授予日期：2026年06月18日。授予价格：人民币8.80元/股。
激励对象名单如下（详见后附名单完整版）：
姓名　部门　授予数量（股）　职务
温时晏　研发中心　120,000　核心技术人员
江临舟　产品中心　100,000　核心业务骨干
纪砚书　财务中心　80,000　财务负责人
预留部分待定，详见后附名单。
本表数据由董事会薪酬委员会核定，个税处理见附件。
```

- **Must redact:**
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `2026年06月18日` — DATE (B)
  - `人民币8.80元/股` — AMOUNT (B)
  - `温时晏` / `江临舟` / `纪砚书` — PERSON (B) `[aspirational: tabular cell under 姓名 header]`
- **Must stay readable:** `授予日期：`, `授予价格：`, `激励对象名单如下`, `详见后附名单完整版`, `姓名`, `部门`, `授予数量（股）`, `职务`, `研发中心`, `产品中心`, `财务中心`, `核心技术人员`, `核心业务骨干`, `财务负责人`, `预留部分待定`, `本表数据由董事会薪酬委员会核定`, `个税处理见附件`, the three grant-count figures.
- **Why useful:** Per-share `元/股` price that MUST redact (contrast with `单价1元/件` that must not), plus tabular grant recipients and generic `中心` department names.
- **Gaps stressed:** tabular person detection; `待定`/`见附件`/`详见后附名单` triple placeholder stack; `董事会薪酬委员会` must read as a generic body.
- **Test idea:** `it("redacts equity grant date and per-share price, tabular grantees [aspirational]; keeps 待定/详见后附名单/研发中心 readable")`.

### Doc 27 — 应诉通知书 (litigation/court notice, caption)

```
虚构市虚构区人民法院应诉通知书
（2026）虚民初0271号
虚构远帆科技有限公司：
原告沈知衡诉你公司买卖合同纠纷一案，本院已立案受理。
现依法向你公司送达起诉状副本，自收到之日起十五日内提交答辩状。
开庭时间：2026年08月15日09时30分。
开庭地点：本院第三法庭（地址详见附件）。
审判员：韩昭，书记员：卓然。
本案诉讼标的额人民币86万元。原告预交案件受理费人民币12,900元。
请按时到庭，否则依法缺席判决。特此通知。
```

- **Must redact:**
  - `（2026）虚民初0271号` — CASE_REF (B)
  - `虚构远帆科技有限公司` — ORG (B)
  - `沈知衡` — PERSON (B)
  - `2026年08月15日09时30分` — DATE (B)
  - `韩昭` — PERSON (B)
  - `卓然` — PERSON (B)
  - `人民币86万元` — AMOUNT (B)
  - `人民币12,900元` — AMOUNT (B)
- **Must stay readable:** `应诉通知书`, `虚构市虚构区人民法院` (court institution name), `原告`, `诉你公司`, `买卖合同纠纷一案`, `本院已立案受理`, `现依法向你公司送达起诉状副本`, `自收到之日起十五日内提交答辩状`, `开庭时间：`, `开庭地点：`, `本院第三法庭`, `地址详见附件`, `审判员：`, `书记员：`, `本案诉讼标的额`, `原告预交案件受理费`, `请按时到庭，否则依法缺席判决`, `特此通知`.
- **Why useful:** Court caption with `（YYYY）…号` case number, claim amount plus filing fee, and `审判员`/`书记员` role-labelled people.
- **Gaps stressed:** court name (`…人民法院`) must read as a public institution, not an org; `你公司`/`本院` are generic role prose.
- **Test idea:** `it("redacts court case number, parties, trial datetime, and claim amount; keeps 你公司/本院/人民法院 and 详见附件 readable")`.

### Doc 28 — 仲裁裁决书 (litigation/court notice, arbitration)

```
虚构仲裁委员会裁决书
虚仲字〔2026〕第0288号
申请人：虚构青澜文化传媒有限公司
被申请人：示例建设集团有限公司
仲裁请求：裁令被申请人支付工程款人民币2,350,000.00元及逾期利息。
仲裁庭由首席仲裁员谢知非、仲裁员阮清和、仲裁员闻人宥组成。
开庭地：虚构市虚构区示例路88号。
裁决日期：2026年06月30日。
本裁决为终局裁决，自作出之日起发生法律效力。
依据《中华人民共和国仲裁法》第五十七条规定。
```

- **Must redact:**
  - `虚仲字〔2026〕第0288号` — CASE_REF (B)
  - `虚构青澜文化传媒有限公司` — ORG (B)
  - `示例建设集团有限公司` — ORG (B)
  - `人民币2,350,000.00元` — AMOUNT (B)
  - `谢知非` / `阮清和` / `闻人宥` — PERSON (B) `[aspirational: 仲裁员 role label not yet wired]`
  - `虚构市虚构区示例路88号` — ADDRESS (B)
  - `2026年06月30日` — DATE (B)
- **Must stay readable:** `裁决书`, `虚构仲裁委员会`, `申请人：`, `被申请人：`, `仲裁请求：`, `裁令被申请人支付工程款`, `逾期利息`, `仲裁庭由首席仲裁员`, `仲裁员`, `组成`, `开庭地：`, `裁决日期：`, `本裁决为终局裁决，自作出之日起发生法律效力`, `依据《中华人民共和国仲裁法》`, `第五十七条规定`.
- **Why useful:** Arbitration award with `虚仲字〔2026〕第0288号` document number, a compound surname (`闻人宥`), and `仲裁员 X` role-labelled tribunal members.
- **Gaps stressed:** `仲裁员` is not in the person-label set; `被申请人`/`工程款` are generic. `《仲裁法》` and article number must survive.
- **Test idea:** `it("redacts arbitration award number, parties, tribunal members [aspirational], and claim amount; keeps 被申请人/《仲裁法》 readable")`.

### Doc 29 — 中标结果公告 (procurement notice, return-to-variety)

```
虚构市政府采购中心中标结果公告
项目编号：FAKE-CG-2026-0219
项目名称：虚构市示例系统运维服务采购
中标人：虚构云栖数据服务有限公司
中标金额：人民币1,286,000.00元
中标人统一社会信用代码：91310104FAKE00219Q
评审日期：2026年06月18日。
合同签订期：自中标通知书发出之日起三十日内。
质疑联系：俞晚舟，电话19900000229，邮箱yuwz@example.org。
本公告同时在采购网发布，单价1元/件为前期询价口径，详见附件。
```

- **Must redact:**
  - `FAKE-CG-2026-0219` — CASE_REF (B)
  - `虚构云栖数据服务有限公司` — ORG (B)
  - `人民币1,286,000.00元` — AMOUNT (B)
  - `91310104FAKE00219Q` — BUSINESS_ID (B)
  - `2026年06月18日` — DATE (B)
  - `俞晚舟` — PERSON (B)
  - `19900000229` — PHONE (B)
  - `yuwz@example.org` — EMAIL (B)
- **Must stay readable:** `中标结果公告`, `虚构市政府采购中心` (agency name), `项目编号：`, `项目名称：`, `虚构市示例系统运维服务采购`, `中标人：`, `中标金额：`, `中标人统一社会信用代码：`, `评审日期：`, `合同签订期：`, `自中标通知书发出之日起三十日内`, `质疑联系：`, `电话`, `本公告同时在采购网发布`, `单价1元/件为前期询价口径`, `详见附件`.
- **Why useful:** Award notice with full contact triple (person/mobile/email), the `中标人统一社会信用代码` compound label, and `单价1元/件` adjacent to a real `元` amount.
- **Gaps stressed:** `单价1元/件` must NOT redact while `人民币1,286,000.00元` must; `三十日内` relative-period prose must survive.
- **Test idea:** `it("redacts procurement award reference, winner USCC, amount, and contact; keeps 单价1元/件 and 三十日内 readable")`.

### Doc 30 — 增值税电子普通发票 (invoice/payment, e-fapiao)

```
虚构增值税电子普通发票
发票代码：0FAKE000219
发票号码：80000230
开票日期：2026年06月18日
购买方：虚构星汉教育投资有限公司
统一社会信用代码：91310101FAKE00219P
销售方：虚构远帆科技有限公司
货物或应税劳务：信息技术服务费
金额：人民币9,433.96元　税率：6%　税额：人民币566.04元
价税合计：人民币10,000.00元（大写：人民币壹万元整）
收款人：钟离白　复核：唐知意　开票方联系电话：021-00000230
备注：本发票单价1元/件仅为核算示例，详见附件。
```

- **Must redact:**
  - `2026年06月18日` — DATE (B)
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `91310101FAKE00219P` — BUSINESS_ID (B)
  - `虚构远帆科技有限公司` — ORG (B)
  - `人民币9,433.96元` — AMOUNT (B)
  - `6%` — AMOUNT (B)
  - `人民币566.04元` — AMOUNT (B)
  - `人民币10,000.00元` — AMOUNT (B)
  - `人民币壹万元整` — AMOUNT (B) `[aspirational: Chinese-numeral amount]`
  - `0FAKE000219` — BUSINESS_ID (B) `[aspirational: 发票代码 label not wired]`
  - `80000230` — BUSINESS_ID (B) `[aspirational: 发票号码 label not wired]`
  - `钟离白` / `唐知意` — PERSON (B)
  - `021-00000230` — PHONE (B)
- **Must stay readable:** `发票代码：`, `发票号码：`, `开票日期：`, `购买方：`, `统一社会信用代码：`, `销售方：`, `货物或应税劳务：`, `信息技术服务费`, `金额：`, `税率：`, `税额：`, `价税合计：`, `大写：`, `收款人：`, `复核：`, `开票方联系电话：`, `备注：`, `单价1元/件`, `核算示例`, `详见附件`.
- **Why useful:** Invoice net/tax/total cascade with VAT rate, plus a `大写` Chinese-numeral amount line and compound signatory labels.
- **Gaps stressed:** `发票代码：`/`发票号码：` labels and Chinese-numeral `大写` amounts are not yet detected; `税率` label must survive while `6%` redacts.
- **Test idea:** `it("redacts e-invoice amount cascade and signatories; [aspirational] 发票代码/号码 and 大写 Chinese-numeral; keeps 单价1元/件 readable")`.

### Extended Batch 1 coverage

| Kind | Docs exercising it |
| ---- | ------------------ |
| PERSON | 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 |
| ORG | 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 |
| ADDRESS | 23, 24, 28 |
| BUSINESS_ID | 21, 22, 24, 25, 29, 30 |
| NATIONAL_ID | 25 |
| PHONE | 21, 22, 29, 30 |
| EMAIL | 29 |
| DATE | 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 |
| AMOUNT | 21, 22, 23, 24, 25, 26, 27, 28, 29, 30 |
| CASE_REF | 21, 22, 23, 24, 27, 28, 29 |
| BANK_ACCOUNT | 23, 24 |

New trap coverage this batch: `万分之五` rate (22), `整`-suffixed amount (23), `每月20日付息` (23), multi-currency `USD` (24), `持股数` share-count column (25), `元/股` per-share that must redact (26), `你公司`/`本院`/法院-institution-name (27), `被申请人`/compound surname (28), `单价1元/件` next to a real amount (29, 30), `发票代码/号码` labels and `大写` Chinese numerals (30).

---

## Extended Batch 2 (Docs 31–40)

### Doc 31 — 招股说明书风险因素 (IPO/prospectus, risk factors)

```
虚构北辰医疗器械股份有限公司首次公开发行股票招股说明书（申报稿）
风险因素
一、研发失败风险：公司主要产品处于临床试验阶段，存在研发失败或审批不通过的风险。
二、毛利率波动风险：报告期综合毛利率分别为62.1%、58.7%、55.3%。
三、实际控制人控制风险：实际控制人温时晏、江临舟合计控制公司71.4%的股份。
四、存货跌价风险：2025年末存货账面价值人民币8,600万元。
本次发行募集资金人民币6.5亿元，拟用于以下项目：
（一）虚构医疗器械产业化项目，投资总额人民币4.2亿元；
（二）研发中心建设项目，投资总额人民币1.8亿元。
保荐机构：示例证券股份有限公司。经办会计师：示例会计师事务所。
签署日期：2026年06月18日。
```

- **Must redact:**
  - `虚构北辰医疗器械股份有限公司` — ORG (B)
  - `62.1%` / `58.7%` / `55.3%` / `71.4%` — AMOUNT (B)
  - `温时晏` / `江临舟` — PERSON (B)
  - `人民币8,600万元` — AMOUNT (B)
  - `人民币6.5亿元` — AMOUNT (B)
  - `虚构医疗器械产业化项目` — PROJECT (B) `[aspirational: bare contextual project name]`
  - `人民币4.2亿元` — AMOUNT (B)
  - `人民币1.8亿元` — AMOUNT (B)
  - `示例证券股份有限公司` — ORG (B)
  - `示例会计师事务所` — ORG (B)
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `风险因素`, `一、研发失败风险`, `临床试验阶段`, `研发失败或审批不通过的风险`, `二、毛利率波动风险`, `报告期综合毛利率分别为`, `三、实际控制人控制风险`, `实际控制人`, `合计控制…的股份`, `四、存货跌价风险`, `存货账面价值`, `本次发行募集资金`, `拟用于以下项目`, `投资总额`, `研发中心建设项目`, `保荐机构：`, `经办会计师：`, `签署日期：`, `2025年末`.
- **Why useful:** Prospectus risk-factor block packed with bare-contextual people (`实际控制人温时晏、江临舟`), a run of percentages, and multiple `亿元` fundraising amounts.
- **Gaps stressed:** `2025年末` year-end reference must NOT parse as a date; `研发中心建设项目` must read as a generic 中心 project name; controlling-shareholder names are contextual, not label-led.
- **Test idea:** `it("redacts prospectus risk percentages, controlling shareholders, and 募投 amounts; keeps 研发中心项目 and 2025年末 readable")`.

### Doc 32 — 外商投资法律意见书 (legal opinion, cross-border)

```
虚构天衡联合律师事务所关于虚构北辰医疗器械股份有限公司
外商投资企业设立的法律意见书
致：虚构北辰医疗器械股份有限公司
本所接受委托，就贵公司作为外商投资企业设立事宜出具本法律意见。
依据《中华人民共和国外商投资法》《中华人民共和国公司法》及有关规定。
经核查，投资方Fuxing Hanover Medical Ltd.（注册地：开曼群岛）已足额缴付出资人民币3,000万元。
公司住所：江苏省苏州市虚构区示例路31号。
法定代表人：温时晏。董事长：江临舟。
本法律意见书正本一式肆份。经办律师：纪砚书、谢知非。
签署日期：2026年06月30日。
```

- **Must redact:**
  - `虚构天衡联合律师事务所` — ORG (B)
  - `虚构北辰医疗器械股份有限公司` — ORG (B)
  - `Fuxing Hanover Medical Ltd.` — ORG (B)
  - `人民币3,000万元` — AMOUNT (B)
  - `江苏省苏州市虚构区示例路31号` — ADDRESS (B)
  - `温时晏` — PERSON (B)
  - `江临舟` — PERSON (B)
  - `纪砚书` / `谢知非` — PERSON (B)
  - `2026年06月30日` — DATE (B)
- **Must stay readable:** `致：`, `本所接受委托`, `就贵公司作为外商投资企业设立事宜出具本法律意见`, `依据《中华人民共和国外商投资法》《中华人民共和国公司法》`, `及有关规定`, `经核查`, `投资方`, `注册地：`, `开曼群岛`, `已足额缴付出资`, `公司住所：`, `法定代表人：`, `董事长：`, `本法律意见书正本一式肆份`, `经办律师：`, `签署日期：`, `贵公司`.
- **Why useful:** Cross-border opinion with a Latin investor name, a Cayman jurisdiction line, and a `注册地：` label whose value is a place, not a street address.
- **Gaps stressed:** `注册地：开曼群岛` is a jurisdiction not an address; `贵公司`/`投资方`/`本所` are generic role prose; two statute names in `《》`.
- **Test idea:** `it("redacts cross-border legal opinion parties, investment amount, address, and signatories; keeps 贵公司/开曼群岛/《外商投资法》 readable")`.

### Doc 33 — 信托合同 (asset-management contract, trust)

```
虚构普惠信托有限责任公司信托合同
委托人：顾屿　　受托人：虚构普惠信托有限责任公司　　受益人：顾屿
信托合同编号：XT-FAKE-2026-0333
信托财产：人民币10,000万元整。
信托期限：自信托成立之日起至2028年06月30日止。
信托目的：为受益人进行稳健的财富管理，详见信托说明书。
受益人分配方式：每年6月、12月各分配一次，每月25日为核算基准日。
受托人报酬：按信托财产的0.8%/年计收。
信托专户账号：9999999999999999033
保管银行：中国虚构银行虚构支行。
签署地：上海市虚构区示例大厦。
```

- **Must redact:**
  - `虚构普惠信托有限责任公司` — ORG (B)
  - `顾屿` — PERSON (B)
  - `XT-FAKE-2026-0333` — CASE_REF (B)
  - `人民币10,000万元整` — AMOUNT (B)
  - `2028年06月30日` — DATE (B)
  - `0.8%` — AMOUNT (B)
  - `9999999999999999033` — BANK_ACCOUNT (H)
  - `中国虚构银行虚构支行` — ORG (B)
  - `上海市虚构区示例大厦` — ADDRESS (B)
- **Must stay readable:** `委托人：`, `受托人：`, `受益人：`, `信托合同编号：`, `信托财产：`, `自信托成立之日起`, `止`, `信托目的：`, `为受益人进行稳健的财富管理`, `详见信托说明书`, `受益人分配方式：`, `每年6月、12月各分配一次`, `每月25日为核算基准日`, `受托人报酬：`, `按信托财产的`, `/年计收`, `信托专户账号：`, `保管银行：`, `签署地：`.
- **Why useful:** Trust contract where `委托人`/`受益人` resolve to a real PERSON, plus the canonical `每月25日为核算基准日` canary and an `每年6月、12月` distribution cadence.
- **Gaps stressed:** `每月25日` and `每年6月、12月` must NOT be dates; `0.8%/年` rate with trailing `年`; `详见信托说明书` placeholder.
- **Test idea:** `it("redacts trust parties, principal, rate, and trust account at heavy; keeps 每月25日 and 每年6月、12月 prose readable")`.

### Doc 34 — 行政处罚决定书（多方） (CSRC-style penalty, multi-party)

```
中国证券监督管理委员会行政处罚决定书
证监处罚字〔2026〕034号
当事人一：虚构星汉教育投资有限公司（住所：北京市虚构区示例路34号）
统一社会信用代码：91310101FAKE00034J
当事人二：温时晏，男，19XX年X月出生，身份证号见附件（住址：上海市虚构区示例环路34号）
当事人三：江临舟，男，身份证号不详
经查明，当事人于2025年9月至2026年3月期间，通过连续买卖操纵"虚构教育"股票价格。
依据《中华人民共和国证券法》第一百九十二条，决定如下：
对当事人一处以罚款人民币300万元；对当事人二温时晏处以罚款人民币60万元；
对当事人三江临舟处以罚款人民币60万元。合计人民币420万元。
```

- **Must redact:**
  - `证监处罚字〔2026〕034号` — CASE_REF (B)
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `北京市虚构区示例路34号` — ADDRESS (B)
  - `91310101FAKE00034J` — BUSINESS_ID (B)
  - `温时晏` — PERSON (B)
  - `上海市虚构区示例环路34号` — ADDRESS (B)
  - `江临舟` — PERSON (B)
  - `2025年9月` — DATE (B)
  - `2026年3月` — DATE (B)
  - `人民币300万元` / `人民币60万元` / `人民币60万元` / `人民币420万元` — AMOUNT (B)
- **Must stay readable:** `行政处罚决定书`, `中国证券监督管理委员会` (regulator name), `当事人一/二/三：`, `男`, `19XX年X月出生`, `身份证号见附件`, `身份证号不详`, `住址：`, `经查明`, `当事人于`, `期间`, `通过连续买卖操纵`, `股票价格`, `依据《中华人民共和国证券法》`, `第一百九十二条`, `决定如下`, `处以罚款`, `合计`.
- **Why useful:** Multi-respondent penalty with a pre-masked DOB (`19XX年X月出生`), two placeholder IDs (`身份证号见附件`, `身份证号不详`), and an insider-trading date range.
- **Gaps stressed:** masked `19XX年X月` must survive (not a date); placeholder IDs adjacent to the `身份证号` label; `当事人` repeated as a generic role.
- **Test idea:** `it("redacts multi-respondent penalty parties, dates range, and fines; keeps 19XX年X月/身份证号见附件/不详 and 当事人 readable")`.

### Doc 35 — 解除劳动合同通知书 (employment/HR, termination)

```
虚构云栖数据服务有限公司解除劳动合同通知书
员工姓名：程九思　　员工编号：EMP-FAKE-2026-0351
身份证号：999995199003070035
入职日期：2023年04月01日　　解除日期：2026年06月30日
部门：产品中心　　岗位：高级产品经理
解除原因：公司业务调整，经双方协商一致解除劳动合同。
经济补偿：人民币N+1共计人民币82,500.00元（税前）。
工资结算至2026年06月30日，于次月发薪日支付。
社保及公积金转移：详见附件。保密义务详见《保密协议》。
联系人：阮清和，联系电话021-00000351。
本通知一式两份，双方各执一份。
```

- **Must redact:**
  - `虚构云栖数据服务有限公司` — ORG (B)
  - `程九思` — PERSON (B)
  - `EMP-FAKE-2026-0351` — BUSINESS_ID / CASE_REF (B)
  - `999995199003070035` — NATIONAL_ID (B)
  - `2023年04月01日` — DATE (B)
  - `2026年06月30日` — DATE (B)
  - `人民币82,500.00元` — AMOUNT (B)
  - `阮清和` — PERSON (B)
  - `021-00000351` — PHONE (B)
- **Must stay readable:** `员工姓名：`, `员工编号：`, `身份证号：`, `入职日期：`, `解除日期：`, `部门：`, `产品中心`, `岗位：`, `高级产品经理`, `解除原因：`, `公司业务调整`, `经双方协商一致解除劳动合同`, `经济补偿：`, `人民币N+1`, `税前`, `工资结算至`, `于次月发薪日支付`, `社保及公积金转移：`, `详见附件`, `保密义务详见《保密协议》`, `联系人：`, `联系电话`, `本通知一式两份，双方各执一份`.
- **Why useful:** Termination notice with `N+1` compensation formula sitting next to a real `元` amount — only the amount redacts, the formula stays.
- **Gaps stressed:** `人民币N+1` is a formula not an amount; `次月发薪日` and `产品中心` are generic; `《保密协议》` survives.
- **Test idea:** `it("redacts termination notice employee ID, national ID, dates, and severance; keeps N+1 formula and 《保密协议》 readable")`.

### Doc 36 — 股权收购意向书 (mixed Chinese-English, M&A term sheet)

```
Term Sheet — 股权收购意向书 (Share Purchase Term Sheet)
日期 / Date: 2026-06-18
买方 / Purchaser: 虚构远帆科技有限公司 (Fuxing Yuanfan Tech Co., Ltd.)
卖方 / Seller: Fuxing Hanover Education Ltd.
标的 / Target: 虚构星汉教育投资有限公司 (65% equity)
对价 / Consideration: USD 12,800,000 (人民币约9,280万元)
定金 / Deposit: USD 1,280,000, 支付至 Account No. 6227000000000000036
排他期 / Exclusivity: 自签署之日起60日 (60 days from signing)
适用法律 / Governing Law: PRC laws（《中华人民共和国民法典》参考适用）
签字 / Signatory: 顾屿 (Gu Yu) / 江临舟 (Jiang Linzhou)
本意向书除保密及排他条款外无法律约束力。详见附件。
```

- **Must redact:**
  - `虚构远帆科技有限公司` — ORG (B)
  - `Fuxing Yuanfan Tech Co., Ltd.` — ORG (B)
  - `Fuxing Hanover Education Ltd.` — ORG (B)
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `2026-06-18` — DATE (B)
  - `USD 12,800,000` — AMOUNT (B)
  - `9,280万元` — AMOUNT (B)
  - `USD 1,280,000` — AMOUNT (B)
  - `6227000000000000036` — BANK_ACCOUNT (H)
  - `顾屿` / `江临舟` — PERSON (B)
  - `Gu Yu` / `Jiang Linzhou` — PERSON (B) `[aspirational: bare Latin name in Chinese doc]`
  - `65%` — AMOUNT (B)
- **Must stay readable:** `Term Sheet`, `股权收购意向书`, `日期 / Date:`, `买方 / Purchaser:`, `卖方 / Seller:`, `标的 / Target:`, `equity`, `对价 / Consideration:`, `定金 / Deposit:`, `支付至 Account No.`, `排他期 / Exclusivity:`, `自签署之日起60日`, `60 days from signing`, `适用法律 / Governing Law:`, `PRC laws`, `《中华人民共和国民法典》`, `签字 / Signatory:`, `本意向书除保密及排他条款外无法律约束力`, `详见附件`.
- **Why useful:** Bilingual term sheet with paired Chinese/English org and person names, multi-currency consideration (`USD` + `万元`), and an `约`-prefixed RMB amount.
- **Gaps stressed:** `人民币约9,280万元` — the `约` breaks the `人民币`-led match, so only `9,280万元` masks and `约` stays; `自签署之日起60日` must not parse as a date.
- **Test idea:** `it("redacts bilingual M&A term sheet parties, bilingual signatories, multi-currency consideration, and deposit account")`.

### Doc 37 — 董事會決議 (Traditional Chinese / HK disclosure)

```
騫越控股有限公司（股份代號：099FAKE.HK）董事會決議
本公司董事會於二零二六年六月十八日舉行會議。
出席董事：杜明軒（主席）、蘇婉清（行政總裁）、梁子謙（財務總監）。
決議事項：批准本公司截至二零二五年十二月三十一日止年度之綜合財務報表。
宣派末期股息每股港幣0.38元。建議派付比率为40%。
授權蘇婉清代表本公司簽署有關文件。
主要營業地點：香港虚构區示例道37號。
股份過戶登記處：香港示例證券登記有限公司。
聯絡電郵：ir@hanover-example.hk。詳情請參閱年報。本公司業務近20年穩健發展。
```

- **Must redact [aspirational: 繁體]:**
  - `騫越控股有限公司` — ORG
  - `099FAKE.HK` — BUSINESS_ID `[aspirational: 股份代號：NNNNN.HK]`
  - `二零二六年六月十八日` — DATE `[aspirational: Chinese numerals]`
  - `杜明軒` / `蘇婉清` / `梁子謙` — PERSON
  - `二零二五年十二月三十一日` — DATE `[aspirational: Chinese numerals]`
  - `港幣0.38元` — AMOUNT `[aspirational: 港幣 unit]`
  - `40%` — AMOUNT
  - `香港虚构區示例道37號` — ADDRESS
  - `香港示例證券登記有限公司` — ORG
  - `ir@hanover-example.hk` — EMAIL
- **Must stay readable:** `董事會決議`, `本公司董事會於`, `舉行會議`, `出席董事：`, `主席`, `行政總裁`, `財務總監`, `決議事項：`, `批准本公司截至`, `止年度之綜合財務報表`, `宣派末期股息每股`, `建議派付比率`, `授權`, `代表本公司簽署有關文件`, `主要營業地點：`, `股份過戶登記處：`, `聯絡電郵：`, `詳情請參閱年報`, `本公司業務近20年穩健發展`.
- **Why useful:** Traditional-Chinese board resolution exercising the full 繁體 gap: numeral dates, `.HK` stock code, `港幣` unit, and `行政總裁`/`財務總監` role labels. Only `40%` and the email are likely to pass under the current simplified detector.
- **Gaps stressed:** entire document is the gap — decide whether batch two opts in to a Traditional pass. `本公司` and `近20年` are the readable canaries.
- **Test idea:** `it("[aspirational 繁體] redacts HK board resolution officers, numeral dates, dividend, and contact; keeps 本公司/近20年 readable")`.

### Doc 38 — 反垄断立案通知书 (regulator notice, anti-monopoly)

```
国家市场监督管理总局反垄断局立案通知书
反垄断调查通〔2026〕第0388号
当事人：虚构云栖数据服务有限公司
住所：广东省深圳市虚构区示例路88号
统一社会信用代码：91440300FAKE00388K
涉嫌违法事项：涉嫌滥用市场支配地位，详见立案报告。
依据《中华人民共和国反垄断法》第三条、第二十二条规定开展调查。
调查期间，当事人应当配合调查，不得拒绝或拖延。
本案调查人员：俞晚舟、元嘉树。联系电话：010-00000388。
本通知自2026年06月18日起送达。特此通知。国家市场监督管理总局印。
```

- **Must redact:**
  - `反垄断调查通〔2026〕第0388号` — CASE_REF (B)
  - `虚构云栖数据服务有限公司` — ORG (B)
  - `广东省深圳市虚构区示例路88号` — ADDRESS (B)
  - `91440300FAKE00388K` — BUSINESS_ID (B)
  - `俞晚舟` / `元嘉树` — PERSON (B)
  - `010-00000388` — PHONE (B)
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `立案通知书`, `国家市场监督管理总局` (regulator, ×2), `反垄断局`, `当事人：`, `住所：`, `涉嫌违法事项：`, `涉嫌滥用市场支配地位`, `详见立案报告`, `依据《中华人民共和国反垄断法》`, `第三条`, `第二十二条规定开展调查`, `调查期间`, `当事人应当配合调查`, `不得拒绝或拖延`, `本案调查人员：`, `联系电话`, `本通知自`, `起送达`, `特此通知`, `印`.
- **Why useful:** Anti-monopoly filing notice with the `反垄断调查通〔2026〕第0388号` document number, multi-article statute reference, and a government-agency name that must NOT redact as an org.
- **Gaps stressed:** `国家市场监督管理总局` must read as a public agency; `本案调查人员：俞晚舟、元嘉树` uses an unfamiliar compound label; `第三条、第二十二条` article list must survive.
- **Test idea:** `it("redacts anti-monopoly notice number, respondent, USCC, and investigators; keeps 国家市场监督管理总局 and 《反垄断法》 readable")`.

### Doc 39 — 信用证申请书 (bank/payment form, letter of credit)

```
不可撤销跟单信用证申请书
开证申请人：虚构青澜文化传媒有限公司
受益人：Fuxing Hanover Media Ltd.
开证行：中国虚构银行股份有限公司虚构分行
信用证号码：LC-FAKE-2026-0399
开证日期：2026年06月18日。有效期限：2026年09月30日。
信用证金额：USD 580,000.00（大写：US DOLLARS FIVE HUNDRED EIGHTY THOUSAND ONLY）。
货物描述：Media production services，单价1元/件仅为内部核算口径。
最迟装运日：2026年08月15日。允许分批装运。
申请人承诺：单证相符即付款。开户行账号：6228480000000000039。
经办：卓然，复核：闻人宥。本证受UCP600约束。
```

- **Must redact:**
  - `虚构青澜文化传媒有限公司` — ORG (B)
  - `Fuxing Hanover Media Ltd.` — ORG (B)
  - `中国虚构银行股份有限公司虚构分行` — ORG (B)
  - `LC-FAKE-2026-0399` — CASE_REF (B)
  - `2026年06月18日` / `2026年09月30日` / `2026年08月15日` — DATE (B)
  - `USD 580,000.00` — AMOUNT (B)
  - `6228480000000000039` — BANK_ACCOUNT (H)
  - `卓然` / `闻人宥` — PERSON (B)
- **Must stay readable:** `不可撤销跟单信用证申请书`, `开证申请人：`, `受益人：`, `开证行：`, `信用证号码：`, `开证日期：`, `有效期限：`, `信用证金额：`, `大写：`, `US DOLLARS FIVE HUNDRED EIGHTY THOUSAND ONLY`, `货物描述：`, `Media production services`, `单价1元/件仅为内部核算口径`, `最迟装运日：`, `允许分批装运`, `申请人承诺：`, `单证相符即付款`, `开户行账号：`, `经办：`, `复核：`, `本证受UCP600约束`.
- **Why useful:** Letter-of-credit application with Latin beneficiary/bank, a run of dates, a USD amount, and two look-alike non-PII tokens.
- **Gaps stressed:** `US DOLLARS … ONLY` English amount-words and `UCP600` (a standard reference) must NOT be eaten as amounts/IDs despite looking code-like; `单价1元/件` again must survive.
- **Test idea:** `it("redacts letter of credit parties, LC number, dates, USD amount, and account; keeps UCP600 and English amount-words readable")`.

### Doc 40 — 股东持股变动表 (cap table, share transfer)

```
虚构星汉教育投资有限公司股东持股变动表
变动日期：2026年06月30日。备案编号：BA-FAKE-2026-0040。
转让方：顾屿（居民身份证999992198801010025）
受让方：虚构远帆科技有限公司（统一社会信用代码91330106FAKE00309L）
转让标的：公司2.0%股权（对应出资额人民币400,000元）
转让对价：人民币680,000.00元。付款方式：银行转账，详见附件。
变动前顾屿持股34.0%，变动后持股32.0%。
本次变动已完成工商变更登记。经办：韩昭。
注：持股比例如有尾差系四舍五入。待定事项见附件。
```

- **Must redact:**
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `2026年06月30日` — DATE (B)
  - `BA-FAKE-2026-0040` — CASE_REF (B)
  - `顾屿` — PERSON (B)
  - `999992198801010025` — NATIONAL_ID (B)
  - `虚构远帆科技有限公司` — ORG (B)
  - `91330106FAKE00309L` — BUSINESS_ID (B)
  - `2.0%` / `34.0%` / `32.0%` — AMOUNT (B)
  - `人民币400,000元` — AMOUNT (B)
  - `人民币680,000.00元` — AMOUNT (B)
  - `韩昭` — PERSON (B)
- **Must stay readable:** `股东持股变动表`, `变动日期：`, `备案编号：`, `转让方：`, `居民身份证`, `受让方：`, `统一社会信用代码`, `转让标的：`, `公司`, `股权`, `对应出资额`, `转让对价：`, `付款方式：`, `银行转账`, `详见附件`, `变动前…持股`, `变动后…持股`, `本次变动已完成工商变更登记`, `经办：`, `待定事项见附件`.
- **Why useful:** Share-transfer register where the IDs are **inline-labelled** (`居民身份证…` and `统一社会信用代码…`) — the current-pass counterpart to the tabular Doc 25/26 gaps.
- **Gaps stressed:** contrast case proving that when a label sits inline with the value, detection works; `待定事项见附件`/`详见附件` placeholders and `工商变更登记` generic prose survive.
- **Test idea:** `it("redacts share-transfer register inline-labelled IDs, transferor/transferee, percentages, and consideration")`.

### Extended Batch 2 coverage

| Kind | Docs exercising it |
| ---- | ------------------ |
| PERSON | 31, 32, 33, 34, 35, 36, 37, 38, 39, 40 |
| ORG | 31, 32, 33, 34, 35, 36, 37, 38, 39, 40 |
| ADDRESS | 32, 33, 34, 37, 38 |
| BUSINESS_ID | 34, 35, 37, 38, 40 |
| NATIONAL_ID | 35, 40 |
| PHONE | 35, 38 |
| EMAIL | 37 |
| DATE | 31, 32, 33, 34, 35, 36, 37, 38, 39, 40 |
| AMOUNT | 31, 32, 33, 34, 35, 36, 37, 39, 40 |
| CASE_REF | 33, 34, 35, 38, 39, 40 |
| BANK_ACCOUNT | 33, 36, 39 |

New trap coverage this batch: `2025年末` year-end (31), `研发中心建设项目` generic project name (31), `注册地：开曼群岛` jurisdiction (32), `每月25日`/`每年6月、12月` cadence (33), `19XX年X月` masked DOB and `身份证号不详` (34), `人民币N+1` formula (35), `人民币约9,280万元` 约-prefixed amount (36), full 繁體 gap + 港幣 unit + .HK code (37), `国家市场监督管理总局` agency name (38), `US DOLLARS…ONLY`/`UCP600` code-lookalikes (39), inline-vs-tabular ID contrast (40).

---

## Extended Batch 3 (Docs 41–50)

### Doc 41 — 采购合同补充协议 (procurement contract, supplement)

```
虚构市示例系统运维服务采购合同补充协议
原合同编号：FAKE-CG-2026-0219
补充协议编号：FAKE-CG-2026-0219-S1
甲方：虚构市示例局　　乙方：虚构云栖数据服务有限公司
鉴于原合同履行需要，双方协商一致补充如下：
一、合同总金额由人民币1,286,000.00元调整为人民币1,586,000.00元，增加人民币300,000.00元。
二、服务期限延长至2026年12月31日。
三、新增驻场工程师一名，单价1元/件口径不变，按月结算。
四、付款方式：按季度付款，首期付款于2026年09月30日前支付。
本补充协议自双方签字盖章之日起生效，与原合同具有同等效力。
授权代表：俞晚舟（甲方）、温时晏（乙方）。
```

- **Must redact:**
  - `FAKE-CG-2026-0219` — CASE_REF (B)
  - `FAKE-CG-2026-0219-S1` — CASE_REF (B)
  - `虚构市示例局` — ORG (B)
  - `虚构云栖数据服务有限公司` — ORG (B)
  - `人民币1,286,000.00元` / `人民币1,586,000.00元` / `人民币300,000.00元` — AMOUNT (B)
  - `2026年12月31日` — DATE (B)
  - `2026年09月30日` — DATE (B)
  - `俞晚舟` / `温时晏` — PERSON (B)
- **Must stay readable:** `补充协议`, `原合同编号：`, `补充协议编号：`, `甲方：`, `乙方：`, `鉴于原合同履行需要，双方协商一致补充如下`, `一、合同总金额由`, `调整为`, `增加`, `二、服务期限延长至`, `三、新增驻场工程师一名`, `单价1元/件口径不变`, `按月结算`, `四、付款方式：`, `按季度付款`, `首期付款于`, `前支付`, `本补充协议自双方签字盖章之日起生效`, `与原合同具有同等效力`, `授权代表：`.
- **Why useful:** Supplement with two chained reference numbers (original + S1 suffix) and an amount-adjustment trio (`由…调整为…增加…`).
- **Gaps stressed:** `单价1元/件口径不变` and `按月结算` must survive; chained `FAKE-CG-2026-0219-S1` must match as a single CASE_REF.
- **Test idea:** `it("redacts procurement supplement references, adjusted amounts, dates, and signatories; keeps 单价1元/件 and 按月结算 readable")`.

### Doc 42 — 执行通知书 (litigation/court notice, enforcement)

```
虚构市虚构区人民法院执行通知书
（2026）虚执0421号
被执行人：虚构远帆科技有限公司
统一社会信用代码：91330106FAKE00309L
申请执行人：沈知衡
执行依据：（2026）虚民初0271号民事判决书。
执行标的：人民币86万元及迟延履行期间的债务利息。
本院责令被执行人自本通知送达之日起七日内履行生效法律文书确定的义务。
逾期未履行的，本院将依法强制执行：查封、扣押、冻结、拍卖财产。
执行法官：韩昭。联系电话：010-00000421。
财产线索提供邮箱：clue-fake@example.org。
本通知书送达日期：2026年07月05日。
```

- **Must redact:**
  - `（2026）虚执0421号` — CASE_REF (B)
  - `虚构远帆科技有限公司` — ORG (B)
  - `91330106FAKE00309L` — BUSINESS_ID (B)
  - `沈知衡` — PERSON (B)
  - `（2026）虚民初0271号` — CASE_REF (B)
  - `人民币86万元` — AMOUNT (B)
  - `韩昭` — PERSON (B)
  - `010-00000421` — PHONE (B)
  - `clue-fake@example.org` — EMAIL (B)
  - `2026年07月05日` — DATE (B)
- **Must stay readable:** `执行通知书`, `虚构市虚构区人民法院` (court name), `被执行人：`, `申请执行人：`, `执行依据：`, `民事判决书`, `执行标的：`, `迟延履行期间的债务利息`, `本院责令被执行人`, `自本通知送达之日起七日内履行生效法律文书确定的义务`, `逾期未履行的`, `本院将依法强制执行`, `查封、扣押、冻结、拍卖财产`, `执行法官：`, `联系电话：`, `财产线索提供邮箱：`, `本通知书送达日期：`.
- **Why useful:** Enforcement notice carrying **two** case numbers (the execution notice plus the judgment it enforces) — tests multi-reference extraction in one document.
- **Gaps stressed:** `被执行人`/`申请执行人`/`本院` are generic roles; court institution name must read as public; `七日内` relative period survives.
- **Test idea:** `it("redacts enforcement notice two case numbers, parties, claim, judge, email, and service date")`.

### Doc 43 — 上市公告书 (IPO/prospectus, listing announcement)

```
虚构北辰医疗器械股份有限公司首次公开发行股票主板上市公告书
股票简称：北辰医疗（示例）　股票代码：600FAKE
总股本：人民币120,000,000元（每股面值人民币1.00元，共120,000,000股）。
发行价格：人民币28.88元/股。募集资金净额：人民币85,600万元。
上市日期：2026年07月09日。上市地点：上海证券交易所。
保荐人：示例证券股份有限公司。联席主承销商：示例证券股份有限公司、虚构普惠证券有限责任公司。
法定代表人：温时晏。董事会秘书：江临舟。
投资者热线：021-00000430。电子信箱：ir@beichen-fake.com。
注册地址：江苏省苏州市虚构区示例路43号。
请投资者关注《招股说明书》全文及风险因素。
```

- **Must redact:**
  - `虚构北辰医疗器械股份有限公司` — ORG (B)
  - `600FAKE` — BUSINESS_ID (B) `[aspirational: 股票代码： label not wired for Chinese]`
  - `人民币120,000,000元` — AMOUNT (B)
  - `人民币1.00元` — AMOUNT (B)
  - `人民币28.88元/股` — AMOUNT (B)
  - `人民币85,600万元` — AMOUNT (B)
  - `2026年07月09日` — DATE (B)
  - `示例证券股份有限公司` — ORG (B)
  - `虚构普惠证券有限责任公司` — ORG (B)
  - `温时晏` / `江临舟` — PERSON (B)
  - `021-00000430` — PHONE (B)
  - `ir@beichen-fake.com` — EMAIL (B)
  - `江苏省苏州市虚构区示例路43号` — ADDRESS (B)
- **Must stay readable:** `上市公告书`, `股票简称：`, `北辰医疗（示例）`, `股票代码：`, `总股本：`, `每股面值`, `共120,000,000股`, `发行价格：`, `募集资金净额：`, `上市日期：`, `上市地点：`, `上海证券交易所`, `保荐人：`, `联席主承销商：`, `法定代表人：`, `董事会秘书：`, `投资者热线：`, `电子信箱：`, `注册地址：`, `请投资者关注《招股说明书》全文及风险因素`.
- **Why useful:** Listing announcement with face-value + offer-price + net-proceeds amount run, a per-share `元/股` price, and the `上海证券交易所` public-institution canary.
- **Gaps stressed:** `股票代码：600FAKE` Chinese stock-code label; `上海证券交易所` must NOT redact as an org; `共120,000,000股` share count is not currency.
- **Test idea:** `it("redacts listing announcement issuer, offer price, net proceeds, contacts, and address; keeps 上海证券交易所 and share counts readable")`.

### Doc 44 — 银行开户申请书 (bank/payment form, KYC account opening)

```
中国虚构银行单位银行结算账户开户申请书
账户名称：虚构青澜文化传媒有限公司
统一社会信用代码：91310104FAKE00444G
注册地址：上海市虚构区示例环路44号
法定代表人：顾屿　　证件类型：居民身份证　　证件号码：999992198801010025
注册资本：人民币1,000万元。实缴资本：人民币1,000万元。
账户性质：基本存款账户。账号：6228480000000000044。开户日期：2026年06月18日。
资金用途：日常经营结算。预留印鉴见附件。
税务登记号：91310104FAKE00444G（与统一社会信用代码一致）。
关联联系人：阮清和，手机13800000444。
本申请所填信息真实有效。经办柜员：卓然。开户行：中国虚构银行虚构支行。
```

- **Must redact:**
  - `虚构青澜文化传媒有限公司` — ORG (B)
  - `91310104FAKE00444G` — BUSINESS_ID (B) (USCC + 税务登记号, same value)
  - `上海市虚构区示例环路44号` — ADDRESS (B)
  - `顾屿` — PERSON (B)
  - `999992198801010025` — NATIONAL_ID (B) `[aspirational: 证件号码 label, not 身份证号]`
  - `人民币1,000万元` — AMOUNT (B) (×2)
  - `6228480000000000044` — BANK_ACCOUNT (H)
  - `2026年06月18日` — DATE (B)
  - `阮清和` — PERSON (B)
  - `13800000444` — PHONE (B)
  - `卓然` — PERSON (B)
  - `中国虚构银行虚构支行` — ORG (B)
- **Must stay readable:** `单位银行结算账户开户申请书`, `中国虚构银行` (bank letterhead, generic), `账户名称：`, `统一社会信用代码：`, `注册地址：`, `法定代表人：`, `证件类型：`, `居民身份证`, `证件号码：`, `注册资本：`, `实缴资本：`, `账户性质：`, `基本存款账户`, `账号：`, `开户日期：`, `资金用途：`, `日常经营结算`, `预留印鉴见附件`, `税务登记号：`, `与统一社会信用代码一致`, `关联联系人：`, `手机`, `本申请所填信息真实有效`, `经办柜员：`, `开户行：`.
- **Why useful:** Account-opening KYC form where the legal-rep ID sits under `证件号码：` with `居民身份证` as the *type* value — a realistic label mismatch that defeats the `身份证号` label matcher.
- **Gaps stressed:** `证件号码：` is not a known ID label (only `身份证号`-family is); `中国虚构银行` letterhead vs `中国虚构银行虚构支行` specific branch; `预留印鉴见附件` placeholder; USCC reused as 税务登记号.
- **Test idea:** `it("redacts bank account-opening form USCC, address, legal rep, capital, and account; [aspirational] 证件号码 ID; keeps 中国虚构银行 letterhead and 见附件 readable")`.

### Doc 45 — 外籍员工聘用与税务信息表 (employment/HR, expat + IIT)

```
虚构星汉教育投资有限公司外籍员工聘用与税务信息表
姓名 / Name：元嘉树 (Yuan Jiashu)　　国籍 / Nationality：Fuxingland（示例）
护照号 / Passport No.：FAKE000445（示例签发）
员工编号：EMP-FAKE-2026-0455
入职日期：2026年07月01日
岗位：国际业务总监　　部门：海外事业部
月薪：人民币60,000元/月（税前）。
个人所得税：每月代扣代缴，税率详见附件，应纳税所得额计算见附件。
住房补贴：人民币8,000元/月。紧急联系人：韩昭，电话+86-19900000455。
银行账户：6227000000000000045。开户银行：中国虚构银行虚构支行。
本表所列信息仅供内部人力资源及税务备案使用。
```

- **Must redact:**
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `元嘉树` — PERSON (B)
  - `Yuan Jiashu` — PERSON (B) `[aspirational: bare Latin name in Chinese doc]`
  - `FAKE000445` — NATIONAL_ID (B) `[aspirational: 护照号 passport handling]`
  - `EMP-FAKE-2026-0455` — BUSINESS_ID / CASE_REF (B)
  - `2026年07月01日` — DATE (B)
  - `人民币60,000元/月` — AMOUNT (B)
  - `人民币8,000元/月` — AMOUNT (B)
  - `韩昭` — PERSON (B)
  - `+86-19900000455` — PHONE (B)
  - `6227000000000000045` — BANK_ACCOUNT (H)
  - `中国虚构银行虚构支行` — ORG (B)
- **Must stay readable:** `外籍员工聘用与税务信息表`, `姓名 / Name：`, `国籍 / Nationality：`, `Fuxingland（示例）`, `护照号 / Passport No.：`, `示例签发`, `员工编号：`, `入职日期：`, `岗位：`, `国际业务总监`, `部门：`, `海外事业部`, `月薪：`, `税前`, `个人所得税：`, `每月代扣代缴`, `税率详见附件`, `应纳税所得额计算见附件`, `住房补贴：`, `紧急联系人：`, `电话`, `银行账户：`, `开户银行：`, `本表所填信息仅供内部人力资源及税务备案使用`.
- **Why useful:** Expat HR form mixing Chinese/English names, an invented nationality, a passport number, and per-month salary + subsidy.
- **Gaps stressed:** `护照号 / Passport No.：` bilingual passport label; `+86-19900000455` international mobile (current-pass, clean form); `税率详见附件` placeholder next to real amounts.
- **Test idea:** `it("redacts expat HR form bilingual name, passport, per-month salary, and bank account; keeps 税率详见附件 and Fuxingland readable")`.

### Doc 46 — 尽调数据室索引 (mixed Chinese-English, data room index)

```
Project Helios — 虚构星汉教育投资有限公司尽调数据室索引 (Data Room Index)
索引编号 / Index No.：DR-FAKE-2026-0046　　更新日期：2026-06-18
A. 公司注册 / Corporate
  A.1 营业执照（统一社会信用代码 91310101FAKE00219P）
  A.2 公司章程（签署日期 2026年03月01日）
B. 财务 / Financials
  B.1 2023–2025审计报告（示例会计师事务所，License No. FAKE-CPA-2026-0046）
  B.2 银行对账单（账号 6228480000000000046，截至 2026-05-31 余额人民币3,200万元）
C. 人员 / People
  C.1 高管名册（温时晏、江临舟、纪砚书，详见后附名单）
  C.2 劳动合同模板（单价1元/件为示例占位，非实际报价）
联系人：裴予安 (Pei Yu'an)，邮箱pei@example.org，电话+86-21-00000046。
```

- **Must redact:**
  - `虚构星汉教育投资有限公司` — ORG (B)
  - `DR-FAKE-2026-0046` — CASE_REF (B)
  - `2026-06-18` — DATE (B)
  - `91310101FAKE00219P` — BUSINESS_ID (B)
  - `2026年03月01日` — DATE (B)
  - `示例会计师事务所` — ORG (B)
  - `FAKE-CPA-2026-0046` — BUSINESS_ID / CASE_REF (B)
  - `6228480000000000046` — BANK_ACCOUNT (H)
  - `2026-05-31` — DATE (B)
  - `人民币3,200万元` — AMOUNT (B)
  - `温时晏` / `江临舟` / `纪砚书` — PERSON (B) `[aspirational: parenthetical list under 高管名册]`
  - `裴予安` — PERSON (B)
  - `Pei Yu'an` — PERSON (B) `[aspirational: bare Latin name]`
  - `pei@example.org` — EMAIL (B)
  - `+86-21-00000046` — PHONE (B) `[aspirational: +86- landline form]`
- **Must stay readable:** `Project Helios`, `尽调数据室索引`, `Data Room Index`, `索引编号 / Index No.：`, `更新日期：`, `A. 公司注册 / Corporate`, `营业执照`, `统一社会信用代码`, `A.2 公司章程`, `签署日期`, `B. 财务 / Financials`, `B.1 2023–2025审计报告`, `银行对账单`, `账号`, `截至`, `余额`, `C. 人员 / People`, `C.1 高管名册`, `详见后附名单`, `C.2 劳动合同模板`, `单价1元/件为示例占位`, `非实际报价`, `联系人：`, `邮箱`, `电话`.
- **Why useful:** Data-room index mixing ISO dates (`2026-06-18`, `2026-05-31`), Chinese dates, parenthetical identifiers, and a bilingual contact block — a realistic diligence artefact.
- **Gaps stressed:** `2023–2025` en-dash range must survive; `单价1元/件` placeholder; `+86-21-…` landline form; parenthetical officer list.
- **Test idea:** `it("redacts data room index references, IDs, account balance, ISO dates, and contact; keeps 单价1元/件 and 2023–2025 range readable")`.

### Doc 47 — 股東週年大會通告 (Traditional Chinese / HK disclosure)

```
騫越控股有限公司（股份代號：099FAKE.HK）股東週年大會通告
茲通告騫越控股有限公司謹訂於二零二六年九月十五日上午十時正假座香港虚构區示例道47號舉行股東週年大會。
議決事項：宣派截至二零二五年十二月三十一日止年度之末期股息每股港幣0.15元。
重選退任董事：杜明軒、蘇婉清。授權董事會釐定董事酬金。
以股代息安排：詳情參閱通函。股息派付比率约35%。
本公司將於二零二六年八月三十一日至二零二六年九月十五日（首尾兩天包括在內）暫停辦理股份過戶登記。
股東如對本通告有疑問，請聯絡公司秘書處，電郵cs@hanover-example.hk。
按持股量計算，每持有近20股可獲派一股紅股。
```

- **Must redact [aspirational: 繁體]:**
  - `騫越控股有限公司` — ORG (×2)
  - `099FAKE.HK` — BUSINESS_ID `[aspirational: 股份代號：NNNNN.HK]`
  - `二零二六年九月十五日上午十時正` — DATE `[aspirational: Chinese numerals + 時正]`
  - `香港虚构區示例道47號` — ADDRESS
  - `二零二五年十二月三十一日` — DATE `[aspirational]`
  - `港幣0.15元` — AMOUNT `[aspirational: 港幣 unit]`
  - `杜明軒` / `蘇婉清` — PERSON
  - `35%` — AMOUNT
  - `二零二六年八月三十一日` / `二零二六年九月十五日` — DATE `[aspirational]`
  - `cs@hanover-example.hk` — EMAIL
- **Must stay readable:** `股東週年大會通告`, `茲通告`, `謹訂於`, `假座`, `舉行股東週年大會`, `議決事項：`, `宣派截至`, `止年度之末期股息每股`, `重選退任董事：`, `授權董事會釐定董事酬金`, `以股代息安排：`, `詳情參閱通函`, `股息派付比率`, `本公司將於`, `至`, `首尾兩天包括在內`, `暫停辦理股份過戶登記`, `股東如對本通告有疑問，請聯絡公司秘書處`, `電郵`, `按持股量計算，每持有近20股可獲派一股紅股`.
- **Why useful:** HK AGM notice with a numeral date **and time** (`上午十時正`), a record-date suspension **window** spanning two numeral dates, and the `近20股` variant of the `近20年` canary.
- **Gaps stressed:** full 繁體 gap; `近20股` must read; the `二零二六年八月三十一日…至…九月十五日` window must keep `至` readable; `參閱通函` placeholder.
- **Test idea:** `it("[aspirational 繁體] redacts HK AGM notice issuer, numeral datetime, dividend, record-date window, and email; keeps 近20股 readable")`.

### Doc 48 — 金融监管行政措施通知书 (regulator notice, financial regulator)

```
国家金融监督管理总局虚构监管局金融监管行政措施通知书
金监措施〔2026〕第0488号
当事人：虚构普惠信托有限责任公司
住所：上海市浦东新区虚构环路1号
统一社会信用代码：91310115FAKE00488T
主要违法违规事实：信托产品净值披露不及时，投资者适当性管理不到位，详见检查报告。
行政措施：责令限期改正，并限制新增同类信托业务规模人民币5亿元，期限6个月。
依据《中华人民共和国银行业监督管理法》第三十七条规定。
当事人如不服，可申请行政复议或提起行政诉讼。
检查人员：俞晚舟、元嘉树。联系电话：021-00000488。
本通知书自2026年06月18日起送达。
```

- **Must redact:**
  - `金监措施〔2026〕第0488号` — CASE_REF (B)
  - `虚构普惠信托有限责任公司` — ORG (B)
  - `上海市浦东新区虚构环路1号` — ADDRESS (B)
  - `91310115FAKE00488T` — BUSINESS_ID (B)
  - `人民币5亿元` — AMOUNT (B)
  - `俞晚舟` / `元嘉树` — PERSON (B)
  - `021-00000488` — PHONE (B)
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `金融监管行政措施通知书`, `国家金融监督管理总局` (regulator), `虚构监管局`, `当事人：`, `住所：`, `主要违法违规事实：`, `信托产品净值披露不及时`, `投资者适当性管理不到位`, `详见检查报告`, `行政措施：`, `责令限期改正`, `并限制新增同类信托业务规模`, `期限6个月`, `依据《中华人民共和国银行业监督管理法》`, `第三十七条规定`, `当事人如不服，可申请行政复议或提起行政诉讼`, `检查人员：`, `联系电话`, `本通知自`, `起送达`.
- **Why useful:** Financial-regulator administrative-measure notice with a business-cap amount (`限制…规模人民币5亿元`) and `期限6个月`.
- **Gaps stressed:** `国家金融监督管理总局` agency name; `期限6个月` relative period; `详见检查报告` placeholder.
- **Test idea:** `it("redacts financial-regulator notice number, respondent, business-cap amount, and inspectors; keeps 国家金融监督管理总局 and 《银监法》 readable")`.

### Doc 49 — 股权出质设立登记申请书 (cap table, share pledge)

```
虚构星汉教育投资有限公司股权出质设立登记申请书
登记编号：PZ-FAKE-2026-0049　　登记日期：2026年06月30日
出质人：顾屿（居民身份证999992198801010025）
质权人：中国虚构银行股份有限公司虚构分行（统一社会信用代码91110108FAKE00049R）
出质股权：公司14.0%股权（对应认缴出资额人民币2,800,000元）
被担保主债权数额：人民币5,000,000.00元。债务履行期限：至2027年06月30日止。
出质人承诺所出质股权权属清晰。反担保措施详见附件。
本登记已于市场监督管理部门完成。经办：韩昭。
注：质押登记信息以登记机关公示为准。如有变更另行登记。
```

- **Must redact:**
  - `PZ-FAKE-2026-0049` — CASE_REF (B)
  - `2026年06月30日` — DATE (B)
  - `顾屿` — PERSON (B)
  - `999992198801010025` — NATIONAL_ID (B)
  - `中国虚构银行股份有限公司虚构分行` — ORG (B)
  - `91110108FAKE00049R` — BUSINESS_ID (B)
  - `14.0%` — AMOUNT (B)
  - `人民币2,800,000元` — AMOUNT (B)
  - `人民币5,000,000.00元` — AMOUNT (B)
  - `2027年06月30日` — DATE (B)
  - `韩昭` — PERSON (B)
- **Must stay readable:** `股权出质设立登记申请书`, `登记编号：`, `登记日期：`, `出质人：`, `居民身份证`, `质权人：`, `统一社会信用代码`, `出质股权：`, `公司`, `股权`, `对应认缴出资额`, `被担保主债权数额：`, `债务履行期限：`, `至`, `止`, `出质人承诺所出质股权权属清晰`, `反担保措施详见附件`, `本登记已于市场监督管理部门完成`, `经办：`, `注：质押登记信息以登记机关公示为准`, `如有变更另行登记`.
- **Why useful:** Share-pledge register with both an inline-labelled PRC ID (`居民身份证…`) and an inline-labelled USCC (`统一社会信用代码…`), plus pledged-equity %, contribution, and secured amount.
- **Gaps stressed:** contrast pair again proving inline-labelled IDs work; `认缴出资额`/`反担保措施详见附件`/`以登记机关公示为准` generic prose survives.
- **Test idea:** `it("redacts share-pledge register inline IDs, pledgee USCC, pledged equity, and secured amount; keeps 详见附件 readable")`.

### Doc 50 — 法律意见书签署页 (legal opinion, signing page)

```
关于虚构北辰医疗器械股份有限公司首次公开发行股票之法律意见书（签署页）
经办律师：纪砚书（执业证号FAKE-BAR-2026-0050A）
经办律师：谢知非（执业证号FAKE-BAR-2026-0050B）
律师事务所：虚构天衡联合律师事务所（统一社会信用代码91310101FAKE00500L）
签字日期：2026年06月18日。签字地点：北京市虚构区示例大厦。
本所律师依据《中华人民共和国证券法》《中华人民共和国律师法》出具本意见。
经办律师签字：________________　　________________
本法律意见书正本陆份，经本所盖章及经办律师签字后生效，副本若干。
如对本意见有疑问，请联系事务所合规部，邮箱compliance@tianheng-fake.com。
本所近20年累计为逾百家发行人提供证券法律服务。
```

- **Must redact:**
  - `虚构北辰医疗器械股份有限公司` — ORG (B)
  - `纪砚书` / `谢知非` — PERSON (B)
  - `FAKE-BAR-2026-0050A` / `FAKE-BAR-2026-0050B` — BUSINESS_ID / CASE_REF (B)
  - `虚构天衡联合律师事务所` — ORG (B)
  - `91310101FAKE00500L` — BUSINESS_ID (B)
  - `2026年06月18日` — DATE (B)
  - `北京市虚构区示例大厦` — ADDRESS (B)
  - `compliance@tianheng-fake.com` — EMAIL (B)
- **Must stay readable:** `法律意见书（签署页）`, `经办律师：`, `执业证号`, `律师事务所：`, `统一社会信用代码`, `签字日期：`, `签字地点：`, `本所律师依据《中华人民共和国证券法》《中华人民共和国律师法》出具本意见`, `经办律师签字：`, `本法律意见书正本陆份，经本所盖章及经办律师签字后生效，副本若干`, `如对本意见有疑问，请联系事务所合规部`, `邮箱`, `本所近20年累计为逾百家发行人提供证券法律服务`.
- **Why useful:** Dense signing page: two lawyer licence numbers, a firm USCC, a compliance email, and signature underscore placeholders — stresses signatory-block extraction without eating the blank signature lines.
- **Gaps stressed:** the `________________` signature blanks must NOT become spurious matches; `本所`/`合规部` generic; `近20年` canary.
- **Test idea:** `it("redacts legal-opinion signing page lawyers, licence numbers, firm USCC, email, and location; keeps signature blanks and 近20年 readable")`.

### Extended Batch 3 coverage

| Kind | Docs exercising it |
| ---- | ------------------ |
| PERSON | 41, 42, 43, 44, 45, 46, 47, 48, 49, 50 |
| ORG | 41, 42, 43, 44, 45, 46, 47, 48, 49, 50 |
| ADDRESS | 43, 44, 47, 48, 50 |
| BUSINESS_ID | 42, 43, 44, 45, 46, 47, 48, 49, 50 |
| NATIONAL_ID | 44, 45, 49 |
| PHONE | 42, 43, 44, 45, 46, 48 |
| EMAIL | 42, 43, 46, 47, 50 |
| DATE | 41, 42, 43, 44, 45, 46, 47, 48, 49, 50 |
| AMOUNT | 41, 42, 43, 44, 45, 46, 47, 48, 49 |
| CASE_REF | 41, 42, 45, 46, 48, 49, 50 |
| BANK_ACCOUNT | 44, 45, 46 |

New trap coverage this batch: chained `…-S1` reference (41), two case numbers in one doc (42), `上海证券交易所`/`共…股` share count (43), `证件号码：` label mismatch + `中国虚构银行` letterhead vs branch (44), bilingual `护照号/Passport` (45), `2023–2025` en-dash range + `+86-` landline (46), 繁體 datetime/record-date window + `近20股` (47), `期限6个月` (48), inline USCC+ID contrast (49), signature underscore blanks + `近20年` (50).

---

## Part Two — Overall Coverage (Docs 21–50)

Aggregated across all three extended batches:

| Kind | Total docs (of 30) | Notable gaps exercised |
| ---- | ------------------ | ---------------------- |
| PERSON | 30/30 | tabular cells (25, 26, 46), `仲裁员` role (28), 繁體 (37, 47), Latin names (36, 45, 46) |
| ORG | 30/30 | agency names kept readable (38, 48), 繁體 (37, 47) |
| ADDRESS | 12/30 | `注册地：开曼群岛` jurisdiction (32), 繁體 (37, 47) |
| BUSINESS_ID | 20/30 | `发票代码/号码` (30), `股份代號/股票代码` (37, 43), SWIFT (24), tabular (25) |
| NATIONAL_ID | 4/30 | tabular (25), `证件号码：` label (44), passport (45) |
| PHONE | 12/30 | `+86-21-` landline (46), 繁體 `(852)` (Part One Doc 20) |
| EMAIL | 8/30 | 繁體 (37, 47) |
| DATE | 30/30 | Chinese numerals (37, 47), `2025年末` (31), `每月25日` (33) |
| AMOUNT | 29/30 | `港幣` (37, 47), `人民币约…` (36), `N+1` (35), `大写` numerals (30) |
| CASE_REF | 17/30 | `〔YYYY〕第N号` forms (21, 28, 38, 48), chained `-S1` (41) |
| BANK_ACCOUNT | 8/30 | trust/account-opening/LC contexts (33, 36, 39, 44, 45, 46) |

### Part Two — Aspirational Gap Catalogue

These recur across Part Two and are the highest-value deterministic-rule candidates:

1. **Tabular / column-header detection** — Docs 25, 26, 46. IDs and people sitting under a header row (`姓名`/`证件号码`) rather than inline labels.
2. **Traditional Chinese (繁體)** — Docs 37, 47 (and Part One 20). Numeral dates, `.HK` codes, `港幣`/`人民幣` units, `行政總裁`/`財務總監` roles.
3. **Bare Latin names in Chinese documents** — Docs 36, 45, 46 (`Gu Yu`, `Jiang Linzhou`, `Yuan Jiashu`, `Pei Yu'an`).
4. **Chinese-stock-code labels** — `股票代码：` (43), `股份代號：NNNNN.HK` (37, 47).
5. **Alternative ID labels** — `证件号码：` (44), `护照号 / Passport No.：` (45), `发票代码：`/`发票号码：` (30), `执业证号`/`SWIFT代码` (24, 50).
6. **`…〔YYYY〕第N号` regulatory numbers** — Docs 21, 28, 38, 48.
7. **Chinese-numeral amounts** — `大写：人民币壹万元整` (30); numeral dates (37, 47).
8. **International phone forms** — `+86-21-…` landline (46), spaced `+86 199 …` (Part One 18).

### Conversion Notes (carry over from Part One)

The Part One conversion notes still apply. For Part Two specifically:

- Every `B` (balanced) span should assert `expect(output).not.toContain(<span>)`; every `H` (heavy) span should also be checked at `redact(text, "heavy")`.
- `[aspirational]` spans should land as `it.skip(...)` or counterexample `expect(output).toContain(<span>)` with a `// TODO(batch-two: <gap>)` comment, so the suite stays green until the matching rule ships.
- The tabular docs (25, 26, 46) are best encoded as **whole-document snapshots** (assert no leak of any cell value) rather than per-span asserts, since their gap is structural.
- Reuse the `redact(text, level)` helper; do not introduce a new harness.

---

## Part Three — Extended Corpus (Batch 4, Docs 51–60)

Batch 4 deliberately front-loads the sparse kinds from Part Two: **NATIONAL_ID** (was 4/30) and **EMAIL** (was 8/30). Every doc also carries the standing trap set (`见附件` / `不详` / `每月25日` / `单价1元/件` / `近20年` / statute names in `《》` / generic `银行/公司/中心` words / headings). All identifiers are invented and length-valid: USCC = 18 chars (`[0-9A-HJ-NPQRTUWXY]`, `FAKE` letters OK), PRC ID = 18 chars (`[1-9]\d{16}[\dXx]`), bank account = 16–19 digits.

New invented names this batch: 宋怀瑾, 叶清辞, 霍辞, 应渊, 苏问, 陆景行, 季淮川, 容与, 沈聿, 谢昀, 周屿. New invented orgs: 虚构青澜新能源科技有限公司, 虚构星轨航天科技股份有限公司, 虚构瀚海生物医药有限公司, 虚构长风文化传媒股份有限公司, 虚构银行股份有限公司示例支行.

### Doc 51 — 员工花名册 (employment/HR, roster table) `[aspirational: tabular]`

```
虚构青澜新能源科技有限公司 员工花名册（编制日期：2026年06月）
序号  姓名    身份证号            手机号        邮箱
01    宋怀瑾  33010619900101001X  13900000051   song.huajin@qinglan-fake.com
02    叶清辞  110108198812120012  13800000052   ye.qingci@qinglan-fake.com
03    霍辞    310115199503030035  13700000053   huo.ci@qinglan-fake.com
本表为示例数据，真实人员见附件，不详字段以人事档案为准。
联系电话栏请勿对外公开。近20年公司始终重视员工隐私保护。
```

- **Must redact:** `[aspirational: tabular cells under header row]`
  - `宋怀瑾` / `叶清辞` / `霍辞` — PERSON (B)
  - `33010619900101001X` / `110108198812120012` / `310115199503030035` — NATIONAL_ID (B)
  - `13900000051` / `13800000052` / `13700000053` — PHONE (B)
  - `song.huajin@qinglan-fake.com` / `ye.qingci@qinglan-fake.com` / `huo.ci@qinglan-fake.com` — EMAIL (B)
  - `虚构青澜新能源科技有限公司` — ORG (B)
  - `2026年06月` — DATE (B)
- **Must stay readable:** `员工花名册`, `序号`, `姓名`, `身份证号`, `手机号`, `邮箱` (column headers — note generic `公司` word), `见附件`, `不详`, `人事档案`, `联系电话栏`, `近20年`, `公司始终重视员工隐私保护`.
- **Why useful:** Three PRC IDs, three phones, three emails all sitting under a header row rather than inline labels — the hardest structural NATIONAL_ID/EMAIL gap. The whole trap quartet (`见附件` / `不详` / `近20年` / generic `公司`) sits in the trailing prose.
- **Gaps stressed:** tabular detection (same family as Docs 25, 26, 46); `公司` must read as a generic word in prose while the full org name in the heading redacts.
- **Test idea:** `it("keeps no NATIONAL_ID/PHONE/EMAIL cell value leaking from an HR roster table, while 序号/姓名/身份证号 headers and 近20年/见附件/不详 prose survive")` — encode as a whole-document snapshot.

### Doc 52 — 房屋租赁合同 (lease contract, inline labels)

```
出租方（甲方）：宋怀瑾，身份证号330106199203070028，手机13900000052。
承租方（乙方）：虚构青澜新能源科技有限公司，统一社会信用代码91330106FAKE00510K。
租赁标的：浙江省杭州市虚构区示例路52号1幢1801室。
租赁期限：自2026年07月01日起至2027年06月30日止，每月25日支付当月租金。
月租金人民币18,000元，押二付一。单价1元/件不适用本合同。
乙方收款账户：开户银行虚构银行示例支行，账号6228480000000000521。
合同一式两份，详见附件。未尽事宜，详按《中华人民共和国民法典》执行。
```

- **Must redact:**
  - `宋怀瑾` — PERSON (B)
  - `330106199203070028` — NATIONAL_ID (B)
  - `13900000052` — PHONE (B)
  - `虚构青澜新能源科技有限公司` — ORG (B)
  - `91330106FAKE00510K` — BUSINESS_ID (B)
  - `浙江省杭州市虚构区示例路52号1幢1801室` — ADDRESS (B)
  - `2026年07月01日` — DATE (B)
  - `2027年06月30日` — DATE (B)
  - `人民币18,000元` — AMOUNT (B)
  - `6228480000000000521` — BANK_ACCOUNT (H)
- **Must stay readable:** `出租方（甲方）：`, `承租方（乙方）：`, `身份证号`, `手机`, `统一社会信用代码`, `租赁标的：`, `租赁期限：`, `自…起至…止`, `每月25日支付当月租金`, `月租金`, `押二付一`, `单价1元/件`, `收款账户：`, `开户银行`, `账号`, `详见附件`, `未尽事宜`, `《中华人民共和国民法典》`.
- **Why useful:** Inline `身份证号：`/`手机：` labels drive the PRC ID and phone; the address cascades 省→市→区→路→号→幢→室 (multi-suffix); two dates bracket the term; `每月25日` / `单价1元/件` / `见附件` / statute-in-《》 all fire; bank account is heavy-only.
- **Gaps stressed:** full-suffix Chinese address; `每月25日` must not parse as a date; `单价1元/件` must not parse as an amount.
- **Test idea:** `it("redacts lease inline PRC ID, USCC, full 省-市-区-路-号-幢-室 address, dates and rent; keeps 每月25日 / 单价1元/件 / 《民法典》 readable")`.

### Doc 53 — 董事会秘书联系方式公告 (IPO/contact, IR disclosure)

```
股票代码：300530 股票简称：虚构星轨 虚构星轨航天科技股份有限公司
董事会秘书：叶清辞，联系电话021-00005301，电子邮箱ir@xinggui-fake.com。
公司住所：上海市虚构区示例环路530号星轨大厦15层，邮政编码200000。
保荐代表人：苏问，联系电话13800000053。
公司仅在工作日受理咨询（每月25日系统维护除外），请勿发送账户信息。
详见公开披露附件与近20年年报摘要。重要提示：本页信息以披露为准。
```

- **Must redact:**
  - `虚构星轨航天科技股份有限公司` — ORG (B)
  - `叶清辞` — PERSON (B)
  - `021-00005301` — PHONE (B)
  - `ir@xinggui-fake.com` — EMAIL (B)
  - `上海市虚构区示例环路530号星轨大厦15层` — ADDRESS (B)
  - `苏问` — PERSON (B)
  - `13800000053` — PHONE (B)
- **Must stay readable:** `股票代码：`, `300530`, `股票简称：`, `虚构星轨`, `董事会秘书：`, `联系电话`, `电子邮箱`, `公司住所：`, `邮政编码200000`, `保荐代表人：`, `公司仅在工作日受理咨询`, `每月25日`, `系统维护`, `详见公开披露附件`, `近20年`, `重要提示：`, `本页信息以披露为准`.
- **Why useful:** IR/contact block stresses EMAIL + PHONE + ADDRESS; `股票代码：300530` Chinese stock-code label (aspirational); `每月25日` / `见附件` / `近20年` triple trap; floor `15层` and 邮政编码 must read.
- **Gaps stressed:** `股票代码：NNNN` label (Part Two gap #4); `每月25日` date trap.
- **Test idea:** `it("redacts IR 董秘/保荐代表人 names, phones, email and 公司住所 address; keeps 股票代码：300530 and 每月25日 readable")`.

### Doc 54 — 居住证申请表 (HR/government form, inline fields)

```
上海市居住证申请表
姓名：霍辞    性别：女    出生：1995年03月
身份证号：310115199503030035    联系电话：13700000053
现居住址：上海市虚构区示例街道52号1803室
紧急联系人：应渊（关系：配偶）电话：13900000054
电子邮箱：huo.ci@qinglan-fake.com
申请事由：近20年一直在沪工作，详见劳动合同附件。籍贯不详，以户籍为准。
每月25日前提交社保记录。本人承诺以上信息真实。
```

- **Must redact:**
  - `霍辞` — PERSON (B)
  - `1995年03月` — DATE (B)
  - `310115199503030035` — NATIONAL_ID (B)
  - `13700000053` — PHONE (B)
  - `上海市虚构区示例街道52号1803室` — ADDRESS (B)
  - `应渊` — PERSON (B)
  - `13900000054` — PHONE (B)
  - `huo.ci@qinglan-fake.com` — EMAIL (B)
- **Must stay readable:** `上海市居住证申请表`, `姓名：`, `性别：`, `女`, `出生：`, `身份证号：`, `联系电话：`, `现居住址：`, `紧急联系人：`, `关系：`, `配偶`, `电话：`, `电子邮箱：`, `申请事由：`, `近20年`, `详见劳动合同附件`, `籍贯不详`, `以户籍为准`, `每月25日`, `社保记录`, `本人承诺以上信息真实`.
- **Why useful:** Government residence-permit form — high NATIONAL_ID + ADDRESS + EMAIL density via inline `身份证号：` / `现居住址：` / `紧急联系人` labels; the trap quartet (`近20年` / `每月25日` / `不详` / `见附件`) all present; gender word `女` must survive.
- **Gaps stressed:** `女` / `配偶` short dictionary words must not be eaten; `籍贯不详` must read.
- **Test idea:** `it("redacts residence-permit applicant inline national id, address, emergency contact (person+phone) and email; keeps 近20年 / 每月25日 / 籍贯不详 / 女 readable")`.

### Doc 55 — 银行询证函 (audit confirmation, bank balance)

```
银行询证函
致：虚构银行股份有限公司示例支行
截至2025年12月31日，下列账户余额如下：
存款人：虚构青澜新能源科技有限公司，统一社会信用代码91310104FAKE00550C。
账号6228480000000000555，币种人民币，余额人民币2,530,000.00元。
联系人：陆景行，电话021-00005501，邮箱 lujingxing@qinglan-fake.com。
回函请寄：上海市虚构区示例路55号审计项目部。详见附件，单价1元/件不适用。
本询证函依据《中国注册会计师审计准则》出具，结果以银行系统为准。
```

- **Must redact:**
  - `虚构银行股份有限公司示例支行` — ORG (B)
  - `2025年12月31日` — DATE (B)
  - `虚构青澜新能源科技有限公司` — ORG (B)
  - `91310104FAKE00550C` — BUSINESS_ID (B)
  - `6228480000000000555` — BANK_ACCOUNT (H)
  - `人民币2,530,000.00元` — AMOUNT (B)
  - `陆景行` — PERSON (B)
  - `021-00005501` — PHONE (B)
  - `lujingxing@qinglan-fake.com` — EMAIL (B)
  - `上海市虚构区示例路55号审计项目部` — ADDRESS (B)
- **Must stay readable:** `银行询证函`, `致：`, `截至`, `下列账户余额如下：`, `存款人：`, `统一社会信用代码`, `账号`, `币种`, `人民币`, `余额`, `联系人：`, `电话`, `邮箱`, `回函请寄：`, `详见附件`, `单价1元/件`, `本询证函依据《中国注册会计师审计准则》出具`, `结果以银行系统为准`.
- **Why useful:** Audit bank-confirmation letter — heavy BANK_ACCOUNT + AMOUNT + ADDRESS + EMAIL. `虚构银行股份有限公司示例支行` is a real-style bank org whose generic `银行` word must NOT suppress the full-name match (contrast with bare `开户行`).
- **Gaps stressed:** bank branch suffix; `银行` generic word vs full org name; `单价1元/件` and `见附件` adjacent traps.
- **Test idea:** `it("redacts bank-confirmation deposit account, balance, contact, email and mailing address; keeps 银行询证函 heading and 单价1元/件 readable")`.

### Doc 56 — 供应商尽职调查表 (procurement, supplier due diligence)

```
供应商尽职调查表
供应商名称：虚构瀚海生物医药有限公司 统一社会信用代码：91350100FAKE005606
法定代表人：季淮川 身份证号：320505199011250031 手机：13900000056
注册地址：江苏省苏州市虚构工业园区示例路56号
财务联系人：容与 邮箱 rong.yu@hanhai-fake.com 电话：0512-00005600
主要产品：体外诊断试剂，单价1元/件为内部测算口径，详见报价附件。
诉讼情况：不详（无重大未决诉讼）。近20年经营稳定。
本表所列信息用于内部评估，不构成《采购框架协议》项下的承诺。
```

- **Must redact:**
  - `虚构瀚海生物医药有限公司` — ORG (B)
  - `91350100FAKE005606` — BUSINESS_ID (B)
  - `季淮川` — PERSON (B)
  - `320505199011250031` — NATIONAL_ID (B)
  - `13900000056` — PHONE (B)
  - `江苏省苏州市虚构工业园区示例路56号` — ADDRESS (B)
  - `容与` — PERSON (B)
  - `rong.yu@hanhai-fake.com` — EMAIL (B)
  - `0512-00005600` — PHONE (B)
- **Must stay readable:** `供应商尽职调查表`, `供应商名称：`, `统一社会信用代码：`, `法定代表人：`, `身份证号：`, `手机：`, `注册地址：`, `财务联系人：`, `邮箱`, `电话：`, `主要产品：`, `体外诊断试剂`, `单价1元/件`, `内部测算口径`, `详见报价附件`, `诉讼情况：`, `不详`, `无重大未决诉讼`, `近20年`, `经营稳定`, `本表所列信息用于内部评估`, `《采购框架协议》`.
- **Why useful:** Densest inline-ID doc in the batch — USCC + PRC ID + two phones + email + 工业园区 address in one form. Full trap quintet (`单价1元/件` / `不详` / `见附件` / `近20年` / statute-in-《》).
- **Gaps stressed:** `工业园区` district token in address; `不详` inside parentheses; `手机：` vs `电话：` label variants for PHONE.
- **Test idea:** `it("redacts supplier USCC, legal-rep inline PRC ID, two phones, email and 工业园区 address; keeps 不详 / 单价1元/件 / 近20年 readable")`.

### Doc 57 — 投资者关系页面 (IPO/investor relations, web disclosure)

```
虚构星轨航天科技股份有限公司 投资者关系
证券代码 688057 证券简称 虚构星轨
董事会秘书：叶清辞   电话：021-00005701   邮箱：ir@xingbiao-fake.com
证券事务代表：苏问    电话：13700000057
注册地址：上海市虚构区示例环路57号   办公地址：同注册地址
分析师沟通会安排见附件，每月25日为静默期。近三年研发投入见年报。
重要提示：本页信息为示例，实际以《招股说明书》披露为准。
```

- **Must redact:**
  - `虚构星轨航天科技股份有限公司` — ORG (B)
  - `叶清辞` — PERSON (B)
  - `021-00005701` — PHONE (B)
  - `ir@xingbiao-fake.com` — EMAIL (B)
  - `苏问` — PERSON (B)
  - `13700000057` — PHONE (B)
  - `上海市虚构区示例环路57号` — ADDRESS (B)
- **Must stay readable:** `投资者关系`, `证券代码`, `688057`, `证券简称`, `虚构星轨`, `董事会秘书：`, `电话：`, `邮箱：`, `证券事务代表：`, `注册地址：`, `办公地址：`, `同注册地址`, `分析师沟通会安排见附件`, `每月25日`, `静默期`, `近三年`, `研发投入`, `见年报`, `重要提示：`, `本页信息为示例`, `《招股说明书》`.
- **Why useful:** IR web block with `证券代码 688057` (no colon — harder stock-code label) and `证券简称`; dual `注册地址`/`办公地址` labels where `办公地址：同注册地址` must read. `每月25日` / `见附件` / `近三年` traps.
- **Gaps stressed:** `证券代码 NNNN` without colon (Part Two gap #4 variant); `近三年` like `近20年` must not match.
- **Test idea:** `it("redacts IR 董秘/证券事务代表 names, phones, email and 注册地址; keeps 证券代码 688057 and 每月25日/见附件/近三年 readable")`.

### Doc 58 — 银行对账单片段 (bank statement, transaction lines)

```
账户对账单（示例）
账户名称：虚构青澜新能源科技有限公司
账号：6227000000000000588  币种：人民币
交易明细：
2026年06月01日 转入 人民币1,200,000.00元 余额人民币3,500,000.00元
2026年06月10日 转出 人民币800,000.00元   余额人民币2,700,000.00元
对手方：虚构瀚海生物医药有限公司，用途详见附件摘要。
经办：沈聿。不明款项请联系开户行核实。本对账单未含每月25日的自动扣款。
```

- **Must redact:**
  - `虚构青澜新能源科技有限公司` — ORG (B)
  - `6227000000000000588` — BANK_ACCOUNT (H)
  - `2026年06月01日` — DATE (B)
  - `人民币1,200,000.00元` — AMOUNT (B)
  - `人民币3,500,000.00元` — AMOUNT (B)
  - `2026年06月10日` — DATE (B)
  - `人民币800,000.00元` — AMOUNT (B)
  - `人民币2,700,000.00元` — AMOUNT (B)
  - `虚构瀚海生物医药有限公司` — ORG (B)
  - `沈聿` — PERSON (B)
- **Must stay readable:** `账户对账单（示例）`, `账户名称：`, `账号：`, `币种：`, `人民币`, `交易明细：`, `转入`, `转出`, `余额`, `对手方：`, `用途详见附件摘要`, `经办：`, `不明款项请联系开户行核实`, `本对账单未含`, `每月25日`, `自动扣款`.
- **Why useful:** Bank statement — heaviest AMOUNT doc (4 amounts + account number + 2 dates). Transaction lines are columnar but label-led (转入/转出/余额) rather than header-led, exercising a softer tabular variant. `不明款项` is an `不详`-style trap; `开户行` is a bare generic bank word that must stay.
- **Gaps stressed:** columnar transaction line alignment; `开户行` generic vs full branch name.
- **Test idea:** `it("redacts bank-statement account name, account number, all transaction amounts/balances/dates, counterparty org and 经办 person; keeps 转入/转出/余额 labels and 每月25日/不明款项 readable")`.

### Doc 59 — 继承公证书 (legal/notarial, inheritance)

```
公证书
申请人：谢昀，女，1965年12月06日生，身份证号11010119651206004X，住北京市虚构区示例胡同59号。
申请人：周屿，男，1990年08月08日生，身份证号110101199008080017，住同上。
被继承人：谢知非（已故），于2025年11月11日死亡。
查明：被继承人遗产为虚构长风文化传媒股份有限公司12%股权，估值人民币580万元。
上述遗产由谢昀继承60%，周屿继承40%。详见亲属关系证明附件。
本公证书依据《中华人民共和国公证法》出具。每月25日不办理公证。
```

- **Must redact:**
  - `谢昀` — PERSON (B)
  - `1965年12月06日` — DATE (B)
  - `11010119651206004X` — NATIONAL_ID (B)
  - `北京市虚构区示例胡同59号` — ADDRESS (B)
  - `周屿` — PERSON (B)
  - `1990年08月08日` — DATE (B)
  - `110101199008080017` — NATIONAL_ID (B)
  - `谢知非` — PERSON (B)
  - `2025年11月11日` — DATE (B)
  - `虚构长风文化传媒股份有限公司` — ORG (B)
  - `12%` — AMOUNT (B)
  - `人民币580万元` — AMOUNT (B)
  - `60%` — AMOUNT (B)
  - `40%` — AMOUNT (B)
- **Must stay readable:** `公证书`, `申请人：`, `女`, `男`, `生`, `身份证号`, `住`, `住同上`, `被继承人：`, `已故`, `于`, `死亡`, `查明：`, `被继承人遗产为`, `股权`, `估值`, `上述遗产由`, `继承`, `详见亲属关系证明附件`, `本公证书依据《中华人民共和国公证法》出具`, `每月25日不办理公证`.
- **Why useful:** Highest NATIONAL_ID + PERSON + AMOUNT density — two inline PRC IDs, four persons, three dates, and percentage-based inheritance shares all in one short doc. `住同上` / `详见…附件` / `每月25日` traps.
- **Gaps stressed:** percentage amounts (`12%` / `60%` / `40%`) as share ratios; `住同上` co-reference; gender words `女`/`男`.
- **Test idea:** `it("redacts two inheritance applicants' PRC IDs, birth/death dates, inheritance percentages and estate valuation; keeps 住同上 / 亲属关系附件 / 每月25日 readable")`.

### Doc 60 — 股权代持协议 (mixed Chinese-English, nominee agreement)

```
股权代持协议 (Nominee Shareholding Agreement)
实际出资人 (Beneficial Owner)：裴予安 / Pei Yu'an，身份证号440301198706080027
代持人 (Nominee)：季淮川，身份证号320505199011250031
标的公司：虚构长风文化传媒股份有限公司（统一社会信用代码91440300FAKE00600K）
标的股权：占注册资本10%，对应出资额人民币1,000,000元。
联系邮箱：jiashu@changfeng-fake.com   联系电话：+86 13800000060
本协议适用《中华人民共和国公司法》。争议提交虚构仲裁委员会，案号 FAKE-ARB-2026-060。
详见附件一至附件三。每月25日为协议对账日，单价1元/件不适用。
```

- **Must redact:**
  - `裴予安` / `Pei Yu'an` — PERSON (B)
  - `440301198706080027` — NATIONAL_ID (B)
  - `季淮川` — PERSON (B)
  - `320505199011250031` — NATIONAL_ID (B)
  - `虚构长风文化传媒股份有限公司` — ORG (B)
  - `91440300FAKE00600K` — BUSINESS_ID (B)
  - `10%` — AMOUNT (B)
  - `人民币1,000,000元` — AMOUNT (B)
  - `jiashu@changfeng-fake.com` — EMAIL (B)
  - `+86 13800000060` — PHONE (B)
  - `FAKE-ARB-2026-060` — CASE_REF (B)
- **Must stay readable:** `股权代持协议 (Nominee Shareholding Agreement)`, `实际出资人 (Beneficial Owner)：`, `代持人 (Nominee)：`, `身份证号`, `标的公司：`, `统一社会信用代码`, `标的股权：`, `占注册资本`, `对应出资额`, `联系邮箱：`, `联系电话：`, `本协议适用《中华人民共和国公司法》`, `争议提交虚构仲裁委员会`, `案号`, `详见附件一至附件三`, `每月25日`, `协议对账日`, `单价1元/件不适用`.
- **Why useful:** Bilingual nominee agreement — two inline PRC IDs, a Latin person name `Pei Yu'an`, USCC, stake percentage + capital amount, email, spaced `+86 1xx` mobile, and an `FAKE-ARB-…` arbitration case number. Carries the full trap set (`见附件` / `每月25日` / `单价1元/件` / statute-in-《》).
- **Gaps stressed:** bare Latin name in a Chinese doc (`Pei Yu'an`); `+86 1xx` spaced mobile; `案号`-labelled ARB reference.
- **Test idea:** `it("redacts nominee-agreement parties (incl Latin name), both PRC IDs, USCC, stake %, capital amount, email, +86 mobile and ARB case ref; keeps bilingual labels and 每月25日 / 单价1元/件 readable")`.

### Extended Batch 4 coverage

| Kind | Docs exercising it |
| ---- | ------------------ |
| PERSON | 51, 52, 53, 54, 55, 56, 57, 58, 59, 60 (all 10) |
| ORG | 52, 53, 55, 56, 57, 58, 59, 60 |
| ADDRESS | 52, 54, 55, 56, 57, 59 |
| BUSINESS_ID | 52, 55, 56, 60 |
| NATIONAL_ID | 51, 52, 54, 56, 59, 60 (6 — was the sparse kind) |
| PHONE | 51, 52, 53, 54, 55, 56, 57, 60 |
| EMAIL | 51, 53, 54, 55, 56, 57, 60 (7 — was the sparse kind) |
| DATE | 51, 52, 54, 55, 58, 59 |
| AMOUNT | 52, 55, 56, 58, 59, 60 |
| CASE_REF | 60 |
| BANK_ACCOUNT | 52, 55, 58 |

New trap coverage this batch: tabular NATIONAL_ID/EMAIL/PHONE cells under headers (51), full 省-市-区-路-号-幢-室 address + `每月25日`/`单价1元/件`/《民法典》 (52), `股票代码：300530` + `每月25日`/`近20年` (53), government-form inline `身份证号：` + `籍贯不详`/`近20年`/`每月25日`/gender `女` (54), bank-org full-name vs bare `开户行` (55), `工业园区` address + `手机：`/`电话：` label variants + `不详` (56), `证券代码 NNNN` no-colon + `近三年` + `同注册地址` (57), columnar transaction lines + `不明款项`/`开户行` (58), percentage share ratios + `住同上` (59), Latin name + `+86 1xx` spaced mobile + `案号` ARB ref (60).

---

## Part Three — Extended Corpus (Batch 5, Docs 61–70)

Batch 5 rotates back to the kinds Batch 4 touched lightly — **CASE_REF** and **BANK_ACCOUNT** — and adds a second **Traditional Chinese** sample (Part Two gap #2) plus an offshore/VIE structure (mixed Latin/Cayman/BVI). The standing trap set persists; new invented names this batch: 梁叙, 楚衡, 程予, 顾衍, 阮慈, 苏珩, 沈霁, 裴行, 林知微, 韩述之, 杜明軒, 溫時晏. New invented orgs: 虚构澜海储能科技股份有限公司, 虚构云图半导体股份有限公司, 虚构星河智能科技股份有限公司, 虚构星河数据技术有限公司, 虚构九州融资租赁有限公司, 虚构晨曦保理有限公司, 虚构瀚辰医药股份有限公司, 騫越控股有限公司, StarGalaxy Holdings Ltd.

### Doc 61 — 招股说明书知识产权清单 (IPO/prospectus, IP portfolio)

```
虚构澜海储能科技股份有限公司 招股说明书（申报稿）— 知识产权
公司及子公司拥有发明专利55项、软件著作权18项、注册商标9项。
核心专利：发明专利ZL2018100000FAKE.7（全固态电池模组管理方法）。
商标：第FAKE00061号商标（图形+文字），核定使用商品第9类。
近三年研发投入累计人民币2.8亿元，研发人员占比28.6%。
保荐机构：示例证券股份有限公司。经办律师：梁叙（虚构天衡联合律师事务所）。
签署日期：2026年06月18日。详见附件专利清单，不详之处以登记簿为准。
```

- **Must redact:**
  - `虚构澜海储能科技股份有限公司` — ORG (B)
  - `人民币2.8亿元` — AMOUNT (B)
  - `28.6%` — AMOUNT (B)
  - `示例证券股份有限公司` — ORG (B)
  - `梁叙` — PERSON (B)
  - `虚构天衡联合律师事务所` — ORG (B)
  - `2026年06月18日` — DATE (B)
  - `ZL2018100000FAKE.7` — BUSINESS_ID (B) `[aspirational: bare patent/application number]`
  - `第FAKE00061号商标` — BUSINESS_ID (B) `[aspirational: 商标注册号 label]`
- **Must stay readable:** `招股说明书（申报稿）— 知识产权`, `公司及子公司拥有发明专利`, `55项`, `软件著作权`, `18项`, `注册商标`, `9项`, `核心专利`, `发明专利`, `商标`, `核定使用商品第9类`, `近三年`, `研发投入累计`, `研发人员占比`, `保荐机构`, `经办律师`, `签署日期`, `详见附件专利清单`, `不详之处以登记簿为准`.
- **Why useful:** IP portfolio block — aspirational patent/trademark BUSINESS_ID forms (`ZL…` application number, `第…号商标`); `近三年` / `不详` / `见附件` traps; a percentage and a `亿元` amount; `第9类` goods-class ordinal must read like `第N条`.
- **Gaps stressed:** bare patent number (`ZL…`) and `商标注册号` (Part Two gap #5 family); `55项`/`18项`/`9项` counts must not parse as amounts.
- **Test idea:** `it("redacts prospectus IP 募投 percentage and 億元 amount; keeps 55项/18项 counts, 第9类 ordinal and 近三年/不详 readable")`.

### Doc 62 — 行政处罚事先告知书 (CSRC-style, pre-penalty notice)

```
中国证券监督管理委员会行政处罚事先告知书
当事人：虚构云图半导体股份有限公司（住所：上海市虚构区示例环路62号）
统一社会信用代码：91310107FAKE00620C  法定代表人：楚衡
经查，当事人2024年年度报告存在虚增收入行为，涉嫌违反《中华人民共和国证券法》。
依据第一百九十七条，拟决定：对当事人罚款人民币300万元；
对直接负责的主管人员楚衡警告并罚款人民币60万元。告知文号：证监罚字〔2026〕62号。
当事人享有陈述、申辩及要求听证的权利，详见权利告知附件。每月25日为对账日。
```

- **Must redact:**
  - `虚构云图半导体股份有限公司` — ORG (B)
  - `上海市虚构区示例环路62号` — ADDRESS (B)
  - `91310107FAKE00620C` — BUSINESS_ID (B)
  - `楚衡` — PERSON (B)
  - `人民币300万元` — AMOUNT (B)
  - `人民币60万元` — AMOUNT (B)
  - `证监罚字〔2026〕62号` — CASE_REF (B) `[aspirational: …〔YYYY〕N号 format — Part Two gap #6]`
- **Must stay readable:** `中国证券监督管理委员会` (issuing regulator — kept readable per Part Two convention), `行政处罚事先告知书`, `当事人`, `住所`, `统一社会信用代码`, `法定代表人`, `经查`, `2024年年度报告` (year-only trap), `虚增收入`, `涉嫌违反《中华人民共和国证券法》`, `依据第一百九十七条`, `拟决定`, `罚款`, `警告`, `告知文号`, `陈述`, `申辩`, `要求听证`, `权利告知附件`, `每月25日`, `对账日`.
- **Why useful:** Pre-penalty notice — `证监罚字〔2026〕62号` document number (Part Two gap #6 family); `2024年年度报告` is a year-only reference that must NOT parse as a full date; statute + article ordinal in `《》` / `第N条`; issuing regulator kept readable.
- **Gaps stressed:** `…〔YYYY〕N号` regulatory number; `2024年年度` year-only trap; `第一百九十七条` article ordinal.
- **Test idea:** `it("redacts CSRC pre-penalty parties, fines and 证监罚字〔2026〕62号; keeps 中国证监会, 2024年年度报告 and 第一百九十七条 readable")`.

### Doc 63 — 资产支持证券说明书 (asset-management, ABS prospectus)

```
虚构星河应收账款资产支持证券说明书（节选）
原始权益人：虚构星河智能科技股份有限公司（统一社会信用代码91440100FAKE00630K）
基础资产：截至2025年06月30日，应收账款债权人民币580,000,000.00元。
证券分层：优先A级占比80%，优先B级占比15%，次级占比5%。
资产服务机构：虚构九州融资租赁有限公司。管理人：示例证券股份有限公司。
信用评级：优先A级AAA。信托账户：6225880000000000630。
发行规模人民币6.0亿元，期限3年。详见于登记服务附件。
本说明书中"基础资产"定义详见第十二条，单价1元/件不适用。
```

- **Must redact:**
  - `虚构星河智能科技股份有限公司` — ORG (B)
  - `91440100FAKE00630K` — BUSINESS_ID (B)
  - `2025年06月30日` — DATE (B)
  - `人民币580,000,000.00元` — AMOUNT (B)
  - `80%` / `15%` / `5%` — AMOUNT (B)
  - `虚构九州融资租赁有限公司` — ORG (B)
  - `示例证券股份有限公司` — ORG (B)
  - `6225880000000000630` — BANK_ACCOUNT (H)
  - `人民币6.0亿元` — AMOUNT (B)
- **Must stay readable:** `虚构星河应收账款资产支持证券说明书（节选）`, `原始权益人`, `基础资产`, `截至`, `应收账款债权`, `证券分层`, `优先A级` / `优先B级` / `次级`, `占比`, `资产服务机构`, `管理人`, `信用评级`, `AAA`, `信托账户`, `发行规模`, `期限3年`, `详见于登记服务附件`, `"基础资产"定义详见第十二条`, `单价1元/件不适用`.
- **Why useful:** ABS prospectus — layered tranching percentages, a 9-digit-yuan receivable amount, a `信托账户` bank account, and multiple party orgs. `第十二条` article ordinal and `期限3年` duration must read.
- **Gaps stressed:** `信托账户：` label variant for BANK_ACCOUNT; `第十二条` ordinal; `期限3年` duration.
- **Test idea:** `it("redacts ABS receivable amount, tranche percentages, 信托账户 and 发行规模; keeps AAA 评级, 第十二条 and 期限3年 readable")`.

### Doc 64 — 资金划拨指令 (bank/payment, internal fund transfer)

```
资金划拨指令（内部）
指令编号：FAKE-TRF-2026-064  日期：2026年06月18日
付款账户：虚构星河智能科技股份有限公司，账号6225880000000000640，开户行虚构银行示例支行。
收款账户：虚构九州融资租赁有限公司，账号6227000000000000640。
划拨金额：人民币12,500,000.00元。用途：支付设备款，详见合同附件。
经办：程予  复核：顾衍  审批：楚衡
本指令经三级审批后生效，不明账户请立即停止划拨。每月25日不做大额划拨。
```

- **Must redact:**
  - `FAKE-TRF-2026-064` — CASE_REF (B)
  - `2026年06月18日` — DATE (B)
  - `虚构星河智能科技股份有限公司` — ORG (B)
  - `6225880000000000640` — BANK_ACCOUNT (H)
  - `虚构九州融资租赁有限公司` — ORG (B)
  - `6227000000000000640` — BANK_ACCOUNT (H)
  - `人民币12,500,000.00元` — AMOUNT (B)
  - `程予` — PERSON (B)
  - `顾衍` — PERSON (B)
  - `楚衡` — PERSON (B)
- **Must stay readable:** `资金划拨指令（内部）`, `指令编号`, `日期`, `付款账户`, `账号`, `开户行`, `收款账户`, `划拨金额`, `用途`, `支付设备款`, `详见合同附件`, `经办`, `复核`, `审批`, `本指令经三级审批后生效`, `不明账户请立即停止划拨`, `每月25日`, `大额划拨`.
- **Why useful:** Two bank accounts + a large amount + an `指令编号` case ref in one short form; three role-labelled people (`经办`/`复核`/`审批`); `开户行` bare generic vs `虚构银行示例支行` full branch.
- **Gaps stressed:** `开户行` generic word must stay while the full branch redacts; `不明账户` `不详`-style trap.
- **Test idea:** `it("redacts both fund-transfer account numbers, amount, 经办/复核/审批 people and 指令编号; keeps 开户行 and 不明账户 readable")`.

### Doc 65 — 限制性股票授予协议 (cap table, equity incentive)

```
限制性股票授予协议
授予方：虚构澜海储能科技股份有限公司（统一社会信用代码91310110FAKE006508）
被授予人：程予，身份证号310110198511120001，职务：技术总监
授予数量：200,000股（每股面值人民币1元），授予价格每股人民币12.50元，授予总对价人民币2,500,000元。
授予日：2026年06月18日。限售期2年，解锁比例第一年50%、第二年50%。
被授予人联系邮箱：cheng.yu@lanhai-fake.com，手机：13900000065。
争议提交虚构仲裁委员会，案号见仲裁条款附件。本协议适用《公司法》。
```

- **Must redact:**
  - `虚构澜海储能科技股份有限公司` — ORG (B)
  - `91310110FAKE006508` — BUSINESS_ID (B)
  - `程予` — PERSON (B)
  - `310110198511120001` — NATIONAL_ID (B)
  - `人民币1元` — AMOUNT (B)
  - `人民币12.50元` — AMOUNT (B)
  - `人民币2,500,000元` — AMOUNT (B)
  - `2026年06月18日` — DATE (B)
  - `50%` / `50%` — AMOUNT (B)
  - `cheng.yu@lanhai-fake.com` — EMAIL (B)
  - `13900000065` — PHONE (B)
- **Must stay readable:** `限制性股票授予协议`, `授予方`, `被授予人`, `身份证号`, `职务`, `技术总监`, `授予数量`, `200,000股`, `每股面值`, `授予价格每股`, `授予总对价`, `授予日`, `限售期2年`, `解锁比例`, `第一年` / `第二年`, `被授予人联系邮箱`, `手机`, `争议提交虚构仲裁委员会`, `案号见仲裁条款附件`, `本协议适用《公司法》`.
- **Why useful:** Equity grant — inline PRC ID + email + phone + par/price/total amount cascade + unlock percentages. `限售期2年` and `第一年/第二年` are durations/ordinals that must read; `《公司法》` short-form statute.
- **Gaps stressed:** `200,000股` share count must not over-redact into the adjacent amount; `2年`/`第一年` duration/ordinal.
- **Test idea:** `it("redacts equity-grant grantee PRC ID, par/price/total amounts, email and phone; keeps 200,000股 count, 限售期2年 and 《公司法》 readable")`.

### Doc 66 — 开庭传票 (litigation/court, summons)

```
虚构市示例区人民法院 传票
案号：（2026）示例民初字第0066号
案由：买卖合同纠纷
原告：虚构瀚辰医药股份有限公司，住所：北京市虚构区示例路66号。
被告：顾衍，男，住所不详，电话：021-00006601。
开庭时间：2026年07月15日09时00分，地点：第三审判庭。
承办法官：苏珩，书记员：阮慈。
当事人及诉讼代理人持本传票于开庭日期到庭，详见诉讼权利义务告知书附件。
无正当理由拒不到庭的，依法按撤诉处理或缺席判决。
```

- **Must redact:**
  - `（2026）示例民初字第0066号` — CASE_REF (B) `[aspirational: （YYYY）…字第N号 civil case format]`
  - `虚构瀚辰医药股份有限公司` — ORG (B)
  - `北京市虚构区示例路66号` — ADDRESS (B)
  - `顾衍` — PERSON (B)
  - `021-00006601` — PHONE (B)
  - `2026年07月15日` — DATE (B)
  - `苏珩` — PERSON (B)
  - `阮慈` — PERSON (B)
- **Must stay readable:** `虚构市示例区人民法院` (issuing court — kept readable like a regulator), `传票`, `案号`, `案由`, `买卖合同纠纷`, `原告`, `住所`, `被告`, `男`, `住所不详`, `电话`, `开庭时间`, `09时00分`, `地点`, `第三审判庭`, `承办法官`, `书记员`, `当事人及诉讼代理人持本传票于开庭日期到庭`, `详见诉讼权利义务告知书附件`, `无正当理由拒不到庭的`, `依法按撤诉处理或缺席判决`.
- **Why useful:** Court summons — `（2026）示例民初字第0066号` civil-case-number format (aspirational variant of the 〔〕 family); issuing court kept readable while the litigant org redacts; `住所不详` trap; `09时00分` time-of-day and `第三审判庭` ordinal must read; role people `法官`/`书记员`.
- **Gaps stressed:** `（YYYY）…字第N号` case format; `住所不详`; court-vs-litigant ORG distinction.
- **Test idea:** `it("redacts summons civil case number, plaintiff org/address, defendant person+phone, judge/clerk; keeps issuing court, 住所不详 and 09时00分 readable")`.

### Doc 67 — 投标函 (procurement, bid letter)

```
投标函
致：虚构市示例局（采购人）
投标人：虚构云图半导体股份有限公司，统一社会信用代码91320500FAKE006709。
法定代表人：沈霁。投标报价：人民币3,280,000.00元（含税），单价1元/件仅作口径。
交货期：合同签订后90日内。质保期：验收合格之日起24个月。
投标保证金：人民币65,000元，从账户6228480000000000670汇出，开户行见附件。
联系人：裴行，手机13800000067，邮箱 pei.xing@yuntu-fake.com。
投标有效期：自2026年06月18日起60日。本投标依据《政府采购法》。
```

- **Must redact:**
  - `虚构市示例局` — ORG (B)
  - `虚构云图半导体股份有限公司` — ORG (B)
  - `91320500FAKE006709` — BUSINESS_ID (B)
  - `沈霁` — PERSON (B)
  - `人民币3,280,000.00元` — AMOUNT (B)
  - `人民币65,000元` — AMOUNT (B)
  - `6228480000000000670` — BANK_ACCOUNT (H)
  - `裴行` — PERSON (B)
  - `13800000067` — PHONE (B)
  - `pei.xing@yuntu-fake.com` — EMAIL (B)
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `投标函`, `致`, `采购人`, `投标人`, `统一社会信用代码`, `法定代表人`, `投标报价`, `含税`, `单价1元/件`, `口径`, `交货期`, `合同签订后90日内`, `质保期`, `验收合格之日起24个月`, `投标保证金`, `账户`, `开户行见附件`, `联系人`, `手机`, `邮箱`, `投标有效期`, `自…起60日`, `本投标依据《政府采购法》`.
- **Why useful:** Bid letter — full org/USCC/amount/bank/contact set in procurement form; `90日内` / `24个月` / `60日` durations must not parse as amounts or dates; `开户行见附件` keeps `开户行` generic.
- **Gaps stressed:** duration expressions (`90日内`/`24个月`/`60日`); `单价1元/件` next to a real `元` amount.
- **Test idea:** `it("redacts bid orgs, USCC, bid/bond amounts, bond account, contact person+phone+email; keeps 90日内/24个月/60日 durations and 单价1元/件 readable")`.

### Doc 68 — 红筹/VIE架构说明 (IPO/prospectus, offshore structure)

```
发行人：虚构星河智能科技股份有限公司（开曼）注册地：开曼群岛
境内运营实体：虚构星河数据技术有限公司（WFOE），统一社会信用代码91310104FAKE00680L。
VIE协议主体：林知微（中国籍，身份证号110105198209150002）持有牌照公司100%股权。
境外控股股东：StarGalaxy Holdings Ltd.（注册地：Cayman Islands）。
实际控制人：韩述之，通过BVI公司间接持股。详见架构图附件。
近三年累计分红人民币1.2亿元。本说明适用《中华人民共和国外商投资法》。
不明事项以登记信息为准。每月25日为例行关账日。
```

- **Must redact:**
  - `虚构星河智能科技股份有限公司` — ORG (B)
  - `虚构星河数据技术有限公司` — ORG (B)
  - `91310104FAKE00680L` — BUSINESS_ID (B)
  - `林知微` — PERSON (B)
  - `110105198209150002` — NATIONAL_ID (B)
  - `100%` — AMOUNT (B)
  - `StarGalaxy Holdings Ltd.` — ORG (B) `[aspirational: bare English offshore org name in CN doc]`
  - `韩述之` — PERSON (B)
  - `人民币1.2亿元` — AMOUNT (B)
- **Must stay readable:** `发行人`, `注册地：开曼群岛` (jurisdiction — aspirational), `境内运营实体`, `WFOE`, `统一社会信用代码`, `VIE协议主体`, `中国籍`, `持有牌照公司`, `股权`, `境外控股股东`, `注册地：Cayman Islands`, `实际控制人`, `通过BVI公司间接持股`, `详见架构图附件`, `近三年`, `累计分红`, `本说明适用《中华人民共和国外商投资法》`, `不明事项以登记信息为准`, `每月25日`, `例行关账日`.
- **Why useful:** Offshore VIE structure — an English offshore parent (`StarGalaxy Holdings Ltd.`), two `注册地：…` jurisdictions (开曼群岛 / Cayman Islands), an inline PRC ID tied to the VIE nominal holder, `BVI公司` generic, and `100%` holding ratio.
- **Gaps stressed:** bare English org name (Part Two gap #3 family); `注册地：<jurisdiction>` short value (Part Two doc 32 family); `BVI`/`WFOE` acronym generics.
- **Test idea:** `it("redacts VIE onshore entities, nominal-holder PRC ID, offshore parent org and 100% holding; keeps 注册地：Cayman Islands / BVI公司 and 近三年 readable")`.

### Doc 69 — 国内保理合同 (bank/payment, factoring)

```
国内有追索权保理合同
保理商：虚构晨曦保理有限公司（统一社会信用代码91310113FAKE00690H）
卖方：虚构瀚辰医药股份有限公司  买方：虚构九州融资租赁有限公司
应收账款：人民币8,800,000.00元，到期日2026年09月30日。
保理融资款：人民币8,000,000.00元，划入卖方账户6225880000000000690。
保理费率：年化4.5%。指定联系人：阮慈，电话021-00006901。
回购条款：详见第八条及回购通知附件。不明账款应在3个工作日内提出。
本合同适用《中华人民共和国民法典》。每月25日为对账日。
```

- **Must redact:**
  - `虚构晨曦保理有限公司` — ORG (B)
  - `91310113FAKE00690H` — BUSINESS_ID (B)
  - `虚构瀚辰医药股份有限公司` — ORG (B)
  - `虚构九州融资租赁有限公司` — ORG (B)
  - `人民币8,800,000.00元` — AMOUNT (B)
  - `2026年09月30日` — DATE (B)
  - `人民币8,000,000.00元` — AMOUNT (B)
  - `6225880000000000690` — BANK_ACCOUNT (H)
  - `年化4.5%` — AMOUNT (B)
  - `阮慈` — PERSON (B)
  - `021-00006901` — PHONE (B)
- **Must stay readable:** `国内有追索权保理合同`, `保理商`, `统一社会信用代码`, `卖方`, `买方`, `应收账款`, `到期日`, `保理融资款`, `划入卖方账户`, `保理费率`, `年化`, `指定联系人`, `电话`, `回购条款`, `详见第八条及回购通知附件`, `不明账款应在3个工作日内提出`, `本合同适用《中华人民共和国民法典》`, `每月25日`, `对账日`.
- **Why useful:** Factoring — three orgs + receivable/financing amounts + a `卖方账户` bank account + `年化4.5%` rate + maturity date. `第八条` article ordinal and `3个工作日` duration must read.
- **Gaps stressed:** `年化4.5%` rate percentage; `第八条` ordinal; `3个工作日` duration.
- **Test idea:** `it("redacts factoring parties, receivable/financing amounts, 卖方账户, rate and contact; keeps 第八条 / 3个工作日 / 每月25日 readable")`.

### Doc 70 — 董事會報告 (Traditional Chinese / HK, board report)

```
騫越控股有限公司（股份代號：02870.HK）二零二六年度董事會報告
本年度本集團收入港幣12.5億元，較去年增長百分之八。
董事會成員：杜明軒（行政總裁）、溫時晏（執行董事）、裴行（獨立非執行董事）。
公司秘書：林知微。註冊辦事處：香港虛構灣示例道70號18樓。
核數師：示例會計師事務所。聯絡電郵：ir@qianyue-fake.com.hk。
股息每股港幣0.25元。詳見年報附件。本公司近三年持續盈利。
本報告以繁體中文編製，依據《香港公司條例》披露。
```

- **Must redact:** `[aspirational: 全文繁體 — Part Two gap #2]`
  - `騫越控股有限公司` — ORG (B)
  - `02870.HK` — BUSINESS_ID (B) `[aspirational: 股份代號：NNNNN.HK]`
  - `二零二六年度` — DATE (B) `[aspirational: 繁體中文數字日期]`
  - `港幣12.5億元` — AMOUNT (B) `[aspirational: 港幣 unit]`
  - `杜明軒` / `溫時晏` / `裴行` / `林知微` — PERSON (B)
  - `香港虛構灣示例道70號18樓` — ADDRESS (B) `[aspirational: 繁體地址 + 樓]`
  - `ir@qianyue-fake.com.hk` — EMAIL (B)
  - `港幣0.25元` — AMOUNT (B) `[aspirational: 港幣 unit]`
- **Must stay readable:** `股份代號`, `董事會報告`, `本年度本集團收入`, `較去年增長百分之八`, `董事會成員`, `行政總裁` / `執行董事` / `獨立非執行董事`, `公司秘書`, `註冊辦事處`, `核數師`, `示例會計師事務所`, `聯絡電郵`, `股息每股`, `詳見年報附件`, `本公司近三年持續盈利`, `本報告以繁體中文編製`, `依據《香港公司條例》披露`.
- **Why useful:** Second 繁體 sample (Part Two only had Docs 37/47 + Part One 20) — 繁體中文數字 date (`二零二六年度`), `港幣` amounts, `股份代號：NNNNN.HK`, 繁體 role titles (`行政總裁`/`執行董事`), 繁體 address with `樓`, and a `.com.hk` email.
- **Gaps stressed:** 繁體 numeral dates; `港幣` unit; `百分之八` Chinese-numeral percentage (kept readable); `.com.hk` email TLD.
- **Test idea:** `it("[繁體] redacts board-report org, 港幣 amounts, directors, address and email; keeps 股份代號：02870.HK label and 百分之八 readable")`.

### Extended Batch 5 coverage

| Kind | Docs exercising it |
| ---- | ------------------ |
| PERSON | 61, 62, 64, 65, 66, 67, 68, 69, 70 |
| ORG | 61, 62, 63, 64, 65, 66, 67, 68, 69, 70 (all 10) |
| ADDRESS | 62, 66, 68, 70 |
| BUSINESS_ID | 61(aspirational), 62, 63, 65, 67, 68, 69, 70(aspirational) |
| NATIONAL_ID | 65, 68 |
| PHONE | 65, 66, 67, 69 |
| EMAIL | 65, 67, 70 |
| DATE | 61, 63, 64, 65, 66, 67, 69, 70(aspirational) |
| AMOUNT | 61, 62, 63, 64, 65, 67, 68, 69, 70 |
| CASE_REF | 62(aspirational), 64, 66(aspirational) |
| BANK_ACCOUNT | 63, 64, 67, 69 |

New trap coverage this batch: aspirational patent `ZL…`/`商标注册号` + `55项` counts (61), `2024年年度报告` year-only + `证监罚字〔2026〕62号` + 第一百九十七条 (62), ABS tranching percentages + `信托账户` + `第十二条`/`期限3年` (63), dual bank accounts + 经办/复核/审批 roles + `开户行` generic (64), `200,000股` count + par/price/total cascade + `限售期2年` (65), `（2026）示例民初字第0066号` civil case + `住所不详` + `09时00分` (66), `90日内`/`24个月`/`60日` durations + `单价1元/件` (67), offshore English org + `注册地：Cayman Islands` + `BVI公司` (68), `年化4.5%` rate + `第八条`/`3个工作日` (69), 繁體 numeral date + `港幣` + `百分之八` + `.com.hk` (70).

---

## Part Three — Overall Coverage (Docs 51–70)

Aggregated across Batches 4–5 (20 new docs). Counts include `[aspirational]` spans, which Codex should land as skipped/counterexample tests.

| Kind | Docs exercising it | Notes |
| ---- | ------------------ | ---- |
| PERSON | 20/20 | tabular cells (51), Latin names (60, 68), 繁體 (70), 法官/书记员/仲裁员 roles (66) |
| ORG | 20/20 | offshore English parent (68), 繁體 (70), bank/leasing/factoring/保理 orgs (55–69), court kept readable vs litigant redacted (66) |
| ADDRESS | 10/20 | full 省-市-区-路-号-幢-室 (52), 工业园区 (56), 繁體+樓 (70), `注册地：<jurisdiction>` (68) |
| BUSINESS_ID | 14/20 | patent `ZL…` (61), `商标注册号` (61), `股份代號：NNNNN.HK` (70), `股票代码：` (53), `证券代码 NNNN` (67) |
| NATIONAL_ID | 8/20 | tabular ×3 (51), inline `身份证号：` (52,54,56,59,60,65,68) |
| PHONE | 12/20 | landlines `0xxx-` (53,55,66,69), spaced `+86 1xx` (60), `手机：`/`电话：` label split (56) |
| EMAIL | 10/20 | tabular ×3 (51), `.com.hk` (70), personal-name local-parts (52,54,55,60,65,67) |
| DATE | 14/20 | `2024年年度报告` year-only trap (62), 繁體 numeral date (70), `2025年…` fiscal dates |
| AMOUNT | 19/20 | percentages as shares/rates (59,63,65,68,69), `港幣` (70), par/price/total cascade (65), duration traps `24个月`/`60日` (67) |
| CASE_REF | 4/20 | `证监罚字〔2026〕62号` (62), `（2026）…字第0066号` (66), `FAKE-TRF-…` (64), `FAKE-ARB-…` (60) |
| BANK_ACCOUNT | 7/20 | `信托账户` (63), `卖方账户` (69), dual accounts (64), heavy-only `单价` traps adjacent |

### Part Three — Aspirational Gap Catalogue (additions)

These either newly appear in Part Three or deepen Part Two's catalogue:

9. **Patent / trademark numbers** — `ZL2018100000FAKE.7` application number and `第FAKE00061号商标` registration number (61).
10. **Civil case-number formats** — `（2026）示例民初字第0066号` (66) alongside the regulatory `证监罚字〔2026〕62号` (62). Same CASE_REF gap family, two bracket styles.
11. **Percentage-as-share / percentage-as-rate** — `12%`/`60%`/`40%` inheritance shares (59), `80%`/`15%`/`5%` ABS tranches (63), `年化4.5%` (69), `100%` holding (68). AMOUNT regex must catch `%` reliably without eating `第N条` ordinals or `百分之N` Chinese-numeral percentages.
12. **Duration expressions** — `90日内` / `24个月` / `60日` / `3个工作日` / `期限3年` / `限售期2年` (63, 65, 67, 69). Must NOT match as dates or amounts.
13. **`信托账户：` / `卖方账户：` / `收款账户：` label variants** for BANK_ACCOUNT (63, 64, 69).
14. **Court vs litigant ORG distinction** — issuing `虚构市示例区人民法院` stays readable while litigant `虚构瀚辰医药股份有限公司` redacts (66). Mirrors the regulator-kept-readable convention (38, 48, 62).
15. **Offshore English org names + jurisdiction values** — `StarGalaxy Holdings Ltd.`, `注册地：Cayman Islands` / `开曼群岛`, `BVI公司` (68).

---

## Part Four — Extended Corpus (Batch 6, Docs 71–80)

Batch 6 rotates to **BUSINESS_ID** (10/10), **CASE_REF** (5/10) and **DATE** (10/10), adds a third 繁體 sample, a customs export declaration, and a cross-border M&A term sheet carrying a USD amount and a passport number. New invented names this batch: 江研, 林疏, 裴慈, 沈昭, 苏叙, 程止, 顾知, 韩嶋, 梁知 (plus 繁體 杜明軒/溫時晏 reused). All identifiers invented and length-valid.

### Doc 71 — 信托受益权转让合同 (asset-management, trust beneficiary transfer)

```
信托受益权转让合同
转让方：江研（身份证号310104198811060021）
受让方：虚构九州融资租赁有限公司（统一社会信用代码91310112FAKE007107）
信托计划：虚构星河一号财产权信托，保管账户6225880000000000710。
转让标的：信托受益权份额8,000万份，对应转让价款人民币56,000,000.00元。
转让日：2026年06月18日。税费各自承担，详见税务附件。
争议提交虚构仲裁委员会，案号 FAKE-ARB-2026-071。单价1元/件不适用。
```

- **Must redact:**
  - `江研` — PERSON (B)
  - `310104198811060021` — NATIONAL_ID (B)
  - `虚构九州融资租赁有限公司` — ORG (B)
  - `91310112FAKE007107` — BUSINESS_ID (B)
  - `6225880000000000710` — BANK_ACCOUNT (H)
  - `人民币56,000,000.00元` — AMOUNT (B)
  - `2026年06月18日` — DATE (B)
  - `FAKE-ARB-2026-071` — CASE_REF (B)
- **Must stay readable:** `信托受益权转让合同`, `转让方`, `身份证号`, `受让方`, `统一社会信用代码`, `信托计划`, `虚构星河一号财产权信托` (named product), `保管账户`, `转让标的`, `信托受益权份额`, `8,000万份` (count trap), `对应转让价款`, `转让日`, `税费各自承担`, `详见税务附件`, `争议提交虚构仲裁委员会`, `案号`, `单价1元/件不适用`.
- **Why useful:** Trust beneficiary transfer — PRC ID + USCC + `保管账户` bank + large amount + ARB case in one doc; `8,000万份` share-count-with-万 must not parse as a 万元 amount.
- **Gaps stressed:** `保管账户：` label variant; `8,000万份` count; named trust product must read.
- **Test idea:** `it("redacts trust-transfer parties, PRC ID, USCC, 保管账户, price and ARB case; keeps 8,000万份 count and 单价1元/件 readable")`.

### Doc 72 — 行政强制措施决定书 (regulator notice, administrative coercion)

```
虚构市市场监督管理局 行政强制措施决定书
当事人：虚构瀚辰医药股份有限公司（统一社会信用代码91310107FAKE00620C）
经查，当事人生产记录与实际不符，违反《中华人民共和国药品管理法》。
依据第九十八条，决定：查封相关设备，期限60日，并处罚款人民币150万元。
文号：市监强字〔2026〕72号。执行机关：虚构市示例区市场监督管理局。
当事人如不服，可在60日内申请行政复议，详见救济途径附件。每月25日系统维护。
```

- **Must redact:**
  - `虚构瀚辰医药股份有限公司` — ORG (B)
  - `91310107FAKE00620C` — BUSINESS_ID (B)
  - `人民币150万元` — AMOUNT (B)
  - `市监强字〔2026〕72号` — CASE_REF (B) `[aspirational: …〔YYYY〕N号 — Part Two gap #6]`
- **Must stay readable:** `虚构市市场监督管理局` / `虚构市示例区市场监督管理局` (issuing regulator — kept readable), `行政强制措施决定书`, `当事人`, `统一社会信用代码`, `经查`, `生产记录与实际不符`, `违反《中华人民共和国药品管理法》`, `依据第九十八条`, `决定`, `查封相关设备`, `期限60日`, `罚款`, `文号`, `执行机关`, `当事人如不服`, `可在60日内申请行政复议`, `详见救济途径附件`, `每月25日`, `系统维护`.
- **Why useful:** Administrative coercion — issuing regulator kept readable while the litigant org redacts; `期限60日` / `60日内` duration traps; `第九十八条` ordinal; `《药品管理法》` statute; `市监强字〔〕` case number.
- **Gaps stressed:** `期限60日` / `60日内` durations; regulator-vs-litigant ORG distinction; `第九十八条` ordinal.
- **Test idea:** `it("redacts coercion-decision litigant org, USCC, fine and 市监强字〔2026〕72号; keeps issuing 监督管理局, 期限60日 and 第九十八条 readable")`.

### Doc 73 — 招股说明书董监高简历 (IPO/prospectus, directors & execs bios)

```
虚构星轨航天科技股份有限公司 董事、监事、高级管理人员简历
董事长：江研，1975年08月生，虚构大学示例硕士，曾任虚构云图半导体股份有限公司副总裁。
总经理：林疏，1980年03月生，联系电话021-00007301，电子邮箱 lin.shu@xinggui-fake.com。
财务总监：裴慈，1982年11月生，注册会计师。独立董事：沈昭。
公司地址：上海市虚构区示例环路73号。上述人员简历详见招股说明书附件。
本公司近20年无重大违法违规记录。联系手机13900000073。
```

- **Must redact:**
  - `虚构星轨航天科技股份有限公司` — ORG (B)
  - `江研` — PERSON (B)
  - `1975年08月` — DATE (B)
  - `虚构云图半导体股份有限公司` — ORG (B)
  - `林疏` — PERSON (B)
  - `1980年03月` — DATE (B)
  - `021-00007301` — PHONE (B)
  - `lin.shu@xinggui-fake.com` — EMAIL (B)
  - `裴慈` — PERSON (B)
  - `1982年11月` — DATE (B)
  - `沈昭` — PERSON (B)
  - `上海市虚构区示例环路73号` — ADDRESS (B)
  - `13900000073` — PHONE (B)
- **Must stay readable:** `董事、监事、高级管理人员简历`, `董事长`, `生`, `虚构大学示例硕士` (generic `大学` word), `曾任`, `副总裁`, `总经理`, `财务总监`, `注册会计师`, `独立董事`, `公司地址`, `上述人员简历详见招股说明书附件`, `本公司近20年无重大违法违规记录`, `联系手机`.
- **Why useful:** Directors/execs bios — heaviest PERSON + birth-date (YYYY年M月) density; three role-titled people plus a fourth; `虚构大学` generic `大学` word; `近20年` trap; role titles (`董事长`/`总经理`/`财务总监`/`副总裁`) must read.
- **Gaps stressed:** generic `大学` word vs full org name; multiple short `YYYY年M月` dates in one paragraph; role-title words.
- **Test idea:** `it("redacts prospectus D&O bio persons, birth dates, former-employer org, phones, email and address; keeps role titles, 虚构大学 and 近20年 readable")`.

### Doc 74 — 出口报关单 (procurement/customs, export declaration)

```
中华人民共和国海关出口货物报关单
申报单位：虚构瀚辰医药股份有限公司（统一社会信用代码91350100FAKE007409）
境内发货人：同上  境外收货人：StarGalaxy Holdings Ltd.
出口口岸：上海海关  申报日期：2026年06月18日
商品：医疗器械，数量10,000件，单价1元/件仅作报关口径，FOB人民币2,000,000元。
合同号：FAKE-EXP-2026-074。运抵国：开曼群岛，详见装箱单附件。
近三年出口额持续增长。不明货物请立即申报。
```

- **Must redact:**
  - `虚构瀚辰医药股份有限公司` — ORG (B)
  - `91350100FAKE007409` — BUSINESS_ID (B)
  - `StarGalaxy Holdings Ltd.` — ORG (B) `[aspirational: bare English org in CN doc]`
  - `2026年06月18日` — DATE (B)
  - `人民币2,000,000元` — AMOUNT (B)
  - `FAKE-EXP-2026-074` — CASE_REF (B)
- **Must stay readable:** `中华人民共和国海关出口货物报关单` (heading — country name must NOT redact), `申报单位`, `统一社会信用代码`, `境内发货人`, `同上`, `境外收货人`, `出口口岸`, `上海海关`, `申报日期`, `商品`, `医疗器械`, `数量`, `10,000件` (count), `单价1元/件`, `报关口径`, `FOB`, `合同号`, `运抵国`, `开曼群岛`, `详见装箱单附件`, `近三年`, `出口额持续增长`, `不明货物请立即申报`.
- **Why useful:** Customs export declaration — offshore English 收货人; `FOB 人民币…元` amount; `合同号` case ref; `10,000件` count; `单价1元/件` trap; `开曼群岛` jurisdiction; `中华人民共和国` country name in the heading must survive.
- **Gaps stressed:** bare English org (gap #3); country-name heading vs org; `开曼群岛` jurisdiction value.
- **Test idea:** `it("redacts customs declarant org, USCC, overseas consignee, FOB amount and 合同号; keeps 中华人民共和国 heading, 10,000件 count and 单价1元/件 readable")`.

### Doc 75 — 股东大会表决结果公告 (board/shareholder, voting results)

```
虚构澜海储能科技股份有限公司 2025年年度股东大会表决结果公告
会议时间：2026年05月20日。出席会议股东及代理人代表股份80.5%。
议案一：关于聘请示例会计师事务所的议案——赞成79.2%，反对0.3%，弃权20.5%。
议案二：关于选举江研为董事的议案——当选。议案三：利润分配方案，每10股派人民币0.50元。
监票人：苏叙、程止。上述表决结果详见网络投票附件。每月25日不召开会议。
```

- **Must redact:**
  - `虚构澜海储能科技股份有限公司` — ORG (B)
  - `2026年05月20日` — DATE (B)
  - `示例会计师事务所` — ORG (B)
  - `80.5%` / `79.2%` / `0.3%` / `20.5%` — AMOUNT (B)
  - `江研` — PERSON (B)
  - `人民币0.50元` — AMOUNT (B)
  - `苏叙` — PERSON (B)
  - `程止` — PERSON (B)
- **Must stay readable:** `2025年年度股东大会表决结果公告` (year-only trap), `会议时间`, `出席会议股东及代理人代表股份`, `议案一`, `关于聘请…的议案`, `赞成` / `反对` / `弃权`, `议案二`, `关于选举…为董事的议案`, `当选`, `议案三`, `利润分配方案`, `每10股派` (count), `监票人`, `上述表决结果详见网络投票附件`, `每月25日不召开会议`.
- **Why useful:** Voting-results announcement — four voting-ratio percentages in one doc; `每10股` share-count; `2025年年度` year-only heading; role people `监票人`.
- **Gaps stressed:** percentage-as-voting-ratio; `每10股派人民币0.50元` count-adjacent-to-amount; year-only `2025年年度`.
- **Test idea:** `it("redacts shareholder-meeting org, date, voting percentages, director and 监票人 people and dividend amount; keeps 每10股 and 2025年年度 readable")`.

### Doc 76 — 银行承兑汇票 (bank/payment, banker's acceptance)

```
银行承兑汇票
出票人：虚构九州融资租赁有限公司（统一社会信用代码91310101FAKE00760K）
收款人：虚构瀚辰医药股份有限公司
出票金额：人民币5,000,000.00元（大写：人民币伍佰万元整）。
出票日：2026年06月18日，到期日：2026年12月18日。期限6个月。
承兑人：虚构银行股份有限公司示例支行。票据号码：FAKE-BA-2026-076。
账号：6227000000000000760。承兑协议详见附件。
联系电话：021-00007601。本汇票依据《中华人民共和国票据法》。不明背书需核实。
```

- **Must redact:**
  - `虚构九州融资租赁有限公司` — ORG (B)
  - `91310101FAKE00760K` — BUSINESS_ID (B)
  - `虚构瀚辰医药股份有限公司` — ORG (B)
  - `人民币5,000,000.00元` — AMOUNT (B)
  - `大写：人民币伍佰万元整` — AMOUNT (B) `[aspirational: Chinese-numeral amount]`
  - `2026年06月18日` — DATE (B)
  - `2026年12月18日` — DATE (B)
  - `虚构银行股份有限公司示例支行` — ORG (B)
  - `FAKE-BA-2026-076` — CASE_REF (B)
  - `6227000000000000760` — BANK_ACCOUNT (H)
  - `021-00007601` — PHONE (B)
- **Must stay readable:** `银行承兑汇票`, `出票人`, `统一社会信用代码`, `收款人`, `出票金额`, `大写`, `出票日`, `到期日`, `期限6个月`, `承兑人`, `票据号码`, `账号`, `承兑协议详见附件`, `联系电话`, `本汇票依据《中华人民共和国票据法》`, `不明背书需核实`.
- **Why useful:** Banker's acceptance — `大写：人民币伍佰万元整` Chinese-numeral amount (aspirational, Part Two gap #7); two dates; `票据号码` case ref; bank org + account + phone; `期限6个月` duration; `《票据法》`.
- **Gaps stressed:** Chinese-numeral `大写` amount; `期限6个月` duration; `票据号码：` case-ref label variant.
- **Test idea:** `it("redacts banker's-acceptance parties, amount (incl 大写 numeral), two dates, 票据号码, account, bank org and phone; keeps 期限6个月 and 《票据法》 readable")`.

### Doc 77 — 劳动合同解除协议 (employment/HR, termination settlement)

```
解除劳动合同协议书
甲方（用人单位）：虚构青澜新能源科技有限公司（统一社会信用代码91310115FAKE007708）
乙方（劳动者）：顾知，身份证号31010419920715002X，岗位：高级工程师
双方协商于2026年06月18日解除劳动合同。甲方支付经济补偿人民币350,000元（N+1）。
甲方于解除后15日内将款项汇入乙方账户6228480000000000770。
乙方保密义务详见保密条款附件，保密期2年。不明事项协商解决。
本协议适用《中华人民共和国劳动合同法》。每月25日为发薪日。
```

- **Must redact:**
  - `虚构青澜新能源科技有限公司` — ORG (B)
  - `91310115FAKE007708` — BUSINESS_ID (B)
  - `顾知` — PERSON (B)
  - `31010419920715002X` — NATIONAL_ID (B)
  - `2026年06月18日` — DATE (B)
  - `人民币350,000元` — AMOUNT (B)
  - `6228480000000000770` — BANK_ACCOUNT (H)
- **Must stay readable:** `解除劳动合同协议书`, `甲方（用人单位）`, `乙方（劳动者）`, `身份证号`, `岗位`, `高级工程师`, `双方协商于`, `解除劳动合同`, `甲方支付经济补偿`, `N+1` (must not parse as an amount), `甲方于解除后15日内将款项汇入乙方账户`, `乙方保密义务详见保密条款附件`, `保密期2年`, `不明事项协商解决`, `本协议适用《中华人民共和国劳动合同法》`, `每月25日`, `发薪日`.
- **Why useful:** Termination settlement — inline PRC ID + `N+1` severance + worker bank account; `15日内` / `保密期2年` durations; the `N+1` expression must not be eaten by an amount rule; `《劳动合同法》`.
- **Gaps stressed:** `N+1` compensation expression; `15日内`/`2年` durations; `乙方账户：` bank-account label variant.
- **Test idea:** `it("redacts termination-settlement employer org, USCC, worker PRC ID, severance amount and account; keeps N+1, 保密期2年 and 《劳动合同法》 readable")`.

### Doc 78 — 法律服务聘请协议 (legal, engagement letter)

```
法律服务聘请协议
委托人：虚构晨曦保理有限公司（统一社会信用代码91310101FAKE00780C）
受托人：虚构天衡联合律师事务所  经办律师：韩嶋、梁知
委托事项：就 FAKE-ARB-2026-078 仲裁案提供代理服务。
律师费：基本费人民币200,000元，风险费按回款金额的8%计付。
联系邮箱 engagement@tianheng-fake.com，电话详见附件。
本协议适用《中华人民共和国律师法》。争议提交虚构仲裁委员会。
服务期限自2026年06月18日起1年。不明费用另行书面确认。
```

- **Must redact:**
  - `虚构晨曦保理有限公司` — ORG (B)
  - `91310101FAKE00780C` — BUSINESS_ID (B)
  - `虚构天衡联合律师事务所` — ORG (B)
  - `韩嶋` / `梁知` — PERSON (B)
  - `FAKE-ARB-2026-078` — CASE_REF (B)
  - `人民币200,000元` — AMOUNT (B)
  - `8%` — AMOUNT (B)
  - `engagement@tianheng-fake.com` — EMAIL (B)
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `法律服务聘请协议`, `委托人`, `统一社会信用代码`, `受托人`, `经办律师`, `委托事项`, `就…仲裁案提供代理服务`, `律师费`, `基本费`, `风险费按回款金额的`, `计付`, `联系邮箱`, `电话详见附件`, `本协议适用《中华人民共和国律师法》`, `争议提交虚构仲裁委员会`, `服务期限自…起1年`, `不明费用另行书面确认`.
- **Why useful:** Engagement letter — case ref + contingency `%` fee + email + `1年` duration; `《律师法》`; `回款金额的8%` rate-as-contingency.
- **Gaps stressed:** contingency `%` rate; `1年` duration; `不明费用` trap.
- **Test idea:** `it("redacts engagement-letter client/firm orgs, lawyers, case ref, base fee, contingency %, email and date; keeps 服务期限…1年 and 《律师法》 readable")`.

### Doc 79 — 跨境并购意向书 (mixed Chinese-English, cross-border M&A term sheet)

```
Term Sheet — Cross-Border Acquisition（非约束性意向书）
收购方：虚构星河智能科技股份有限公司 (Acquirer)
目标公司：StarGalaxy Holdings Ltd. (Target, 注册地：Cayman Islands)
交易对价：USD 120,000,000（约人民币8.6亿元）。定金人民币50,000,000元。
交割条件：详见附件一。适用法律：《中华人民共和国外商投资法》。
买方授权代表：江研 / Jiang Yan，护照号 Passport No.：FAKE-P-079（示例）。
联系人邮箱：legal@stargalaxy-fake.com，电话：+86 13800000079。
排他期：自2026年06月18日起90日。尽职调查以数据室附件为准。
```

- **Must redact:**
  - `虚构星河智能科技股份有限公司` — ORG (B)
  - `StarGalaxy Holdings Ltd.` — ORG (B) `[aspirational: bare English org in CN doc]`
  - `USD 120,000,000` — AMOUNT (B) `[aspirational: USD/美元 currency unit]`
  - `人民币8.6亿元` — AMOUNT (B)
  - `人民币50,000,000元` — AMOUNT (B)
  - `江研` / `Jiang Yan` — PERSON (B)
  - `FAKE-P-079` — NATIONAL_ID (B) `[aspirational: 护照号/Passport No. label]`
  - `legal@stargalaxy-fake.com` — EMAIL (B)
  - `+86 13800000079` — PHONE (B)
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `Term Sheet — Cross-Border Acquisition`, `非约束性意向书`, `收购方`, `Acquirer`, `目标公司`, `Target`, `注册地：Cayman Islands` (jurisdiction — aspirational), `交易对价`, `定金`, `交割条件`, `详见附件一`, `适用法律`, `《中华人民共和国外商投资法》`, `买方授权代表`, `护照号`, `Passport No.`, `联系人邮箱`, `电话`, `排他期`, `自…起90日`, `尽职调查以数据室附件为准`.
- **Why useful:** Cross-border M&A term sheet — `USD` currency amount (aspirational), offshore English target, `护照号/Passport No.` (Part Two gap #5 family), bilingual rep name, `90日` exclusivity duration.
- **Gaps stressed:** `USD`/`美元` currency unit; passport number; bare English org; `90日` duration.
- **Test idea:** `it("redacts cross-border M&A acquirer/target orgs, USD + RMB amounts, bilingual rep, passport, email, +86 mobile and date; keeps 注册地：Cayman Islands and 排他期…90日 readable")`.

### Doc 80 — 致股東之通函 (Traditional Chinese / HK, circular)

```
騫越控股有限公司（股份代號：02870.HK）致股東之通函
茲通告本公司將於二零二六年八月十五日舉行股東特別大會。
議案：批准收購 StarGalaxy Holdings Ltd. 之全部已發行股本，代價港幣5.0億元。
獨立董事委員會成員：杜明軒、溫時晏。獨立財務顧問：示例融資有限公司。
股東可於二零二六年八月八日前將代表委任表格交回，詳見附件。
查詢電郵：ir@qianyue-fake.com.hk。本公司近三年持續增長。
依據《香港公司收購及合併守則》作出本通函。每月廿五日為結算日。
```

- **Must redact:** `[aspirational: 全文繁體 — Part Two gap #2]`
  - `騫越控股有限公司` — ORG (B)
  - `02870.HK` — BUSINESS_ID (B) `[aspirational: 股份代號：NNNNN.HK]`
  - `二零二六年八月十五日` — DATE (B) `[aspirational: 繁體中文數字日期]`
  - `StarGalaxy Holdings Ltd.` — ORG (B)
  - `港幣5.0億元` — AMOUNT (B) `[aspirational: 港幣 unit]`
  - `杜明軒` / `溫時晏` — PERSON (B)
  - `示例融資有限公司` — ORG (B)
  - `二零二六年八月八日` — DATE (B) `[aspirational]`
  - `ir@qianyue-fake.com.hk` — EMAIL (B)
- **Must stay readable:** `致股東之通函`, `茲通告本公司將於`, `舉行股東特別大會`, `議案`, `批准收購`, `之全部已發行股本`, `代價`, `獨立董事委員會成員`, `獨立財務顧問`, `股東可於`, `前將代表委任表格交回`, `詳見附件`, `查詢電郵`, `本公司近三年持續增長`, `依據《香港公司收購及合併守則》作出本通函`, `每月廿五日` (繁體 numeral date trap), `結算日`.
- **Why useful:** Third 繁體 sample — SGM circular with two 繁體中文數字 dates, `港幣` consideration, English target, `每月廿五日` (繁體 numeral variant of the `每月25日` trap), and `《收購守則》`.
- **Gaps stressed:** 繁體 numeral dates (`二零二六年八月十五日`); `港幣` unit; `每月廿五日` 繁體-numeral date trap; `百分之N`-style ordinals.
- **Test idea:** `it("[繁體] redacts SGM-circular org, 股份代號, two 繁體 numeral dates, 港幣 consideration, directors, advisor org and email; keeps 每月廿五日 and 《收購守則》 readable")`.

### Extended Batch 6 coverage

| Kind | Docs exercising it |
| ---- | ------------------ |
| PERSON | 71, 73, 75, 77, 78, 79, 80 |
| ORG | 71, 72, 73, 74, 75, 76, 77, 78, 79, 80 (all 10) |
| ADDRESS | 73 |
| BUSINESS_ID | 71, 72, 73, 74, 76, 77, 78, 79, 80 (9) |
| NATIONAL_ID | 71, 77, 79(aspirational passport) |
| PHONE | 73, 76, 77, 79 |
| EMAIL | 73, 78, 79, 80 |
| DATE | 71, 72, 73, 74, 75, 76, 77, 78, 79, 80 (all 10) |
| AMOUNT | 71, 72, 74, 75, 76, 77, 78, 79, 80 (9) |
| CASE_REF | 71, 72, 74, 76, 78 (5) |
| BANK_ACCOUNT | 71, 76, 77 |

New trap coverage this batch: `8,000万份` share-count-with-万 + `保管账户` label (71), `期限60日`/`60日内` durations + regulator-kept-readable + `市监强字〔〕` (72), generic `大学` word + multiple `YYYY年M月` birth dates + role titles (73), country-name heading `中华人民共和国` vs org + `10,000件` count + `开曼群岛` (74), four voting-ratio percentages + `每10股` count + year-only `2025年年度` (75), `大写：人民币伍佰万元整` Chinese-numeral amount + `期限6个月` + `票据号码` (76), `N+1` severance + `15日内`/`保密期2年` durations + `乙方账户` label (77), contingency `8%` rate + `1年` duration (78), `USD` currency + passport + bilingual rep + `90日` duration (79), third 繁體 sample with `二零二六年…` numeral dates + `港幣` + `每月廿五日` 繁體-numeral trap (80).

---

## Part Four — Extended Corpus (Batch 7, Docs 81–90)

Batch 7 is deliberately **ADDRESS-heavy** (7/10) — ADDRESS was the sparsest kind across Parts Two–Six — and introduces fresh document categories (real-estate sale & property certificate, property insurance policy, notarial will, government budget notice, bank credit certificate, bilingual business card) plus a fourth 繁體 sample. New invented names this batch: 闻人熙, 容止, 江临, 苏玦, 林晚, David Lin (plus 繁體 杜明軒/溫時晏/江臨舟 reused). New invented orgs: 虚构澜海置业有限公司, 虚构保险股份有限公司示例分公司. All identifiers invented and length-valid.

### Doc 81 — 商品房买卖合同 (real-estate, commercial housing sale)

```
商品房买卖合同
出卖人：虚构澜海置业有限公司（统一社会信用代码91310105FAKE00810K）
买受人：闻人熙，身份证号330106197810100023，手机13800000081。
标的房屋：上海市虚构区示例街道88号澜海花园1幢2单元1801室，建筑面积120.50平方米。
总价款人民币8,800,000.00元，买受人于2026年06月18日前付清。
付款方式：按揭贷款，首付人民币2,640,000元，贷款划入出卖人账户6228480000000000810。
交房日期：2027年06月30日。详见附件交付标准。每月25日为还款日。
本合同适用《中华人民共和国民法典》。不明事项以产权登记为准。
```

- **Must redact:**
  - `虚构澜海置业有限公司` — ORG (B)
  - `91310105FAKE00810K` — BUSINESS_ID (B)
  - `闻人熙` — PERSON (B)
  - `330106197810100023` — NATIONAL_ID (B)
  - `13800000081` — PHONE (B)
  - `上海市虚构区示例街道88号澜海花园1幢2单元1801室` — ADDRESS (B)
  - `人民币8,800,000.00元` — AMOUNT (B)
  - `2026年06月18日` — DATE (B)
  - `人民币2,640,000元` — AMOUNT (B)
  - `6228480000000000810` — BANK_ACCOUNT (H)
  - `2027年06月30日` — DATE (B)
- **Must stay readable:** `商品房买卖合同`, `出卖人`, `统一社会信用代码`, `买受人`, `身份证号`, `手机`, `标的房屋`, `建筑面积`, `120.50平方米` (area trap — must NOT parse as an amount), `总价款`, `买受人于…前付清`, `付款方式`, `按揭贷款`, `首付`, `贷款划入出卖人账户`, `交房日期`, `详见附件交付标准`, `每月25日`, `还款日`, `本合同适用《中华人民共和国民法典》`, `不明事项以产权登记为准`.
- **Why useful:** Real-estate sale — the longest multi-element Chinese address in the corpus (街道+号+花园+幢+单元+室); `120.50平方米` area value must not be eaten by the amount rule; mortgage down-payment/loan cascade; `每月25日` / `《民法典》`.
- **Gaps stressed:** `120.50平方米` area-vs-amount; 6-token address; `贷款划入出卖人账户` bank-account label variant.
- **Test idea:** `it("redacts housing-sale developer USCC, buyer PRC ID/phone, full multi-token address, total/down-payment amounts and account; keeps 120.50平方米 and 每月25日 readable")`.

### Doc 82 — 不动产权证书 (real-estate, property certificate)

```
不动产权证书
权利人：闻人熙  证件号：330106197810100023
共有情况：单独所有  不动产单元号：310106FAKE0082000082
坐落：上海市虚构区示例街道88号澜海花园1幢2单元1801室
权利类型：国有建设用地使用权/房屋所有权  使用期限：至2066年06月17日
登记机构：上海市虚构区自然资源局。附记详见登记附件。
本证依《不动产登记暂行条例》核发。每月25日为权属查询日。
```

- **Must redact:**
  - `闻人熙` — PERSON (B)
  - `330106197810100023` — NATIONAL_ID (B)
  - `310106FAKE0082000082` — BUSINESS_ID (B) `[aspirational: 不动产单元号 label]`
  - `上海市虚构区示例街道88号澜海花园1幢2单元1801室` — ADDRESS (B)
  - `2066年06月17日` — DATE (B)
- **Must stay readable:** `不动产权证书`, `权利人`, `证件号` (alternative ID label), `共有情况`, `单独所有`, `不动产单元号`, `坐落`, `权利类型`, `国有建设用地使用权` / `房屋所有权`, `使用期限`, `至`, `登记机构`, `上海市虚构区自然资源局` (登记机构 — kept readable), `附记详见登记附件`, `本证依《不动产登记暂行条例》核发`, `每月25日`, `权属查询日`.
- **Why useful:** Property certificate — `不动产单元号` (aspirational BUSINESS_ID), `证件号` alternative NATIONAL_ID label, a full repeated address, and a `使用期限：至…` future date; `登记机构` kept readable like a regulator.
- **Gaps stressed:** `证件号：` vs `身份证号：` label; `不动产单元号` ID; `登记机构`-as-regulator distinction.
- **Test idea:** `it("redacts property-certificate owner name, 证件号 national id, 不动产单元号, address and 使用期限 date; keeps 登记机构 and 《不动产登记暂行条例》 readable")`.

### Doc 83 — 财产一切险保险单 (insurance, property policy)

```
财产一切险保险单
投保人：虚构瀚辰医药股份有限公司（统一社会信用代码91440100FAKE00630K）
被保险人：同上  保险标的：位于江苏省苏州市虚构工业园区示例路56号的厂房及设备
保险金额：人民币120,000,000.00元。免赔额：人民币50,000元。
保险期间：自2026年06月18日零时起至2027年06月17日二十四时止。
保单号码：FAKE-INS-2026-083。签单机构：虚构保险股份有限公司示例分公司。
报案电话：021-00008301。本保单适用《中华人民共和国保险法》。详见条款附件。
```

- **Must redact:**
  - `虚构瀚辰医药股份有限公司` — ORG (B)
  - `91440100FAKE00630K` — BUSINESS_ID (B)
  - `江苏省苏州市虚构工业园区示例路56号` — ADDRESS (B)
  - `人民币120,000,000.00元` — AMOUNT (B)
  - `人民币50,000元` — AMOUNT (B)
  - `2026年06月18日` — DATE (B)
  - `2027年06月17日` — DATE (B)
  - `FAKE-INS-2026-083` — CASE_REF (B)
  - `虚构保险股份有限公司示例分公司` — ORG (B)
  - `021-00008301` — PHONE (B)
- **Must stay readable:** `财产一切险保险单`, `投保人`, `统一社会信用代码`, `被保险人`, `同上`, `保险标的`, `位于`, `的厂房及设备`, `保险金额`, `免赔额`, `保险期间`, `自…零时起至…二十四时止` (time-of-day must not break the date), `保单号码`, `签单机构`, `报案电话`, `本保单适用《中华人民共和国保险法》`, `详见条款附件`.
- **Why useful:** Property insurance — `保险标的` address; large insured amount + deductible; two dates each carrying a time-of-day (`零时`/`二十四时`) that must not corrupt the date span; `保单号码` case ref; 分公司 branch org; `《保险法》`.
- **Gaps stressed:** `零时`/`二十四时` time-of-day adjacency to dates; `保单号码：` case-ref label variant; `签单机构`/`分公司` branch org.
- **Test idea:** `it("redacts property-policy insured org, 保险标的 address, insured/deductible amounts, dates, 保单号码, branch org and phone; keeps 零时/二十四时 and 《保险法》 readable")`.

### Doc 84 — 遗嘱公证书 (legal/notarial, will)

```
遗嘱公证书
立遗嘱人：容止，男，1950年06月05日生，身份证号11010119500605001X，
住所：北京市虚构区示例胡同84号。
我自愿将名下虚构长风文化传媒股份有限公司15%股权，由女儿江临继承。
其余财产详见财产清单附件。本遗嘱为最终遗嘱，此前遗嘱作废。
本遗嘱经虚构市示例公证处公证，公证书编号：（2026）示例证字第0084号。
立遗嘱日期：2026年06月18日。每月25日不办理遗嘱公证。
```

- **Must redact:**
  - `容止` — PERSON (B)
  - `1950年06月05日` — DATE (B)
  - `11010119500605001X` — NATIONAL_ID (B)
  - `北京市虚构区示例胡同84号` — ADDRESS (B)
  - `虚构长风文化传媒股份有限公司` — ORG (B)
  - `15%` — AMOUNT (B)
  - `江临` — PERSON (B)
  - `（2026）示例证字第0084号` — CASE_REF (B) `[aspirational: （YYYY）…证字第N号 notarial format]`
  - `2026年06月18日` — DATE (B)
- **Must stay readable:** `遗嘱公证书`, `立遗嘱人`, `男`, `生`, `身份证号`, `住所`, `我自愿将名下`, `股权`, `由女儿…继承`, `其余财产详见财产清单附件`, `本遗嘱为最终遗嘱`, `此前遗嘱作废`, `本遗嘱经虚构市示例公证处公证` (公证处 — kept readable), `公证书编号`, `立遗嘱日期`, `每月25日不办理遗嘱公证`.
- **Why useful:** Notarial will — inline PRC ID + address + `15%` inheritance share + a daughter person (`女儿…继承` kinship) + a notarial `公证书编号` case number (new `（YYYY）…证字第N号` variant); notarizing `公证处` kept readable.
- **Gaps stressed:** `（YYYY）…证字第N号` notarial case format; kinship `女儿` co-reference; `公证处`-as-regulator distinction.
- **Test idea:** `it("redacts will testator PRC ID, address, 15% bequest, heir person and 公证书编号; keeps 公证处 and 每月25日 readable")`.

### Doc 85 — 财政专项资金下达通知 (regulator/government, budget)

```
虚构市财政局 财政专项资金下达通知
收款单位：虚构瀚辰医药股份有限公司（统一社会信用代码91350100FAKE007409）
下达项目：研发补贴，金额人民币3,000,000.00元。
资金用途：专款专用，详见资金管理办法附件。
拨付日期：2026年06月18日，拨付至单位账户6225880000000000850。
文号：财企〔2026〕85号。不明款项应在10个工作日内反馈。
本通知依据《中华人民共和国预算法》。每月25日为对账日。
```

- **Must redact:**
  - `虚构瀚辰医药股份有限公司` — ORG (B)
  - `91350100FAKE007409` — BUSINESS_ID (B)
  - `人民币3,000,000.00元` — AMOUNT (B)
  - `2026年06月18日` — DATE (B)
  - `6225880000000000850` — BANK_ACCOUNT (H)
  - `财企〔2026〕85号` — CASE_REF (B) `[aspirational: …〔YYYY〕N号 — Part Two gap #6]`
- **Must stay readable:** `虚构市财政局` (issuing regulator — kept readable), `财政专项资金下达通知`, `收款单位`, `统一社会信用代码`, `下达项目`, `研发补贴`, `金额`, `资金用途`, `专款专用`, `详见资金管理办法附件`, `拨付日期`, `拨付至单位账户`, `文号`, `不明款项应在10个工作日内反馈`, `本通知依据《中华人民共和国预算法》`, `每月25日`, `对账日`.
- **Why useful:** Government budget notice — issuing `财政局` kept readable while the recipient company redacts; subsidy amount + disbursement account + `财企〔2026〕85号` doc number; `10个工作日` duration; `《预算法》`.
- **Gaps stressed:** `财企〔2026〕85号` regulatory number; `10个工作日` duration; `拨付至单位账户` bank-account label variant; regulator-vs-recipient ORG distinction.
- **Test idea:** `it("redacts budget-notice recipient org, USCC, subsidy amount, disbursement account and 财企〔2026〕85号; keeps issuing 财政局 and 10个工作日 readable")`.

### Doc 86 — 董监高持股变动公告 (cap table / IPO, exec shareholding change)

```
虚构澜海储能科技股份有限公司关于董事、高级管理人员持股变动的公告
证券代码：688086 证券简称：虚构澜海
江研于2026年06月18日通过集中竞价减持公司股份50,000股，占公司总股本0.05%。
减持后，江研持有公司股份450,000股，占比0.45%。成交均价每股人民币18.50元。
本次变动详见上海证券交易所披露文件附件。公司近三年无其他变动。
不明变动以登记结算数据为准。每月25日为披露截止日。
```

- **Must redact:**
  - `虚构澜海储能科技股份有限公司` — ORG (B)
  - `江研` — PERSON (B)
  - `2026年06月18日` — DATE (B)
  - `0.05%` — AMOUNT (B)
  - `0.45%` — AMOUNT (B)
  - `人民币18.50元` — AMOUNT (B)
- **Must stay readable:** `关于…持股变动的公告`, `证券代码：`, `688086` (aspirational stock code), `证券简称：`, `虚构澜海`, `于`, `通过集中竞价减持公司股份`, `50,000股` (count), `占公司总股本`, `减持后`, `持有公司股份`, `450,000股` (count), `占比`, `成交均价每股`, `本次变动详见上海证券交易所披露文件附件` (`上海证券交易所` generic), `公司近三年无其他变动`, `不明变动以登记结算数据为准`, `每月25日`, `披露截止日`.
- **Why useful:** Exec shareholding change — share **counts** (`50,000股`/`450,000股`) must survive while the **ratios** (`0.05%`/`0.45%`) and the per-share price (`人民币18.50元`) redact; `证券代码：688086` label (aspirational); `上海证券交易所` generic exchange name.
- **Gaps stressed:** count-vs-percentage-vs-price disambiguation; `证券代码：NNNN` label; `每股人民币…` price phrasing (re-spelled away from the `/股` slash trap).
- **Test idea:** `it("redacts shareholding-change percentages and per-share price while keeping 50,000股/450,000股 counts; keeps 证券代码：688086 and 上海证券交易所 readable")`.

### Doc 87 — 供应商资格审查记录 (procurement, supplier qualification)

```
供应商资格审查记录
供应商：虚构瀚海生物医药有限公司（统一社会信用代码91350100FAKE008709）
注册地址：江苏省苏州市虚构工业园区示例路87号
法定代表人：苏玦，联系电话0571-00008700，手机13900000087，邮箱 qual@hanhai-fake.com。
资质：医疗器械生产许可证编号 FAKE-MD-2026-087，有效期至2027年12月31日。
近三年无重大违法违规记录。详见资质证明附件。
本记录适用《中华人民共和国政府采购法》。不明信息以核实为准。
```

- **Must redact:**
  - `虚构瀚海生物医药有限公司` — ORG (B)
  - `91350100FAKE008709` — BUSINESS_ID (B)
  - `江苏省苏州市虚构工业园区示例路87号` — ADDRESS (B)
  - `苏玦` — PERSON (B)
  - `0571-00008700` — PHONE (B)
  - `13900000087` — PHONE (B)
  - `qual@hanhai-fake.com` — EMAIL (B)
  - `FAKE-MD-2026-087` — BUSINESS_ID (B) `[aspirational: 许可证编号 label]`
  - `2027年12月31日` — DATE (B)
- **Must stay readable:** `供应商资格审查记录`, `供应商`, `统一社会信用代码`, `注册地址`, `法定代表人`, `联系电话`, `手机`, `邮箱`, `资质`, `医疗器械生产许可证编号`, `有效期至`, `近三年无重大违法违规记录`, `详见资质证明附件`, `本记录适用《中华人民共和国政府采购法》`, `不明信息以核实为准`.
- **Why useful:** Supplier qualification — a `许可证编号` (aspirational BUSINESS_ID) alongside the USCC; two phones + email + 工业园区 address in one block; `近三年` / `不明` / `见附件` traps; `《政府采购法》`.
- **Gaps stressed:** `许可证编号` ID label; `联系电话：`/`手机：` dual phone labels; `有效期至…` date phrasing.
- **Test idea:** `it("redacts supplier-qualification USCC, 许可证编号, address, rep person, two phones and email; keeps 有效期至 and 近三年 readable")`.

### Doc 88 — 银行资信证明 (bank/payment, credit certificate)

```
资信证明
兹证明虚构瀚辰医药股份有限公司（统一社会信用代码91310101FAKE00880C）
在我行开立结算账户，账号6227000000000000880。
截至2026年06月18日，账户余额人民币32,000,000.00元，币种人民币。
该客户近三年结算正常，无不良信用记录。
经办：林晚。联系电话021-00008801。本证明仅供参考，详见征信报告附件。
出具机构：虚构银行股份有限公司示例支行。依据《中华人民共和国商业银行法》。
```

- **Must redact:**
  - `虚构瀚辰医药股份有限公司` — ORG (B)
  - `91310101FAKE00880C` — BUSINESS_ID (B)
  - `6227000000000000880` — BANK_ACCOUNT (H)
  - `2026年06月18日` — DATE (B)
  - `人民币32,000,000.00元` — AMOUNT (B)
  - `林晚` — PERSON (B)
  - `021-00008801` — PHONE (B)
  - `虚构银行股份有限公司示例支行` — ORG (B)
- **Must stay readable:** `资信证明`, `兹证明`, `统一社会信用代码`, `在我行开立结算账户`, `账号`, `截至`, `账户余额`, `币种人民币`, `该客户近三年结算正常`, `无不良信用记录`, `经办`, `联系电话`, `本证明仅供参考`, `详见征信报告附件`, `出具机构`, `依据《中华人民共和国商业银行法》`.
- **Why useful:** Bank credit certificate — `结算账户` bank account + balance amount + issuing branch org + 经办 person; `近三年` / `不明`(none) traps; `《商业银行法》`; the bare `我行` pronoun must read while the full branch name redacts.
- **Gaps stressed:** `我行` pronoun-vs-branch; `账号：` label; `结算账户` framing.
- **Test idea:** `it("redacts credit-certificate customer org, USCC, 结算账户 account, balance, 经办 person, phone and issuing branch; keeps 我行 and 《商业银行法》 readable")`.

### Doc 89 — 中英文双语名片块 (mixed Chinese-English, business card)

```
Business Card / 名片
林晚 / David Lin    职位 / Title: 总经理 General Manager
公司 / Company: StarGalaxy Holdings Ltd.（虚构星河智能科技股份有限公司）
电话 / Tel: 021-00008900   手机 / Mobile: +86 13800000089
邮箱 / Email: david.lin@stargalaxy-fake.com
地址 / Address: Room 8900, 18 Fuxing Road, Shanghai（上海市虚构区示例路89号18层）
统一社会信用代码 / USCC: 91310104FAKE00680L
详见名片背面附件。每月25日为对账日。单价1元/件仅供参考。
```

- **Must redact:**
  - `林晚` / `David Lin` — PERSON (B)
  - `StarGalaxy Holdings Ltd.` — ORG (B) `[aspirational: bare English org in CN doc]`
  - `虚构星河智能科技股份有限公司` — ORG (B)
  - `021-00008900` — PHONE (B)
  - `+86 13800000089` — PHONE (B)
  - `david.lin@stargalaxy-fake.com` — EMAIL (B)
  - `Room 8900, 18 Fuxing Road, Shanghai` — ADDRESS (B) `[aspirational: English address line in CN doc]`
  - `上海市虚构区示例路89号18层` — ADDRESS (B)
  - `91310104FAKE00680L` — BUSINESS_ID (B)
- **Must stay readable:** `Business Card / 名片`, `职位 / Title:`, `总经理`, `General Manager`, `公司 / Company:`, `电话 / Tel:`, `手机 / Mobile:`, `邮箱 / Email:`, `地址 / Address:`, `统一社会信用代码 / USCC:`, `详见名片背面附件`, `每月25日`, `对账日`, `单价1元/件仅供参考`.
- **Why useful:** Bilingual business card — a Latin person name (`David Lin`), an English company, a paired EN+CN address (both must redact), two phones, an email, and a USCC, all in label/value pairs; `单价1元/件` / `见附件` traps.
- **Gaps stressed:** bare Latin name + English org + English address line (Part Two gaps #2/#3 family); bilingual label alignment.
- **Test idea:** `it("redacts bilingual-card Latin+CN name, English+CN company, paired EN+CN addresses, phones, email and USCC; keeps bilingual labels and 单价1元/件 readable")`.

### Doc 90 — 招股章程風險因素 (Traditional Chinese / HK, prospectus risk factors)

```
騫越控股有限公司（股份代號：02870.HK）招股章程（概要）— 風險因素
本公司主要業務依賴少數主要客戶，前五大客戶佔收益百分之六十八。
董事：杜明軒、溫時晏、江臨舟。註冊辦事處：香港虛構灣示例道90號20樓。
截至二零二五年十二月三十一日止年度，收入港幣18.5億元，純利港幣2.3億元。
保薦人：示例融資有限公司。聯絡：ir@qianyue-fake.com.hk。
近三年毛利率波動，詳見年報附件。依據《香港公司條例》披露。
不明風險以招股章程全文為準。每月廿五日為結算日。
```

- **Must redact:** `[aspirational: 全文繁體 — Part Two gap #2]`
  - `騫越控股有限公司` — ORG (B)
  - `02870.HK` — BUSINESS_ID (B) `[aspirational: 股份代號：NNNNN.HK]`
  - `杜明軒` / `溫時晏` / `江臨舟` — PERSON (B)
  - `香港虛構灣示例道90號20樓` — ADDRESS (B) `[aspirational: 繁體地址 + 樓]`
  - `二零二五年十二月三十一日` — DATE (B) `[aspirational: 繁體中文數字日期]`
  - `港幣18.5億元` — AMOUNT (B) `[aspirational: 港幣 unit]`
  - `港幣2.3億元` — AMOUNT (B) `[aspirational: 港幣 unit]`
  - `示例融資有限公司` — ORG (B)
  - `ir@qianyue-fake.com.hk` — EMAIL (B)
- **Must stay readable:** `招股章程（概要）— 風險因素`, `本公司主要業務依賴少數主要客戶`, `前五大客戶佔收益百分之六十八` (Chinese-numeral percentage — kept readable), `董事`, `註冊辦事處`, `截至`, `止年度`, `收入`, `純利`, `保薦人`, `聯絡`, `近三年毛利率波動`, `詳見年報附件`, `依據《香港公司條例》披露`, `不明風險以招股章程全文為準`, `每月廿五日` (繁體 numeral date trap), `結算日`.
- **Why useful:** Fourth 繁體 sample — prospectus risk factors with a 繁體中文數字 date (`二零二五年十二月三十一日`), `港幣` income/profit amounts, a Chinese-numeral percentage (`百分之六十八`, kept readable), 繁體 address with `樓`, and a `.com.hk` email. Deepens Part Two gap #2.
- **Gaps stressed:** 繁體 numeral dates; `港幣` unit; `百分之六十八` Chinese-numeral percentage (must stay readable); `…止年度` fiscal-year phrasing.
- **Test idea:** `it("[繁體] redacts prospectus org, 股份代號, directors, 繁體 address, 繁體 numeral date, 港幣 amounts, sponsor org and email; keeps 百分之六十八 and 每月廿五日 readable")`.

### Extended Batch 7 coverage

| Kind | Docs exercising it |
| ---- | ------------------ |
| PERSON | 81, 82, 84, 86, 87, 88, 89, 90 |
| ORG | 81, 83, 84, 85, 86, 87, 88, 89, 90 |
| ADDRESS | 81, 82, 83, 84, 87, 89, 90 (7/10 — strongest address batch) |
| BUSINESS_ID | 81, 82(aspirational), 83, 85, 86(aspirational), 87(aspirational), 88, 89, 90(aspirational) |
| NATIONAL_ID | 81, 82, 84 |
| PHONE | 81, 83, 87, 88, 89 |
| EMAIL | 87, 89, 90 |
| DATE | 81, 82, 83, 84, 85, 86, 87, 88, 90 |
| AMOUNT | 81, 83, 84, 85, 86, 88, 90 |
| CASE_REF | 83, 84(aspirational), 85 |
| BANK_ACCOUNT | 81, 85, 88 |

New trap coverage this batch: 6-token real-estate address + `120.50平方米` area-vs-amount + mortgage cascade (81), `证件号`/`不动产单元号` ID labels + `登记机构`-as-regulator (82), `零时`/`二十四时` time-of-day adjacency to dates + `保单号码` case (83), notarial `（2026）…证字第0084号` + kinship `女儿…继承` + `公证处`-as-regulator (84), `财企〔2026〕85号` + `10个工作日` duration + `拨付至单位账户` label (85), share-count vs percentage vs per-share price disambiguation + `每股人民币…` re-spelling (86), `许可证编号` ID + dual `联系电话/手机` labels (87), `我行` pronoun vs full branch + `结算账户` framing (88), Latin name + English org + paired EN/CN addresses (89), fourth 繁體 sample + `百分之六十八` Chinese-numeral percentage + `二零二五年…` date (90).

---

## Grand Coverage — All Parts (Docs 01–90)

Cumulative kind coverage across Part One (01–20), Part Two (21–50) and Parts Three–Four (51–90). Counts treat `[aspirational]` spans as exercised (Codex lands them as `it.skip` or counterexample asserts).

| Kind | Rough coverage | Highest-value remaining gaps |
| ---- | -------------- | --------------------------- |
| PERSON | ~80/90 | tabular cells (25,26,46,51), Latin names (36,45,46,60,68,79,89), 繁體 (20,37,47,70,80,90), 法官/书记员/仲裁员 roles (28,66) |
| ORG | ~90/90 | bare English orgs (36,45,46,68,74,79,89), regulator/court/公证处 kept-readable convention (38,48,62,66,72,82,84,85), 繁體 |
| ADDRESS | ~40/90 | full multi-token 省-市-区-路-号-幢-单元-室 (52,81), 工业园区 (56,83,87), 繁體+樓 (70,80,90), EN address lines (18,89), `注册地：<jurisdiction>` (32,68,74,79) |
| BUSINESS_ID | ~70/90 | patent `ZL…`/`商标注册号`/`许可证编号`/`不动产单元号` (61,82,87), `股票代码：`/`证券代码`/`股份代號：NNNNN.HK` (37,43,53,57,67,70,80,86,90), SWIFT/发票代码 (24,30) |
| NATIONAL_ID | ~25/90 | tabular (25,51), inline `身份证号：`/`证件号：` (52,54,56,59,60,65,68,71,77,81,82,84), passport `护照号/Passport No.` (45,79) |
| PHONE | ~50/90 | landlines `0xxx-` (5,18,53,55,66,69,73,76,83,87,88,89), spaced `+86 1xx` (18,60,79,89), `+86-21-` landline gap (46) |
| EMAIL | ~35/90 | tabular (51), 繁體 (37,47,70,80,90), personal-name local-parts, `.com.hk` TLD (70,80,90) |
| DATE | ~85/90 | 繁體 numeral dates (37,47,70,80,90), `每月25日`/`每月廿五日` traps (many), `2025年末`/`2024年年度` year-only (7,31,62,75), time-of-day adjacency (83) |
| AMOUNT | ~80/90 | percentages-as-shares/rates (59,63,65,68,69,75,78,86), `港幣`/`USD` (37,47,70,79,80,90), `大写` Chinese numerals (30,76), `单价1元/件`/`120.50平方米`/`8,000万份` traps (many) |
| CASE_REF | ~30/90 | `〔YYYY〕第N号`/`财企〔〕`/`市监强字〔〕` (21,28,38,48,62,72,85), `（YYYY）…字第N号` civil/notarial (66,84), `FAKE-ARB`/`FAKE-TRF`/`FAKE-BA`/`FAKE-INS`/`FAKE-EXP` contract numbers (60,64,71,74,76,78,83) |
| BANK_ACCOUNT | ~30/90 | heavy-only label traps; label variants `信托账户`/`卖方账户`/`收款账户`/`保管账户`/`乙方账户`/`拨付至单位账户` (33,36,39,44,45,46,52,55,58,63,64,67,69,71,76,77,81,85,88) |

### Conversion Notes (additions for Parts Three–Four)

- Batch 4–7 IDs are all length-valid: USCC = 18 chars, PRC ID = 18 chars, bank account = 16–19 digits. Before committing, Codex should still assert `isValidUscc`/PRC-ID-regex against every `[BUSINESS_ID]/[NATIONAL_ID]` fixture string (a couple of reused orgs share a USCC across docs by design — that's fine).
- Several docs deliberately **reuse** an invented company across documents (e.g. `虚构瀚辰医药股份有限公司` in 63/66/72/74/83/85/88, `StarGalaxy Holdings Ltd.` in 68/74/79/80/89). This is intentional: it exercises cross-document label consistency, not a copy-paste defect.
- The **regulator/court/公证处/登记机构 kept-readable** convention (issuing authority stays, private litigant redacts) is a judgment call baked into Docs 62, 66, 72, 82, 84, 85. If Codex prefers to redact issuing authorities too, flip those `[Must stay readable]` entries to `[Must redact: ORG]` and update the matching asserts.
- `百分比` spans flagged `[aspirational: 港幣 unit]` / `繁體 numeral date` / `大写 numeral amount` / `百分之N` are the clearest places to start with `it.skip` counterexamples so the suite stays green until the matching batch-two rule ships.
