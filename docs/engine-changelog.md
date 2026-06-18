# Redaction Engine Changelog

The redaction engine uses semantic versioning independently from the app package.

## 1.3.0 - 2026-06-18

Chinese redaction batch three: numeral dates, bare 万/亿 amounts, contact
handles, passport/vehicle-plate labels, and two correctness fixes to the
batch-two bare-identifier and amount rules. All deterministic, browser-only;
no AI/LLM/backend/telemetry added.

New coverage:

- Chinese numeral dates (`二〇二六年六月十八日`, `贰零贰陆年壹月拾伍日`) as
  `DATE` at Balanced. The pattern requires `年…月` so that `年度报告`,
  `甲午战争`, and bare numeric runs stay readable. Digit-by-digit reading of
  the year/month plus the compound day forms (`十八`/`廿三`/`三十`) are
  supported for both Simplified and Traditional numeral sets.
- Bare 万/亿 amounts with no trailing `元` (`合同金额80万`, `市值约1400万`,
  `投资总额3亿`) as `AMOUNT` at Balanced. A counter-noun guard rejects
  quantifier uses such as `1万个`, `3万年`, `万人空巷`, `80万人`.
- WeChat / QQ contact handle labels (`微信号`, `QQ号`) as `CHANNEL` at
  Balanced, with a value shape check so placeholders like `见附件` stay
  readable.
- Passport number labels (`护照号码`, `护照号`) as `NATIONAL_ID` at Light.
- Vehicle plate labels (`车牌号`, `车牌号码`) as `BUSINESS_ID` at Light.

Behavior changes (correctness fixes):

- Bare USCC and bare PRC resident-ID detection now run even when the document
  has NO Han text. Previously the whole `detectChinese` path was gated behind
  `hasHanText`, so identifiers in English-only table cells or parentheticals
  (e.g. `Code: 91110000MA12345679`, `Ref (…)` ) leaked. The bare-identifier
  detector is now called before the Han gate; it remains checksum/date-gated
  so the false-positive rate is unchanged.
- The bare 万/亿 counter-noun guard is now anchored to the start of the
  lookahead window. Previously the counter regex matched anywhere in the
  four-character window, so a counter character appearing later (e.g. `部` in
  `20万外的部分`) caused a real amount to be left readable. Counters must now
  immediately follow `万`/`亿`.

Known limitations (deferred):

- Quoted person names in signature blocks (`签字：（张三）`) and free-form
  Chinese person names in prose remain out of scope (high false-positive risk
  without segmentation).
- Hong Kong BR numbers and HKID still need their own validators (HK BR MOD-7:
  needs verification).
- Year-only Chinese dates (`2026年` without `月`) are intentionally not
  redacted because `年度报告` / `公司于2026年成立` are common non-sensitive
  prose.

## 1.2.0 - 2026-06-18

Chinese redaction batch two: bare-identifier detection with checksum guards,
context organization detection, multi-line addresses, and Traditional label
aliases. All deterministic, browser-only; no AI/LLM/backend/telemetry added.

New coverage:

- Bare Unified Social Credit Codes anywhere in text (`BUSINESS_ID`, Light),
  gated by the GB 32100-2015 mod-31 checksum. The regex charset itself excludes
  `I/O/S/V/Z`, so most random alphanumeric runs are rejected before the checksum
  runs. The bare rule additionally requires at least one letter, because ~32% of
  random 18-digit runs pass the checksum (the check character can itself be a
  digit, e.g. `123456789012345678`); a real USCC's organization-identifier
  portion (GB 11714) is effectively always alphanumeric. All-digit USCCs, if any
  legitimately exist, are still caught by the labeled rule (`统一社会信用代码：…`).
- Bare PRC resident identity numbers anywhere in text (`NATIONAL_ID`, Light),
  gated by the GB 11643-1999 mod-11 checksum AND a real-date check on the
  embedded `YYYYMMDD`. The date check is mandatory: shape-only detection has a
  9.1% false-positive rate on random 18-digit numbers; checksum-only is still
  9.1%; checksum + date drops it to ~0.033% (a 270x reduction). Years are
  bounded to 1900-2099.
