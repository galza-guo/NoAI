# Redaction Engine Changelog

The redaction engine uses semantic versioning independently from the app package,
plus split ruleset counters for English/general and Chinese deterministic rules.

## NoAI redaction engine 1.5.14 (general r9, chinese r10) - 2026-06-20

Employment/credit/lease round: executive employment agreements and credit-
agreement notice blocks. Synthetic tests only; no real documents committed.
Deterministic rule changes only. No AI/LLM/backend/telemetry added.

- Added numbered building/plaza address detection (ADDRESS, Light). Credit-
  agreement and redress notice blocks write the recipient street as a building
  name with NO street suffix, e.g. "3 Bryant Park", "5 Times Square",
  "1 Presidential Plaza". The numbered-street rule required a Street/Avenue
  suffix, so the building line leaked while the following city/ZIP line
  redacted. The new rule matches a number + at least one Capitalized name token
  + a Capitalized building/place suffix (Park, Plaza, Square, Gardens,
  Tower(s), Center/Centre, House, Estate, Point, Mall, Complex, Block) as the
  final token. It is case-sensitive (capitalized) so lowercase prose ("3 park
  benches", "5 towers of equipment") is never matched. Benchmark-neutral on
  NAIR-v2 (recall 68.44%, 655 covered — unchanged).
- Added 1 synthetic test (numbered building/plaza address) with a lowercase-
  prose counterexample.
- Residual (deferred): named banks/parties ending in "National Association"
  (e.g. "U.S. Bank National Association") are not caught as ORG because the
  "U.S." abbreviation breaks the capitalized-name matcher; an abbreviation-aware
  ORG fix is deferred. Statute-name fragmentation and the multi-line notice-
  address street leak from the prior round remain open.

## NoAI redaction engine 1.5.13 (general r8, chinese r10) - 2026-06-20

Public-payments-and-contacts round: bank/payment instructions, procurement
contacts, and enforcement redress pages. Synthetic tests only; no real documents
committed. Deterministic rule changes only. No AI/LLM/backend/telemetry added.

- SWIFT/BIC codes now redact after an em-dash, en-dash, or hyphen separator
  (BANK_ACCOUNT, Balanced). Public wire instructions commonly write the value as
  "SWIFT code—BOFAUS3N" or "BIC - CHASUS33"; the original rule only accepted ":"
  / "#" separators, so the em-dash form leaked the code entirely. The separator
  class is widened to `[:#-–—]`. A bare "SWIFT" mention with no following code
  stays readable.
- Added US ABA routing number detection (BANK_ACCOUNT, Light). Wire/ACH
  instructions label the routing value as "Wire payment ABA routing number",
  "ACH ABA routing number", and the abbreviated "Wire/ACH Routing No." / "Routing
  No." with a separator and a 9-digit run (optionally space-grouped as
  "026 009 593"). The run is phone-shaped and was previously mislabeled PHONE.
  The label + qualifier anchor owns the value; a bare 9-digit figure with no
  label stays readable.
- Added DDA (demand-deposit account) number detection (BANK_ACCOUNT, Light).
  Bank wire instructions label the payee account as "DDA account number" with an
  em-dash/hyphen/colon separator and a long digit run. The run is phone-shaped
  and was mislabeled PHONE; the label anchor owns it.
- Added single-internal-whitespace email detection (EMAIL, Light). PDF/extraction
  artifacts occasionally insert one space right after the "@" (e.g.
  "Bho@ biodegradablefilter.com"); the standard email regex requires the domain
  to touch the "@", so this shape leaked. The rule allows exactly one optional
  space after the "@" with a real 2+ letter TLD anchor; prose "at @ home" is not
  matched.
- Standalone title-case person lines no longer over-redact product/service
  module names and section headings. `looksLikePersonName` now rejects a 2+ token
  candidate whose final token is a product/section noun (Interface, Accounts,
  Module, Automation, Processing, Needed, Criteria, Included, Support,
  Integration, Service(s), Schedule, ...), and adds "Signatory" to the
  role-ending stoplist. These were carved out as PERSON from service catalogs and
  RFP feature tables. (A street-suffix final-token guard was tried and reverted:
  street-suffix words like Place/Court/Park are also genuine surnames, and the
  guard cost 5 real PERSON spans on the sealed NAIR-v2 benchmark. Bare
  street-name standalone lines therefore remain a known residual over-redaction;
  full numbered street addresses are still handled by the ADDRESS rule.)
- Added 5 synthetic tests (SWIFT em-dash, ABA/DDA labels, internal-space email,
  product/service headings), each with a counterexample.
