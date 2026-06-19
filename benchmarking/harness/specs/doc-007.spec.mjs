// Spec for nair-cn-v0.1-doc-007: BOC International Futures - Dingfeng asset management contract.
export default {
  docId: "nair-cn-v0.1-doc-007",
  annotator: "agent-glm-5.2",
  redact: [
    // ===== Product / plan name =====
    { needle: "鼎锋成长 28 期", label: "PROJECT", severity: "medium", reason: "Named asset-management plan / product identifying the specific contract", all: true },
    // ===== Parties =====
    { needle: "中银国际期货有限责任公司", label: "ORG", severity: "medium", reason: "Named asset manager (Party A)", all: true },
    { needle: "中国银行股份有限公司上海市分行", label: "ORG", severity: "medium", reason: "Named asset custodian (Party B)", all: true },
    { needle: "上海鼎锋资产管理有限公司", label: "ORG", severity: "medium", reason: "Named investment advisor of the plan", all: true },
    { needle: "国金道富投资服务有限公司", label: "ORG", severity: "medium", reason: "Named administrative service agency of the plan", all: true },
    // ===== Manager identifiers / contact block =====
    { needle: "中国（上海）自由贸易试验区世纪大道 1589 号 903-907 室", label: "ADDRESS", severity: "high", reason: "Registered address (住所) of the asset manager", all: true },
    { needle: "上海市浦东新区世纪大道 1589 号长泰国际金融大厦 908-909 室", label: "ADDRESS", severity: "high", reason: "Office address of the asset manager", all: true },
    { needle: "200122", label: "POSTCODE", severity: "high", reason: "Postal code of the asset manager", all: true },
    { needle: "3.5 亿元人民币", label: "AMOUNT", severity: "medium", reason: "Registered capital amount of the asset manager", all: true },
    { needle: "翟增军", label: "PERSON", severity: "high", reason: "Named legal representative of the asset manager", all: true },
    { needle: "殷泽", label: "PERSON", severity: "medium", reason: "Named contact person of the asset manager", all: true },
    { needle: "021-61088033", label: "PHONE", severity: "high", reason: "Contact phone number of the asset manager", all: true },
    // ===== Custodian identifiers / contact block =====
    { needle: "上海市中山东一路 23 号", label: "ADDRESS", severity: "high", reason: "Business premises address of the asset custodian", all: true },
    { needle: "上海市银城中路 200 号 14 层", label: "ADDRESS", severity: "high", reason: "Office address of the asset custodian", all: true },
    { needle: "200120", label: "POSTCODE", severity: "high", reason: "Postal code of the asset custodian", all: true },
    { needle: "赵蓉", label: "PERSON", severity: "high", reason: "Named principal/head of the asset custodian branch", all: true },
    { needle: "胡黎黎", label: "PERSON", severity: "medium", reason: "Named contact person of the asset custodian", all: true },
    { needle: "021-58883676", label: "PHONE", severity: "high", reason: "Contact phone number of the asset custodian", all: true },
    // ===== Bank accounts and opening branches (开户行) =====
    // Plan fundraising/clearing account (manager)
    { needle: "439069668894", label: "BANK_ACCOUNT", severity: "critical", reason: "Bank account number of the plan fundraising/clearing account", all: true },
    { needle: "中国银行上海市浦东分行营业一部", label: "ORG", severity: "medium", reason: "Opening bank branch (开户行) of the plan fundraising/clearing account", all: true },
    // Manager fee-receipt account
    { needle: "452059215520", label: "BANK_ACCOUNT", severity: "critical", reason: "Bank account number of the manager's fee-receipt account", all: true },
    { needle: "中国银行上海市期货大厦支行", label: "ORG", severity: "medium", reason: "Opening bank branch of the manager's fee-receipt account", all: true },
    // Custodian fee-receipt account
    { needle: "9061440019991001", label: "BANK_ACCOUNT", severity: "critical", reason: "Bank account number of the custodian's fee-receipt account", all: true },
    { needle: "中国银行上海市中银大厦支行", label: "ORG", severity: "medium", reason: "Opening bank branch of the custodian's fee-receipt account", all: true },
    // Custodian plan-asset account
    { needle: "9060190019991001", label: "BANK_ACCOUNT", severity: "critical", reason: "Bank account number of the custodian's plan-asset account", all: true },
    { needle: "中国银行上海市分行", label: "ORG", severity: "medium", reason: "Opening bank branch of the custodian's plan-asset account", all: true },
    // Investment advisor fee-receipt account
    { needle: "1001 1826 0900 0124 419", label: "BANK_ACCOUNT", severity: "critical", reason: "Bank account number of the investment advisor's fee-receipt account", all: true },
    { needle: "工行上海陆家嘴支行", label: "ORG", severity: "medium", reason: "Opening bank branch of the investment advisor's fee-receipt account", all: true },
    // ===== Contract date =====
    { needle: "二○一七年二月", label: "DATE", severity: "medium", reason: "Date (month/year) of the asset-management contract", all: true },
    // ===== Plan thresholds identifying the product terms =====
    { needle: "0.8700 元", label: "AMOUNT", severity: "low", reason: "Plan warning-line unit value", all: true },
    { needle: "0.8000", label: "AMOUNT", severity: "low", reason: "Plan stop-loss-line unit value", all: true },
  ],
  keep: [
    // Generic law names (boilerplate, should stay readable).
    { needle: "《合同法》", label: "MUST_KEEP", reason: "Generic law name, should remain readable" },
    { needle: "《电子签名法》", label: "MUST_KEEP", reason: "Generic law name, should remain readable" },
    { needle: "《私募投资基金监督管理暂行办法》", label: "MUST_KEEP", reason: "Generic regulation name, should remain readable" },
    // Generic role labels.
    { needle: "委托人", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "管理人", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "托管人", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
    { needle: "投资顾问", label: "MUST_KEEP", reason: "Generic role label, should not be over-redacted" },
  ],
};
