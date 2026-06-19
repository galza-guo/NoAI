// Spec for nair-cn-v0.1-doc-005: Huaian legal-services procurement contract.
export default {
  docId: "nair-cn-v0.1-doc-005",
  annotator: "agent-glm-5.2",
  redact: [
    // Procurement project number identifying the specific tender.
    { needle: "JSZC-320891-HAXH-G2025-0006", label: "PROJECT", severity: "high", reason: "Procurement project / tender number identifying the specific matter", all: true },
    // Project name.
    { needle: "2025 年度法律顾问服务项目", label: "PROJECT", severity: "medium", reason: "Named procurement project being contracted", all: true },
    // Party A (government buyer) full name.
    { needle: "中共淮安经济技术开发区工委政法委员会", label: "ORG", severity: "medium", reason: "Named government client (Party A / purchaser)", all: true },
    // Party B (law firm) full name.
    { needle: "北京盈科（淮安）律师事务所", label: "ORG", severity: "medium", reason: "Named law firm service provider (Party B)", all: true },
    // Named arbitration institution (dispute-resolution venue identifying the locale).
    { needle: "淮安市仲裁委员会", label: "ORG", severity: "medium", reason: "Named arbitration institution selected for disputes", all: true },
    // Performance bond amount.
    { needle: "肆仟元整", label: "AMOUNT", severity: "medium", reason: "Specific performance-bond amount", all: true },
    // Contract pricing rate vs standard.
    { needle: "80%", label: "AMOUNT", severity: "medium", reason: "Specific contract pricing rate against the standard fee", all: true },
    // Fixed annual on-site counsel price.
    { needle: "12\n万元/年/包", label: "AMOUNT", severity: "medium", reason: "Specific fixed annual on-site counsel price per package", all: true },
    // Base consultant fee.
    { needle: "5 万元/年", label: "AMOUNT", severity: "medium", reason: "Specific base annual consultant fee in the bid price table", all: true },
    // Per-case administrative-litigation fee.
    { needle: "5000 元/件", label: "AMOUNT", severity: "medium", reason: "Specific per-case administrative-litigation fee in the bid price table", all: true },
  ],
  keep: [
    // Referenced regulation / notice document numbers (generic, not matter-specific).
    { needle: "财办库〔2021〕14 号", label: "MUST_KEEP", reason: "Generic Ministry of Finance procurement regulation citation, should remain readable" },
    { needle: "苏财购【2023】150 号", label: "MUST_KEEP", reason: "Generic provincial procurement e-bond notice citation, should remain readable" },
    // Referenced fee-standard regulation name.
    { needle: "《2017 年江苏省律师服务收费试行标准的通知》", label: "MUST_KEEP", reason: "Generic lawyer-fee standard regulation citation, should remain readable" },
    { needle: "关于在全省\n政府采购领域推行电子履约保函（保险）的通知", label: "MUST_KEEP", reason: "Generic provincial e-performance-bond notice name, should remain readable" },
    // Role labels (first occurrence each) that must stay readable.
    { needle: "甲方", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "乙方", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "采购人", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "中标人", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "投标人", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "服务单位", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "采购包 1", label: "MUST_KEEP", reason: "Generic package label, should remain readable" },
    { needle: "采购包 2", label: "MUST_KEEP", reason: "Generic package label, should remain readable" },
  ],
};