- Residual (deferred): multi-line redress street addresses (street + suite on one
  line, city/ZIP masked but street left readable), statute-name fragmentation
  ("Electronic Fund" matched as ORG, leaving "Transfer Act"), bare street-name
  standalone-line over-redaction, and contextual brand/location/person-role-list
  detection. These need broader address-joining, statute-name, or context-based
  handling and are deferred to keep this round focused and benchmark-neutral.

## NoAI redaction engine 1.5.12 (general r7, chinese r10) - 2026-06-20

Email-thread round: forwarded-email recipient headers. Synthetic tests only;
no real documents committed. Deterministic rule changes only. No
AI/LLM/backend/telemetry added.

- Added email-header recipient-list detection (PERSON_OR_ORG, Light).
  Forwarded-email `To:`/`Cc:`/`Bcc:` headers frequently list several
  recipients of the form "Display Name <email>" and wrap across several
  physical lines. The legacy From/To/Cc label rule captured only the value on
  the label's own line, so wrapped continuation recipients (and display names
  whose `<email>` was redacted first) leaked. A new detector joins the label
  value with its wrapped continuation lines (stopping at the next header,
  blank line, or salutation), splits per recipient while keeping angle-bracket
  and parenthetical groups whole, and emits a PERSON_OR_ORG candidate for each
  display name. Role/department boilerplate ("Compliance Department") and
  contract-defined-term fragments are skipped so labels stay readable. The
  trailing parenthetical firm annotation ("(Northbridge LLP)") is dropped from
  the display-name candidate so it is not fragmented when the ORG detector
  redacts the firm separately.
- Adjusted the From/To/Cc legacy label rule to defer to the dedicated detector
  when the value contains an angle-bracket recipient, so the whole-line
  candidate no longer wins the overlap and swallows a department name.
- Added 2 synthetic tests: wrapped multi-line To/Cc recipient display names
  (positive) and department-shaped recipient boilerplate stays readable
  (counterexample).
- Residual: lowercase functional mailbox aliases (e.g. "project_k") inside
  recipient lists are not redacted as person names; the EMAIL rule still
  redacts the address itself. Generalizing lowercase-alias capture was
  rejected as too false-positive-prone (info/support/admin mailboxes).

## NoAI redaction engine 1.5.11 (general r6, chinese r10) - 2026-06-20

Clinical-notes round: first coverage of the clinical-document family
(discharge summary, ICU progress note, operative report, nephrology consult,
emergency-department note). Synthetic documents only; no real PHI committed.
Deterministic rule changes only. No AI/LLM/backend/telemetry added.

- Added underscore-rule signature detection (PERSON, Light). Clinical note
  signature blocks print an underscore rule (_____) followed directly by the
  signatory's name and credentials, with no "/s/", "By:", or "Name:" marker.
  The underscore rule is now treated as a signature marker that crosses a
  single newline to capture the printed name below it, matching the existing
  "/s/" behavior. This catches names like "Helena V. Brandt, MD, FACS" printed
  under a signature line.
- Added US DEA registration number detection (NATIONAL_ID, Light). Format is
  two registrant letters followed by seven digits (e.g. BB8471936), anchored
  by a "DEA" label so arbitrary letter+digit runs stay readable.
- Added masked PRC national ID detection (NATIONAL_ID, Balanced). Courts and
  credit-disclosure platforms publish masked IDs as dddddddd******dddd. The
  previously-defined MASKED_PRC_ID_RE regex was not wired into detectChinese,
  so the leading digit run leaked as a PHONE token. It is now applied as a
  NATIONAL_ID candidate, fixing the recall hole and the phone-leak side effect.
- Added clinical section-heading boilerplate to the person-name stoplist so
  all-caps headings (PAST MEDICAL HISTORY, DISCHARGE MEDICATIONS, HISTORY OF
  PRESENT ILLNESS, etc.) are no longer swallowed by the all-caps/line person
  heuristic. These are a bounded, standardized clinical vocabulary, analogous
  to the existing "Table Contents" / "Expert Report" stops.
- Added 5 synthetic tests: titled names with single-letter middle initials,
  underscore-rule signature names, DEA number positive, clinical-heading
  over-redaction guard, and the masked PRC ID test that was previously red.

## NoAI redaction engine 1.5.10 (general r5, chinese r9) - 2026-06-20

Chinese patch (round 8): CSRC penalty decisions, SAMR anti-monopoly penalty,
market regulation bulk penalty notice. Deterministic rule changes only.
No AI/LLM/backend/telemetry added.