- Context Chinese organizations outside labels (`ORG`, Balanced), using a
  strong-suffix allowlist (`有限公司`, `股份有限公司`, `研究院`, `医院`, …) and
  common-noun-prefix exclusion (`我公司`, `本局`, `该中心`, `全市医院` stay
  readable). Weak suffixes (`公司`/`局`/`中心`/`部`) are intentionally excluded.
  Statute names inside `《…》` book brackets are protected.
- Multi-line labeled Chinese addresses (`ADDRESS`, Balanced), mirroring the
  English `Address:` continuation rule: a label on its own line folds up to three
  following address-looking lines, stopping at a new label, a blank line, or an
  enumerated item.
- Legal and finance reference labels (`CASE_REF`, Light): `案号`, `文书号`,
  `文号`, `判决书号`, `裁定书号`, `执行案号`, `仲裁案号`, `公证书编号`,
  `发票号`, `发票号码`, `票据号`, `票据编号`, `报关单号`, `备案号`,
  `核销单号`, `流水号`, `凭证号`, `凭证编号`, `许可证编号`, `批准文号`,
  `备案文号`. Values must contain a digit, so prose such as `流水线生产` and
  `凭证管理` stays readable.
- Traditional Chinese / HK / TW label aliases (供應商, 註冊地址, 法定代理人,
  聯絡電話, 身分證號, …) plus Traditional strong-suffix aliases (大學, 醫院,
  有限責任公司, …) so existing Simplified detectors fire on Traditional
  documents without new kinds.

Behavior notes:

- Bare USCC and bare PRC-ID detection are Light, so they apply at all levels.
  They dedupe cleanly against the existing label-bound rules via the shared
  `Detector.add` merge.
- Context-org detection is Balanced; the broad CJK `NON_LATIN_TEXT` fallback
  remains Heavy-only (unchanged from 1.1.0).
- Book-title statute names wrapped in `《…》` are protected from the context-org
  rule.

Known limitations (deferred to batch three):

- Bare Chinese bank accounts remain label-bound, Heavy-only: no checksum exists
  and bare 16-19 digit detection is unsafe.
- Hong Kong BR numbers and HKID need their own validators (HK BR MOD-7:
  needs verification) and a dedicated false-positive suite.
- Free-form Chinese person names in prose, Chinese numeral dates
  (`二〇二六年六月十八日`), and weak-suffix orgs (`公司`, `局`, `中心`) remain
  out of scope for false-positive reasons.

## 1.1.0 - 2026-06-18

First deterministic Chinese redaction layer (beta). Added a separate Chinese
detector module wired into the shared browser-only pipeline through a narrow
candidate callback. No AI, LLM, OCR service, backend, analytics, telemetry, or
document upload was added.

New Chinese coverage:

- Unified Social Credit Codes after `统一社会信用代码` / `社会信用代码`
  labels (`BUSINESS_ID`, Light).
- PRC resident identity numbers after `身份证号`, `身份证件号码`,
  `居民身份证号`, or `身份证号码` labels (`NATIONAL_ID`, Light).
- Chinese phone/mobile/fax values after `联系电话`, `联系方式`, `电话`,
  `手机`, `手机号码`, or `传真` labels (`PHONE`, Light). Bare Chinese phone
  shapes were already mostly covered by the generic phone detector; this adds
  label scoping.
- Chinese dates such as `2026年6月18日`, `2026 年 6 月`, and
  `2026年06月01日15时30分` (`DATE`, Balanced).
- RMB amounts in `万元`, `亿元`, `元`, and fullwidth-yen `￥` forms (`AMOUNT`,
  Balanced), while keeping tiny unit prices such as `单价1元/件` readable.
- Labeled Chinese addresses, people, organizations, procurement/contract
  references, regulatory document numbers, and court case numbers.
- Chinese bank-account values after `账号`, `开户账号`, `银行账号`, `对公账号`,
  or `收款账号` labels (`BANK_ACCOUNT`, Heavy, label-bound only).
- Narrow Chinese agreement-heading party detection for structures like
  `由 <person> 与 <person> 就...`, without adding broad free-form Chinese name
  detection.

Behavior change:

- The broad CJK `NON_LATIN_TEXT` fallback moved from Balanced to Heavy and its
  reason changed to `heavy non-Latin fallback quarantine`. Balanced output now
  keeps ordinary Chinese prose, headings, statute names, and procurement
  boilerplate readable unless a specific deterministic Chinese rule matches.
