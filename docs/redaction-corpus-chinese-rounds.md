# Chinese Redaction Development Corpus Rounds

This note seeds public Chinese development-corpus rounds for the Chinese
redaction detector. These documents are development material, not a sealed NAIR
benchmark and not a training set to overfit.

Do not commit raw PDFs, HTML captures, extracted Markdown, model annotations, or
real public values copied from these documents. Convert general findings into
small synthetic tests.

Retrieved seed links: 2026-06-18.

## Selection Rules

- Prefer public, born-digital, text-extractable Chinese documents.
- Favor documents with real labels: `统一社会信用代码`, `法定代表人`,
  `住所`, `注册地址`, `联系人`, `联系电话`, `合同金额`, `经办律师`,
  `签字会计师`, and `项目编号`.
- Include some mixed Chinese-English material because real documents often mix
  Chinese names with English URLs, emails, stock codes, and Latin company names.
- Avoid blank templates as primary inputs, but keep a few templates for
  counterexamples.
- Do not use private client documents or leaked personal files.

## Round 1: Mainland Corporate Disclosure And Finance Documents

Purpose: stress organization suffixes, responsible-person labels, dates, RMB
amounts, addresses, phone numbers, emails, professional-service signatories, and
unified social credit codes.

| # | Type | Source Document | Why It Helps |
| - | ---- | --------------- | ------------ |
| 1 | IPO prospectus | [广东金戈新材料股份有限公司招股说明书](https://dataclouds.cninfo.com.cn/sjother2/documents/2026/2026-05-28/3cabc2a438cb4b017738c42ac77a8329.pdf) | Dense table-like fields for institutions, legal representatives, registration addresses, phone/fax, lawyers, accountants, and social credit codes. |
| 2 | Listing announcement | [重庆至信实业股份有限公司首次公开发行股票主板上市公告书](https://big5.sse.com.cn/site/cht/www.sse.com.cn/disclosure/listedinfo/announcement/c/new/2026-01-14/603352_20260114_GE8P.pdf) | Public-company contact blocks, investor-relations phone/email, controlling shareholder tables, addresses, and Chinese dates. |
| 3 | IPO prospectus | [长鑫科技集团股份有限公司招股说明书](https://static.sse.com.cn/stock/disclosure/announcement/c/202605/002170_20260527_23QQ.pdf) | Long modern prospectus with company names, technical project names, funding amounts, and securities disclosure boilerplate. |
| 4 | IPO prospectus | [企查查科技股份有限公司招股说明书申报稿](https://dataclouds.cninfo.com.cn/sjother2/documents/2026/20260331/1a3e747adb944f419c6a8c608236e39d.pdf) | Mixed business prose, product names, signatures, lawyers, accountants, app/H5 references, and many table fragments. |
| 5 | Listing sponsor letter | [中信证券关于宇树科技股份有限公司首次公开发行股票上市保荐书](https://dataclouds.cninfo.com.cn/sjother2/documents/2026/2026-05-25/4f2e6f3a3f10cb28e233f84a17f11dc9.pdf) | Contact labels, issuer details, securities-service organization names, project people, and bilingual-ish tech/company terms. |
| 6 | Asset-management contract | [西部恒通X号定向资产管理计划资产管理合同](https://static.cninfo.com.cn/finalpage/2016-12-01/1202853834.PDF) | Contract-party labels, office address, legal representative, contact person, phone number, account-like finance fields, and rights/obligations boilerplate. |
| 7 | Legal opinion | [福建天衡联合律师事务所关于厦门陆海环保股份有限公司股票定向发行的法律意见书](https://static.cninfo.com.cn/finalpage/2022-05-06/1213287727.PDF) | Law-firm signature pages, lawyers, legal-opinion boilerplate, issuer/entity details, and formal Chinese legal phrasing. |
| 8 | Related-party finance report | [上海汽车集团关于上海汽车集团财务有限责任公司2025年风险评估报告](https://static.cninfo.com.cn/finalpage/2026-04-02/1225071787.PDF) | Financial-license identifiers, social credit code labels, legal representative labels, registered address, and finance-company terminology. |

Expected output from Round 1:

- Synthetic tests for social credit codes, Chinese dates, RMB units, legal
  representative labels, address labels, law-firm/accounting-firm suffixes, and
  organization suffixes.
- Counterexamples for generic disclosure boilerplate such as `董事会报告`,
  `重要提示`, `风险因素`, and `经营范围`.

## Round 2: Procurement, Contracts, And Public Notices

Purpose: stress government-procurement notices, contact fields, project IDs,
contract IDs, amounts, suppliers, public agencies, and phone numbers.

| # | Type | Source Document | Why It Helps |
| - | ---- | --------------- | ------------ |
| 1 | Procurement contract notice | [淮安市政府采购网医疗设备采购合同公告](https://czj.huaian.gov.cn/col/7644_475461/content/17775648/ff8080819e65aa6a019e6781a1dc0001.html) | Compact HTML fields for project number, contract number, supplier, social credit code, date, amount, and linked notice title. |
| 2 | Procurement notice | [中央民族大学海南国际学院智能化补充设备购置及门禁系统项目竞争性磋商公告](https://muchnic.muc.edu.cn/info/1022/2111.htm) | Purchaser and agency names, addresses, contact people, mobile numbers, procurement-source boilerplate, and section headings. |
| 3 | Central government procurement notice | [全国组织机构统一社会信用代码数据服务中心2026年软硬件集成采购项目](https://www.zycg.gov.cn/freecms/site/zygjjgzfcgzx/ggxx/info/2026/1117e078-cc25-4ad4-a267-dd3e020a0612.html?id=d8c1e0cf-1b92-11f1-9615-fa163ee0ead6) | Project number, procurement method, budget amount, agency language, and government-procurement boilerplate. |
| 4 | Government procurement template | [政府采购招标文件](https://guizhou.chinatax.gov.cn/xxgk/zfcg/zbgg/201807/W020190219433442813236.pdf) | Useful counterexamples and form labels for supplier name, legal representative, social credit code, contact phone, bank account, and blank fields. |

Expected output from Round 2:

- Synthetic tests for `项目编号`, `合同编号`, `供应商`, `中标供应商统一社会信用代码`,
  `合同总金额`, and contact labels.
- Counterexamples proving procurement boilerplate stays readable.

## Round 3: Regulatory Enforcement And Administrative Decisions

Purpose: stress administrative penalty numbers, party labels, partially masked
people, firm names, social credit codes, addresses, dates, law references, and
agency boilerplate.

| # | Type | Source Document | Why It Helps |
| - | ---- | --------------- | ------------ |
| 1 | CSRC penalty decision | [中国证券监督管理委员会上海监管局行政处罚决定书沪〔2025〕32号](https://www.csrc.gov.cn/shanghai/c103864/c7599378/content.shtml) | Party fields, social credit code,住所, partially masked people, Chinese regulatory case number, and hearing dates. |
| 2 | CSRC penalty decision | [中国证券监督管理委员会上海监管局行政处罚决定书沪〔2026〕10号](https://www.csrc.gov.cn/shanghai/c103864/c7637347/content.shtml) | Dense regulatory prose with company respondent, social credit code, address, dates, and administrative-process boilerplate. |
| 3 | CSRC penalty decision | [中国证券监督管理委员会上海监管局行政处罚决定书沪〔2026〕1号](https://www.csrc.gov.cn/shanghai/c103864/c7610775/content.shtml) | Multiple respondent organizations in one opening block, social credit codes, addresses, and abbreviated organization aliases. |
| 4 | SAMR penalty page | [国家市场监督管理总局行政处罚文书网样本文书](https://cfws.samr.gov.cn/detail.html?docid=520100019055777889) | Market-supervision format with respondent, business license/social credit code, venue, phone, and legal representative labels. |

Expected output from Round 3:

- Synthetic tests for administrative document numbers such as `沪〔2026〕10号`,
  `当事人`, `住所`, `住址`, `法定代表人`, and masked person references.
- Counterexamples for law names and public agency boilerplate.

## Round 4: Hong Kong And Traditional Chinese

Purpose: test Traditional Chinese, mixed English/Chinese names, Hong Kong
issuer reports, board-member sections, dates written in Chinese numerals, and
finance tables.

| # | Type | Source Document | Why It Helps |
| - | ---- | --------------- | ------------ |
| 1 | HKEX annual report | [騰訊控股二零二四年年報](https://www.hkexnews.hk/listedco/listconews/sehk/2025/0408/2025040800668_c.pdf) | Traditional Chinese board/officer names, date phrasing, equity-award tables, English personal names, and Hong Kong disclosure boilerplate. |
| 2 | HKEX annual report | [Prada Group二零二五年年報](https://www.hkexnews.hk/listedco/listconews/sehk/2026/0401/2026040102413_c.pdf) | Traditional Chinese plus Italian/English names, family relationship disclosures, group entities, and finance tables. |

Expected output from Round 4:

- Decide whether Traditional Chinese belongs in the first beta or in a follow-up
  pass.
- Synthetic tests for `董事`, `高級管理層`, Chinese numeral dates, and mixed
  Latin/Chinese names only if rules can be kept general.

## Worker Loop

For each round:

1. Download source documents into a private ignored scratch folder, not the repo.
2. Extract text through the same browser/PDF path when possible.
3. Run current NoAI at Light, Balanced, and Heavy.
4. Ask GLM to list omissions and harmful over-redactions.
5. Convert only general patterns into synthetic tests.
6. Patch deterministic rules.
7. Delete scratch source files before finishing.

## First-Day Target

Start with Round 1 documents 1, 2, 6, and Round 2 documents 1 and 2. That gives
a manageable mix of long PDF, short listing announcement, contract, HTML
contract notice, and procurement contact notice.