- Added 某-pattern anonymized legal personal name detector (PERSON, Balanced).
  Regulatory penalty decisions, court judgments, and administrative rulings mask
  personal names as 李某廷 / 王某鹏 / 陈某 — a single Han surname followed by
  某 and an optional 1-2 given-name characters. The detector uses regex
  `[Han]某[Han]{0,2}(?![Han])` to catch names at natural boundaries (followed
  by punctuation, line breaks, or non-Han chars). A validator rejects indefinite
  pronouns (某人/某些/某种), time expressions (某年/某月/某时), and
  placeholders (某某). Names embedded mid-sentence in running Han text
  (王某鹏参与) are a known balanced-level boundary limitation deferred to Heavy.
- Added standalone bracketed Chinese case/document reference detection (CASE_REF,
  Light). The existing REGULATORY_DOC_NO_RE pattern (2-8 Han prefix) missed
  forms like 中国证监会〔2025〕76号 and [2025]21-102号. Two new regexes cover
  the fullwidth-bracket and ASCII-bracket standalone forms with year-bracket
  anchoring and digit-content validation.
- Added agency-prefixed bracketed reference detection (CASE_REF, Light) for
  forms like 国市监处罚〔2024〕25号 and 证监许可〔2017〕1841号 where the Han
  prefix exceeds the 8-char limit of REGULATORY_DOC_NO_RE.
- Added birth date detection (DATE, Light) for 年X月出生 and 年X日出生
  patterns common in regulatory penalty decisions. The regex accepts X as a
  legal anonymization placeholder (196X年X月出生) and requires 出生 as anchor
  so generic year-month prose stays readable.
- Added 7 synthetic tests: 某-pattern positive coverage + counterexample,
  standalone bracketed CASE_REF positive + counterexample, birth date positive
  + counterexample, and non-birth guard.

English/general patch:
declarations page, a Texas special warranty deed, and a Chapter 11 bankruptcy
notice. Deterministic rule changes only. No AI/LLM/backend/telemetry added.

- Added patent bibliographic reference detection (`CASE_REF`, Light) for the
  USPTO INID labels `Appl. No.`, `Application No.`, `Ser. No.`, `Pat. No.`,
  and `Provisional application No.`. These application/serial/related-patent
  numbers are label-bound and require a digit-bearing value, so bare figures,
  patent classification codes (`G01N 35/10`), and statute/section citations
  stay readable. The label is consumed within the redacted reference, consistent
  with how SEC file numbers and procurement IDs are handled.
- Added label-bound identifier coverage for new document types (`BUSINESS_ID`/
  `CASE_REF`, Light), each requiring a label + qualifier/colon anchor and a
  digit-bearing value so prose and placeholder values stay readable:
  - Insurance: `Policy Number`, `NAIC Number`, `NAICS Code`, `NPN`.
  - Federal grant: `Award Number`, `UEI`, `DUNS Number`, bare-acronym
    `UEI:`/`DUNS:`/`NPN:`/`EIN:`/`FEIN:`/`CAGE:`, and `NSF/NIH/DOE/NASA/USDA
    Program Code`.
  - Deed/recording: `Instrument No.`, recorded `File No.`/`Clerk's File No.`,
    `Property Identification Number (Tax ID)`, `Notary ID`, and `Bar No.`/
    `State Bar No.`/`N.C. Bar No.`.
  - Bankruptcy/court: `Document No.` (ECF) and bare `Tax ID:`.
- Several of these values are phone-shaped (`DUNS 07-445-1928`, `NPN 18442973`,
  `Instrument No. 2026-0449173`, `Notary ID 1329984-7`, debtor `Tax ID
  47-2209184`) and were previously mislabeled `PHONE`. Adding the label-bound
  `BUSINESS_ID`/`CASE_REF` candidate makes the correct kind win at finalize,
  mirroring the Round 9 HR/payroll fix.
- Added patent inventor-name detection (`PERSON`, Light). The `(75) Inventors:`/
  `Applicant:` line lists multiple inventors separated by `;` and often wrapped
  across lines; the generic context patterns caught only the first. A dedicated
  detector captures every TitleCase name on the labelled line, validated by
  `looksLikePersonName`. Ordinary "the inventor of..." prose has no INID label
  and stays readable.
- Added patent examiner-name detection (`PERSON`, Balanced) after the role
  label `Primary Examiner —`/`Assistant Examiner —`, allowing a single-letter
  middle initial (`Daniel K. Weinstein`). Mirrors the litigation `Defendant X`
  role pattern.
- Added patent inventor/assignee residence detection (`LOCATION`, Balanced):
  the `City, ST (US)` / `City (XX)` tail on the `(75) Inventors:`/`(73)
  Assignee:` line. The INID-label context anchor is required, so ordinary city
  mentions in prose stay readable (no city dictionary is used).