- Generic phone detection now skips digit runs longer than 15 digits, matching
  the E.164 maximum and avoiding mislabeling long account/identifier numbers as
  phones.

Known limitations:

- Free-form Chinese person names in prose, suffix-only organization detection,
  Traditional Chinese/Hong Kong-specific patterns, Chinese numeral dates, and
  bare USCC/PRC-ID checksum matching are deferred.
- Bare Chinese bank-account numbers are not redacted; only labeled account
  values at Heavy are covered.

## 1.0.15 - 2026-06-18

HR, employment, board/shareholder, and governance documents pass. Audited synthetic samples covering an employment agreement, an offer letter, a separation/severance agreement, board minutes, a shareholder/AGM notice, a stock-option award notice, a cap-table excerpt, and an internal approval memo, so the engine stays useful for documents that name individual employees, directors, equity grants, and corporate records without being legal pleadings or SEC correspondence, with no new AI/backend dependencies.

New direct-identifier coverage (all label-bound to avoid false positives on bare figures, table quantities, share counts, and prose; the full labeled phrase is the candidate value, consistent with procurement/finance references and SEC file numbers, and the value must contain a digit):

- HR/payroll identifiers after their label + qualifier: `Employee ID/No./Number`, `Personnel No./Number/ID`, and `Payroll ID/No./Number` (`BUSINESS_ID`). Without this rule the trailing digit run was mislabeled as `PHONE` and the alphabetic prefix (e.g. `EMP-`, `PERS-`, `PAY-`) leaked.
- Compound `Payroll Reference` / `Payroll Ref` and `Shareholder Reference` / `Shareholder Ref` labels (`BUSINESS_ID`), mirroring the Round 8 `Payment Reference` rule. The bare-colon `Reference:` detector only matched the trailing substring and left the `Payroll ` / `Shareholder ` prefix unscoped.
- Equity award identifiers after their label + qualifier: `Grant No./Number/ID`, `Equity Grant ID`, `Option Grant No.`, and `Award ID/Number` (`BUSINESS_ID`). Without this rule the trailing digit run was mislabeled as `PHONE` and the grant prefix (e.g. `EQ-`, `GRT-`, `OPT-`) leaked.
- Share certificate identifiers: `Certificate No./Number/ID`, `Share Certificate No./Number/ID`, and the bare-colon `Share Certificate:` field (`BUSINESS_ID`). Without this rule the trailing digit run was mislabeled as `PHONE`.
- Governance record references: `Written Consent` / `Written Consent No./Number/ID` (including the common bare-colon `Written Consent:` form where the qualifier is omitted) and `Approval ID/No./Number` (`BUSINESS_ID`). Without this rule the trailing digit run was mislabeled as `PHONE` or `DATE`.
- Same labels are also recognized as line-anchored form fields (`Label: value`), with multi-value splitting and the shared digit guard.

False-positive guardrails (kept readable at all levels):

- All new identifier patterns require a label + qualifier (or a compound label, or a colon anchor for the bare forms) plus a digit-bearing value, so unlabeled bare numbers (`447821`, `5512`), share counts in tables (`5,000,000`), placeholder values (`Employee ID: pending`, `Grant ID: to be determined`, `Written Consent: to be filed`), and prose (`Employee Number of staff`, `grant of options`, `by written consent of the board`, `subject to approval`) remain readable.
- `Manager` is no longer treated as a plausible surname token in a title-case name, so role labels such as `Hiring Manager`, `Office Manager`, `Account Manager`, and `Project Manager` stay readable instead of being redacted as people.
- `Table` is no longer treated as a plausible surname token in a title-case standalone line, so document headings such as `Capitalization Table` and `Amortization Table` stay readable instead of being redacted as people.
- `Project <Role>` phrases (e.g. `Project Manager`, `Project Coordinator`, `Project Engineer`) are no longer treated as project codenames; when the token after `Project` is itself a role/defined-term word the phrase names a job title and stays readable. Real project names (`Project Falcon`, `Project X`) are unaffected.
- Standing board-committee qualifiers (`Audit`, `Nominating`, `Governance`, `Ethics`) were added to the defined-term token set, so `Audit Committee`, `Nominating Committee`, `Governance Committee`, and `Ethics Committee` stay readable instead of being redacted as organizations or people. (`Compensation Committee` already stayed readable because `Compensation` is a defined-term token.)

