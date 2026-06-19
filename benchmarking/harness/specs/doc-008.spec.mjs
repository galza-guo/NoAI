// Spec for nair-cn-v0.1-doc-008: Beijing Capital International Airport annual report (Traditional Chinese).
export default {
  docId: "nair-cn-v0.1-doc-008",
  annotator: "agent-glm-5.2",
  redact: [
    // ===== Issuer (core party) and airport =====
    { needle: "北京首都國際機場股份有限公司", label: "ORG", severity: "medium", reason: "Named listed issuer company", all: true },
    { needle: "首都機場集團有限公司", label: "ORG", severity: "medium", reason: "Named parent / controlling shareholder of the issuer", all: true },
    { needle: "北京首都機場", label: "ORG", severity: "medium", reason: "Named airport operated by the issuer (identifying the business)", all: true },
    // ===== Listing identifier and registered contact block =====
    { needle: "00694", label: "BUSINESS_ID", severity: "high", reason: "Stock/share number of the listed issuer", all: true },
    { needle: "中國北京首都機場", label: "ADDRESS", severity: "high", reason: "Registered location of the issuer", all: true },
    { needle: "100621", label: "POSTCODE", severity: "high", reason: "Postal code of the issuer", all: true },
    { needle: "8610 6450 7700", label: "PHONE", severity: "high", reason: "Issuer fax/phone number", all: true },
    { needle: "ir@bcia.com.cn", label: "EMAIL", severity: "high", reason: "Issuer investor-relations email", all: true },
    // ===== Chairman (named individual) =====
    { needle: "宋鵾", label: "PERSON", severity: "high", reason: "Named chairman of the issuer", all: true },
    // ===== Annual report sign-off date =====
    { needle: "二零二六年三月二十六日", label: "DATE", severity: "medium", reason: "Date of the chairman's report sign-off", all: true },
    // ===== Headline financial figures identifying the year's performance =====
    { needle: "5,631,751,000元", label: "AMOUNT", severity: "medium", reason: "Issuer operating revenue amount for the year", all: true },
    { needle: "2,770,358,000元", label: "AMOUNT", severity: "medium", reason: "Aeronautical revenue amount for the year", all: true },
    { needle: "5,784,482,000元", label: "AMOUNT", severity: "medium", reason: "Operating expenses amount for the year", all: true },
    { needle: "78萬元", label: "AMOUNT", severity: "medium", reason: "Charitable and other donations amount", all: true },
    { needle: "2,019,782,000元", label: "AMOUNT", severity: "medium", reason: "Accumulated loss amount", all: true },
    { needle: "1,062,050,000元", label: "AMOUNT", severity: "medium", reason: "Accounts receivable amount", all: true },
    { needle: "81,951.59元", label: "AMOUNT", severity: "low", reason: "Annual interest amount on deposit service", all: true },
    { needle: "130,687,700元", label: "AMOUNT", severity: "medium", reason: "Registered capital of associate 創聯公司", all: true },
    { needle: "40,513,200元", label: "AMOUNT", severity: "medium", reason: "Capital contribution to associate 創聯公司", all: true },
    // ===== Subsidiary / associate / connected-party entities (intact full names) =====
    { needle: "北京首都機場動力能源有限公司", label: "ORG", severity: "medium", reason: "Named connected party (energy) subsidiary of the parent", all: true },
    { needle: "首都機場集團傳媒有限公司", label: "ORG", severity: "medium", reason: "Named connected party (media) subsidiary of the parent", all: true },
    { needle: "北京首都機場商貿有限公司", label: "ORG", severity: "medium", reason: "Named connected party (commerce) subsidiary of the parent", all: true },
    { needle: "首都空港貴賓服務管理有限公司", label: "ORG", severity: "medium", reason: "Named connected party (VIP services)", all: true },
    { needle: "北京空港航空地面服務有限公司", label: "ORG", severity: "medium", reason: "Named connected party (ground services)", all: true },
    { needle: "首都機場集團商務航空管理有限公司", label: "ORG", severity: "medium", reason: "Named connected party (business aviation)", all: true },
    { needle: "北京首都機場餐飲發展有限公司", label: "ORG", severity: "medium", reason: "Named connected party (catering)", all: true },
    { needle: "北京首都機場旅業有限公司", label: "ORG", severity: "medium", reason: "Named connected party (tourism)", all: true },
    { needle: "北京首都機場航空服務有限公司", label: "ORG", severity: "medium", reason: "Named connected party (aviation services)", all: true },
    { needle: "北京民航機場巴士有限公司", label: "ORG", severity: "medium", reason: "Named connected party (airport bus)", all: true },
    { needle: "北京京瑞飯店管理有限責任公司", label: "ORG", severity: "medium", reason: "Named connected party (canteen/hotel management)", all: true },
    { needle: "北京中鵬飲料水有限公司", label: "ORG", severity: "medium", reason: "Named connected party (drinking water equipment)", all: true },
    { needle: "首都機場集團科技管理有限公司", label: "ORG", severity: "medium", reason: "Named connected party (technology services)", all: true },
    { needle: "首都機場集團財務有限公司", label: "ORG", severity: "medium", reason: "Named connected party (group finance company)", all: true },
    { needle: "首都機場集團科技有限公司", label: "ORG", severity: "medium", reason: "Named connected party / shareholder of associate", all: true },
    // ===== Largest customer (spaced full name in two-column layout) =====
    { needle: "中 國 國 際 航 空 股 份 有 限 公 司", label: "ORG", severity: "medium", reason: "Named largest customer airline (spaced in two-column layout)" },
    // ===== Largest supplier (aviation security) — use defined-term short name =====
    { needle: "航空安保公司", label: "ORG", severity: "medium", reason: "Named largest supplier (aviation security) defined term", all: true },
    // ===== External auditor (intermediary) =====
    { needle: "德勤 • 關黃陳方會計師行", label: "ORG", severity: "medium", reason: "Named independent auditor of the issuer", all: true },
  ],
  keep: [
    // Generic regulator / exchange / authority references (supervision boilerplate).
    { needle: "香港聯合交易所", label: "MUST_KEEP", reason: "Generic exchange name (listing boilerplate)" },
    { needle: "中國人民銀行", label: "MUST_KEEP", reason: "Generic central bank reference (pricing-policy boilerplate)" },
  ],
};