- Added 11 synthetic regression tests covering each new label group plus
  counterexamples (bare unlabeled figures, classification codes, ordinary
  examiner/role prose, ordinary city prose, and `not.toMatch(/Label: PHONE_/)`
  mislabel guards).

On this round's six-document development corpus, redaction recall against the
annotator union (claude web + codex/gpt-5, independent) improved from 57.3% to
70.3% at balanced (135/192 spans), with by-label gains: BUSINESS_ID 36.4% →
86.4%, CASE_REF 35.0% → 65.0%, PERSON 22.7% → 45.5%, NATIONAL_ID 66.7% → 100%.
Keep-clean moved from 94.6% to 89.2% (33/37); the 4 violated keep spans are 2
pre-existing all-caps PERSON false positives newly surfaced by the new corpus
(`SPECIAL WARRANTY DEED`, `Technical Abstract`) and 2 `Appl. No.:` labels
consumed within the reference phrase under the engine's documented convention
for reference labels. No new false positives were introduced on existing
document patterns.

Known limitation (pre-existing, unrelated to this round): the masked-PRC-ID
detector constant `MASKED_PRC_ID_RE` in `chinese.ts` was added by the prior
Chinese round but is not yet wired into `detectChinese`, so asterisk-masked
national IDs (`3201151988****0022`) still leak their leading digit run as a
stray `PHONE`. This is a Chinese-ruleset gap to address in a separate round;
this English round does not touch `chinese.ts`.

## NoAI redaction engine 1.5.9 (general r4, chinese r8) - 2026-06-19

Patch: Chinese/mixed development round 8 (HKIAC & SCIA arbitration set-aside
application, arbitration Notice-of-Arbitration service summary, arbitration
applicant letter, a listed-company equity-change report, a filled residential
lease, and a court dishonest-debtor notice). Deterministic rule changes only.
No AI/LLM/backend/telemetry added.

- Broadened the HKIAC arbitral case-reference regex (general engine) to accept
  a 1- OR 2-letter prefix before the digits. HKIAC case codes use both single-
  and double-letter prefixes (e.g. `HKIAC/A25088` and `HKIAC/PA25057`), so the
  previous single-letter-only regex left every PA/AR-style code unredacted.
- Broadened the Chinese label-bound passport regex to accept a 1- OR 2-letter
  prefix before 6-9 digits. Chinese e-passports and many foreign passports use
  a 2-letter prefix (e.g. `EM3983934`), which the previous single-letter regex
  rejected outright. Label-anchored, so a non-passport labelled value still
  stays readable.
- Added a direct masked-PRC-ID detector (`NATIONAL_ID`, level 1). Courts and
  credit-disclosure platforms publish asterisk-masked national IDs shaped
  `dddddd******dddd` (6-10 leading digits, an asterisk run, a 4-digit suffix).
  These are not checksum-valid but are still identifying, and the leading digit
  run was being split off by the generic phone regex as a stray PHONE. Matching
  the WHOLE masked string as NATIONAL_ID shadows that phone fragment at render.
  Requiring an asterisk run makes this high-precision (no real ID, amount, or
  date contains asterisks).
- `cleanChineseValue` now also strips fullwidth brackets `（）《》【】` (in addition
  to the halfwidth set) from the ends of label-bound values, so a value that
  sits inside a parenthetical label such as `（中国护照号码：EM3983934）` is not
  left with a dangling `）` that fails validation.
- Added 6 synthetic tests: passport 1/2-letter-prefix coverage + its
  non-passport counterexample, HKIAC 1/2-letter-prefix coverage + its
  non-case-code counterexample, and masked-ID coverage + its non-id-asterisk
  counterexample. On this round's six-document development corpus, redaction
  recall against the annotator union improved from 51.6% to 53.5% at balanced,
  keep-clean unchanged.

## NoAI redaction engine 1.5.8 (general r3, chinese r7) - 2026-06-19

Patch: English/general development round (public SEC correspondence, FTC consent
agreement, and state-AG consent order). Deterministic rule changes only. No
AI/LLM/backend/telemetry added.

- Fixed a parenthesized-area-code US phone leak. US business letterheads write
  the area code in parentheses (`(650) 493-9300`, `(212) 895.3500`). The phone
  regexes start at the first digit and `cleanValue` strips the leading `(`, so
  the stored value was `650) 493-9300` with a dangling close paren. The literal
  replacement then matched only from the `6`, leaving a stray `(` visible in the
  redacted output (`Tel (PHONE_001.`). When a phone value has a close paren
  directly after a 3-digit area code (the open paren was stripped) AND the raw
  match began with `(`, the balanced `(AAA)` form is restored so the whole
  parenthesized number is one redacted token. This only fires on the
  paren-area-code shape, so ordinary separator phones, ISINs, and other kinds are
  unaffected.
