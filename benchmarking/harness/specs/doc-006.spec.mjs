// Spec for nair-cn-v0.1-doc-006: Mawei district procurement goods contract.
export default {
  docId: "nair-cn-v0.1-doc-006",
  annotator: "agent-glm-5.2",
  redact: [
    // ===== Parties (buyer + supplier) =====
    { needle: "福州市马尾区教育局", label: "ORG", severity: "medium", reason: "Named government buyer (Party A / purchaser)", all: true },
    { needle: "福建冠农新城科技有限公司", label: "ORG", severity: "medium", reason: "Named supplier (Party B)", all: true },
    // ===== Procurement project identifiers =====
    { needle: "[350105]FJSXH[TP]2025001", label: "PROJECT", severity: "high", reason: "Procurement project / contract number identifying the specific matter", all: true },
    { needle: "CGXM-2025-350105-00153[2025]00135", label: "PROJECT", severity: "high", reason: "Procurement plan number identifying the specific matter", all: true },
    // Project name (split across lines in the source; mark the two contiguous fragments).
    { needle: "马尾区部分义务教育阶段学校计算机", label: "PROJECT", severity: "medium", reason: "Named procurement project (first fragment, line-wrapped)", all: true },
    { needle: "及机房设备更新项目", label: "PROJECT", severity: "medium", reason: "Named procurement project (second fragment, line-wrapped)", all: true },
    // ===== Contract amounts =====
    { needle: "1,342,180.00", label: "AMOUNT", severity: "medium", reason: "Total contract amount / payment amount", all: true },
    { needle: "壹佰叁拾肆万贰仟壹佰捌拾元整", label: "AMOUNT", severity: "medium", reason: "Total contract amount in words", all: true },
    { needle: "1,258,000.00", label: "AMOUNT", severity: "medium", reason: "Line-item total amount", all: true },
    { needle: "3,700.00", label: "AMOUNT", severity: "medium", reason: "Line-item unit price", all: true },
    { needle: "84,180.00", label: "AMOUNT", severity: "medium", reason: "Line-item unit price / total", all: true },
    // ===== Key dates =====
    { needle: "2025年04月30日", label: "DATE", severity: "medium", reason: "Contract performance start date", all: true },
    { needle: "2025年05月10日", label: "DATE", severity: "medium", reason: "Contract performance completion date", all: true },
    { needle: "2025年4月30日", label: "DATE", severity: "medium", reason: "Contract effective date", all: true },
    { needle: "2025-07-31", label: "DATE", severity: "medium", reason: "Planned payment date", all: true },
    // ===== Party contact persons (signatories and contacts) =====
    { needle: "潘振强", label: "PERSON", severity: "high", reason: "Named signatory / legal representative of Party A", all: true },
    { needle: "高建文", label: "PERSON", severity: "high", reason: "Named signatory / legal representative of Party B", all: true },
    { needle: "叶铸用", label: "PERSON", severity: "high", reason: "Named contact person of Party A", all: true },
    { needle: "陈瑜", label: "PERSON", severity: "high", reason: "Named contact person of Party B", all: true },
    // ===== Phones, addresses, postcodes, emails =====
    { needle: "63190290", label: "PHONE", severity: "high", reason: "Party A contact phone number", all: true },
    { needle: "13969720363", label: "PHONE", severity: "high", reason: "Party B contact phone number", all: true },
    { needle: "福州市马尾区君竹路83号", label: "ADDRESS", severity: "high", reason: "Party A address", all: true },
    { needle: "福州市马尾区建星路80号", label: "ADDRESS", severity: "high", reason: "Party B address", all: true },
    { needle: "350015", label: "POSTCODE", severity: "high", reason: "Postal code of both parties", all: true },
    { needle: "mwjyjjyz@163.com", label: "EMAIL", severity: "high", reason: "Party A email address", all: true },
    { needle: "17131834@qq.com", label: "EMAIL", severity: "high", reason: "Party B email address", all: true },
    // ===== Unified social credit codes =====
    { needle: "113501050036281003", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of Party A", all: true },
    { needle: "91350105MA3458HX32", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of Party B", all: true },
    // ===== Bank account details (Party B) =====
    { needle: "中国建设银行股份有限公司福州马江支行", label: "ORG", severity: "medium", reason: "Named bank branch for Party B payment (开户行)", all: true },
    { needle: "35050161740100000023", label: "BANK_ACCOUNT", severity: "critical", reason: "Bank account number for Party B payment", all: true },
    // ===== Dispute-resolution court =====
    { needle: "福州市马尾区人民法院", label: "ORG", severity: "medium", reason: "Named court with jurisdiction over the contract", all: true },
    // ===== Product brand/model identifying the specific procurement =====
    { needle: "兆芯KX-U6780A", label: "BRAND", severity: "low", reason: "Specific product model of the procured goods", all: true },
    { needle: "国产兆芯系列芯片处理器", label: "BRAND", severity: "low", reason: "Specific product brand of the procured goods", all: true },
    { needle: "国产银河麒麟", label: "BRAND", severity: "low", reason: "Specific product brand (operating system) of the procured goods", all: true },
    // ===== Delivery site schools (named locations for performance) =====
    { needle: "福州市金砂初级中学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市快安学校", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市儒江小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州亭江中心小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市亭江第二中心小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市东街小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市象洋小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市琅岐第二中心小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市金砂中心小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市云龙小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市海屿小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
    { needle: "福州市吴庄华侨小学", label: "LOCATION", severity: "low", reason: "Named delivery site school", all: true },
  ],
  keep: [
    // Generic law names (boilerplate, should stay readable).
    { needle: "《中华人民共和国民法典》", label: "MUST_KEEP", reason: "Generic law name, should remain readable" },
    { needle: "《中华人民共和国政府采购法》", label: "MUST_KEEP", reason: "Generic law name, should remain readable" },
    // Generic role labels.
    { needle: "甲方", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "乙方", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "采购人", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "供应商", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
  ],
};
