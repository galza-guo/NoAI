// Spec for nair-cn-v0.1-doc-002: CITIC Securities sponsor letter for Unitree.
export default {
  docId: "nair-cn-v0.1-doc-002",
  annotator: "agent-glm-5.2",
  redact: [
    // ===== Issuer (core party) =====
    { needle: "宇树科技股份有限公司", label: "ORG", severity: "medium", reason: "Named IPO issuer company", all: true },
    // ===== Sponsor / underwriter firm =====
    { needle: "中信证券股份有限公司", label: "ORG", severity: "medium", reason: "Named sponsor / lead underwriter firm", all: true },
    { needle: "中信证券", label: "ORG", severity: "medium", reason: "Short name of the sponsor firm", all: true },
    // Sponsor firm registered office (address identifying the intermediary).
    { needle: "广东省深圳市福田区中心三路 8 号卓越时代广场（二期）北座", label: "ADDRESS", severity: "high", reason: "Registered office address of the sponsor firm", all: true },
    // ===== Issuer identifiers and contact block =====
    { needle: "91330108MA27YJ5H56", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of the issuer", all: true },
    { needle: "36,401.7906 万元人民币", label: "AMOUNT", severity: "medium", reason: "Registered capital amount of the issuer", all: true },
    { needle: "浙江省杭州市滨江区西兴街道东流路 88 号 1 幢 306 室", label: "ADDRESS", severity: "high", reason: "Registered address of the issuer", all: true },
    { needle: "310000", label: "POSTCODE", severity: "high", reason: "Postal code of the issuer", all: true },
    { needle: "0571-58129599", label: "PHONE", severity: "high", reason: "Issuer contact phone / fax number", all: true },
    { needle: "www.unitree.com", label: "URL", severity: "medium", reason: "Issuer website URL", all: true },
    { needle: "ir@unitree.com", label: "EMAIL", severity: "high", reason: "Issuer investor-relations email", all: true },
    // ===== Key individuals (issuer legal rep / controller / disclosure officer) =====
    { needle: "王兴兴", label: "PERSON", severity: "high", reason: "Named legal representative / controller of the issuer", all: true },
    { needle: "傅风华", label: "PERSON", severity: "high", reason: "Named information-disclosure officer of the issuer", all: true },
    // ===== Establishment dates identifying the issuer =====
    { needle: "2016 年 08 月 26 日", label: "DATE", severity: "medium", reason: "Establishment date of the issuer (limited company)", all: true },
    { needle: "2025 年 05 月 28 日", label: "DATE", severity: "medium", reason: "Establishment date of the issuer (joint-stock company)", all: true },
    // ===== Sponsor representatives and project team (named individuals + license numbers) =====
    { needle: "高若阳", label: "PERSON", severity: "high", reason: "Named sponsor representative of the project", all: true },
    { needle: "陈熙颖", label: "PERSON", severity: "high", reason: "Named sponsor representative of the project", all: true },
    { needle: "刘梦迪", label: "PERSON", severity: "high", reason: "Named project co-organizer of the project", all: true },
    { needle: "S1010717030001", label: "BUSINESS_ID", severity: "high", reason: "Securities practice license number of sponsor representative 高若阳", all: true },
    { needle: "S1010716040002", label: "BUSINESS_ID", severity: "high", reason: "Securities practice license number of sponsor representative 陈熙颖", all: true },
    { needle: "S1010720120025", label: "BUSINESS_ID", severity: "high", reason: "Securities practice license number of co-organizer 刘梦迪", all: true },
    // Project team members (named individuals on the deal).
    { needle: "金波", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "王凯", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "赵旭亮", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "朱伟铭", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "俞瑶\n蓉", label: "PERSON", severity: "medium", reason: "Named project team member (line-wrapped)" },
    { needle: "林楷", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "林鸿阳", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "盛钰淋", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "郭铖", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "贾济舟", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "刘一村", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "石鑫", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "王金石", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "赵迎旭", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "桑一帆", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "张津源", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "刘昊", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "刘赜远", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "胡娴", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "覃星", label: "PERSON", severity: "medium", reason: "Named project team member" },
    { needle: "李融", label: "PERSON", severity: "medium", reason: "Named project team member" },
    // ===== Project contact address / phone (sponsor's deal office) =====
    { needle: "浙江省杭州市上城区解放东路 29 号迪凯银座大厦 17 层", label: "ADDRESS", severity: "high", reason: "Deal-team contact address of the sponsor", all: true },
    { needle: "0571-85783757", label: "PHONE", severity: "high", reason: "Deal-team contact phone of the sponsor", all: true },
    // ===== Sponsor affiliates holding issuer shares (conflict-of-interest disclosure) =====
    { needle: "中信证券投资有限公司", label: "ORG", severity: "medium", reason: "Named sponsor subsidiary holding issuer shares", all: true },
    { needle: "中信金石投资有限公司", label: "ORG", severity: "medium", reason: "Named sponsor subsidiary (GP) holding issuer shares", all: true },
    { needle: "金石成长股\n权投资（杭州）合伙企业（有限合伙）", label: "ORG", severity: "medium", reason: "Named sponsor-affiliated fund holding issuer shares (line-wrapped)", all: true },
    { needle: "0.3377%", label: "AMOUNT", severity: "low", reason: "Shareholding percentage of sponsor subsidiary in the issuer", all: true },
    { needle: "4.1520%", label: "AMOUNT", severity: "low", reason: "Shareholding percentage of sponsor-affiliated fund in the issuer", all: true },
    // ===== Signature-block individuals (sponsor officers) =====
    { needle: "朱洁", label: "PERSON", severity: "medium", reason: "Named internal-control head of the sponsor (signature block)", all: true },
    { needle: "孙毅", label: "PERSON", severity: "medium", reason: "Named sponsor-business head of the sponsor (signature block)", all: true },
    { needle: "张佑君", label: "PERSON", severity: "medium", reason: "Named chairman / legal representative of the sponsor (signature block)", all: true },
  ],
  keep: [
    // Generic law / regulation names and exchange/regulator boilerplate (should stay readable).
    { needle: "《公司法》", label: "MUST_KEEP", reason: "Generic law name, should remain readable" },
    { needle: "《证券法》", label: "MUST_KEEP", reason: "Generic law name, should remain readable" },
    { needle: "《证券发行上市保荐业务管理办法》", label: "MUST_KEEP", reason: "Generic regulation name, should remain readable" },
    { needle: "《首次公开发行股票注册管理办法》", label: "MUST_KEEP", reason: "Generic regulation name, should remain readable" },
    { needle: "《保荐人尽职调查工作准则》", label: "MUST_KEEP", reason: "Generic regulation name, should remain readable" },
    { needle: "《上海证券交易\n所科创板股票上市规则》", label: "MUST_KEEP", reason: "Generic exchange rule name (line-wrapped), should remain readable" },
    { needle: "企业发行上市申报及推荐暂行规定", label: "MUST_KEEP", reason: "Generic exchange rule name (core, revision suffix line-wrapped), should remain readable" },
    // Generic regulator / exchange references (supervision boilerplate).
    { needle: "中国证监会", label: "MUST_KEEP", reason: "Generic regulator name (supervision boilerplate)" },
    { needle: "上海证券交易所", label: "MUST_KEEP", reason: "Generic exchange name (listing boilerplate)" },
    { needle: "科创板", label: "MUST_KEEP", reason: "Generic board/market name (listing boilerplate)" },
  ],
};