- Added a label-bound CASE_REF detector for regulator file/docket/matter/case
  numbers written as a short digit split with a space or dash: FTC
  `FILE NO. 092 3184`, `Docket No. 2024 567`, `File No. 092-3184`. These
  3+4 / 4+3 splits match the generic phone shape and were mislabeled PHONE. The
  label anchor (`File`/`Docket`/`Matter`/`Case`/`Charge`/`Claim`/`Reference`
  followed by `No.`) is the trust boundary, so a bare local phone
  (`Call 555 1234`) keeps its PHONE label. A matching context guard in the direct
  phone detector skips a split-digit run when it directly follows one of those
  labels, so the labeled phrase is the only candidate (no stray PHONE fragment).
- Added 4 synthetic tests: paren-area-code phone coverage, its non-parenthesized
  counterexample, split file/docket number CASE_REF coverage, and its bare-phone
  counterexample. On this round's three-document public development corpus
  (SEC correspondence, FTC consent, state-AG consent), redaction recall against
  the annotator union improved from 62.8% to 64.1%. The sealed
  `benchmark-v1.0` Balanced score was unchanged at 59.8% span recall / 64.4%
  char recall / 50.7% precision proxy / 88.7% keep-clean, confirming the change
  is recall-neutral on documents without these patterns (no regression).

## NoAI redaction engine 1.5.7 (general r2, chinese r7) - 2026-06-19

Patch: Chinese development round 7 (SAMR penalty decisions, procurement award
notices, listed-company shareholder-meeting notices). Deterministic rule changes
only. No AI/LLM/backend/telemetry added.

- Generalized every colon-anchored Chinese label rule to see through a
  parenthetical synonym between the label and the colon. Formal Chinese
  paperwork (SAMR/administrative penalty decisions, court filings, contracts)
  standardizes on `住所（住址）`, `法定代表人（负责人、经营者）`,
  `统一社会信用代码（注册号）` — a field label qualified by a parenthetical
  synonym BEFORE the colon. The old rule required the colon immediately after
  the label, so these labeled ADDRESS/PERSON/BUSINESS_ID values leaked
  entirely. A new `LABEL_SYNONYM_PARENS` optional segment sits between the label
  and `LABEL_SEP` for `applyLabelRules` and both ADDRESS multi-line detectors.
  It is anchored by the label alternation (a real label must precede the
  parenthetical), so ordinary prose such as `本通知（盖章后生效）` stays
  readable.
- Added 4 shareholder-meeting / conference venue labels to ADDRESS_LABELS:
  现场会议地点, 会议地点, 登记地点, 会议地址. Listed-company AGM convening
  notices announce the on-site venue under these labels, which the generic
  address-label set did not cover. Bare prose use (`会议地点尚未确定`) is still
  protected because `LABEL_SEP` requires a colon-value structure.
- Added 4 synthetic tests: parenthetical-synonym label coverage + its
  not-a-label-synonym counterexample, and meeting/registration venue label
  coverage + its prose-without-colon counterexample.

## NoAI redaction engine 1.5.6 (general r2, chinese r6) - 2026-06-19

Patch: Chinese postcode label detection and label guard hardening.
Deterministic rule changes only. No AI/LLM/backend/telemetry added.

- Added POSTCODE_LABELS (邮编/邮政编码/郵編/郵政編碼/编码) with a strict
  6-digit validator (POSTCODE_RE). Chinese postcodes are 6-digit runs
  (100000-854099 domestic, 999001-999078 special); the validator accepts
  exactly 6 digits with no letters or punctuation.
- Extended ADDRESS_NEXT_LABEL_RE to stop address value capture at
  账号/开户行/收款单位/收款行 sub-labels, preventing address values from
  swallowing bank-account fields that follow on the same line.
- Added 4 synthetic tests: postcode label coverage and FP guard, address
  fragment guard, and keep-clean verification.

## NoAI redaction engine 1.5.5 (general r2, chinese r5) - 2026-06-19

- Added 14 procurement-specific labels to cover Chinese government procurement
  award notice patterns: 采购代理机构, 代理机构名称, 采购单位, 中标供应商,
  供应商地址, 采购单位地址, 代理机构地址, 项目联系电话, 采购单位联系方式,
  代理机构联系方式, 招标文件编号, 评审专家, 评审专家名单, 项目联系人,
  单一来源采购人员, 采购人代表, 用户代表, and their Traditional Chinese
  (HK/TW) aliases.
