# Redaction Engine Changelog

The redaction engine uses semantic versioning independently from the app package.

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
- Added procurement boilerplate to the Strict proper-noun stop list: `Scope of Work`, `Statement of Work`, `Terms and Conditions`, `Contract Award Notice`, `Accounts Payable`, `Request for Proposal`, `Request for Quotation`, `Invitation for Bid`, `Procurement Officer`, `Procurement Manager`, `Purchase Order`.
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
- Added stock-exchange regulatory/meeting boilerplate to the Strict proper-noun stop list: `Annual General Meeting`, `Extraordinary General Meeting`, `Company Secretary`, `Proxy Form`, `Ordinary Resolution`, `Ordinary Shares`, `Results Announcement`, `Registration Statement`, `Listing Rule`, `Main Board Rule`, `GEM Rule`, `AIM Rules`, `Annual/Directors'/Auditor's/Remuneration/Financial/Sustainability Report`, `Explanatory Statement`, `Notice of Meeting`, `Non-Executive/Independent/Executive Director`, `Group Chief Executive Officer`, `Performance Rights`, `For personal use only`.
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
