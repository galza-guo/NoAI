# Redaction Corpus Rounds

This note proposes three public-document rounds for redaction engine refinement before release.

The goal is not to commit real documents into this repository. Use the public sources below as working inputs, record misses as synthetic regression cases, and commit only synthetic examples that preserve the pattern without preserving real private facts.

## Selection Rules

- Prefer born-digital HTML, text, or clean text-based PDFs over scanned documents.
- Favor ordinary business/legal language: contracts, regulatory complaints, SEC correspondence, offer letters, and business email.
- Capture failures as small synthetic tests in `src/redactor/engine.test.ts`.
- Do not add client documents, leaked documents, random uploaded personal files, or unlicensed private samples.
- Treat Enron email as useful but privacy-sensitive. If used, use a small manually reviewed subset and do not commit raw messages.

## Round 1: Commercial Contracts

Purpose: stress party names, company suffixes, addresses, dates, money, percentages, defined terms, signatures, exhibit references, and agreement-specific project/product names.

| # | Type | Source Document | Why It Helps |
| - | ---- | --------------- | ------------ |
| 1 | Lease | [Jones Soda lease agreement](https://www.sec.gov/Archives/edgar/data/1083522/000108352215000003/jsda-20150106ex102ed9c45.htm) | Landlord/tenant parties, premises address, dates, lease terms. |
| 2 | Lease | [PC Connection lease agreement](https://www.sec.gov/Archives/edgar/data/1050377/000119312514392040/d783151dex101.htm) | Multiple addresses, entity suffixes, article headings. |
| 3 | Employment | [RegeneCa employment agreement](https://www.sec.gov/Archives/edgar/data/1056598/000107878212000508/f8ka022212_ex10z1.htm) | Individual employee, company address, compensation terms. |
| 4 | Consulting | [SeaStar Medical consulting agreement](https://www.sec.gov/Archives/edgar/data/1831868/000143774925035449/ex_886639.htm) | Contractor name, dates, services, medical-company context. |
| 5 | Consulting | [Fossil Group consulting agreement](https://www.sec.gov/Archives/edgar/data/883569/000110465924033924/tm248665d1_ex10-1.htm) | Public-company executive name and formal signature blocks. |
| 6 | Share purchase | [Share sale and purchase agreement](https://www.sec.gov/Archives/edgar/data/56978/000005697815000022/exhibit101sharesaleandpurc.htm) | Seller/buyer/company roles, share counts, EUR amounts. |
| 7 | Registration rights | [American Capital registration rights agreement](https://www.sec.gov/Archives/edgar/data/1423689/000119312508177761/dex101.htm) | Securities terms, party aliases, defined terms. |
| 8 | Credit | [AVITA Medical credit agreement](https://www.sec.gov/Archives/edgar/data/1762303/000095017023053882/rcel-ex10_1.htm) | Borrower/lender/agent roles, tables of contents, financial terms. |
| 9 | Supply | [GATX supply agreement](https://www.sec.gov/Archives/edgar/data/40211/000095012311040176/c63344exv10w1.htm) | Buyer/seller entities, product context, effective dates. |
| 10 | Distribution | [Navy Wharf master distribution agreement](https://www.sec.gov/Archives/edgar/data/1938046/000164117225000525/ex10-1.htm) | Supplier/distributor roles, brand and product names. |
| 11 | Merger | [Outdoor Specialty Products merger agreement](https://www.sec.gov/Archives/edgar/data/1610718/000107878221000593/f10061621_ex10z1.htm) | State names, corporate domicile, stockholder references. |
| 12 | License/royalty | [Outdoor Specialty Products license and royalty agreement](https://www.sec.gov/Archives/edgar/data/1610718/000107878221000593/f10061621_ex10z3.htm) | Licensor/licensee individual, product mark, royalty amounts. |

Expected output from the round: 10-20 synthetic tests covering missed direct identifiers and over-redacted legal boilerplate.

## Round 2: Litigation And Regulatory Filings

Purpose: stress captions, docket numbers, government agency names, party lists, addresses, public officials, complaint sections, consent orders, and case citations.

| # | Type | Source Document | Why It Helps |
| - | ---- | --------------- | ------------ |
| 1 | FTC complaint | [InMarket Media complaint](https://www.ftc.gov/system/files/ftc_gov/pdf/InMarketMedia-Complaint.pdf) | FTC caption, docket number, company respondent, privacy allegations. |
| 2 | FTC complaint | [GoDaddy complaint](https://www.ftc.gov/system/files/ftc_gov/pdf/GoDaddy-Complaint.pdf) | Multiple respondents, corporate suffixes, cybersecurity vocabulary. |
| 3 | FTC complaint | [Fashion Nova complaint](https://www.ftc.gov/system/files/documents/cases/192_3138_fashion_nova_complaint.pdf) | Consumer-brand name, docket fields, complaint style. |
| 4 | FTC order package | [Instant Brands final consent order](https://www.ftc.gov/system/files/ftc_gov/pdf/2223140instantbrandsfinalconsent.pdf) | Consent-order structure and defined respondent terms. |
| 5 | FTC consent agreement | [DoNotPay agreement containing consent order](https://www.ftc.gov/system/files/ftc_gov/pdf/DoNotPayInc-ACCO.pdf) | Proposed respondent, formal notice language, legal dates. |
| 6 | SEC complaint | [WorldCom complaint](https://www.sec.gov/litigation/complaints/comp17829.htm) | Securities complaint in HTML, company/person/court terms. |
| 7 | SEC complaint | [Polevikov complaint](https://www.sec.gov/litigation/complaints/2021/comp-pr2021-186.pdf) | Case caption with plaintiff/defendant/relief defendant names. |
| 8 | SEC complaint | [Levoff complaint](https://www.sec.gov/litigation/complaints/2019/comp-pr2019-10.pdf) | Individual defendant, locations, securities-trading context. |
| 9 | SEC complaint | [Kusatzky complaint](https://www.sec.gov/litigation/complaints/comp18688.pdf) | Address-heavy first page and civil action number. |
| 10 | DOJ complaint | [United States v. Microsoft complaint](https://www.justice.gov/atr/complaint-us-v-microsoft-corp) | HTML complaint, antitrust terms, defendant company references. |
| 11 | DOJ judgment | [United States v. General Electric proposed final judgment](https://www.justice.gov/atr/proposed-final-judgment-and-competitive-impact-statement-us-v-general-electric-company) | Definitions, civil action context, divestiture terms. |
| 12 | DOJ complaint | [JetBlue/Spirit complaint](https://www.justice.gov/d9/press-releases/attachments/2023/03/07/001_-_complaint_jb_0.pdf) | Modern antitrust complaint, airlines, case number, exhibits. |

Expected output from the round: better case/docket coverage, fewer false positives on agency boilerplate, stronger party/caption detection.

## Round 3: Correspondence And Operational Business Documents

Purpose: stress email headers, letterheads, attention lines, sender/recipient blocks, phone/fax/email fields, file numbers, business addresses, offer terms, and short informal prose.

| # | Type | Source Document | Why It Helps |
| - | ---- | --------------- | ------------ |
| 1 | SEC correspondence | [PIMCO Flexible Credit Income Fund response letter](https://www.sec.gov/Archives/edgar/data/1688554/000119312517033610/filename1.htm) | Law-firm letterhead, phone/fax/email, file numbers. |
| 2 | SEC correspondence | [Cisco 2021 response letter](https://www.sec.gov/Archives/edgar/data/858877/000119312521297041/filename1.htm) | Corporate sender, SEC staff addressees, filing references. |
| 3 | SEC correspondence | [Cisco 2018 response letter](https://www.sec.gov/Archives/edgar/data/858877/000119312518014229/filename1.htm) | Address line, direct phone/fax fields, SEC comment format. |
| 4 | SEC correspondence | [Invizyne Technologies counsel letter](https://www.sec.gov/Archives/edgar/data/2010788/000149315224042469/filename1.htm) | Modern counsel correspondence with names and registration numbers. |
| 5 | SEC correspondence | [Gulf Chronic Care response letter](https://www.sec.gov/Archives/edgar/data/1762400/000149315219005903/0001493152-19-005903.txt) | Plain-text filing with duplicated addressee blocks. |
| 6 | SEC correspondence | [Helios Total Return Fund response letter](https://www.sec.gov/Archives/edgar/data/851169/000119312512009133/filename2.htm) | Attorney contact line, file numbers, fund name. |
| 7 | SEC correspondence | [TRX SEC correspondence](https://www.sec.gov/Archives/edgar/data/1103025/000119312505126600/filename36.htm) | IPO/S-1 response style and staff name references. |
| 8 | SEC correspondence | [Williams Pipeline response letter](https://www.sec.gov/Archives/edgar/data/1411583/000095012907005147/filename1.htm) | Partnership names, registration statement file number. |
| 9 | Offer letter | [Expedia offer letter in SEC filing text](https://www.sec.gov/Archives/edgar/data/1095357/000103221099001538/0001032210-99-001538.txt) | Individual address, salary/equity terms, conversational business letter. |
| 10 | SEC correspondence | [Intermountain Refining response letter](https://www.sec.gov/Archives/edgar/data/1084597/000108459706000014/0001084597-06-000014.txt) | Older plain-text filing with business address and comment-letter references. |
| 11 | SEC correspondence | [SonoSite response letter](https://www.sec.gov/Archives/edgar/data/1055355/0001288794-05-000058.txt) | Medical-device company correspondence with address and filing references. |
| 12 | SEC correspondence | [Allegro Beauty Products response letter](https://www.sec.gov/Archives/edgar/data/1689490/000107878217000298/0001078782-17-000298.txt) | Small-company correspondence with business and mailing addresses. |

Expected output from the round: better label-value detection for correspondence, less leakage from filenames/letterheads, and safer handling of email header fields.

Optional email source: [CMU Enron Email Dataset](https://www.cs.cmu.edu/~enron/) is useful for plain-text email headers and everyday workplace prose, but treat it as privacy-sensitive. Before using it, read the [EDRM Enron PII-cleansing notes](https://enrondata.readthedocs.io/en/latest/data/edrm-enron-email-datasets/) and manually review any selected messages. The [SEC guide to EDGAR correspondence](https://www.sec.gov/answers/edgarletters.htm) is a good way to find more `CORRESP` and `UPLOAD` substitutes without reaching for Enron.

## Suggested Round Workflow

For each document:

1. Convert it to plain text or Markdown using the same browser path NoAI supports when practical.
2. Run Light, Balanced, and Heavy.
3. Record missed sensitive values and damaging over-redactions in a scratch note outside the repo.
4. Convert each generalizable miss into a small synthetic test.
5. Tune rules only after at least two examples show the same pattern, unless the miss is obvious and high-risk.

The best release signal is not "all public documents fully anonymized." It is "the same classes of identifiers are caught repeatedly, and failures are represented by readable synthetic tests."