Known trade-offs:

- The HR/equity/certificate label (e.g. `Grant ID`) is consumed within the redacted reference phrase, consistent with how procurement IDs, finance references, and SEC file numbers are handled. The label word in other contexts (e.g. the standalone `Grant` verb, `Written Consent` in prose) remains readable.
- A `Tax/Payroll Reference:` field whose label contains a slash (e.g. `Tax/Payroll Reference: TPR-99-044821`) redacts only the trailing reference value (via the generic `Reference:` label); the `Tax/` prefix is left readable because the slash form is not a compound label. The sensitive value itself is redacted. This is the same single-line label-value limitation noted in Round 8.
- Numeric share counts inside cap-table table cells (e.g. `5,000,000`, `12,500`) are not redacted, because a bare number in a table is ambiguous (it could be a quantity, price, or count) and there is no currency anchor. Only explicitly labeled share references (e.g. `Certificate No.`, `Share Certificate:`) redact. This mirrors how finance Round 8 handled table line items.
- A specific equity plan name that repeats three or more times (e.g. `2026 Omnibus Equity Incentive Plan`) may be redacted as a proper noun at heavy level, consistent with how heavy treats other repeated capitalized defined-term-like phrases. The `Option Plan` role label and the plan reference at light/balanced stay readable.

## 1.0.14 - 2026-06-17

Release-candidate repair after auditing the synthetic `public/dev-sample.md` engagement letter.

- Added label-bound coverage for legal-engagement matter references (`Matter: ABC/2026/001`, `Internal matter reference: ...`), UK company registration numbers/CRNs with Companies House context, SRA IDs, HMRC references, and spaced UK/EU VAT registration numbers such as `GB 123 4567 89`.
- Added postcode-anchored full UK address-line detection so addresses like `18 Example Quay, Belfast BT1 3XD, United Kingdom` and `Suite 400, 77 Example Street, London EC4N 7BL` redact as full address units instead of leaking city/country tails.
- Added narrow ampersand organization detection for names with a real organization suffix or tail (`Maple & Stone LLP`, `Mercantile & Cross Bank`) while keeping boilerplate headings such as `Terms & Conditions` readable.
- Improved legal-contact name detection for contact-list rows before email addresses, business-contact prose (`lead partner is ...`, `conduct will be handled by ...`), and full names before `Esq.`.
- Project codenames introduced as `Project X` now also redact the codename token when it appears elsewhere in the same document, reducing leaks such as `X distribution network`.

False-positive guardrails:

- The new identifier rules remain label-bound and digit-bearing; placeholder prose such as `Matter: to be confirmed` stays readable.
- The UK full-address rule requires a UK postcode, and the ampersand organization rule requires an organization suffix/tail, to avoid turning ordinary prose into addresses or organizations.

## 1.0.13 - 2026-06-17

Pre-release level-name cleanup.

- Standardized the strongest redaction setting on `heavy` throughout the engine/API surface, removing the temporary `strict` alias before initial release.

## 1.0.12 - 2026-06-17

Release-candidate audit repair after the Round 8 finance operations pass.

- Required label-based `CASE_REF`, `BUSINESS_ID`, and `BANK_ACCOUNT` values to contain a digit, so placeholder prose such as `Tax ID: pending` or `Bank Account Number: to be confirmed` stays readable.

## 1.0.11 - 2026-06-17

Finance operations, invoice, remittance, and accounts-payable pass. Audited synthetic samples covering a utility monthly invoice, a UK VAT vendor invoice, a university remittance advice, a purchase order with line items, an accounts-payable policy, international wire/remittance instructions, a vendor invoice submission guide, and a vendor onboarding form, so the engine stays useful for operational documents that look like tables and forms rather than legal prose, with no new AI/backend dependencies.

New direct-identifier coverage (all label-bound to avoid false positives on bare figures, quantities, unit prices, totals, item codes, and version numbers):