- Extended the Chinese name-list splitter to handle space-separated expert
  rosters. 评审专家 sections commonly list names delimited by spaces rather than
  punctuation (齐海粟 胡萍 孙云飚 马贺 赵心怡); the old splitter only handled
  、/,/;/； delimiters. The new path only activates when every fragment is a
  2-3 Han-char Chinese name, so prose is not accidentally split.
- Added 2 synthetic tests: positive coverage of the new procurement labels
  with invented values, and an FP guard where label-bearing procurement prose
  stays readable.

## NoAI redaction engine 1.5.4 (general r2, chinese r4) - 2026-06-19

Patch: Chinese development round 3 (public listed-company board announcements
with executive bios). Deterministic rule changes only. No AI/LLM/backend/telemetry
added.

- Added an honorific-suffixed bare-person detector (X先生 / X女士 / X小姐). Public
  company announcements, news, and meeting minutes introduce people this way with
  no label anchor, which is the largest source of unlabeled PERSON spans. The
  先生/女士/小姐 honorific almost exclusively follows a personal name in
  business/legal Chinese, so a 2-4 Han-char name prefix is a strong signal.
  Three guards keep prose readable: (1) the name must start at a non-Han boundary
  or immediately after a role-introduction trigger (董事长/总经理/提名/聘任/…);
  (2) a stoplist rejects common-noun prefixes (各位先生, 两位女士); (3) when a
  role title's trailing chars leak into the captured name (董事长李铁 ->
  "事长李铁"), they are pulled back into the title so the title stays readable
  and the name is correct. Generic salutations ("各位先生女士请注意") are not
  redacted.

## NoAI redaction engine 1.5.3 (general r2, chinese r3) - 2026-06-19

Patch: Chinese development round 2 (public court judgments, procurement notices,
listed-company announcements). Deterministic rule changes only. No
AI/LLM/backend/telemetry added.

- Added the litigation-agent labels 委托诉讼代理人 and 诉讼代理人 to person
  detection. These are the standard court-document terms for a party's lawyer;
  the existing 委托代理人 label is a substring but the 诉讼 infix stopped it from
  anchoring on the separator, so named lawyers in judgments leaked.
- Added a court-signature-block detector for spaced-out role titles. Chinese
  judgment signature lines space the role out with full-width spaces for
  alignment (审　判　长　　刘玉蓉, 书　记　员　　朱健芳) and separate role from name
  with full-width spaces rather than a colon. The colon-anchored label rules
  could not reach presiding judges, judges, people's assessors, clerks, and
  judges' assistants; they are now redacted. Detection is line-anchored and name-
  shaped, so judge-title prose (审判长主持庭审) stays readable.
- Added an address value guard that stops a labeled address at the next inline
  sub-label. Directory/header lines commonly chain fields
  (地址：…27号 邮编：100000 总机：01000000000); previously the address value
  swallowed the postcode and phone. It now stops at 邮编/邮政编码/总机/电话/
  传真/邮箱/网址/etc., so those fields stay readable and are redacted by their
  own label rules.

## NoAI redaction engine 1.5.2 (general r2, chinese r2) - 2026-06-19

Patch: Chinese development round 1 (HK arbitration + share-pledge documents).
Deterministic rule changes only. No AI/LLM/backend/telemetry added.

- Added Traditional-Chinese (HK/TW) legal, arbitration, and contact role labels
  that introduce a named individual, so named arbitrators, tribunal secretaries,
  legal advisers, and `聯係人` contacts are now redacted. New labels include
  獨任仲裁員, 仲裁員, 仲裁庭秘書/書記員, 審判長/審判員, 法律顧問, 代表律師,
  and the HK `聯係人` variant of 聯絡人. Generic role nouns in prose stay
  readable because detection still requires the label + separator anchor.
- Added Traditional-Chinese service and registered-office address labels
  (送達地址, 註冊辦公地址, 通訊位址) so addresses introduced by these labels are
  redacted instead of leaking because only the trailing 地址 sub-label matched.
- Added folding for labeled Chinese addresses that wrap across a soft newline
  (common in PDF text extraction). When a labeled address value ends a line and
  the next line starts with a building/floor/room marker (樓/层/室/棟/號…), the
  continuation is folded into one redacted span. Continuation lines are truncated
  at the first hard stop and must start with an address marker, so following
  prose sentences are not swallowed.

## NoAI redaction engine 1.5.1 (general r2, chinese r1) - 2026-06-19

Patch: removed built-in real-entity lookup lists from default English/general
redaction behavior. No AI/LLM/backend/telemetry added.

- Removed committed organization and matter-term allowlists that had carried
  prototype corpus knowledge into the default engine.
