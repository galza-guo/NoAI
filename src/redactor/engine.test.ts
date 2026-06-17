import { describe, expect, it } from "vitest";
import { redactDocuments } from "./engine";
import { RedactionLevel } from "./types";

function redact(
  text: string,
  level: RedactionLevel = "balanced",
  customTerms: string[] = [],
): string {
  return redactDocuments([{ name: "sample.md", text }], { level, customTerms })
    .combinedMarkdown;
}

describe("deterministic redaction engine", () => {
  it("does not leak original filenames into redacted exports", () => {
    const result = redactDocuments(
      [
        {
          name: "Private Client JV Agreement.docx",
          text: "This document has no sensitive body text.",
        },
      ],
      { level: "balanced" },
    );

    expect(result.combinedMarkdown).not.toContain("Private Client");
    expect(result.combinedMarkdown).not.toContain("JV Agreement.docx");
    expect(result.documents[0].name).toBe("Document 001");
    expect(result.combinedMarkdown).toContain("## Document: Document 001");
  });

  it("redacts legal references, transcript references, amounts, and percentages at balanced level", () => {
    const output = redact(`
HKIAC/A25088
D/042/123
R-12
CL-7
Day 14, pp. 1-70
USD 150 million
RMB27m
23.5%
`);

    expect(output).not.toContain("HKIAC/A25088");
    expect(output).not.toContain("D/042/123");
    expect(output).not.toContain("R-12");
    expect(output).not.toContain("CL-7");
    expect(output).not.toContain("Day 14, pp. 1-70");
    expect(output).not.toContain("USD 150 million");
    expect(output).not.toContain("RMB27m");
    expect(output).not.toContain("23.5%");
  });

  it("redacts business registry numbers, compact currency amounts, share counts, and table-style addresses", () => {
    const output = redact(`
Exact full legal name of the HK company: RAVEN INTERNATIONAL (HK) LIMITED
CR No. 12345678
company number 98765432
registered no.: 55667788
incorporated 5 January 2026
UNIT B, 11/F JADE TOWER
BLDG 23 THOMSON RD WAN CHAI
Registered office: Unit B, 11/F, Jade Commercial Building, 23 Pearl Road, Central, Hong Kong.
✅ CONFIRMED: RAVEN LIMITED, CR No. 12345678, Unit B, 11/F, Jade Commercial Building, 23 Pearl Road, Central, Hong Kong.
10000
I invested 5000Euro on 9 January 2026 and later recorded EUR 500 as surplus.
The shares are 10,000 ordinary shares, with Alex 5,100 shares (51%) and Blair 4,900 shares (49%).
Each share is 1HKD/share.
`);

    for (const leaked of [
      "RAVEN INTERNATIONAL",
      "12345678",
      "98765432",
      "55667788",
      "5 January 2026",
      "UNIT B",
      "JADE TOWER",
      "THOMSON RD",
      "WAN CHAI",
      "Jade Commercial Building",
      "Pearl Road",
      "10000",
      "5000Euro",
      "9 January 2026",
      "EUR 500",
      "10,000 ordinary shares",
      "5,100 shares",
      "4,900 shares",
      "1HKD/share",
    ]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("redacts product brands, sales channel names, and non-Latin duplicate text while preserving generic business words", () => {
    const output = redact(`
Current channel = MarketPilot.
Scope of Products (RAVENMOTO brand products only?)
Correct, atm only RAVENMOTO branded products.
Neither Party may register or use any RAVENMOTO-related trademarks independently.
由 李小明 与 卢卡斯 就设立及运营 RAVENMOTO INTERNATIONAL 所订立
在中国以外地区运营RAVENMOTO品牌
Products, Territory, and Net Profit remain useful defined terms.
All other off-road motorcycle products remain readable.
`);

    for (const leaked of [
      "MarketPilot",
      "RAVENMOTO",
      "李小明",
      "卢卡斯",
      "所订立",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain(
      "Products, Territory, and Net Profit remain useful defined terms.",
    );
    expect(output).toContain(
      "All other off-road motorcycle products remain readable.",
    );
  });

  it("redacts both parties in agreement headings and emphasized escaped company names", () => {
    const output = redact(`
__Between
Li Rivers and Blake Stone
For the Establishment and Operation of RAVENMOTO INTERNATIONAL \\(HK\\) LIMITED__
__RAVENBIKE INTERNATIONAL \\(HK\\) LIMITED__
- __51% held by Li__
- __49% held by Blake__

Question
Blake's Response
Our Further Response to Blake
`);

    for (const leaked of [
      "Li Rivers",
      "Blake Stone",
      "held by Li",
      "held by Blake",
      "Blake's Response",
      "Response to Blake",
      "RAVENMOTO INTERNATIONAL",
      "RAVENBIKE",
    ]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("redacts people in titles, case captions, all-caps table cells, surnames, and contextual given names", () => {
    const output = redact(`
# Kodera v Wingtech
KOUJI KODERA
<td>KOUJI KODERA</td>
Mr Michael Li says that Ms Jenny Chan was not copied to Jenny.
Michael Li was involved in the transaction.
Li further explained the timing.
`);

    for (const leaked of [
      "Kodera",
      "Wingtech",
      "KOUJI KODERA",
      "Michael Li",
      "Jenny Chan",
      "Jenny",
      "Li further",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
    expect(output).toContain("ORG_");
  });

  it("redacts honorific titled names without redacting generic salutations", () => {
    const output = redact(`
The tribunal secretary prepared notes for Sir Adrian's review.
Dame Eleanor was copied on the procedural update.
Dear Sir or Madam, the deadline remains unchanged.
`);

    for (const leaked of ["Sir Adrian", "Adrian", "Dame Eleanor", "Eleanor"]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("Dear Sir or Madam");
    expect(output).toContain("PERSON_");
  });

  it("redacts labelled legal contact details without breaking slash-separated addresses", () => {
    const output = redact(`
Address: 12/F, Gloucester Tower / 15 Queen's Road Central
Attention: Douglas Clark / Kevin Siu / Jacqueline Leung
Email: douglas@example.com; kevin@example.com
Ref: HKIAC/A25088
`);

    for (const leaked of [
      "Gloucester Tower",
      "Queen's Road",
      "Douglas Clark",
      "Kevin Siu",
      "Jacqueline Leung",
      "douglas@example.com",
      "kevin@example.com",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).not.toMatch(/<\/ADDRESS_/);
  });

  it("redacts corpus-specific banks, advisers, projects, assets, and agreement terms", () => {
    const output = redact(`
BAM and Brookfield discussed HSBC, UOB and LUSO financing.
The KETD Project, ICETD Project, Huatai financing and Haimen Park were mentioned.
The Commission Agreement, Amendment to Schedule A, SHA, SSA, SSHA, PSA and MOU were disputed.
Future Government Subsidies and Neibaowaidai were also discussed.
WINGTECH \\(HONG KONG\\) LIMITED appeared in Procedural Order No\\.1.
`);

    for (const leaked of [
      "BAM",
      "Brookfield",
      "HSBC",
      "UOB",
      "LUSO",
      "KETD",
      "ICETD",
      "Huatai",
      "Haimen",
      "Commission Agreement",
      "Amendment to Schedule A",
      "SHA",
      "SSA",
      "SSHA",
      "PSA",
      "MOU",
      "Future Government Subsidies",
      "Neibaowaidai",
      "WINGTECH",
      "HONG KONG",
      "Procedural Order No\\.1",
    ]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("keeps ordinary lower-case words readable after person alias detection", () => {
    const output = redact(`
Mr Michael Li says the management team later reviewed the market information.
The financing information was later updated by management.
`);

    expect(output).toContain(
      "management team later reviewed the market information",
    );
    expect(output).toContain(
      "financing information was later updated by management",
    );
  });

  it("redacts title-case people in participant lists", () => {
    const output = redact(`
The conference was attended by Jenny Li, Zhang Yi and Jack Xu.
The follow-up email copied Alex Chen, Priya Shah, and Omar Khan.
`);

    for (const leaked of [
      "Jenny Li",
      "Zhang Yi",
      "Jack Xu",
      "Alex Chen",
      "Priya Shah",
      "Omar Khan",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("redacts standalone title-case person names in simple lists", () => {
    const output = redact(`
Attendees
- Peter Mok
- Sara Ng
`);

    for (const leaked of ["Peter Mok", "Sara Ng"]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("does not redact standalone legal list items as person names", () => {
    const output = redact(`
Documents
- Hearing Bundle
- Procedural History
- Costs Schedule
`);

    expect(output).toContain("Hearing Bundle");
    expect(output).toContain("Procedural History");
    expect(output).toContain("Costs Schedule");
  });

  it("strict mode localizes chronology rows", () => {
    const output = redact(
      `
| Date | Bundle Ref | Exhibit Number | Description |
| --- | --- | --- | --- |
| 2025.07.11 | D/042/123 | C-4 | Mr Michael Li attended the meeting |
`,
      "strict",
    );

    expect(output).toContain("CHRONO_DATE_001");
    expect(output).toContain("CHRONO_BUNDLE_001");
    expect(output).toContain("CHRONO_EXHIBIT_001");
    expect(output).not.toContain("2025.07.11");
    expect(output).not.toContain("D/042/123");
    expect(output).not.toContain("C-4");
  });

  it("strict mode quarantines legal contact blocks", () => {
    const output = redact(
      `
For the Tribunal
Arbitrator Name
Address: 1 Road
Email: tribunal@example.com

1. INTRODUCTION
The merits continue here.
`,
      "strict",
    );

    expect(output).toContain("[CONTACT_SECTION_001]");
    expect(output).toContain("1. INTRODUCTION");
    expect(output).toContain("The merits continue here.");
    expect(output).not.toContain("tribunal@example.com");
  });

  it("supports user supplied custom terms", () => {
    const output = redact("The private codename is Velvet Lantern.", "light", [
      "Velvet Lantern",
    ]);

    expect(output).not.toContain("Velvet Lantern");
    expect(output).toContain("CUSTOM_001");
  });

  it("redacts GBP, EUR, plain dollar and symbol-led amounts", () => {
    const output = redact(`
The retainer was £12,500 and expenses came to €3,200.
US pricing started at $1,000,000 and A$5,000 setup fee.
Counterparty offered 7500 GBP and 4 million Sterling.
`);

    for (const leaked of [
      "£12,500",
      "€3,200",
      "$1,000,000",
      "A$5,000",
      "7500 GBP",
      "4 million Sterling",
    ]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("redacts national IDs, passport numbers, and bank details", () => {
    const output = redact(`
SSN on file: 123-45-6789.
NI number AB123456C was recorded.
Passport No. 452190134 expired.
EIN 12-3456789 covers the entity.
IBAN GB29 NWBK 601613 31926819 and sort code 12-34-56.
SWIFT code: NWBKGB2L.
`);

    for (const leaked of [
      "123-45-6789",
      "AB123456C",
      "452190134",
      "12-3456789",
      "GB29 NWBK 601613 31926819",
      "12-34-56",
      "NWBKGB2L",
    ]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("redacts UK, Canadian, and US ZIP+4 postcodes", () => {
    const output = redact(`
Office at SW1A 1AA, London.
Canadian branch M5H 2N2.
Mailing address Beverly Hills, CA 90210-1234.
`);

    for (const leaked of ["SW1A 1AA", "M5H 2N2", "90210-1234"]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("redacts UK neutral citations, US dockets, and case numbers", () => {
    const output = redact(`
The appeal is [2021] EWCA Civ 123 and the lower ruling was [2020] EWHC 4567 (Ch).
Federal matter No. 1:21-cv-00123.
Case No. 21-cv-98765 was dismissed.
`);

    for (const leaked of [
      "[2021] EWCA Civ 123",
      "[2020] EWHC 4567 (Ch)",
      "1:21-cv-00123",
      "21-cv-98765",
    ]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("redacts slash, ISO, dash, quarter, and financial-year dates", () => {
    const output = redact(`
Signed 31/12/2024 and effective 2025-01-15.
Amended 06-30-2023 in Q3 2024 of FY2024.
Closed during financial year 2025.
`);

    for (const leaked of [
      "31/12/2024",
      "2025-01-15",
      "06-30-2023",
      "Q3 2024",
      "FY2024",
      "financial year 2025",
    ]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("redacts general UK/US address lines without Hong Kong-specific terms", () => {
    const output = redact(`
Registered office: Suite 200, 18 Bedford Avenue, Milton Park, Oxfordshire, OX14 4RG.
Delivery to Apt 4B, 221 Baker Street, London.
`);

    for (const leaked of ["Suite 200, 18 Bedford Avenue", "221 Baker Street"]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("does not treat ordinary legal sentences as standalone addresses", () => {
    const output = redact(`
The Court considered Article 12 and dismissed the point.
The Way Forward 2024 was approved by the committee.
The St John report section 12 was updated.
`);

    expect(output).toContain("The Court considered Article 12");
    expect(output).toContain("The Way Forward 2024");
    expect(output).toContain("The St John report section 12");
    expect(output).not.toContain("ADDRESS_");
  });

  it("keeps label-detected organizations when exact-value dedupe sees another kind", () => {
    const output = redact(`
Attention: North Star Holdings
Please respond this week.
`);

    expect(output).not.toContain("North Star Holdings");
    expect(output).toContain("PERSON_");
  });

  it("redacts suffix currency amounts with multipliers as a single amount", () => {
    const output = redact(`
Counterparty offered 12k GBP and 4 million Sterling.
`);

    expect(output).not.toContain("12k GBP");
    expect(output).not.toContain("4 million Sterling");
    expect(output).not.toContain(" Sterling");
  });

  it("redacts common day-month and month-day dates with or without a year", () => {
    const output = redact(`
The call was scheduled for 28 Nov and the reply was due by 28 November.
Further dates were 28th Nov, 28-Nov-2025, Nov 28, and November 28, 2025.
`);

    for (const leaked of [
      "28 Nov",
      "28 November",
      "28th Nov",
      "28-Nov-2025",
      "Nov 28",
      "November 28, 2025",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("DATE_");
  });

  it("strict mode redacts repeated non-person capitalized phrases", () => {
    const output = redact(
      `
Records mention Crimson Falcon Ledger Compass Beacon often.
Counsel cited Crimson Falcon Ledger Compass Beacon again.
Crimson Falcon Ledger Compass Beacon appears a third time.
`,
      "strict",
    );

    expect(output).not.toContain("Crimson Falcon Ledger Compass Beacon");
    expect(output).toContain("PROPER_NOUN_");
  });

  it("keeps commercial-contract defined terms readable while still redacting real people", () => {
    // Mirrors the recurring boilerplate that was previously redacted as people
    // (Tenant, Seller, Administrative Agent, Common Stock, Base Rent,
    // Intellectual Property, ...). These must survive at the default Balanced
    // level so the output stays useful, while genuine signatories are removed.
    const output = redact(`
This Agreement is between Acme Holdings, Inc. (the "Company") and the Buyer.
The Tenant shall pay Base Rent and Additional Rent to the Landlord monthly.
The Administrative Agent acts for the Lenders; the Borrower grants Collateral.
The parties exchanged Common Stock, Registrable Shares and other Securities.
All Intellectual Property, Patents and Trademarks remain Confidential Information.
Operating Expenses, Real Estate Taxes and Indebtedness were disclosed.
Mr. Jordan Wakefield and Ms. Priya Nair executed the documents.
`);

    for (const leaked of ["Jordan Wakefield", "Priya Nair"]) {
      expect(output).not.toContain(leaked);
    }
    for (const kept of [
      "Tenant",
      "Buyer",
      "Landlord",
      "Administrative Agent",
      "Lenders",
      "Borrower",
      "Collateral",
      "Common Stock",
      "Shares",
      "Securities",
      "Intellectual Property",
      "Patents",
      "Trademarks",
      "Confidential Information",
      "Operating Expenses",
      "Real Estate Taxes",
      "Indebtedness",
      "Base Rent",
      "Additional Rent",
    ]) {
      expect(output).toContain(kept);
    }
    expect(output).toContain("PERSON_");
  });

  it("does not turn 'in its capacity as <Role>' role labels into people", () => {
    const output = redact(`
The Guarantor serves as Administrative Agent for the Lenders.
The party named Escrow Agent holds the deposit.
`);

    expect(output).toContain("Administrative Agent");
    expect(output).toContain("Escrow Agent");
    expect(output).toContain("Guarantor");
    expect(output).toContain("Lenders");
    // No person tokens should be minted for these role labels.
    expect(output).not.toContain("PERSON_");
  });

  it("redacts signatory names in signature blocks including middle initials and all-caps", () => {
    // Signature blocks use "/s/", "By:", "Name:" and "Printed Name" markers, and
    // frequently include middle initials or initials-led names that the general
    // detector misses. All forms below must be redacted.
    const output = redact(`
IN WITNESS WHEREOF the parties have executed this Agreement.

By: /s/ Marcus T. Ridley
Name: Marcus T. Ridley
Title: Chief Executive Officer

/s/ Helena Voss
Printed Name: HELENA VOSS

By: L. K. Pemberton
/s/ F.M. Castillo
By: Jordan Price
/s/ Jordan Price
`);

    for (const leaked of [
      "Marcus T. Ridley",
      "Marcus Ridley",
      "Helena Voss",
      "HELENA VOSS",
      "L. K. Pemberton",
      "F.M. Castillo",
      "Jordan Price",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("redacts the first-and-last form of a longer printed signatory name", () => {
    // A printed name "Daniela Brooke Marsh" is often signed as "Daniela Marsh".
    const output = redact(`
Name: Daniela Brooke Marsh
/s/ Daniela Marsh
Daniela Marsh approved the amendment.
`);

    expect(output).not.toContain("Daniela Brooke Marsh");
    expect(output).not.toContain("Daniela Marsh");
    expect(output).toContain("PERSON_");
  });

  it("redacts initials-led and particle signatory names with leading titles", () => {
    // International signatures combine initials, lowercase particles (de, van)
    // and leading titles. The body often repeats the name without the title.
    const output = redact(`
Attention: Dr. Tomás Vega
/s/ Dr. Tomás Vega

By: Mr. P. Q. Navarro
/s/ P.Q. Navarro

By: Mr. K. L. de Soto
/s/ K. L. de Soto
K. L. de Soto signed for the Buyer.
`);

    for (const leaked of [
      "Tomás Vega",
      "Dr. Tomás Vega",
      "P. Q. Navarro",
      "P.Q. Navarro",
      "K. L. de Soto",
      "de Soto",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("does not redact organization names captured after signature markers as people", () => {
    const output = redact(`
By: Northwind Logistics, LLC
Name: Northwind Logistics, LLC
/s/ Northwind Holdings B.V.
By: Atlas Trading GmbH
`);

    expect(output).not.toContain("PERSON_");
    expect(output).not.toContain("Northwind Logistics");
    expect(output).not.toContain("Northwind Holdings B.V.");
    expect(output).not.toContain("Atlas Trading GmbH");
    expect(output).toContain("ORG_");
  });

  it("redacts numbered street addresses in notices and preamble prose", () => {
    // Registered-office and notices addresses commonly appear inline without a
    // leading unit indicator (e.g. "located at 1 Technology Drive, Suite C-515").
    const output = redact(`
The Company's principal office is at 1 Technology Drive, Irvine.
Send notices to 222 West Adams Street, Suite 400.
Deliveries: 11510 Dallas Parkway, Building 2.
The parties met at 22 Market Close. Section 12 remains unchanged.
`);

    for (const leaked of [
      "1 Technology Drive",
      "222 West Adams Street",
      "11510 Dallas Parkway",
      "22 Market Close",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("Section 12 remains unchanged.");
    expect(output).toContain("ADDRESS_");
  });

  // ---- Round 2: litigation / regulatory filings ----

  it("does not turn litigation/regulatory boilerplate into person redactions", () => {
    const output = redact(`
The Federal Trade Commission Act ("FTC Act") provides that the Commission
shall prevent unfair methods of competition. The Securities Exchange Act
of 1934 governs securities trading. The Commission has authority to bring
this action. Defendant in this matter violated the Exchange Act. The
Relief Defendant also profited. Firms engaged in deceptive practices.
Prayer for Relief is hereby requested.
`);

    // These boilerplate terms should remain readable, not be redacted as PERSON.
    expect(output).toContain("Commission Act");
    expect(output).toContain("Exchange Act");
    expect(output).toContain("Defendant");
    expect(output).toContain("Relief Defendant");
    expect(output).toContain("Firms");
    expect(output).not.toContain("PERSON_");
  });

  it("does not redact caption/heading lines as all-caps persons", () => {
    const output = redact(`
                             UNITED STATES OF AMERICA
                    BEFORE THE FEDERAL TRADE COMMISSION

FIRST CLAIM FOR RELIEF
(Unfair Methods of Competition)

PRAYER FOR RELIEF

JURISDICTION AND VENUE
`);

    // These are caption/heading boilerplate, not person names.
    expect(output).not.toContain("PERSON_");
  });

  it("redacts commissioner and judicial officer names in caption blocks", () => {
    const output = redact(`
COMMISSIONERS:          Maria E. Chen, Chair
                        Robert T. Johnston
                        Harriet K. Whitfield
                        James A. Patel
__________________________________________

In the Matter of
`);

    for (const leaked of [
      "Maria E. Chen",
      "Robert T. Johnston",
      "Harriet K. Whitfield",
      "James A. Patel",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("redacts all-caps party names in court captions with trailing roles", () => {
    const output = redact(`
UNITED STATES DISTRICT COURT
SOUTHERN DISTRICT OF NEW YORK

ALEXEI VOLKOV,
                                   Defendant,

and

MARIA SVEDLOVA,
                                   Relief Defendant.
`);

    for (const leaked of ["ALEXEI VOLKOV", "MARIA SVEDLOVA"]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("redacts names after litigation role labels in body text", () => {
    const output = redact(`
Plaintiff, Securities and Exchange Commission ("Commission"), for its
complaint against Defendant Alexei Volkov ("Volkov") and Relief Defendant
Maria Svedlova ("Svedlova"), alleges as follows:
`);

    for (const leaked of ["Alexei Volkov", "Maria Svedlova"]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("redacts SEC civil action and docket number formats", () => {
    const output = redact(`
Case 1:21-cv-07925 Document 1 Filed 09/23/21
Civ. No. 02-CV-4963 (JSR)
21 Civ. 7925 (LDH)
Civil Action No. 2:19-cv-05536
`);

    for (const leaked of [
      "1:21-cv-07925",
      "02-CV-4963",
      "21 Civ. 7925",
      "2:19-cv-05536",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("CASE_REF_");
  });

  it("redacts US 5-digit ZIP codes after state abbreviations", () => {
    const output = redact(`
The company is located at 123 Maple Street, Austin, TX 78701.
Send mail to 456 Oak Avenue, Chicago, IL 60601.
Branch office: 789 Pine Drive, Seattle, WA 98101.
The production reference PO 12345 remains useful.
Internal ID 98765 remains visible.
`);

    for (const leaked of ["TX 78701", "IL 60601", "WA 98101"]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PO 12345");
    expect(output).toContain("ID 98765");
    expect(output).toContain("POSTCODE_");
  });

  it("redacts person names with middle initials in contextual patterns", () => {
    // Names like "Mark R. Meador" were previously rejected because the all-caps
    // check treated the middle initial "R." as an uppercase token.
    const output = redact(`
COMMISSIONERS:          Lina M. Park, Chair
                        Mark R. Thompson
                        James P. O'Brien
`);

    for (const leaked of [
      "Lina M. Park",
      "Mark R. Thompson",
      "James P. O'Brien",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("does not suppress multi-word names containing ambiguous first-name tokens", () => {
    // Words like "Mark", "Rose", "Will" are in AMBIGUOUS_PERSON_TOKENS for
    // single-token detection, but should NOT block multi-word names.
    const output = redact(`
Defendant Mark Henderson was charged with fraud.
Plaintiff Rose Calloway filed the complaint.
Witness Will Drummond testified before the court.
`);

    for (const leaked of ["Mark Henderson", "Rose Calloway", "Will Drummond"]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("does not redact address lines in caption blocks as party names", () => {
    const output = redact(`
BARRY RICHARD KUSATZKY,                  :
500 PEMBROOK COURT NORTH,                : 1:04CV00700(JGP)(D.D.C.)
CRYSTAL LAKE, IL 60014                   :
                  Defendant.             :
`);

    // The name should be redacted as a person.
    expect(output).not.toContain("BARRY RICHARD KUSATZKY");
    // The place name "CRYSTAL LAKE" should not be mislabeled as a person.
    // (It may appear unredacted because all-caps address detection is limited.)
    expect(output).not.toMatch(/\bCRYSTAL LAKE\b[\s,]+PERSON_/);
    expect(output).toContain("PERSON_");
  });

  it("does not let company names ending in org suffixes block alias generation", () => {
    // When a company like "Northwind Inc" is caught as PERSON by a litigation
    // role pattern, it should not prevent the standalone "Northwind" from
    // being redacted via alias generation.
    const output = redact(`
Respondent Northwind Inc. is a corporation.
by Northwind from 2018 to 2020.
Northwind failed to implement security measures.
`);

    // The standalone "Northwind" should be redacted (as PERSON or ORG).
    expect(output).not.toContain("Northwind");
  });

  it("redacts uppercase organization suffixes in litigation party references", () => {
    const output = redact(`
Respondent NORTHWIND TRADING LTD filed an answer.
Defendant ALPINE SYSTEMS LIMITED appeared by counsel.
Relief Defendant RIVERSTONE CAPITAL CORP consented.
`);

    for (const leaked of [
      "NORTHWIND TRADING LTD",
      "ALPINE SYSTEMS LIMITED",
      "RIVERSTONE CAPITAL CORP",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("ORG_");
  });
});

describe("interactive review model", () => {
  it("exposes the redaction engine version used for a review", () => {
    const result = redactDocuments(
      [{ name: "sample.md", text: "Ada Stone signed." }],
      { level: "balanced" },
    );

    expect(result.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("builds replacement entries across multiple documents with stable metadata", () => {
    const result = redactDocuments(
      [
        {
          name: "alpha.md",
          text: "Ada Stone, Beta Lee, and Cara Ng attended.",
        },
        { name: "beta.md", text: "Ada Stone, Beta Lee, and Cara Ng joined." },
      ],
      { level: "balanced" },
    );

    const person = result.entries.find((entry) => entry.value === "Ada Stone");
    expect(person).toMatchObject({
      kind: "PERSON",
      manual: false,
    });
    expect(person?.replacement).toMatch(/^PERSON_/);
    expect(person?.sources).toContain("alpha.md");
    expect(person?.sources).toContain("beta.md");
    expect(person?.count).toBeGreaterThanOrEqual(2);
    expect(person?.id).toBe("PERSON:Ada%20Stone");
  });

  it("counts replacement entries only when they apply to the selected level", () => {
    const result = redactDocuments(
      [
        {
          name: "sample.md",
          text: "Contact ada@example.com before 2026-02-14.",
        },
      ],
      { level: "light" },
    );

    const email = result.entries.find((entry) => entry.kind === "EMAIL");
    const date = result.entries.find(
      (entry) => entry.kind === "DATE" && entry.value === "2026-02-14",
    );

    expect(email?.count).toBe(1);
    expect(date?.level).toBe("balanced");
    expect(date?.count).toBe(0);
  });

  it("applies user-edited replacements while hiding the original", () => {
    const first = redactDocuments(
      [{ name: "sample.md", text: "Ada Stone, Beta Lee, and Cara Ng signed." }],
      { level: "balanced" },
    );
    const ada = first.entries.find((entry) => entry.value === "Ada Stone")!;

    const second = redactDocuments(
      [{ name: "sample.md", text: "Ada Stone, Beta Lee, and Cara Ng signed." }],
      { level: "balanced", entries: [{ ...ada, replacement: "A" }] },
    );

    expect(second.combinedMarkdown).toContain("A,");
    expect(second.combinedMarkdown).not.toContain("Ada Stone");
  });

  it("restores the original when an entry is deleted", () => {
    const first = redactDocuments(
      [{ name: "sample.md", text: "Ada Stone, Beta Lee, and Cara Ng signed." }],
      { level: "balanced" },
    );
    const ada = first.entries.find((entry) => entry.value === "Ada Stone")!;

    const second = redactDocuments(
      [{ name: "sample.md", text: "Ada Stone, Beta Lee, and Cara Ng signed." }],
      { level: "balanced", removedEntryIds: [ada.id] },
    );

    expect(second.combinedMarkdown).toContain("Ada Stone,");
    expect(second.entries.find((entry) => entry.id === ada.id)).toBeUndefined();
  });

  it("matches manual entries case-insensitively as exact phrases", () => {
    const result = redactDocuments(
      [{ name: "sample.md", text: "Acme Ltd met ACME LTD." }],
      {
        level: "light",
        entries: [
          {
            id: "manual:acme-ltd",
            value: "Acme Ltd",
            replacement: "CLIENT",
            kind: "CUSTOM",
            level: "light",
            reason: "manual",
            sources: ["manual"],
            count: 0,
            manual: true,
            matchCase: false,
          },
        ],
      },
    );

    expect(result.combinedMarkdown).toContain("CLIENT met CLIENT.");
    expect(result.combinedMarkdown).not.toContain("Acme Ltd");
    expect(result.combinedMarkdown).not.toContain("ACME LTD");
  });

  it("treats legacy custom terms as case-insensitive manual entries", () => {
    const result = redactDocuments(
      [{ name: "sample.md", text: "Acme Ltd met ACME LTD." }],
      { level: "light", customTerms: ["Acme Ltd"] },
    );

    const custom = result.entries.find((entry) => entry.value === "Acme Ltd");
    expect(custom).toMatchObject({
      kind: "CUSTOM",
      manual: true,
      matchCase: false,
    });
    expect(result.combinedMarkdown).toContain("CUSTOM_001 met CUSTOM_001.");
    expect(result.combinedMarkdown).not.toContain("Acme Ltd");
    expect(result.combinedMarkdown).not.toContain("ACME LTD");
  });

  it("prefers manual entries over automatic entries and longer phrases over shorter", () => {
    const result = redactDocuments(
      [{ name: "sample.md", text: "Reach out to Northwind Trading today." }],
      {
        level: "balanced",
        entries: [
          {
            id: "manual:northwind-trading",
            value: "Northwind Trading",
            replacement: "THE_CLIENT",
            kind: "CUSTOM",
            level: "balanced",
            reason: "manual",
            sources: ["manual"],
            count: 0,
            manual: true,
            matchCase: false,
          },
        ],
      },
    );

    expect(result.combinedMarkdown).toContain("THE_CLIENT today.");
    expect(result.combinedMarkdown).not.toContain("Northwind Trading");
  });

  it("exposes preview segments with original and replacement metadata", () => {
    const result = redactDocuments(
      [
        {
          name: "sample.md",
          text: "Ada Stone, Beta Lee, and Cara Ng attended.",
        },
      ],
      { level: "balanced" },
    );
    const doc = result.documents[0];
    const redacted = doc.segments.filter((segment) => segment.entryId);

    expect(redacted.length).toBeGreaterThanOrEqual(2);
    expect(redacted[0]).toHaveProperty("value");
    expect(redacted[0]).toHaveProperty("replacement");
    expect(doc.segments.some((segment) => segment.value === "Ada Stone")).toBe(
      true,
    );
    expect(
      redacted.some(
        (segment) =>
          segment.value === "Ada Stone" &&
          segment.text === segment.replacement &&
          segment.entryId,
      ),
    ).toBe(true);
  });

  it("preserves edited replacements when more documents are added", () => {
    const first = redactDocuments(
      [{ name: "one.md", text: "Ada Stone, Beta Lee, and Cara Ng signed." }],
      { level: "balanced" },
    );
    const ada = first.entries.find((entry) => entry.value === "Ada Stone")!;

    const second = redactDocuments(
      [
        { name: "one.md", text: "Ada Stone, Beta Lee, and Cara Ng signed." },
        { name: "two.md", text: "Ada Stone, Beta Lee, and Cara Ng replied." },
      ],
      { level: "balanced", entries: [{ ...ada, replacement: "A" }] },
    );

    expect(second.combinedMarkdown).not.toContain("Ada Stone");
    expect(second.combinedMarkdown).toContain("A,");
    expect(
      second.entries.find((entry) => entry.id === ada.id)?.replacement,
    ).toBe("A");
    expect(
      second.entries.find((entry) => entry.id === ada.id)?.sources,
    ).toContain("two.md");
  });

  it("keeps per-document and combined markdown exports free of active originals", () => {
    const result = redactDocuments(
      [
        {
          name: "alpha.md",
          text: "Ada Stone, Beta Lee, and Cara Ng attended.",
        },
        { name: "beta.md", text: "Ada Stone, Beta Lee, and Cara Ng joined." },
      ],
      { level: "balanced" },
    );

    for (const doc of result.documents) {
      expect(doc.sanitized).not.toContain("Ada Stone");
      expect(doc.sanitized).not.toContain("Beta Lee");
    }
    expect(result.combinedMarkdown).not.toContain("Ada Stone");
    expect(result.combinedMarkdown).not.toContain("Beta Lee");
    expect(result.combinedMarkdown).toContain("## Document: Document 001");
    expect(result.combinedMarkdown).toContain("## Document: Document 002");
  });

  // ---- Round 3: correspondence and operational business documents ----

  it("redacts SEC file numbers, registration numbers, and accession numbers", () => {
    const output = redact(`
File No. 333-124741
File No. 0-18225
File Nos. 333-214419 and 811-23211
Registration No. 333-265967
Registration Nos. 281901 and 282334
Accession 0001193125-17-033610 filed today.
`);

    for (const leaked of [
      "333-124741",
      "0-18225",
      "333-214419",
      "811-23211",
      "333-265967",
      "281901",
      "282334",
      "0001193125-17-033610",
    ]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("does not redact ordinary dddd-ddddd figures lacking a filing label", () => {
    // Counterexample: a plain 4-2 figure (e.g. a version or PO reference) must
    // remain readable when no File/Registration label anchors it.
    const output = redact(`
The internal build 2024-12 shipped on schedule.
Reference PO 12345 was noted in the ledger.
`);

    expect(output).toContain("2024-12");
    expect(output).toContain("12345");
  });

  it("redacts correspondence header labels (From/To/Cc/Re/File No/Registration/Direct/Fax)", () => {
    const output = redact(`
From: Orion Vance
To: Dana Frost
Cc: Morgan Reye
Re: Project Lighthouse
File No. 001-39940
Registration No. 333-901023
Direct Dial No.: (212) 555-0148
Fax: (212) 555-0149
Email: orion@example.com
`);

    for (const leaked of [
      "Orion Vance",
      "Dana Frost",
      "Morgan Reye",
      "orion@example.com",
      "001-39940",
      "333-901023",
      "(212) 555-0148",
      "(212) 555-0149",
    ]) {
      expect(output).not.toContain(leaked);
    }
  });

  it("redacts every name in a multi-line Attention/Attn block", () => {
    const output = redact(`
Attention:    Mr. Tyler Hale
Ms. Laura Crane
Ms. Christine Tate
Ms. Lynn Drake

Dear Mr. Hale:
`);

    for (const leaked of [
      "Tyler Hale",
      "Laura Crane",
      "Christine Tate",
      "Lynn Drake",
    ]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
  });

  it("does not stitch names across newlines in title-led name lists", () => {
    // Regression: the title pattern used to cross newlines, turning
    // "Mr. Tyler Hale\nMs. Laura Crane" into a bogus "Tyler Hale Ms" candidate
    // and leaking "Laura Crane".
    const output = redact(`
Attn: Mr. Tyler Hale
Ms. Laura Crane
`);

    expect(output).not.toContain("Tyler Hale");
    expect(output).not.toContain("Laura Crane");
    expect(output).not.toContain("Tyler Hale Ms");
  });

  it("redacts a lawyer addressed by bare surname with the Esq. suffix", () => {
    const output = redact(`
Dear Thompson, Esq.:
Re: matter for review.
`);

    expect(output).not.toContain("Thompson");
    expect(output).toContain("PERSON_");
  });

  it("matches names across non-breaking spaces emitted by HTML-to-text conversion", () => {
    // The \u00A0 between title and surname must not break replacement.
    const output = redact(`
Attn: Ms. Anu Dubey
Dear Ms.\u00A0Dubey:
`);

    expect(output).not.toContain("Anu Dubey");
    expect(output).not.toContain("Dubey");
  });

  it("does not turn prospectus headings and table column labels into person redactions", () => {
    const output = redact(`
Risk Factors
Use of Proceeds
Table of Contents
Balance Sheet Data
Cash Equivalents
Certain Relationships and Related Transactions
Senior Vice President, Corporate Controller
Staff Attorney
Our Strategy and Opportunity
Investment Objectives and Transaction Processing
`);

    for (const kept of [
      "Risk Factors",
      "Use of Proceeds",
      "Table of Contents",
      "Balance Sheet Data",
      "Cash Equivalents",
      "Staff Attorney",
      "Senior Vice President",
      "Our Strategy",
    ]) {
      expect(output).toContain(kept);
    }
  });

  it("does not redact all-caps section headings as party names", () => {
    const output = redact(`
RISK FACTORS
USE OF PROCEEDS
TABLE OF CONTENTS
MANAGEMENT'S DISCUSSION AND ANALYSIS
SCOPE AND TRANSFERABILITY
`);

    for (const kept of [
      "RISK FACTORS",
      "USE OF PROCEEDS",
      "TABLE OF CONTENTS",
      "SCOPE AND TRANSFERABILITY",
    ]) {
      expect(output).toContain(kept);
    }
  });

  it("does not turn company names ending in organization tail tokens into person redactions", () => {
    // "Cisco Systems" etc. must not become a PERSON candidate, which previously
    // leaked a bogus given-name alias "Cisco" into surrounding prose.
    const output = redact(`
The letter was sent to Cisco Systems and copied to Pegasus Airlines.
Cisco later confirmed the response.
Acme Industries attended alongside Dover Partners.
`);

    expect(output).not.toMatch(/PERSON_[0-9]/);
    // The standalone short-form org token is not mis-redacted as a person.
    expect(output).toContain("Cisco");
  });

  it("does not redact generic management headings as organizations", () => {
    const output = redact(`
Risk Management
Capital Management
Investment Management
Account Management

The company described its risk management program.
`);

    for (const kept of [
      "Risk Management",
      "Capital Management",
      "Investment Management",
      "Account Management",
    ]) {
      expect(output).toContain(kept);
    }
  });

  it("keeps contact role labels after titled names and catches quay addresses", () => {
    const output = redact(`
This letter is sent to Northwind Logistics PLC, attention Mr. Aldo Brennan, Group General Counsel.
The registered office is at 18 Harbourgate Quay, Belfast BT1 3XD, United Kingdom.
`);

    expect(output).not.toContain("Aldo Brennan");
    expect(output).not.toContain("18 Harbourgate Quay");
    expect(output).not.toContain("Harbourgate Quay");
    expect(output).toContain("Group General Counsel");
    expect(output).not.toContain("Mr. PERSON_");
    expect(output).not.toContain("PERSON_002 Quay");
  });

  it("still redacts genuine people whose surname is also a contract word", () => {
    // Counterexample to the structural-token rules: a real person like
    // "Jordan Price" or "Patrick Cash" must still be redacted when titled.
    const output = redact(`
Mr. Jordan Price submitted the filing.
Ms. Patrick Cash reviewed the schedules.
`);

    expect(output).not.toContain("Jordan Price");
    expect(output).not.toContain("Patrick Cash");
  });
});