- Finance document references after their label + qualifier: `Remittance Advice No./Number`, `Remittance No.`, and `Customer No./Number/ID` (`BUSINESS_ID`). The full labeled phrase is the candidate value (consistent with procurement references and SEC file numbers), so only the labeled occurrence is redacted and a bare number elsewhere stays readable. The value must contain a digit.
- `Payment Reference` / `Payment Ref` as a compound label, e.g. `Payment Reference: PAY-2026-5512-CUST2099` (`BUSINESS_ID`). The bare-colon `Reference:` detector only matches the trailing substring and left the `Payment ` prefix unscoped; this compound label captures the full reference. Prose such as "the payment reference will follow" stays readable because the value must contain a digit.
- Tax identifiers after their label: `VAT Registration No./Number`, `VAT No.`, `VAT ID`, `Tax ID`, `Tax No.`, `Tax Identification No./Number`, and `Taxpayer ID` (`BUSINESS_ID`). Bare `TIN` is deliberately excluded because lowercase `tin` is a common word. `VAT:` followed by a rate/amount is not matched because the qualifier is required.
- `Bank Account No./Number` and the full-word `Account Number` (`BANK_ACCOUNT`). Previously a digit-only bank account number was mislabeled as `PHONE`; the label-bound rule now classifies it correctly. The abbreviated `Account No.` (CASE_REF) behavior is unchanged.

False-positive guardrails (kept readable at all levels):

- The finance reference/tax patterns require a label + qualifier anchor (or the compound `Payment Reference` label), so unlabeled bare numbers (`1234`, `567890`), manufacturer item codes (`AB1234567890`, which also fails the ISIN checksum), table quantities, `Unit Price`, `Version 2.1`, and `Section 12` remain readable.
- `VAT: 20%`, `VAT (20%): ...`, and `Tax: 32.00` are not treated as tax identifiers because they lack the `No./Number/ID` qualifier; the rate/amount stays an ordinary amount and the label stays readable.
- Added finance operations boilerplate to the heavy proper-noun stop list: `Remittance Advice`, `Payment Terms`, `Net 30`/`Net 60`/`Net 90`, `Subtotal`, `Total Due`, `Balance Due`, `Payment Due`, `Bill To`, `Ship To`, `Remit To`. The standalone `Remittance Advice` document/section title and `Accounts Payable` (added in Round 6) stay readable.
- Invoice table column headers (`Invoice No.`, `PO Number`, `Description`, `Qty`, `Unit Price`, `Amount`) and line-item descriptions stay readable; only inline labeled references and explicit contact/bank fields redact.

Known trade-offs:

- The finance label (e.g. `Remittance Advice No.`) is consumed within the redacted reference phrase, consistent with how procurement IDs and SEC file numbers are handled. The label word in other contexts (e.g. the standalone `Remittance Advice` title) remains readable.
- A `From:`/`To:` correspondence field whose value contains a department suffix (e.g. `From: Cedar Grove Public University - Accounts Payable`) redacts the whole sender line, so `Accounts Payable` is consumed within that single sender value; the standalone `Accounts Payable` label elsewhere is preserved. This is a pre-existing single-line label-value limitation, not specific to finance documents.
- Spaced/grouped VAT numbers such as `GB 123 4567 89` and bare `VAT: GB123456789` (without a `No.`/`ID` qualifier) are not matched; the no-space qualified form `VAT No. GB123456789` is covered.

## 1.0.10 - 2026-06-17

Additional deterministic redaction repairs after another corpus pass.

- Tightened person/organization candidate validation to reduce context bleed from adjacent labels.
- Added missing guardrails for edge-case document headers and legal metadata phrasing.
- Improved replacement consistency for multi-line legal correspondence fields.
- Expanded regression coverage for the updated edge cases.

## 1.0.9 - 2026-06-17

Audit repair after the Round 7 regulatory enforcement pass.

- Added narrow continuation detection for empty person/entity labels such as `To:` or `Firm Name:` when the value appears on the next line, covering regulatory notice headers like `To:\nMaria S. Velazquez` without redacting generic salutations such as `Whom It May Concern`.

## 1.0.8 - 2026-06-17

Regulatory enforcement and compliance notice pass. Audited synthetic samples covering FDA warning letters, UK ICO enforcement notices, FTC consent orders, EPA administrative orders on consent, EEOC notices of right to sue, state Attorney General cease-and-desist orders, model Dear Health Care Provider letters, and CMS decisions/orders, so the engine stays useful for agency letters and orders that are not court pleadings and not SEC correspondence, with no new AI/backend dependencies.

New direct-identifier coverage (all label-bound to avoid false positives on bare figures, quantities, and statute sections):