- Removed corpus-specific location terms from default location detection;
  generic city coverage remains.
- Added explicit `RedactionOptions` fields for caller-supplied local
  organizations, matter terms, and locations. These default to empty and redact
  with `configured ...` reason strings when used.
- Replaced real-name regression fixtures with synthetic examples and added
  coverage proving default redaction has no configured corpus memory.
- Local benchmark check against `benchmark-v1.0` at Balanced level retained
  span recall at 59.8%, improved precision proxy from 50.4% to 50.7%, and
  improved keep-span clean rate from 85.9% to 88.7%.

## NoAI redaction engine 1.5.0 (general r1, chinese r1) - 2026-06-19

Minor: introduced split engine/ruleset version metadata for AI-maintained
development loops.

- Added machine-readable engine version info with a shared engine SemVer and
  separate `general` and `chinese` ruleset counters.
- Added the readable label format
  `NoAI redaction engine <engine> (general rN, chinese rM)` to review output,
  UI version display, dev-round reports, and benchmark score reports.
- Updated score-history keys to use the combined label so a general-only and a
  Chinese-only ruleset bump under the same shared engine SemVer do not
  overwrite each other.
- Updated the pre-commit engine-version hook to require the relevant ruleset
  counter when `src/redactor/rules.ts` or `src/redactor/chinese.ts` changes.

## 1.4.6 - 2026-06-19

Patch: user-supplied Huarong facility/finder-fee PDF development round. Raw
PDFs, extracted text, and Claude Code pattern notes were kept under
`benchmarking/private/dev-rounds/2026-06-19-user-huarong-pdfs/`.

- Made `SWIFT/BIC` label detection case-insensitive and added an OCR-spaced
  `Sw ift Code` variant so bank-code values in account-detail blocks are
  redacted consistently.
- Added a label-bound OCR-spaced `Accoun t number` detector for scanned
  bank-account values with injected spaces and common `1`/`l` OCR confusion.
- Added a label-bound OCR-spaced `company re gi st rati on number` detector for
  business identifiers in scanned bilingual facility agreements.
- Added synthetic regression coverage and counterexamples for the OCR-spaced
  bank-account and company-registration forms.

## 1.4.5 - 2026-06-19

Patch: user-supplied arbitration-correspondence development round using the
first 100 Markdown files from the local correspondence folder. Raw/source
Markdown, extracted engine output, and Claude Code pattern notes were kept under
`benchmarking/private/dev-rounds/2026-06-19-user-correspondence-first100/`.

- Added context-derived redaction for bare HKIAC arbitration numbers such as
  `A34567` when the number is learned from `HKIAC/A34567` or procedural
  correspondence filenames such as `Agenda for 22 March CMC A34567.doc`.
  This closes overlap leaks where `HKIAC` was masked separately but the stable
  A-number remained visible in subjects, filenames, and case-file links.
- Added redaction for bracketed internal matter tags with dotted `D` / `FID`
  numeric suffixes, such as `[team.D19995]` and
  `[ALPHA-MATTERS.FID1695188]`, while keeping ordinary labels like
  `[Draft.V1]` and `[Schedule.A]` readable.
- Added synthetic regression coverage and counterexamples for both patterns.

## 1.4.4 - 2026-06-19

Patch: user-supplied arbitration-pleadings development round. Raw DOCX files,
extracted text, and Claude Code notes were kept under
`benchmarking/private/dev-rounds/2026-06-19-user-mountain-road-pleadings/` and
were not added to committed fixtures.

- Added Balanced-level detection for narrow biographical birth details such as
  `Born in 1957 in Meridian City`. The rule requires both birth context and a
  birthplace-looking location, so ordinary year prose such as company founding
  dates stays readable.
- Added synthetic regression coverage for birth-year/birthplace redaction and
  a counterexample for non-biographical year prose.

## 1.4.3 - 2026-06-19

Patch: SEC/public-agreement development round improvements. All changes are
deterministic and browser-only; no AI/LLM/backend/telemetry added.

- Added US letterhead phone coverage for mixed separator forms such as
  `(212) 895.3500`, `(800) 724·0761`, and `(212) 895-3783`.
- Extended numbered street-address detection to handle Markdown-converted
  ordinal street names such as `177^(th) Place` and `1^(st) Ave`.
- Added a ZIP-anchored full US address pattern for unit-bearing addresses such
  as `#293` or `Suite 203`, reducing leaks of city/state/ZIP tails.
- Added `Current` to commercial/SEC defined-term guards so filing boilerplate
  such as `Current Reports` stays readable instead of becoming a person
  candidate.

## 1.4.2 - 2026-06-18

