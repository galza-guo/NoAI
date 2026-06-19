// Spec for nair-cn-v0.1-doc-003: AllBright (JTC) legal opinion for Changxin.
export default {
  docId: "nair-cn-v0.1-doc-003",
  annotator: "agent-glm-5.2",
  redact: [
    // ===== Law firm issuing the opinion (intermediary) =====
    { needle: "上海市锦天城律师事务所", label: "ORG", severity: "medium", reason: "Named law firm issuing the legal opinion (intermediary)", all: true },
    // ===== Issuer (Changxin) and its subsidiaries =====
    { needle: "长鑫科技", label: "ORG", severity: "medium", reason: "Short name of the issuer", all: true },
    { needle: "长鑫存储", label: "ORG", severity: "medium", reason: "Named subsidiary of the issuer", all: true },
    { needle: "长鑫产品合", label: "ORG", severity: "medium", reason: "Named subsidiary of the issuer (name split by table layout; suffix 肥 on a later line)" },
    { needle: "长鑫新桥", label: "ORG", severity: "medium", reason: "Named subsidiary of the issuer", all: true },
    { needle: "长鑫西安", label: "ORG", severity: "medium", reason: "Named subsidiary of the issuer", all: true },
    { needle: "长鑫闵科", label: "ORG", severity: "medium", reason: "Named subsidiary of the issuer", all: true },
    { needle: "长鑫集电", label: "ORG", severity: "medium", reason: "Named subsidiary of the issuer", all: true },
    // Issuer capitalization and valuation figures identifying the offering.
    { needle: "6,019,279.7469", label: "AMOUNT", severity: "medium", reason: "Issuer pre-offering share capital / total share count", all: true },
    { needle: "617.99 亿元", label: "AMOUNT", severity: "medium", reason: "Issuer most-recent-year revenue figure", all: true },
    // ===== Shareholder 1: 大基金二期 =====
    { needle: "大基金二期", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "国家集成电路产业投资基金二期股份有限公司", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "91110000MA01N9JK2F", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 大基金二期", all: true },
    { needle: "北京市北京经济技术开发区景园北街 2 号 52 幢 7 层 701-6", label: "ADDRESS", severity: "high", reason: "Registered address of shareholder 大基金二期", all: true },
    { needle: "张新", label: "PERSON", severity: "medium", reason: "Named legal representative of shareholder 大基金二期", all: true },
    // ===== Shareholder 2: 兆易创新 =====
    { needle: "兆易创新", label: "ORG", severity: "medium", reason: "Named shareholder / related party (short name)", all: true },
    { needle: "兆易创新科技集团股份有限公司", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "91110108773369432Y", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 兆易创新", all: true },
    { needle: "北京市海淀区丰豪东路 9 号院 8 号楼 1 至 5 层 101", label: "ADDRESS", severity: "high", reason: "Registered address of shareholder 兆易创新", all: true },
    { needle: "何卫", label: "PERSON", severity: "medium", reason: "Named legal representative of shareholder 兆易创新", all: true },
    // ===== Shareholder 3: 安徽交控 =====
    { needle: "安徽交控", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "安徽交控招商产业投资基金（有限合伙）", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "91340100MA2NJYNM4Q", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 安徽交控", all: true },
    { needle: "合肥市高新区望江西路 520 号皖通高速科技产业园区 11#研发楼 1", label: "ADDRESS", severity: "high", reason: "Registered premises of shareholder 安徽交控 (street portion; room floor split by field label)" },
    { needle: "安徽徽道招商私募基金管理有限公司", label: "ORG", severity: "medium", reason: "Named GP of shareholder 安徽交控", all: true },
    // ===== Shareholder 4: 建银国际 =====
    { needle: "建银国际", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "建银国际（深圳）投资有限公司", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "91440300570046799W", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 建银国际", all: true },
    { needle: "深圳市前海深港合作区前湾一路鲤鱼门街一号前海深港合作区管", label: "ADDRESS", severity: "high", reason: "Registered premises of shareholder 建银国际 (street portion; building split by field label)" },
    { needle: "曾昱", label: "PERSON", severity: "medium", reason: "Named legal representative of shareholder 建银国际", all: true },
    // ===== Shareholder 5: 国寿投资 =====
    { needle: "国寿投资", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "国寿投资保险资产管理有限公司", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "911100001020321266", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 国寿投资", all: true },
    { needle: "北京市朝阳区景华南街 5 号 17 层（14）1703 单元", label: "ADDRESS", severity: "high", reason: "Registered address of shareholder 国寿投资", all: true },
    { needle: "张凤鸣", label: "PERSON", severity: "medium", reason: "Named legal representative of shareholder 国寿投资", all: true },
    // ===== Shareholder 6: 国调基金 =====
    { needle: "国调基金", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "中国国有企业结构调整基金股份有限公司", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "91110102MA008DDL0X", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 国调基金", all: true },
    { needle: "北京市西城区金融大街 9 号楼 6 层 601-02 单元", label: "ADDRESS", severity: "high", reason: "Registered address of shareholder 国调基金", all: true },
    { needle: "郭祥玉", label: "PERSON", severity: "medium", reason: "Named legal representative of shareholder 国调基金", all: true },
    // ===== Shareholder 7: 阿里网络 =====
    { needle: "阿里网络", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "阿里巴巴（中国）网络技术有限公司", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "91330100716105852F", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 阿里网络", all: true },
    { needle: "浙江省杭州市滨江区网商路 699 号", label: "ADDRESS", severity: "high", reason: "Registered address of shareholder 阿里网络", all: true },
    { needle: "蒋芳", label: "PERSON", severity: "medium", reason: "Named legal representative of shareholder 阿里网络", all: true },
    // ===== Shareholder 8: 安徽担保资管 =====
    { needle: "安徽担保资管", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "安徽担保资产管理有限公司", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "913400003487088943", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 安徽担保资管", all: true },
    { needle: "合肥市蜀山区怀宁路 288 号安徽担保大厦 18 楼", label: "ADDRESS", severity: "high", reason: "Registered address of shareholder 安徽担保资管", all: true },
    { needle: "张伦超", label: "PERSON", severity: "medium", reason: "Named legal representative of shareholder 安徽担保资管", all: true },
    // ===== Shareholder 9: 东方资管 =====
    { needle: "东方资管", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "中国东方资产管理股份有限公司", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "911100007109254543", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 东方资管", all: true },
    { needle: "北京市西城区阜成门内大街 410 号", label: "ADDRESS", severity: "high", reason: "Registered address of shareholder 东方资管", all: true },
    { needle: "梁强", label: "PERSON", severity: "medium", reason: "Named legal representative of shareholder 东方资管", all: true },
    // ===== Shareholder 10: 合肥集鑫 =====
    { needle: "合肥集鑫", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "合肥集鑫企业管理合伙企业（有限合伙）", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "91340111MA2W0QEU5B", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 合肥集鑫", all: true },
    { needle: "安徽省合肥市经济技术开发区合肥空港经济示范区玉兰花路东侧合", label: "ADDRESS", severity: "high", reason: "Registered premises of shareholder 合肥集鑫 (street portion; port-office split by field label)" },
    { needle: "合肥集鑫硕驰企业管理有限责任公司", label: "ORG", severity: "medium", reason: "Named GP of shareholder 合肥集鑫", all: true },
    // ===== Shareholder 11: 安元星亿达 =====
    { needle: "安元星亿达", label: "ORG", severity: "medium", reason: "Named shareholder (short name)", all: true },
    { needle: "安徽安元星亿达投资基金合伙企业（有限合伙）", label: "ORG", severity: "medium", reason: "Named shareholder full entity name", all: true },
    { needle: "91340111MA8LHU1Q45", label: "BUSINESS_ID", severity: "critical", reason: "Unified social credit code of shareholder 安元星亿达", all: true },
    { needle: "安徽省合肥市经济技术开发区习友路西、锦绣大道北南艳湖高科技", label: "ADDRESS", severity: "high", reason: "Registered premises of shareholder 安元星亿达 (street portion; park-building split by field label)" },
    { needle: "安徽安元投资基金管理有限公司", label: "ORG", severity: "medium", reason: "Named GP of shareholder 安元星亿达", all: true },
    // ===== High-tech enterprise certificate numbers (subsidiaries) =====
    { needle: "GR202534004916", label: "BUSINESS_ID", severity: "high", reason: "High-tech enterprise certificate number of subsidiary 长鑫新桥", all: true },
    { needle: "GR202561001668", label: "BUSINESS_ID", severity: "high", reason: "High-tech enterprise certificate number of subsidiary 长鑫西安", all: true },
    { needle: "GR202531003856", label: "BUSINESS_ID", severity: "high", reason: "High-tech enterprise certificate number of subsidiary 长鑫闵科", all: true },
    { needle: "GR202534007148", label: "BUSINESS_ID", severity: "high", reason: "High-tech enterprise certificate number of subsidiary 长鑫产品合肥", all: true },
    // ===== Pollutant-discharge permit numbers (subsidiaries) =====
    { needle: "91110302MA007QPT25001R", label: "BUSINESS_ID", severity: "high", reason: "Pollutant-discharge permit number of subsidiary 长鑫集电", all: true },
    { needle: "91340100MA2MWUT60Q001W", label: "BUSINESS_ID", severity: "high", reason: "Pollutant-discharge registration number of subsidiary 长鑫科技", all: true },
    // ===== Controller individuals of related parties (natural persons) =====
    { needle: "朱一明", label: "PERSON", severity: "medium", reason: "Named natural person controlling multiple related parties", all: true },
    { needle: "赵纶", label: "PERSON", severity: "medium", reason: "Named natural person controlling / directing related parties", all: true },
    { needle: "郑锐", label: "PERSON", severity: "medium", reason: "Named natural person directing multiple related parties", all: true },
    { needle: "方炜", label: "PERSON", severity: "medium", reason: "Named natural person directing multiple related parties", all: true },
    { needle: "韦俊", label: "PERSON", severity: "medium", reason: "Named natural person directing multiple related parties", all: true },
    { needle: "侯华伟", label: "PERSON", severity: "medium", reason: "Named natural person (director) directing related parties", all: true },
    { needle: "冯鹏熙", label: "PERSON", severity: "medium", reason: "Named natural person directing / controlling related parties", all: true },
    { needle: "彭红兵", label: "PERSON", severity: "medium", reason: "Named former director of the issuer", all: true },
    { needle: "李中亚", label: "PERSON", severity: "medium", reason: "Named former director controlling related-party suppliers", all: true },
    // ===== Named related-party suppliers (transaction counterparties) =====
    { needle: "合肥沛顿", label: "ORG", severity: "medium", reason: "Named related-party supplier", all: true },
    { needle: "合肥鑫丰", label: "ORG", severity: "medium", reason: "Named related-party supplier", all: true },
    { needle: "合肥经济技术开发区海恒科创控股集团有限公", label: "ORG", severity: "medium", reason: "Named related party holding 5%+ of the issuer (name split by table layout; trailing 司 on next line)" },
  ],
  keep: [
    // Generic law / regulation names and accounting-standard boilerplate.
    { needle: "《公司法》", label: "MUST_KEEP", reason: "Generic law name, should remain readable" },
    { needle: "《证券法》", label: "MUST_KEEP", reason: "Generic law name, should remain readable" },
    { needle: "《首发注册管理办法》", label: "MUST_KEEP", reason: "Generic regulation name, should remain readable" },
    { needle: "《科创板股票上市规则》", label: "MUST_KEEP", reason: "Generic exchange rule name, should remain readable" },
    { needle: "《科创属性评价指引（试行）》", label: "MUST_KEEP", reason: "Generic regulation name, should remain readable" },
    { needle: "《企业会计准则》", label: "MUST_KEEP", reason: "Generic accounting standard name, should remain readable" },
    { needle: "《企业会计制度》", label: "MUST_KEEP", reason: "Generic accounting standard name, should remain readable" },
    { needle: "《产业结构调整指导目录（2024 年本）》", label: "MUST_KEEP", reason: "Generic industry-guidance catalogue name, should remain readable" },
    // Generic regulator / authority references (supervision boilerplate).
    { needle: "中国证监会", label: "MUST_KEEP", reason: "Generic regulator name (supervision boilerplate)" },
    { needle: "国家知识产权局", label: "MUST_KEEP", reason: "Generic authority name (IP boilerplate)" },
    // Generic regulator/issuing offices referenced in certificate tables.
    { needle: "北京市市场监督管理局", label: "MUST_KEEP", reason: "Generic registration authority name (boilerplate)" },
  ],
};