- Regulator matter references after their label + qualifier: `Reference No./Number`, `Docket No./Number`, `Complaint No./Number`, `Charge No./Number`, and inline `Matter No./Number` (FDA/ICO/FTC/EPA/EEOC/state AG). Classified as `CASE_REF`; the full labeled phrase is the candidate value (consistent with SEC file numbers), so a bare number elsewhere remains readable.
- Agency-prefixed case/charge codes where the prefix is part of the label: `CMS Case #`, `EEOC No.`, `Document Control No.` (`CASE_REF`).
- Regulator establishment/registration identifiers that name the regulated entity: `FEI No.` (FDA Firm Establishment Identifier), `Establishment Identifier`, `Provider No.` (CMS), `ICO Registration`, `Registry No.` / `EPA Registry No.` (`BUSINESS_ID`).
- Same labels are also recognized as line-anchored form fields (`Label: value`).
- `Firm Name:` and `Registered Agent:` form fields now redact the inspected firm / named agent (`PERSON_OR_ORG`).
- Signatory names printed on the line immediately after a `/S/` or `/s/` marker are now captured (regulator letter signature blocks routinely put the printed name below the marker).

False-positive guardrails (kept readable at all levels):

- Government/regulator agency names ending in `Administration`, `Commission`, `Department`, `Agency`, `Bureau`, `Authority`, `Directorate`, or `Inspectorate` are no longer carved into PERSON candidates. The communication-context, title-case-list, and standalone "X and Y" person detectors were splitting `Food and Drug Administration` into `Drug Administration`, `Human Services` out of `Health and Human Services`, etc. A shared `GOV_AGENCY_TOKENS` set now suppresses these fragments across all three detectors and the core `looksLikePersonName` validator.
- The regulator reference patterns require a label + qualifier anchor, so unlabeled bare numbers (`1234`, `567890`), statute/regulation citations (`Section 5`, `Section 309`, `Parts 210 and 211`, `Title 21`), `Version 2.1`, and `33 U.S.C. § 1319` remain readable.
- Notice/order boilerplate (`WARNING LETTER`, `ENFORCEMENT NOTICE`, `DECISION AND ORDER`, `Consent Order`, `Clean Water Act`, `UK GDPR`) stays readable.

Known trade-offs:

- The procurement-style regulator label (e.g. `Reference No.`) is consumed within the redacted reference phrase, consistent with how SEC file numbers and procurement IDs are handled.
- A label whose value sits on the following line (e.g. `To:` on one line with the recipient name on the next) still leaks because label-value patterns are single-line; this is a pre-existing architecture limitation, not specific to regulator notices.
- Regulated-entity organization names (e.g. `Northwind Pharmaceuticals LLC`) still leak at Light level by design, because ORG suffix detection is a Balanced-level feature (consistent with prior rounds).

## 1.0.7 - 2026-06-17

Audit repair after the Round 6 procurement pass.

- Added label-bound detection for compound procurement/payment references such as `Reference Number for Payment: PAY-2026-0042`, while keeping prose like "reference number for the table" readable.
- Treated `Buyer Name` and `Bidder Name` fields as person-or-organization labels, since public bid forms may put either a named contact or a bidding entity in those fields.

## 1.0.6 - 2026-06-17

Procurement, RFP, purchase order, and public contract document pass. Audited synthetic samples covering SAM.gov solicitations, university/state PO terms, municipal bids, UK contract notices, vendor bid responses, PO line items, and remittance advice so the engine stays useful for everyday procurement operations outside securities/legal filings, with no new AI/backend dependencies.

New direct-identifier coverage (all label-bound to avoid false positives on bare figures, quantities, and version numbers):

- Procurement document reference numbers after their label + qualifier: `Solicitation No./Number`, `RFP/RFQ/RFI/IFB No./Number`, `Purchase Order No./Number`, `PO Number`, `Contract No./Number`, `Requisition No./Number`, `Vendor ID/Number`, `Invoice No./Number`, `Bid No.`, `Tender No.`, `Quote/Quotation No.`. The full labeled phrase is the candidate value (consistent with SEC file/registration numbers), so only the labeled occurrence is redacted and a bare number elsewhere remains readable. The value must contain at least one digit so prose words after a label are ignored.
- Bare procurement field headers followed directly by a colon/hash and a digit-containing value: `Purchase Order: PO-CCS-009876`, `Reference: PAY-2026-0042`, `Vendor: V12345`. The colon/hash anchor distinguishes these from prose ("issue a purchase order for the goods").
- `Contact Person`, `Procurement Officer`, `Procurement Contact`, `Buyer Name`, and `Bidder Name` form fields now redact the buyer/bidder contact name (SAM.gov solicitations and public bid forms).