Patch: context-organization regex now includes fullwidth parentheses （）
(U+FF08/U+FF09) in the body charset, so org names like
`虚构示例（北京）科技有限公司` are captured whole instead of splitting at the
fullwidth paren. Common-noun-prefix guard (`我公司（北京）`) still applies.

## 1.4.1 - 2026-06-18

Patch: extended Chinese person/role and opening-bank label coverage. All
label-bound and shape-validated; no behavior change to existing detectors.

- Extended person / role labels (`PERSON`, Balanced): `申请人`, `上诉人`,
  `被申请人`, `原告`, `被告`, `代表`, `代表人`, `项目经理`, `总工程师`,
  `工程师`, `见证人`, `记录人`, `审判长`, `审判员` (plus Traditional
  `見證人`, `項目經理`).
- Opening-bank labels (`ORG`, Balanced): `开户行`, `开户银行`, `收款行`
  (plus Traditional `開戶行`, `開戶銀行`).

Prose such as `申请人资格条件` and `项目经理负责制` stays readable because the
label values must still pass the Han-name / org shape validators.

## 1.4.0 - 2026-06-18

Chinese redaction batches four and five: procurement/logistics reference
labels, spaced bank cards, extended multi-line addresses, Hong Kong
identifiers, signature names, fullwidth-digit amounts, and a large
Balanced-level false-positive suite. All deterministic, browser-only; no
AI/LLM/backend/telemetry added.

New coverage:

- Procurement / logistics / listing reference labels (`CASE_REF`, Light):
  `订单号`, `订单编号`, `采购订单号`, `快递单号`, `运单号`, `运单编号`,
  `物流单号`, `提单号`, `提单编号`, `回单号`, `回执号`, `受理号`,
  `受理编号`, `挂牌号`, `挂牌编号`, `保单号`, `保单编号`, `保函号`,
  `保函编号`, `挂号单号`, `查询号`, `查询码`. Values must match the project-
  ref shape (digit-bearing) so 订单状态 / 快递送达 stay readable.
- Spaced bank-account numbers (`BANK_ACCOUNT`, Heavy): the label validator now
  accepts 4-digit space-separated groups (`6222 0000 0000 0000`) in addition to
  the bare 16-19 digit form.
- Multi-line labeled Chinese addresses (`ADDRESS`, Balanced) now fold up to five
  continuation lines (was three), matching real address depth
  (province -> city -> district -> street -> building/room).
- Hong Kong / Traditional identifiers (label-bound, shape-validated, NO
  checksum): HK Business Registration (`商业登记号` / `商業登記號` ->
  `BUSINESS_ID`), HK Identity Card (`香港身份证` / `香港身份證` / `身分證字號`
  -> `NATIONAL_ID`), stock / securities codes (`股份代號` / `股票代码` /
  `证券代码` -> `CASE_REF`, accepting `.HK` / `.SH` / `.SZ` / `.SS` suffixes
  or a bare 4-6 digit run). HK BR MOD-7 and HKID check-digit algorithms have
  multiple conflicting public descriptions (needs verification), so bare
  detection remains disabled; the label is the trust anchor.
- Signature / authorization parenthesized names (`PERSON`, Balanced):
  `签字：（张三）`, `盖章：（李四）`, `经办人：（王五）`, etc. A non-name
  exclusion set (`盖章` / `公章` / `略` / `待定` / `附件` …) keeps seal and
  placeholder parentheticals readable.
- Agreement-party headings (`PERSON`, Balanced): `由 X 与 Y 就` is now wired
  (the detector existed but was never invoked).
- Fullwidth-digit RMB amounts (`AMOUNT`, Balanced): the `万元` / `亿元` / `元` /
  bare `万` / `亿` / fullwidth-yen regexes now accept fullwidth digits
  (U+FF10-FF19) and the fullwidth comma `，`, so `５０００元`,
  `人民币８０万元`, `￥５，０００` are redacted. The counter guard
  (`产量１万个`) is unchanged.

Behavior notes:

- The `万/亿` counter-noun guard is anchored to the start of the lookahead
  window (carried over from 1.3.0); fullwidth counter forms are still rejected.
- HK ID values are matched in their paren-stripped form because
  `cleanChineseValue` strips a trailing `)`; the sensitive identifier is fully
  redacted and only a cosmetic dangling `)` may remain.

Known limitations (deferred):

- HK BR MOD-7 and HKID check-digit validators still need verification before
  bare detection can be enabled.
- Fullwidth-digit detection is limited to RMB amount regexes; dates,
  identifiers, and phone numbers still require halfwidth digits.
- Free-form Chinese person names in prose (outside signature/agreement
  contexts) remain out of scope.

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
