import { describe, expect, it } from "vitest";
import { redactDocuments } from "./engine";
import { RedactionLevel } from "./types";

function redact(text: string, level: RedactionLevel = "balanced", customTerms: string[] = []): string {
  return redactDocuments([{ name: "sample.md", text }], { level, customTerms }).combinedMarkdown;
}

describe("deterministic redaction engine", () => {
  it("does not leak original filenames into redacted exports", () => {
    const result = redactDocuments(
      [{ name: "Private Client JV Agreement.docx", text: "This document has no sensitive body text." }],
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

    for (const leaked of ["MarketPilot", "RAVENMOTO", "李小明", "卢卡斯", "所订立"]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("Products, Territory, and Net Profit remain useful defined terms.");
    expect(output).toContain("All other off-road motorcycle products remain readable.");
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

    for (const leaked of ["Li Rivers", "Blake Stone", "held by Li", "held by Blake", "Blake's Response", "Response to Blake", "RAVENMOTO INTERNATIONAL", "RAVENBIKE"]) {
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

    for (const leaked of ["Kodera", "Wingtech", "KOUJI KODERA", "Michael Li", "Jenny Chan", "Jenny", "Li further"]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain("PERSON_");
    expect(output).toContain("ORG_");
  });

  it("redacts labelled legal contact details without breaking slash-separated addresses", () => {
    const output = redact(`
Address: 12/F, Gloucester Tower / 15 Queen's Road Central
Attention: Douglas Clark / Kevin Siu / Jacqueline Leung
Email: douglas@example.com; kevin@example.com
Ref: HKIAC/A25088
`);

    for (const leaked of ["Gloucester Tower", "Queen's Road", "Douglas Clark", "Kevin Siu", "Jacqueline Leung", "douglas@example.com", "kevin@example.com"]) {
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

    expect(output).toContain("management team later reviewed the market information");
    expect(output).toContain("financing information was later updated by management");
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
    const output = redact("The private codename is Velvet Lantern.", "light", ["Velvet Lantern"]);

    expect(output).not.toContain("Velvet Lantern");
    expect(output).toContain("CUSTOM_001");
  });
});