False-positive guardrails (kept readable at all levels):

- Procurement role labels (`Purchaser`, `Supplier`, `Vendor`, `Bidder`, `Contractor`, `Subcontractor`, `Procurement`, `Buyer`) are no longer treated as standalone person-name components, so prose like "The Vendor shall deliver" stays readable.
- Added procurement boilerplate to the heavy proper-noun stop list: `Scope of Work`, `Statement of Work`, `Terms and Conditions`, `Contract Award Notice`, `Accounts Payable`, `Request for Proposal`, `Request for Quotation`, `Invitation for Bid`, `Procurement Officer`, `Procurement Manager`, `Purchase Order`.
- The procurement ID patterns require a label + qualifier (or label + colon) anchor, so unlabeled bare numbers (`1234`, `567890`), table quantities, `AB1234567890`, `Version 2.1`, and `Section 12` remain readable.

Known trade-off: the procurement label (e.g. `Purchase Order No.`) is consumed within the redacted reference phrase, consistent with how SEC file numbers are handled. `Purchase Order` in other contexts ("This Purchase Order is issued under...") remains readable because it lacks the reference qualifier.

## 1.0.5 - 2026-06-17

Audit repair after the Round 5 stock-exchange pass.

- Added checksum validation for ISIN detection so the engine keeps real securities identifiers such as `GB00B63HMG49` covered without redacting arbitrary 12-character alphanumeric references that merely match the broad shape.

## 1.0.4 - 2026-06-17

Stock-exchange and listed-issuer document diversity pass. Audited HKEX/HKEXnews, SGX, ASX, and London Stock Exchange/AIM materials so the engine stays generally useful for listed-company filings outside the US SEC corpus, with no new AI/backend dependencies.

New direct-identifier coverage (all label- or format-bound to avoid false positives):

- Exchange stock/securities codes after their label (`Stock Code: 1193`, `Stock code (if listed) 01919`); the bare code identifies the listed issuer.
- ISIN (12-character international securities identifier, e.g. `GB00B63HMG49`).
- SEDOL (7-character UK/LSE security identifier), only after a `SEDOL` label.
- LEI (20-character legal entity identifier), only after an `LEI` / `Legal Entity Identifier` label.
- Australian ABN (`ABN 53 603 253 541`), ACN, and ARBN, label-bound.
- `Submitted by:` (HKEX/SGX regulatory returns) and `Name of Director` (ASX Appendix 3Y) form fields now redact the filing officer / director name.

Over-redaction fixes for exchange/listing-venue boilerplate (kept readable at all levels):

- Listing-venue entity names and disclaimer fragments are no longer carved into ORG/PERSON candidates: `Hong Kong Exchanges and Clearing`, `Stock Exchange`, `The Stock Exchange of Hong Kong Limited`, `London Stock Exchange`, `Singapore Exchange`, and the `CHANGE OF COMPANY` heading.
- Added stock-exchange regulatory/meeting boilerplate to the heavy proper-noun stop list: `Annual General Meeting`, `Extraordinary General Meeting`, `Company Secretary`, `Proxy Form`, `Ordinary Resolution`, `Ordinary Shares`, `Results Announcement`, `Registration Statement`, `Listing Rule`, `Main Board Rule`, `GEM Rule`, `AIM Rules`, `Annual/Directors'/Auditor's/Remuneration/Financial/Sustainability Report`, `Explanatory Statement`, `Notice of Meeting`, `Non-Executive/Independent/Executive Director`, `Group Chief Executive Officer`, `Performance Rights`, `For personal use only`.
- Corporate-governance role phrases ending in `Director`/`Directors`/`Representative`/`Secretary`/`Chairman`/`Officer`/... are no longer treated as person names (`Independent Non-executive Directors`, `Authorised Representative`, `Chief Executive Officer`).
- Person-list and communication-context detectors skip fragments ending in a legal-form suffix (`Clearing Limited` from `Hong Kong Exchanges and Clearing Limited`) while preserving genuine litigation-role captures such as `Respondent Northwind Inc`.
- Removed the corpus-specific `Stock Exchange of Hong Kong` known-organization entry so the listing venue is not redacted.

