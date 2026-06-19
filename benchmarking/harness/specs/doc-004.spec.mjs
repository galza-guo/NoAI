// Spec for nair-cn-v0.1-doc-004: CSRC Shanghai administrative penalty.
export default {
  docId: "nair-cn-v0.1-doc-004",
  annotator: "agent-glm-5.2",
  redact: [
    // Issuer / regulator body (identifies the specific regulator office).
    { needle: "中国证券监督管理委员会上海监管局", label: "ORG", severity: "medium", reason: "Named regulator office that issued the penalty (identifies the matter)", all: true },
    // Document / case references.
    { needle: "沪〔2025〕56号", label: "CASE_REF", severity: "high", reason: "Administrative penalty decision number identifying the specific matter", all: true },
    { needle: "bm56000001/2026-00000876", label: "CASE_REF", severity: "medium", reason: "Government disclosure index number identifying the specific document", all: true },
    // Respondent company full name and short name (the penalized entity).
    { needle: "广东钜米私募证券投资基金管理有限公司", label: "ORG", severity: "medium", reason: "Named penalized private-fund management company (respondent)", all: true },
    { needle: "广东钜米", label: "ORG", severity: "medium", reason: "Short name of the penalized company (respondent)", all: true },
    // Unified social credit code of the respondent.
    { needle: "91440300349578294E", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of the penalized company", all: true },
    // Addresses of the parties.
    { needle: "广州市番禺区", label: "ADDRESS", severity: "high", reason: "Residential/registered address (district) of the respondent and party", all: true },
    { needle: "广州市白云区", label: "ADDRESS", severity: "high", reason: "Residential address (district) of the responsible person", all: true },
    // Individual responsible persons (partially masked but identify parties in the matter).
    { needle: "付某庆", label: "PERSON", severity: "high", reason: "Named responsible person / legal representative of the penalized company", all: true },
    { needle: "陈某蒲", label: "PERSON", severity: "high", reason: "Named responsible person (deputy general manager) of the penalized company", all: true },
    // Birth years identifying the individuals.
    { needle: "1984年出生", label: "DATE", severity: "high", reason: "Birth year identifying the responsible person", all: true },
    { needle: "1991年出生", label: "DATE", severity: "high", reason: "Birth year identifying the responsible person", all: true },
    // Dates identifying the matter.
    { needle: "2024年10月9日", label: "DATE", severity: "medium", reason: "As-of date of the facts underlying the penalty", all: true },
    { needle: "2025年12月30日", label: "DATE", severity: "medium", reason: "Issuance date of the penalty decision", all: true },
    // Identified amounts of the penalties / illegal gains.
    { needle: "2,079,050.98元", label: "AMOUNT", severity: "medium", reason: "Specific monetary amount of the confiscated illegal gains", all: true },
    { needle: "四十万元", label: "AMOUNT", severity: "medium", reason: "Specific monetary fine amount", all: true },
    { needle: "十二万元", label: "AMOUNT", severity: "medium", reason: "Specific monetary fine amount", all: true },
    { needle: "七十万元", label: "AMOUNT", severity: "medium", reason: "Specific monetary fine amount", all: true },
    { needle: "二十一万元", label: "AMOUNT", severity: "medium", reason: "Specific monetary fine amount", all: true },
    { needle: "十八万元", label: "AMOUNT", severity: "medium", reason: "Specific monetary fine amount", all: true },
    { needle: "一百一十万元", label: "AMOUNT", severity: "medium", reason: "Specific monetary fine amount (aggregate)", all: true },
    { needle: "三十三万元", label: "AMOUNT", severity: "medium", reason: "Specific monetary fine amount (aggregate)", all: true },
    // Related association (the self-regulatory body the respondent reported to).
    { needle: "中国证券投资基金业协会", label: "ORG", severity: "low", reason: "Named industry association the respondent reported to (context org)", all: true },
  ],
  keep: [
    // Law / regulation names and structural boilerplate that should stay readable.
    { needle: "《私募投资基金监督管理条例》", label: "MUST_KEEP", reason: "Law / regulation name, generic boilerplate that should remain readable", all: true },
    { needle: "《私募条例》", label: "MUST_KEEP", reason: "Defined-term abbreviation for the regulation, should remain readable", all: true },
    { needle: "《私募投资基金监督管理暂行办法》", label: "MUST_KEEP", reason: "Regulation name, generic boilerplate that should remain readable", all: true },
    { needle: "《私募办法》", label: "MUST_KEEP", reason: "Defined-term abbreviation for the regulation, should remain readable", all: true },
    { needle: "证监会令第105号", label: "MUST_KEEP", reason: "Generic regulation citation, not a matter-specific identifier", all: true },
    { needle: "中国证券监督管理委员会行政处罚委员会办公室", label: "MUST_KEEP", reason: "Generic regulator office referenced for payment filing boilerplate", all: true },
    { needle: "中国证券监督管理委员会法治司", label: "MUST_KEEP", reason: "Generic regulator office referenced for administrative review boilerplate", all: true },
    { needle: "中国证券监督管理委员会", label: "MUST_KEEP", reason: "Generic top-level regulator name (boilerplate, payment/review instructions)", all: true },
    { needle: "广东钜米或公司", label: "MUST_KEEP", reason: "Defined-term gloss for the respondent; over-redacting harms readability" },
    { needle: "行政执法", label: "MUST_KEEP", reason: "Category label / navigation boilerplate" },
  ],
};