Known trade-off: the location value `Hong Kong` is still redacted wherever it occurs (it is a genuine location in date/address lines), so `Hong Kong Exchanges and Clearing` may render as `[LOCATION] Exchanges and Clearing`. The distinctive `Exchanges and Clearing Limited` tail remains readable; a position-aware location suppressor would require new architecture.

## 1.0.3 - 2026-06-17

Audit repair after the Round 4 release-candidate pass. Focused on narrow engine correctness issues found while reviewing the worker changes.

- Restored normal hyphenated local phone detection (`555-0142`) while still avoiding SEC file-number-shaped values such as `333-45346`.
- Added narrow dot-separated business phone detection for forms such as `1.844.623.9008`.
- Made Dutch postcode detection genuinely context-bound to address/office labels or Netherlands address lines, avoiding bare table/reference tokens such as `1234 AB`.
- Added deterministic `P.O. Box` address detection.
- Removed a risky variable-width lookbehind from organization suffix detection while preserving the sentence-boundary anti-stitching behavior.

## 1.0.2 - 2026-06-17

Release-candidate refinement pass for mixed business/legal operational documents (offer and acquisition letters, separation/employment agreements, legal opinion letters, and underwriting/advisory engagement letters). Focus on eliminating high-frequency false positives without losing real identifiers.

- Fixed a capturing-group typo `(:?...)` in the SEC "File No." detector that silently discarded inline file numbers (they leaked and were mislabeled as phone numbers).
- Stopped US ZIP+4 (`ddddd-dddd`) and SEC file-number-shaped (`ddd-ddddd`) digit runs from being classified as phone numbers, so postcodes and filing references keep the correct kind.
- Prevented the organization-suffix detector from stitching across sentence boundaries (`Heading. The Company`, `Congress. The Company`) and from turning generic defined-term references (`The Company`, `The Bank`, `The Firm`, ...) into organizations. Split suffixes into legal-form (may follow ", ") and generic-tail (plain space only) tiers so `Name, LLC` still matches while `Name, Group General Counsel` does not.
- Required labelled business/registration numbers to contain a digit, removing matches such as `Company notifies` (matched as `Company` + `No` + `tifies` under the case-insensitive class).
- Required the correspondence `Date:` label to use a colon, so prose like `Date of this Agreement` and wrapped `date, and for which ...` is no longer captured as a date.
- Kept securities/HR defined terms readable (`Debt Securities`, `Preferred Stock`, `Depositary Shares`, `Severance Payment`, `Occupational Safety`, `Warrants`, `Units`) by adding the missing qualifier tokens.
- Kept `Attention: Legal Department` (and other department/role phrases) readable, and stripped the `Dear` salutation from standalone person lines.
- Kept boilerplate markers/timezone text readable (`Not Applicable`, `Central European Time`).
- Removed the corpus-specific `Forum` known-organization entry that was redacting the common word `forum`.
- Detected numbered street addresses with directional abbreviations (`6409 E. Nisbet Road`, `5435 NE Dawson Creek Drive`).
- Added context-bound Singapore (6-digit, after `Singapore`) and Dutch (`1234 AB`) postal-code detection.
- Tightened the OCR-spaced email matcher so a sentence that merely ends in an email address is no longer swallowed as one giant email.

## 1.0.1 - 2026-06-17

Updated engine coverage and quality after additional deterministic corpus rounds.

- Extended direct and contextual detectors for additional legal and business variants.
- Added normalization and boundary checks to reduce false positives.
- Strengthened replacement consistency for names, organizations, and reference IDs.
- Expanded tests to cover the new edge cases and expected redaction patterns.

## 1.0.0 - 2026-06-17

Initial versioned baseline after the first release-candidate refinement rounds.

This baseline includes deterministic detection for common English business/legal documents: direct identifiers, addresses, postcodes, national/business IDs, bank details, case and filing references, people, organizations, dates, amounts, locations, matter/project terms, correspondence metadata, litigation captions, legal contact blocks, and signature blocks.

Known trade-off: the engine is intentionally rule-based and inspectable, so unusual names, rare address formats, and context-only identifiers can still require human review.
