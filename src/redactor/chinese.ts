import { CandidateKind, RedactionInput } from "./types";

export type AddCandidate = (
  value: string,
  kind: CandidateKind,
  minLevel: number,
  reason: string,
  source: string,
  pos: number,
) => void;

const HAN_RE = /[\u3400-\u9fff]/;
const LABEL_SEP = String.raw`\s*[：:#]\s*`;
const VALUE_UNTIL_HARD_STOP = String.raw`([^\r\n。；;]+)`;
// Formal Chinese paperwork (SAMR penalty decisions, court filings, contracts)
// frequently qualifies a field label with a parenthetical synonym BEFORE the
// colon: 住所（住址）, 法定代表人（负责人、经营者）, 统一社会信用代码（注册号）.
// The synonym sits between the label and LABEL_SEP, so the label rule must
// allow an optional full parenthetical there. Only a REAL label immediately
// preceding the parenthetical triggers detection (the alternation still
// requires one of the label terms), so prose such as 本通知（盖章后生效）
// does not fire. Both （）and () brackets are accepted.
const LABEL_SYNONYM_PARENS = String.raw`(?:\s*[（(][^）)]*[）)])?`;

const USCC_LABELS = ["统一社会信用代码", "社会信用代码", "中标供应商统一社会信用代码"];
const PRC_ID_LABELS = [
  "身份证件号码",
  "居民身份证号",
  "身份证号码",
  "身份证号",
  // Formal / administrative variant used on social-security, medical-insurance,
  // and household-registration documents (公民身份号码 is the GB/T 17744 wording).
  "公民身份号码",
  // Traditional / HK / TW aliases (same kind, same validator):
  "身分證號",
  "身分證字號",
  "身分證統一編號",
];
const PHONE_LABELS = [
  "联系电话",
  "联系方式",
  "项目联系电话",
  "采购单位联系方式",
  "采购人联系方式",
  "代理机构联系方式",
  "供应商联系方式",
  "手机号码",
  "电话",
  // 手机 alone is too short (it matches "手机号码" as a substring and the
  // trailing 号码 slots into the value), so sort it before 手机号码 in the alt
  // to ensure the longer label wins. But alt is sorted longest-first, so 手机号码
  // already wins. 手机 is intentionally kept but must be a distinct label, not a
  // substring collision.
  "手机",
  "传真",
  // Traditional / HK / TW aliases:
  "聯絡電話",
  "聯絡方式",
  "傳真",
  "項目聯繫電話",
  "採購單位聯繫方式",
  "代理機構聯繫方式",
];

// Postcode / ZIP labels (POSTCODE, Light). Chinese postcodes are 6-digit
// (100000-854099 for domestic, 999001-999078 for special). The value validator
// accepts the strict 6-digit form only; letters or punctuation are rejected.
const POSTCODE_LABELS = ["邮编", "邮政编码", "郵編", "郵政編碼", "编码"];
const BANK_ACCOUNT_LABELS = [
  "银行账号",
  "开户账号",
  "对公账号",
  "收款账号",
  // Social-security / pension / benefit disbursement account labels
  // (待遇发放账号 / 养老金发放账号 / 抚恤金发放账号). The value is always a
  // long bank card number, so the BANK_ACCOUNT_RE validator still applies.
  "待遇发放账号",
  "养老金发放账号",
  "发放账号",
  "待遇领取账号",
  "账号",
];
const ADDRESS_LABELS = [
  "注册地址",
  "办公地址",
  "联系地址",
  "通讯地址",
  "送达地址",
  "住所",
  "住址",
  "居住地址",
  "工作单位及职务", // A mix of org and title, but fundamentally an address/location field
  "主要营业地点",
  "主要營業地點",
  "营业地点",
  "營業地點",
  "地址",
  // Common procurement/corporate address labels:
  "供应商地址",
  "采购单位地址",
  "采购人地址",
  "代理机构地址",
  // Shareholder-meeting / conference venue labels (listed-company notices,
  // AGM convening notices). These carry the on-site address the same way an
  // address label does. Bare prose use ("会议地点尚未确定") is protected by
  // LABEL_SEP requiring a colon-value structure.
  "现场会议地点",
  "会议地点",
  "登记地点",
  "会议地址",
  // Traditional / HK / TW aliases:
  "註冊地址",
  "註冊辦公地址",
  "辦公地址",
  "聯絡地址",
  "通訊地址",
  "通訊位址",
  "送達地址",
  "供應商地址",
  "採購單位地址",
  "代理機構地址",
];
const PERSON_LABELS = [
  "法定代表人",
  "项目负责人",
  "签字会计师",
  "委托代理人",
  "委托诉讼代理人",
  "诉讼代理人",
  "经办律师",
  "联系人",
  "项目联系人",
  "负责人",
  "经办人",
  "姓名",
  // Additional common signature / role labels:
  "申请人",
  "上诉人",
  "被申请人",
  "原告",
  "被告",
  "当事人",
  "代表",
  "代表人",
  "项目经理",
  "总工程师",
  "工程师",
  "见证人",
  "记录人",
  "审判长",
  "审判员",
  // Legal / arbitration / hearing role labels (introduce a named individual).
  // These appear on HK arbitral orders, court paperwork, and hearing records
  // as "獨任仲裁員：陳大文" / "仲裁庭秘書：李偉恒" / "法律顧問：黃議員".
  "独任仲裁员",
  "仲裁员",
  "仲裁庭秘书",
  "书记员",
  "公诉人",
  "法律顾问",
  // Procurement/project role labels:
  "评审专家",
  "评审专家名单",
  "单一来源采购人员",
  "采购人代表",
  "用户代表",
  // Traditional / HK / TW aliases:
  "法定代理人",
  "負責人",
  "聯絡人",
  "聯係人", // HK variant of 聯絡人
  "經辦人",
  "見證人",
  "項目經理",
  "項目聯繫人",
  "獨任仲裁員",
  "仲裁員",
  "仲裁庭秘書",
  "書記員",
  "審判長",
  "審判員",
  "法律顧問",
  "代表律師",
  "評審專家",
  "評審專家名單",
  // Contract / rental / loan party labels (introduce a named individual or
  // entity in lease agreements, loan contracts, guarantee deeds, and pledge
  // agreements). The value must pass PERSON_RE (2-6 Han chars), so a named
  // individual is caught while an organization name that exceeds the length
  // limit is deferred to the ORG label rules.
  "出租人",
  "承租人",
  "担保人",
  "借款人",
  "贷款人",
  // Corporate officer labels:
  "公司秘书",
  "公司秘書",
  "执行董事",
  "執行董事",
  "非执行董事",
  "非執行董事",
  "独立非执行董事",
  "獨立非執行董事",
  "授权代表",
  "授權代表",
  "抵押人",
  "出借人",
  "出质人",
  "质权人",
  "发包人",
  "承包人",
  "出租方",
  "承租方",
  "担保方",
  "借款方",
  "贷款方",
  // Insurance party labels (introduce a named individual on life-insurance
  // claim decisions, underwriting forms, and benefit notices):
  "投保人",
  "被保险人",
  "受益人",
  "户名", // bank-account holder name on payment/disbursement forms
  "账户名",
  "开户名",
  // Healthcare physician role labels (introduce the signing clinician on
  // discharge summaries, medical certificates, and birth certificates):
  "主治医师",
  "住院医师",
  "签发医师",
  "经治医师",
  "主治医生",
  "住院医生",
  "接生人员",
  "体检医师",
  "主检医师",
];
const ORG_LABELS = [
  "代理机构",
  "采购代理机构",
  "代理机构名称",
  "公司名称",
  "机构全称",
  "单位名称",
  "采购单位",
  "供应商",
  "采购人",
  "中标供应商",
  "当事人",
  "中标人",
  "投标人",
  "甲方",
  "乙方",
  "开户行",
  "开户银行",
  "收款行",
  // Traditional / HK / TW aliases:
  "供應商",
  "採購人",
  "採購代理機構",
  "採購單位",
  "代理機構",
  "代理機構名稱",
  "當事人",
  "公司名稱",
  "機構全稱",
  "單位名稱",
  "開戶行",
  "開戶銀行",
  "收款行",
  "中標供應商",
];
const PROJECT_REF_LABELS = [
  "项目编号",
  "采购编号",
  "招标编号",
  "招标文件编号",
  "公告编号",
  "合同编号",
];
// Legal and finance reference labels (CASE_REF, Light). These cover court
// documents, invoices, customs, and accounting references that were entirely
// missed in batch one. Values must contain a digit (enforced in the validator).
const LEGAL_REF_LABELS = [
  "案号",
  "文书号",
  "文号",
  "判决书号",
  "裁定书号",
  "执行案号",
  "仲裁案号",
  "公证书编号",
];
// Procurement / logistics / listing reference labels (CASE_REF, Light). These
// identify a specific transaction or shipment on PO headers, delivery notes,
// e-commerce orders, and exchange listings. Values must contain a digit (enforced
// by PROJECT_REF_RE) so prose such as 订单管理 / 快递送达 stays readable.
const PROCUREMENT_REF_LABELS = [
  "订单号",
  "订单编号",
  "采购订单号",
  "快递单号",
  "运单号",
  "运单编号",
  "物流单号",
  "提单号",
  "提单编号",
  "报关单号", // also in FINANCE_REF_LABELS; dedup is safe (same kind/level)
  "回单号",
  "回执号",
  "受理号",
  "受理编号",
  "挂牌号",
  "挂牌编号",
  "保单号",
  "保单编号",
  "保函号",
  "保函编号",
  // Insurance claim references (CASE_REF). 赔案编号 / 赔案号 identify a
  // specific claim file on life/P&C insurance decision notices; the value is
  // an alphanumeric reference (CL-2026-0512-0034567), never prose.
  "赔案编号",
  "赔案号",
  "理赔案号",
  "报案号",
  "理赔编号",
  // Healthcare / medical record references (CASE_REF). 住院号 / 门诊号 / 病案号
  // identify a specific encounter or chart on hospital paperwork; the value
  // is a short alphanumeric code, never prose.
  "住院号",
  "门诊号",
  "病案号",
  "病历号",
  "就诊号",
  "急诊号",
  // Birth-certificate document references (CASE_REF). 出生证编号 /
  // 出生医学证明编号 identify a specific certificate; the value is a
  // formatted document number with spaces (O2026 0512 0034).
  "出生证编号",
  "出生医学证明编号",
  "出生证号",
  "挂号单号",
  "查询号",
  "查询码",
];
const FINANCE_REF_LABELS = [
  "发票号",
  "发票号码",
  "票据号",
  "票据编号",
  "报关单号",
  "备案号",
  "核销单号",
  "流水号",
  "凭证号",
  "凭证编号",
  "许可证编号",
  "批准文号",
  "备案文号",
];
// Cross-border / social identifiers (label-bound only; bare detection would be
// too FP-prone). WeChat IDs are arbitrary usernames, passport numbers vary by
// issuing country, vehicle plates are PRC-specific.
const CONTACT_HANDLE_LABELS = [
  "微信号",
  "微信",
  "QQ号",
  "QQ",
  "支付宝账号",
  "支付宝",
];
const PASSPORT_LABELS = ["护照号码", "护照号", "护照编号"];
const VEHICLE_PLATE_LABELS = ["车牌号", "车牌号码", "车牌编号", "车辆牌号"];
// Hong Kong / Traditional identifiers (label-bound, shape-validated, NO checksum).
// HK BR MOD-7 and HKID check-digit algorithms have multiple conflicting public
// descriptions (needs verification), so bare detection is NOT enabled. Labels
// are reliable anchors and the shape validators catch the canonical forms.
const HK_BR_LABELS = [
  "商业登记号",
  "商业登记证号",
  "商业登记号码",
  "商業登記號",
  "商業登記證號",
  "商業登記號碼",
];
const HK_ID_LABELS = [
  "香港身份证",
  "香港身份证号",
  "香港身份證",
  "香港身份證號",
  "身分證號",
  "身分證字號",
  "身分證號碼",
];
// Stock / securities code labels (CASE_REF). HK (.HK), Shanghai (.SH),
// Shenzhen (.SZ) suffixes. Pure shape — no checksum exists. Values must have
// a digit so 股份代号说明 / 证券代码简介 stay readable.
const STOCK_CODE_LABELS = [
  "股份代号",
  "股份代號",
  "股票代码",
  "股票代碼",
  "证券代码",
  "證券代碼",
  "港股代码",
  "港股代碼",
];

// Taxpayer / tax registration identifier labels (BUSINESS_ID, Light). Chinese
// corporate documents, invoices, and tax filings label the taxpayer identifier
// as 纳税人识别号 / 税务登记号 / 税号. The value is a 15-20 digit alphanumeric
// string. Label-bound only; bare digit runs without the label stay readable.
const TAX_ID_LABELS = [
  "纳税人识别号",
  "税务登记号",
  "税号",
];

const AMOUNT_LABELS = [
  "合同总金额",
  "合同金额",
  "中标金额",
  "成交金额",
  "采购预算",
  "预算金额",
  "项目预算",
  "注册资本",
  "投资总额",
  // Traditional / HK aliases
  "合同總金額",
  "中標金額",
  "成交金額",
  "採購預算",
  "預算金額",
  "項目預算",
  "註冊資本",
  "投資總額",
];

const PLACEHOLDER_VALUES = new Set([
  "见附件",
  "详见附件",
  "详见后附名单",
  "同上",
  "不详",
  "未知",
  "待定",
  "无",
  "暂无",
  "另附",
]);

const CHINESE_DATE_RE =
  /(?:19\d{2}|20\d{2})\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*日)?(?:\s*\d{1,2}\s*时(?:\s*\d{1,2}\s*分)?)?/g;
// Chinese-numeral dates (二〇二六年六月十八日 / 贰零贰陆年壹月拾伍日). Year and
// month are read digit-by-digit; the day also allows the compound ten-marker
// forms 十八/廿三/三十. Requires 年…月 so 年度报告 / 甲午战争 / 纯数字串 stay readable.
const NUMERAL = "[零〇一二三四五六七八九两壹贰叁肆伍陆染捌玖]";
const DAY_NUMERAL = "[零〇一二三四五六七八九两壹贰叁肆伍陆染捌玖十廿卅拾]";
const CHINESE_NUMERAL_DATE_RE = new RegExp(
  NUMERAL + "{4}年" + NUMERAL + "{1,2}月(?:" + DAY_NUMERAL + "{1,3}日)?",
  "g",
);
const RMB_WAN_YUAN_RE =
  /(?:人民币\s*)?[0-9０-９]{1,3}(?:[,，][0-9０-９]{3})*(?:\.[0-9０-９]+)?\s*万元/g;
const RMB_YI_YUAN_RE =
  /(?:人民币\s*)?[0-9０-９]{1,3}(?:[,，][0-9０-９]{3})*(?:\.[0-9０-９]+)?\s*亿元/g;
// Chinese-numeral RMB amounts written out in formal/financial form
// (处以一百五十万元罚款 / 支付人民币伍万捌仟元整 / 违法所得贰佰叁拾万元).
// Combined digit set: everyday numerals (一二三…十百千万亿, 〇/零) and the
// formal "大写" financial digits (壹贰叁肆伍陆柒捌玖拾佰仟) used on legal and
// arbitral documents. The regex matches any numeral run anchored by 元/元整;
// a structure guard (hasChineseNumeralAmountStructure) then rejects casual
// pocket-change phrases (一万元 / 一元 / 几元) so ordinary prose stays readable
// while formal multi-position amounts (一百五十万 / 伍万捌仟 / 贰佰叁拾万) are
// caught. Requires the trailing 元 anchor so 年/月/日 fragments are not swept.
const CN_NUMERAL_AMT_CHARS =
  "[零〇一二三四五六七八九十百千万亿壹贰叁肆伍陆柒捌玖拾佰仟]";
const RMB_CN_NUMERAL_RE = new RegExp(
  "(?:人民币\\s*)?" + CN_NUMERAL_AMT_CHARS + "+元(?:整|正)?",
  "g",
);
const RMB_CN_NUMERAL_WAN_YI_RE = new RegExp(
  "(?:人民币\\s*)?" + CN_NUMERAL_AMT_CHARS + "+[万亿]元(?:整|正)?",
  "g",
);

// Structure guard: returns the numeral run (text before 元/万元/亿元) from a
// full Chinese-numeral amount match, so the allow() filter can decide whether
// the amount carries enough compounding structure to redact.
function chineseNumeralRun(fullMatch: string): string {
  // Strip an optional 人民币 prefix and the trailing 元/元整/万元/亿元 anchor.
  return fullMatch
    .replace(/^人民币\s*/, "")
    .replace(/元(?:整|正)?$/, "")
    .replace(/[万亿]$/, "");
}

// A written-out Chinese-numeral amount looks formal when the numeral run has
// real compounding structure: ≥3 numeral positions, an internal power-of-ten
// multiplier (十/百/千/拾/佰/仟), or at least one formal 大写 financial digit.
// Bare 一万/一百/几万 without that structure stays readable as pocket-change.
function hasChineseNumeralAmountStructure(numeralRun: string): boolean {
  if (numeralRun.length >= 3) return true;
  if (/[十百千拾佰仟]/.test(numeralRun)) return true;
  if (/[壹贰叁肆伍陆柒捌玖拾佰仟]/.test(numeralRun)) return true;
  return false;
}
// Bare 万/亿 amounts with NO trailing 元 (合同金额80万 / 市值约80亿). The digit
// run must be directly followed by 万 or 亿, and the char after that must not be
// a counter (万人/1万个/3万年) nor 元 (covered by the 万元/亿元 rules). The counter
// guard is applied in the allow() filter, not the regex, so the regex itself
// stays simple. Accepts fullwidth digits (U+FF10-FF19) and fullwidth comma.
const BARE_WAN_YI_RE =
  /[0-9０-９]+(?:[,，][0-9０-９]{3})*(?:\.[0-9０-９]+)?\s*[万亿]/g;
const WAN_YI_COUNTER_AFTER =
  /^(?:人|个|家|名|位|岁|里|年|吨|公里|米|平米|平方米|分|秒|次|字|伏|瓦|赫|克|斤|桶|亩|公顷|件|盒|箱|车|辆|台|套|本|支|张|幅|尊|部|处|座|栋|条|块|片|株|头|只|匹|群|批)/;
const RMB_YUAN_RE =
  /[0-9０-９]+(?:[,，][0-9０-９]{3})*(?:\.[0-9０-９]+)?\s*元(?!年|旦|素)/g;
const FULLWIDTH_YEN_RE =
  /\uFFE5\s*[0-9０-９]{1,3}(?:[,，][0-9０-９]{3})*(?:\.[0-9０-９]+)?/g;
const REGULATORY_DOC_NO_RE =
  /[\u3400-\u9fff]{1,8}[〔［\[]\d{4}[〕］\]]\d{1,5}号/g;
// Same shape as REGULATORY_DOC_NO_RE but using full-width 【】 brackets, the
// dominant form in Chinese labour-arbitration awards (深劳人仲案【2022】8836号)
// and some court notices. The leading Han run is the case-type prefix
// (深劳人仲案 / 京海劳仲 / 沪一仲案), so 2-8 chars keeps 注释 / 说明 / 概述 prose
// out even when it happens to use 【】 footnotes.
const ARBITRATION_CASE_NO_RE =
  /[\u3400-\u9fff]{2,8}【\d{4}】(?:第?\d{1,6}(?:-\d{1,4})?)号/g;
const COURT_CASE_NO_RE =
  /[（(]\d{4}[)）][\u3400-\u9fff]{1,4}\d{0,4}[\u3400-\u9fff]{1,8}第?\d{1,6}号/g;
const AGREEMENT_PARTY_RE =
  /由\s*([\u3400-\u9fff·]{2,6})\s*与\s*([\u3400-\u9fff·]{2,6})\s*就/g;
// Signature / authorization contexts where a parenthesized 2-4 Han-char name is
// almost always a real person (签字：（张三）, 盖章：（李四）, 经办人：（王五）).
// Used to scope a PERSON candidate that the bare-context detector cannot reach.
const SIGNATURE_CONTEXT_LABELS = [
  "签字",
  "签署",
  "签章",
  "盖章",
  "盖童",
  "经办",
  "签署人",
  "签字人",
  "经办人",
  "负责人",
  "联系人",
  "代理人",
  "委托代理人",
  "法定代表人",
  "授权代表",
];
// Parenthetical tokens that look like names but are NOT (印章/附件/略/待定 etc).
// These must stay readable even after a signature label.
const SIGNATURE_NON_NAME = new Set([
  "盖章",
  "盖童", // OCR variant of 盖章
  "公童", // OCR variant of 公章
  "公章",
  "签字",
  "签署",
  "签章",
  "略",
  "待定",
  "附件",
  "见附件",
  "详见附件",
  "另附",
  "不详",
  "未知",
  "无",
  "暂无",
  "同上",
  "注",
]);
const CHINESE_ROLE_TERMS = new Set([
  "甲方",
  "乙方",
  "丙方",
  "双方",
  "各方",
  "公司",
  "本司",
  "本人",
]);

// Demographic descriptors that appear as comma-separated fields inside a
// party/subject block (被申请人：李某某，女，汉族，住址：…). These are NOT names
// even though they pass the 2-6 Han-char PERSON_RE shape, so they must be
// excluded from person candidates to avoid leaking gender/ethnicity into a
// PERSON_ placeholder. Includes the official PRC ethnic-group names plus the
// common gender/age descriptors 男/女/老/少.
const CHINESE_DEMOGRAPHIC_TERMS = new Set([
  "汉族",
  "回族",
  "满族",
  "蒙古族",
  "藏族",
  "维吾尔族",
  "苗族",
  "彝族",
  "壮族",
  "布依族",
  "侗族",
  "瑶族",
  "白族",
  "土家族",
  "哈尼族",
  "哈萨克族",
  "傣族",
  "黎族",
  "傈僳族",
  "佤族",
  "畲族",
  "高山族",
  "拉祜族",
  "水族",
  "东乡族",
  "纳西族",
  "景颇族",
  "柯尔克孜族",
  "土族",
  "达斡尔族",
  "仫佬族",
  "羌族",
  "布朗族",
  "撒拉族",
  "毛南族",
  "仡佬族",
  "锡伯族",
  "阿昌族",
  "普米族",
  "塔吉克族",
  "怒族",
  "乌孜别克族",
  "俄罗斯族",
  "鄂温克族",
  "德昂族",
  "保安族",
  "裕固族",
  "京族",
  "塔塔尔族",
  "独龙族",
  "鄂伦春族",
  "赫哲族",
  "门巴族",
  "珞巴族",
  "基诺族",
  "外籍",
  "无族",
  "男",
  "女",
]);

// Context-organization detection (outside labels). Only STRONG suffixes that
// are essentially organizational are used; weak common-noun suffixes such as
// 公司 / 局 / 中心 / 部 / 会 are intentionally excluded because they appear in
// ordinary prose ("我公司", "市中心医院", "各部委"). Sorted longest-first so
// 集团有限公司 wins over 有限公司. The body charset deliberately excludes space
// so the match cannot greedily eat preceding prose ("本次采购由 <org>").
const ORG_STRONG_SUFFIXES = [
  "集团有限公司",
  "股份有限公司",
  "有限责任公司",
  "有限公司",
  "普通合伙",
  "合伙企业",
  "事务所",
  "研究院",
  "研究所",
  "实验室",
  "医院",
  "学校",
  "大学",
  "学院",
  // Traditional / HK / TW aliases (same chars except where they differ):
  "集團有限公司",
  "股份有限公司",
  "有限責任公司",
  "普通合夥",
  "合夥企業",
  "事務所",
  "研究所",
  "實驗室",
  "醫院",
  "學校",
  "大學",
  "學院",
];
const ORG_STRONG_SUFFIX_RE = new RegExp(
  String.raw`(?<![\u3400-\u9fffA-Za-z0-9])` +
    String.raw`([\u3400-\u9fffA-Za-z0-9()（）\u00b7.&'\-]{2,40}` +
    String.raw`(?:${ORG_STRONG_SUFFIXES.join("|")}))`,
  "g",
);
const COMMON_NOUN_PREFIX_RE = /^(我|本|该|此|其|各|全)/;

const USCC_RE = /^[0-9A-HJ-NPQRTUWXY]{18}$/;
const PRC_ID_RE = /^[1-9]\d{16}[\dXx]$/;

// Bare (unlabeled) USCC / PRC-ID detection. The charset is restricted IN the
// regex (USCC excludes I/O/S/V/Z; both use ASCII word-boundary lookarounds so a
// match can never be a slice of a longer hex/UUID/serial run). The checksum and
// (for PRC ID) date checks then run as an allow() filter — see the FP-rate
// notes on isValidUscc/isValidPrcId. The USCC rule additionally requires at
// least one letter, because ~32% of random 18-digit runs pass the USCC checksum
// (the check character can itself be a digit); a real USCC's organization-
// identifier portion (GB 11714) is effectively always alphanumeric.
const BARE_USCC_RE = /(?<![0-9A-Za-z])[0-9A-HJ-NPQRTUWXY]{18}(?![0-9A-Za-z])/g;
const BARE_PRC_ID_RE = /(?<![0-9A-Za-z])[1-9]\d{16}[\dXx](?![0-9A-Za-z])/g;
const PHONE_RE = /^(?:\+?86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})$/;
// Bank accounts: 16-19 digits, optionally grouped as 4-digit space-separated
// blocks (e.g. 6222 0000 0000 0000). The spacing variant is normalized by
// stripping spaces before the length check; a single regex with backreferences
// would be more brittle than the two-shape union below.
const BANK_ACCOUNT_RE = /^(?:\d{16,19}|(?:\d{4}\s){3}\d{4}(?:\s\d{1,3})?)$/;
// Procurement / contract / document reference shape. Must contain at least
// one digit (lookahead) so prose such as 订单管理 / 快递送达 stays readable.
// Internal single-space groups are allowed so formatted document numbers such
// as birth-certificate refs (O2026 0512 0034) and serialised IDs validate,
// but the value must still start and end on an alphanumeric and be dominated
// by alphanumerics (≥60%), so prose phrases cannot slip through.
const PROJECT_REF_RE =
  /^(?=[A-Za-z0-9._/ -]*\d)[A-Za-z0-9](?:[A-Za-z0-9._/ -]{2,48}[A-Za-z0-9])?$/;
// WeChat IDs: must start with a letter, 6-20 chars, letters/digits/_/-.
const WECHAT_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{5,19}$/;
// Passport numbers: a letter followed by 8 digits (PRC E/G shape) is the most
// common, but accept letter+6-9 digits for other issuers. Some Chinese
// e-passports and many foreign passports use a 2-letter prefix (e.g. EM, KJ)
// before 6-9 digits, so allow a 1- or 2-letter prefix.
const PASSPORT_RE = /^[A-Za-z]{1,2}\d{6,9}$/;
// Masked (asterisked) PRC national IDs as published by courts and credit
// platforms: 6-10 leading digits (the visible birth-date/region segment), a
// run of 4-8 asterisks, then a 4-digit suffix (e.g. 41112119******1010,
// 3201151988****0022). These are not valid checksum IDs but are still
// identifying; catching the WHOLE masked string as NATIONAL_ID also shadows
// the leading digit run that the generic phone regex would otherwise split
// off as a phone. Requiring a run of asterisks makes this high-precision (no
// real ID, amount, or date contains asterisks).
const MASKED_PRC_ID_RE = /\b\d{6,10}\*{4,8}\d{4}\b/g;
// PRC vehicle plates: province Han char + letter + 5-6 alphanumerics, or new-
// energy (8 chars). e.g. 京A12345 / 粤B12345D.
const VEHICLE_PLATE_RE = /^[\u3400-\u9fff][A-Za-z][A-Za-z0-9]{4,6}$/;
// HK Business Registration: 8 digits, optionally followed by a hyphen and a
// check digit (12345678-9). No checksum is validated (MOD-7: needs verification).
const HK_BR_RE = /^\d{8}(?:-\d)?$/;
// HK Identity Card: 1-2 letters + 6 digits + optional parenthesized check
// digit (A123456(7), AB123456(1)). No checksum is validated (needs verification).
// NOTE: cleanChineseValue strips a trailing ')' (balanced-punctuation), so the
// validator accepts both the bracketed and the paren-stripped form.
const HK_ID_RE = /^[A-Za-z]{1,2}\d{6}(?:\([A0-9]\)|\(?[A0-9])?$/;
// Securities / stock codes with exchange suffix. HK (.HK), Shanghai (.SS or
// .SH), Shenzhen (.SZ). Also accepts a bare 5-6 digit run after the label,
// but the suffix form is the safest because a bare digit run collides with
// other numeric references.
const STOCK_CODE_RE = /^\d{4,6}(?:\.(?:HK|SS|SH|SZ))?$/;
// Taxpayer / tax registration identifier: 15-20 alphanumeric chars. Chinese
// individual and corporate taxpayer identifiers range from 15-20 characters.
const TAX_ID_RE = /^[A-Za-z0-9]{15,20}$/;
const POSTCODE_RE = /^\d{6}$/;
const PERSON_RE = /^[\u3400-\u9fff·]{2,6}$/;
const PERSON_VALUE_RE = /^([\u3400-\u9fff·]{2,6}|[A-Za-z \-'.]{2,40})$/;
const ORG_RE = /^[\u3400-\u9fffA-Za-z0-9()（）·.&' -]{2,60}$/;
const ADDRESS_SUFFIX_RE =
  /省|市|区|县|镇|乡|村|路|街|道|号|室|楼|栋|幢|大厦|广场|中心|工业区|开发区|园区|區|縣|鎮|鄉|號|樓|棟|大廈|廣場|工業區|開發區|園區/;

// --- PRC identifier checksum validators (GB 32100-2015 USCC, GB 11643-1999
//     resident ID). Deterministic, browser-only, no backend/AI. Exported so they
//     can be unit-tested directly.
//
// USCC (Unified Social Credit Code): 18 chars from the 31-symbol alphabet
// (0-9, A-Z excluding I/O/S/V/Z). Check char c18 satisfies
// (sum(v[i]*W[i]) + v[17]) mod 31 == 0, where W[i] = 3^i mod 31.
const USCC_ALPHABET = "0123456789ABCDEFGHJKLMNPQRTUWXY";
const USCC_WEIGHTS = [
  1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28,
];
const USCC_VALUE: ReadonlyMap<string, number> = new Map(
  [...USCC_ALPHABET].map((char, i) => [char, i] as const),
);

// PRC resident ID: 18 chars [1-9]\d{16}[\dX]. Check char from
// ISO 7064 MOD 11-2 with weights 2^(17-i) mod 11. The YYYYMMDD portion
// (positions 7-14, 1-indexed) must also be a real Gregorian date.
const PRC_ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const PRC_ID_CHECK = ["1", "0", "X", "9", "8", "7", "6", "5", "4", "3", "2"];

export function isValidUscc(value: string): boolean {
  if (value.length !== 18) return false;
  const codes: number[] = [];
  for (let i = 0; i < 18; i += 1) {
    const v = USCC_VALUE.get(value[i]);
    if (v === undefined) return false;
    codes.push(v);
  }
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += codes[i] * USCC_WEIGHTS[i];
  return (31 - (sum % 31)) % 31 === codes[17];
}

export function isValidPrcId(value: string): boolean {
  const v = value.toUpperCase();
  if (!/^[1-9]\d{16}[\dX]$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) sum += Number(v[i]) * PRC_ID_WEIGHTS[i];
  if (PRC_ID_CHECK[sum % 11] !== v[17]) return false;
  const year = Number(v.slice(6, 10));
  const month = Number(v.slice(10, 12));
  const day = Number(v.slice(12, 14));
  return year >= 1900 && year <= 2099 && isValidGregorianDate(year, month, day);
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isValidGregorianDate(
  year: number,
  month: number,
  day: number,
): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  return day <= daysInMonth[month - 1];
}

export function hasHanText(text: string): boolean {
  return HAN_RE.test(text);
}

export function detectChinese(doc: RedactionInput, add: AddCandidate): void {
  // Bare USCC and bare PRC resident IDs are checksum/date-gated and have
  // negligible false-positive rates in ANY language context, so they run even
  // when the document has no Han text (e.g. an English table cell or an
  // isolated identifier line). Everything else requires Han context.
  detectBareIdentifiers(doc, add);
  if (!hasHanText(doc.text)) return;

  detectChineseDirectPatterns(doc, add);
  detectChineseLabelValues(doc, add);
  detectChineseAddressContinuations(doc, add);
  detectContextOrgs(doc, add);
  detectAgreementParties(doc, add);
  detectSignatureNames(doc, add);
  detectCourtSignatureNames(doc, add);
  detectHonorificNames(doc, add);
}

// Bare PRC direct identifiers (USCC + resident ID). Always runs regardless of
// language context because the GB-standard checksums are language-independent.
function detectBareIdentifiers(doc: RedactionInput, add: AddCandidate): void {
  applyRegex(
    doc,
    BARE_USCC_RE,
    "BUSINESS_ID",
    1,
    "bare Unified Social Credit Code (checksum)",
    add,
    (match) => isPlausibleBareUscc(match.text),
  );
  applyRegex(
    doc,
    BARE_PRC_ID_RE,
    "NATIONAL_ID",
    1,
    "bare PRC resident identity number (checksum + date)",
    add,
    (match) => isValidPrcId(match.text),
  );
}

function cleanChineseValue(raw: string): string {
  return raw
    .trim()
    .replace(
      /^[\s,.;:()[\]{}<>"'“”‘’、，。；：（）《》【】]+|[\s,.;:()[\]{}<>"'“”‘’、，。；：（）《》【】]+$/g,
      "",
    )
    .replace(/\s+/g, " ");
}

function labelAlt(labels: string[]): string {
  return [...labels].sort((a, b) => b.length - a.length).join("|");
}

function isPlaceholder(value: string): boolean {
  return !value || PLACEHOLDER_VALUES.has(value);
}

function detectChineseDirectPatterns(
  doc: RedactionInput,
  add: AddCandidate,
): void {
  // (Bare USCC/PRC-ID detection lives in detectBareIdentifiers, which runs
  // regardless of Han context. Do not duplicate it here.)
  applyRegex(doc, CHINESE_DATE_RE, "DATE", 2, "Chinese date", add);
  applyRegex(
    doc,
    CHINESE_NUMERAL_DATE_RE,
    "DATE",
    2,
    "Chinese numeral date",
    add,
  );
  // Asterisk-masked PRC national IDs published in court disclosures and credit
  // reports (dddddddd******dddd). These are identifying even though invalid
  // checksums; catching them here also prevents the leading digit run from
  // leaking as a PHONE token via the generic phone regex.
  applyRegex(
    doc,
    MASKED_PRC_ID_RE,
    "NATIONAL_ID",
    1,
    "masked PRC national ID",
    add,
  );
  applyRegex(doc, RMB_WAN_YUAN_RE, "AMOUNT", 2, "RMB wan-yuan amount", add);
  applyRegex(doc, RMB_YI_YUAN_RE, "AMOUNT", 2, "RMB yi-yuan amount", add);
  // Written-out Chinese-numeral RMB amounts (一百五十万元 / 人民币伍万捌仟元整 /
  // 贰佰叁拾万元). The wan/yi variant is scored first so the longer anchored
  // form wins over the plain 元 form. The allow() filter rejects casual
  // pocket-change phrases (一万元 / 一元) via the structure guard.
  applyRegex(
    doc,
    RMB_CN_NUMERAL_WAN_YI_RE,
    "AMOUNT",
    2,
    "Chinese-numeral wan/yi RMB amount",
    add,
    (match) => hasChineseNumeralAmountStructure(chineseNumeralRun(match.text)),
  );
  applyRegex(
    doc,
    RMB_CN_NUMERAL_RE,
    "AMOUNT",
    2,
    "Chinese-numeral RMB amount",
    add,
    (match) => hasChineseNumeralAmountStructure(chineseNumeralRun(match.text)),
  );
  applyRegex(doc, FULLWIDTH_YEN_RE, "AMOUNT", 2, "fullwidth-yen amount", add);
  applyRegex(doc, RMB_YUAN_RE, "AMOUNT", 2, "RMB yuan amount", add, (match) => {
    const before = doc.text.slice(Math.max(0, match.index - 4), match.index);
    const after = doc.text[match.index + match.text.length] ?? "";
    return !before.includes("单价") && !/[\/／]/.test(after);
  });
  // Bare 万/亿 amounts (合同金额80万 / 市值约80亿). The allow() filter rejects
  // matches whose 万/亿 is followed by a counter noun or by 元 (which the
  // 万元/亿元 rules already cover).
  applyRegex(
    doc,
    BARE_WAN_YI_RE,
    "AMOUNT",
    2,
    "bare Chinese wan/yi amount",
    add,
    (match) => isPlausibleBareWanYi(doc.text, match),
  );
  applyRegex(
    doc,
    REGULATORY_DOC_NO_RE,
    "CASE_REF",
    1,
    "Chinese regulatory document number",
    add,
  );
  applyRegex(
    doc,
    ARBITRATION_CASE_NO_RE,
    "CASE_REF",
    1,
    "Chinese arbitration case number",
    add,
  );
  applyRegex(
    doc,
    COURT_CASE_NO_RE,
    "CASE_REF",
    1,
    "Chinese court case number",
    add,
  );
  // Standalone bracketed Chinese document/case reference numbers. The
  // REGULATORY_DOC_NO_RE pattern already catches forms like
  // 沪〔2025〕56号 when preceded by 2-8 Han chars, and COURT_CASE_NO_RE
  // catches parenthesized-year court case forms. This covers the remaining
  // standalone 〔YYYY〕NN号 and [YYYY]NN-{1,2}NN号 forms that appear in
  // regulator penalty titles (中国证监会〔2025〕76号, 汕市监处罚[2025]21-102号).
  // The year must be 19xx-20xx and followed by 〕/] and a digit, so ordinary
  // bracketed legislative citations and ranges stay readable.
  // Use two separate regexes: one for the fullwidth-bracket form, one for the
  // ASCII-bracket form [YYYY], so the bracket character classes don't overlap.
  applyRegex(
    doc,
    /[\u300C\u300D（(]?(?:19|20)\d{2}[\u300D\u300E）)][^\r\n。；;]{1,30}号/g,
    "CASE_REF",
    1,
    "Chinese standalone bracketed case/document reference",
    add,
    isPlausibleDqCaseRef,
  );
  // Cover ASCII-bracket form: [2025]21-102号 (common in local regulator penalties).
  applyRegex(
    doc,
    /\[(?:19|20)\d{2}\][^\r\n。；;]{1,30}号/g,
    "CASE_REF",
    1,
    "Chinese ASCII-bracket case reference [YYYY]NN-NN号",
    add,
    isPlausibleDqCaseRef,
  );
  // 国市监处罚 / 证监许可 / 沪市监处罚 等 agency-prefixed reference forms.
  // These appear on SAMR/CSRC/local regulator penalty headers and must be
  // caught even when the full body-string prefix characters are more than the
  // 8 chars allowed by REGULATORY_DOC_NO_RE.
  applyRegex(
    doc,
    /[\u3400-\u9fff]{2,30}[〔［[][(]?(?:19|20)\d{2}[)）]?[〕］\]]\d{1,5}号/g,
    "CASE_REF",
    1,
    "Chinese agency-prefixed bracketed case reference",
    add,
    (match) => isPlausibleRefValue(match.text),
  );
  // Birth year context: 年X月出生 or 年X日出生. These appear in regulatory
  // penalty decisions as highly identifying personal data. The pattern
  // requires 出生 immediately after the month segment, so generic year-month
  // prose (2026年6月期间经营业绩) stays readable. The digit class also
  // accepts X as a legal anonymization placeholder (196X年X月出生).
  applyRegex(
    doc,
    /(?:19|20)[\dX]{2}[年]\s*[\dX]{1,2}[月日](?:\s*[\dX]{1,2}[日])?\s*出生/g,
    "DATE",
    1,
    "Chinese birth date (年X月出生 pattern)",
    add,
  );
  // Chinese legal anonymized personal names (某-pattern). Regulatory penalty
  // decisions, court judgments, and administrative rulings mask personal names
  // as 李某廷 / 王某鹏 / 陈某 / 赵某华 — a single Han surname followed by 某
  // and an optional 1-2 Han given-name character. The 某 infix is distinctive
  // to legal anonymization and does not appear in ordinary names or prose.
  // Minimally, 2 chars (李+某); maximally, 4 chars (欧阳+某+华). The pattern
  // only fires in Han text, so standalone 某 in mixed-language docs is safe.
  // Boundary check (no Han char before the surname) is done in the allow()
  // filter to avoid lookbehind compatibility issues.
  applyRegex(
    doc,
    // 某-pattern name: surname + 某 + 0-2 given chars, must NOT be followed by
    // another Han char (prevents greedily swallowing following text).
    // At Balanced this is a trade-off: names embedded mid-sentence in Han text
    // (王某鹏参与...) may leak, but names at boundary or followed by punctuation
    // are caught cleanly. Heavy level catches via NON_LATIN_TEXT.
    /[\u3400-\u9fff]某[\u3400-\u9fff]{0,2}(?![\u3400-\u9fff])/g,
    "PERSON",
    2,
    "Chinese anonymized legal personal name (某-pattern)",
    add,
    (match) => isPlausibleMouName(cleanChineseValue(match.text)),
  );
  detectAgreementParties(doc, add);
}

// 某-pattern name validator: must be a Han surname + 某 + optional given name.
// Rejects common prose uses: 某些 (some), 某年/某月 (indefinite time), 某人
// (someone), 某某 (placeholder). The anonymous name MUST start with a real Han
// char that is a surname (any single Han char except 某 itself), so 某某集团
// and bare 某 are rejected. Also rejects matches where the char before the
// match is a Han character (to prevent slicing from longer words like 董事长).
function isPlausibleMouName(value: string): boolean {
  if (typeof value !== "string" || value.length < 2 || value.length > 4)
    return false;
  // 某人/某些/某种/某件/某地 – indefinite pronouns, not names.
  if (/^某[人些种件地]/u.test(value)) return false;
  // 某年/某月/某日 – indefinite time expressions.
  if (/^某[年月日]/u.test(value)) return false;
  // 某某 – placeholder, not a name.
  if (value.startsWith("某某")) return false;
  // If the char immediately after 某 is 年/月/日/人/件 etc, not a name.
  if (/某[年月日人些种件地时]/u.test(value)) return false;
  // Must start with a non-某 Han char (the surname).
  return /^[\u3400-\u9fff]某[\u3400-\u9fff]*$/.test(value);
}

// Standalone bracketed case-reference guard: the value after the bracket must
// contain a digit (the case number), and the bracket must not enclose a plain
// year range or legislative article citation.
function isPlausibleDqCaseRef(match: { text: string; index: number }): boolean {
  // The regex already requires the year bracket followed by content ending in 号,
  // so the shape is inherently specific. The allow() filter just ensures digit
  // content so bare 号 with no case number is not caught.
  return /\d/.test(match.text);
}

function applyRegex(
  doc: RedactionInput,
  regex: RegExp,
  kind: CandidateKind,
  level: number,
  reason: string,
  add: AddCandidate,
  allow: (match: { text: string; index: number }) => boolean = () => true,
): void {
  regex.lastIndex = 0;
  for (const match of doc.text.matchAll(regex)) {
    const index = match.index ?? 0;
    const value = cleanChineseValue(match[0]);
    if (!value || !allow({ text: match[0], index })) continue;
    add(value, kind, level, reason, doc.name, index);
  }
}

function detectChineseLabelValues(
  doc: RedactionInput,
  add: AddCandidate,
): void {
  applyLabelRules(doc, USCC_LABELS, "BUSINESS_ID", 1, "USCC label", add, (v) =>
    USCC_RE.test(v),
  );
  applyLabelRules(
    doc,
    PRC_ID_LABELS,
    "NATIONAL_ID",
    1,
    "PRC resident ID label",
    add,
    (v) => PRC_ID_RE.test(v),
  );
  applyLabelRules(
    doc,
    PHONE_LABELS,
    "PHONE",
    1,
    "Chinese phone label",
    add,
    (v) => PHONE_RE.test(v),
  );
  applyLabelRules(
    doc,
    BANK_ACCOUNT_LABELS,
    "BANK_ACCOUNT",
    2,
    "Chinese bank account label",
    add,
    (v) => BANK_ACCOUNT_RE.test(v),
  );
  applyLabelRules(
    doc,
    ADDRESS_LABELS,
    "ADDRESS",
    2,
    "Chinese address label",
    add,
    isPlausibleAddress,
    (value) => [value],
    trimAddressAtNextLabel,
  );
  applyLabelRules(
    doc,
    PERSON_LABELS,
    "PERSON",
    2,
    "Chinese person label",
    add,
    (v) =>
      PERSON_VALUE_RE.test(v) &&
      !CHINESE_DEMOGRAPHIC_TERMS.has(v) &&
      !CHINESE_ROLE_TERMS.has(v),
    splitChineseList,
  );
  applyLabelRules(
    doc,
    ORG_LABELS,
    "ORG",
    2,
    "Chinese organization label",
    add,
    isPlausibleOrg,
  );
  applyLabelRules(
    doc,
    PROJECT_REF_LABELS,
    "CASE_REF",
    2,
    "Chinese procurement/contract reference label",
    add,
    (v) => PROJECT_REF_RE.test(v),
  );
  // Legal and finance reference labels (Light, direct references). The value
  // must contain a digit so prose like "流水线生产" / "凭证管理" stays readable.
  applyLabelRules(
    doc,
    LEGAL_REF_LABELS,
    "CASE_REF",
    1,
    "Chinese legal reference label",
    add,
    isPlausibleRefValue,
  );
  applyLabelRules(
    doc,
    FINANCE_REF_LABELS,
    "CASE_REF",
    1,
    "Chinese finance reference label",
    add,
    isPlausibleRefValue,
  );
  // Procurement / logistics / listing references (Light). The value shape is the
  // same as project/contract refs (PROJECT_REF_RE), so e.g. DD20260618001,
  // SF1234567890, GP2026-001 are caught while 订单状态 / 快递送达 stay readable.
  applyLabelRules(
    doc,
    PROCUREMENT_REF_LABELS,
    "CASE_REF",
    1,
    "Chinese procurement/logistics reference label",
    add,
    (v) => PROJECT_REF_RE.test(v),
  );
  // Social / contact handles (CHANNEL, Balanced). Label-bound only: WeChat IDs
  // and QQ numbers have no fixed checksum and bare detection would be unsafe.
  // The validator accepts the WeChat username shape OR a digit-bearing handle
  // (QQ numbers, numeric IDs) so labeled values are caught without over-
  // reaching into prose.
  applyLabelRules(
    doc,
    CONTACT_HANDLE_LABELS,
    "CHANNEL",
    2,
    "Chinese contact handle label",
    add,
    isPlausibleContactHandle,
  );
  // Passport and vehicle-plate identifiers (label-bound). Passport -> NATIONAL_ID,
  // vehicle plate -> BUSINESS_ID (it is an asset identifier, not a person).
  applyLabelRules(
    doc,
    PASSPORT_LABELS,
    "NATIONAL_ID",
    1,
    "Chinese passport number label",
    add,
    (v) => PASSPORT_RE.test(v),
  );
  applyLabelRules(
    doc,
    VEHICLE_PLATE_LABELS,
    "BUSINESS_ID",
    1,
    "Chinese vehicle plate label",
    add,
    (v) => VEHICLE_PLATE_RE.test(v),
  );
  // Hong Kong / Traditional identifiers (label-bound, shape-validated).
  // HK BR -> BUSINESS_ID (entity identifier), HKID -> NATIONAL_ID.
  // Checksums are NOT validated (HK BR MOD-7 / HKID check digit:
  // needs verification), so bare detection stays disabled; the label is the
  // trust anchor and the shape validator catches the canonical forms.
  applyLabelRules(
    doc,
    HK_BR_LABELS,
    "BUSINESS_ID",
    1,
    "Hong Kong Business Registration label",
    add,
    (v) => HK_BR_RE.test(v),
  );
  applyLabelRules(
    doc,
    HK_ID_LABELS,
    "NATIONAL_ID",
    1,
    "Hong Kong Identity Card label",
    add,
    (v) => HK_ID_RE.test(v),
  );
  applyLabelRules(
    doc,
    STOCK_CODE_LABELS,
    "CASE_REF",
    2,
    "Chinese stock / securities code label",
    add,
    (v) => STOCK_CODE_RE.test(v),
  );
  applyLabelRules(
    doc,
    POSTCODE_LABELS,
    "POSTCODE",
    1,
    "Chinese postcode label",
    add,
    (v) => POSTCODE_RE.test(v),
  );
  applyLabelRules(
    doc,
    TAX_ID_LABELS,
    "BUSINESS_ID",
    1, // light
    "Chinese taxpayer identifier label",
    add,
    (v) => TAX_ID_RE.test(v),
  );
  applyLabelRules(
    doc,
    AMOUNT_LABELS,
    "AMOUNT",
    2, // balanced
    "Chinese amount label",
    add,
    (v) => /\d/.test(v),
  );
}

// Multi-line labeled Chinese addresses. The single-line applyLabelRules only
// captures text up to a hard stop on the SAME line, so a wrapped address such
// as
//   住所：
//   江苏省南京市玄武区虚构路1号
//   科技园A栋3层301室
//   联系电话：...
// loses lines 2+ and also over-captures the following label line. This detector
// walks subsequent lines, folding address-looking fragments into one collapsed
// candidate, and stops at a new label, a blank line, or an enumerated item.
function detectChineseAddressContinuations(
  doc: RedactionInput,
  add: AddCandidate,
): void {
  const lines = doc.text.split(/\r?\n/);
  const offsets: number[] = [];
  let searchPos = 0;
  for (const line of lines) {
    const pos = doc.text.indexOf(line, searchPos);
    offsets.push(pos);
    searchPos = pos + line.length + 1;
  }
  const labelSoloRe = new RegExp(
    `^\\s*(?:${labelAlt(ADDRESS_LABELS)})${LABEL_SYNONYM_PARENS}${LABEL_SEP}$`,
  );
  for (let i = 0; i < lines.length; i += 1) {
    if (!labelSoloRe.test(lines[i])) continue;
    const parts: string[] = [];
    let firstOffset = -1;
    for (let cursor = i + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor].trim();
      if (!candidate) break;
      if (chineseAddressContinuationStop(candidate)) break;
      if (!isPlausibleAddressFragment(candidate)) break;
      if (firstOffset < 0) firstOffset = offsets[cursor];
      parts.push(candidate);
      // Real Chinese addresses frequently span 4-5 lines (province -> city ->
      // district -> street -> building/room). isPlausibleAddressFragment already
      // rejects prose, so a higher cap is safe and catches addresses that the
      // old 3-line limit truncated.
      if (parts.length >= 5) break;
    }
    if (parts.length === 0) continue;
    const collapsed = cleanChineseValue(parts.join(" "));
    if (isPlausibleAddress(collapsed)) {
      add(
        collapsed,
        "ADDRESS",
        2,
        "Chinese multi-line labeled address",
        doc.name,
        firstOffset < 0 ? offsets[i] : firstOffset,
      );
    }
  }
  detectInlineAddressWraps(doc, add, lines, offsets);
}

// Inline labeled addresses that wrap across a soft newline. PDF text extraction
// commonly breaks a single address so that the street portion (ending in 號/号)
// stays on the label line while the floor/room/building portion (樓/层/室/棟…)
// spills onto the next line. The single-line label rule only captures up to the
// newline and loses the continuation. This pass finds an inline
// `<address-label>：<partial>` line whose partial value looks like an address,
// then folds subsequent address-fragment continuation lines into one candidate.
// Guards against FP:
//   1. The label-line value must itself look like an address (has a 路/街/道/
//      號/号/室… suffix or a digit + counter punctuation).
//   2. Each continuation line must START with a building/floor/room marker so a
//      following prose sentence ("本公司保留最終解釋權") is never swallowed.
//   3. Stops at a blank line, a new label, an enumerated item, or any line that
//      is not a plausible address fragment.
const ADDRESS_CONTINUATION_START_RE =
  /^(?:第?\d|[A-Za-z]|樓|楼|層|层|室|棟|栋|幢|座|期|區|区|号|號|大厦|大廈|广场|廣場|中心|工业区|工業區|开发区|開發區|园区|園區|号院|號院|附楼|附樓)/;

function detectInlineAddressWraps(
  doc: RedactionInput,
  add: AddCandidate,
  lines: string[],
  offsets: number[],
): void {
  const labelInlineRe = new RegExp(
    `^(?:${labelAlt(ADDRESS_LABELS)})${LABEL_SYNONYM_PARENS}${LABEL_SEP}([^\\r\\n。；;]+)$`,
  );
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(labelInlineRe);
    if (!m) continue;
    const head = cleanChineseValue(m[1] ?? "");
    if (!head || !isPlausibleAddressFragment(head)) continue;
    // Only fold when the captured head looks truncated: it should look like an
    // address but a continuation exists. Require a digit so label-only or
    // placeholder values (e.g. "見附件") do not trigger folding.
    if (!/\d/.test(head)) continue;
    const parts: string[] = [head];
    const firstOffset =
      (offsets[i] ?? 0) + (m[0].length - (m[1]?.length ?? 0));
    for (let cursor = i + 1; cursor < lines.length; cursor += 1) {
      // Truncate at the first hard stop so a sentence continuing on the same
      // line (e.g. "20樓2000室。聯絡電話：") does not get swallowed: only the
      // "20樓2000室" fragment before the period is an address continuation.
      const candidate = lines[cursor]
        .split(/[。；;]/)[0]
        .trim();
      if (!candidate) break;
      if (chineseAddressContinuationStop(candidate)) break;
      if (!ADDRESS_CONTINUATION_START_RE.test(candidate)) break;
      if (!isPlausibleAddressFragment(candidate)) break;
      parts.push(candidate);
      if (parts.length >= 4) break;
    }
    if (parts.length <= 1) continue;
    const collapsed = cleanChineseValue(parts.join(" "));
    if (isPlausibleAddress(collapsed)) {
      add(
        collapsed,
        "ADDRESS",
        2,
        "Chinese wrapped labeled address",
        doc.name,
        firstOffset,
      );
    }
  }
}

function chineseAddressContinuationStop(line: string): boolean {
  // Another label on a fresh line ends the address.
  if (/^[\u3400-\u9fff]{1,10}\s*[：:]/.test(line)) return true;
  // Enumerated item.
  if (/^\s*[（(]\d/.test(line) || /^\s*\d+\./.test(line)) return true;
  return false;
}

function isPlausibleAddressFragment(line: string): boolean {
  if (line.length > 80) return false;
  return (
    ADDRESS_SUFFIX_RE.test(line) || (/\d/.test(line) && /[、，,]/.test(line))
  );
}

// Leading phrases that the strong-suffix org regex can sweep into a match when
// the org name follows a verb-of-acquisition / connective in prose. These are
// generic connective tails, not part of any entity name, so trimming them keeps
// the org span tight without leaking the preceding sentence into the placeholder
// (e.g. "可转换债券等方式收购北京聚利科技有限公司" -> "北京聚利科技有限公司").
// Each entry must end on a boundary that an entity name would not start with.
const ORG_LEADING_PROSE_RE =
  /^(?:可?转换债券|公司债券|股权|现金|资产|增资|发行股份|股份|债券|等方式)?(?:等?(?:方式|形式|途径)?)?(?:收购|并购|重组|购买|受让|增持|入股|投资|取得|受让|划转|置换)+/;
// Single-char particles / prepositions / conjunctions that glue directly to the
// front of an org name in running prose (对…给予警告 / 与…签订 / 由…承担).
const ORG_LEADING_PARTICLE_RE = /^(?:对|与|由|向|为|替|给|把|被|将|让|使|按|据|沿|顺)$/;

function trimOrgLeadingProse(value: string): {
  value: string;
  trimmed: number;
} {
  let trimmed = 0;
  // First pass: strip a verb-of-acquisition connective tail (greediest).
  const proseMatch = value.match(ORG_LEADING_PROSE_RE);
  if (proseMatch) {
    trimmed = proseMatch[0].length;
    value = value.slice(trimmed);
  }
  // Second pass: repeatedly strip leading single-char particles / punctuation
  // so "对上海…" / "、北京…" / "，深圳…" collapse to the entity itself.
  while (value.length > 0) {
    const head = value[0] ?? "";
    if (ORG_LEADING_PARTICLE_RE.test(head)) {
      value = value.slice(1);
      trimmed += 1;
      continue;
    }
    if (/[\s,.;:()[\]{}<>"'“”‘’、，。；：（）《》【】、]/.test(head)) {
      value = value.slice(1);
      trimmed += 1;
      continue;
    }
    break;
  }
  return { value, trimmed };
}

// Context-organization detection: redact organizations mentioned in prose via
// a strong suffix, WITHOUT requiring a label. This closes the consistency gap
// where the labeled mention of a vendor is redacted but its body-text mentions
// leak. Three guards keep Balanced readable:
//   1. Strong suffix allowlist (no 公司/局/中心/部).
//   2. Body must not start with a common-noun prefix (我/本/该/此/其/各/全).
//   3. Match must not be inside a 《…》 book/statute title.
//   4. At least 3 Han characters before the suffix so a bare suffix glued to
//      punctuation ("、医院") does not fire.
function detectContextOrgs(doc: RedactionInput, add: AddCandidate): void {
  ORG_STRONG_SUFFIX_RE.lastIndex = 0;
  for (const match of doc.text.matchAll(ORG_STRONG_SUFFIX_RE)) {
    const rawValue = match[1] ?? "";
    const rawStart =
      (match.index ?? 0) +
      (match[0].indexOf(rawValue) >= 0 ? match[0].indexOf(rawValue) : 0);
    const { value, trimmed } = trimOrgLeadingProse(cleanChineseValue(rawValue));
    const index = rawStart + trimmed;
    if (!isPlausibleContextOrg(value)) continue;
    if (isInsideBookTitle(doc.text, index)) continue;
    add(
      value,
      "ORG",
      2,
      "Chinese context organization (strong suffix)",
      doc.name,
      index,
    );
  }
}

function isPlausibleContextOrg(value: string): boolean {
  if (!HAN_RE.test(value)) return false;
  if (value.length < 4 || value.length > 60) return false;
  if (COMMON_NOUN_PREFIX_RE.test(value)) return false;
  const hanCount = (value.match(/[㐀-鿿]/g) ?? []).length;
  return hanCount >= 3;
}

// Returns true if `index` sits inside an unmatched 《 … 》 book/statute title.
// Statute names (《中华人民共和国公司法》) must stay readable even if they end
// in a strong suffix (e.g. 《某大学章程》). The test is: the nearest title
// bracket behind us must be an unmatched 《, and a 》 must appear ahead.
function isInsideBookTitle(text: string, index: number): boolean {
  const back = text.slice(Math.max(0, index - 60), index);
  const lastOpen = back.lastIndexOf("《");
  if (lastOpen < 0) return false;
  const lastClose = back.lastIndexOf("》");
  if (lastClose > lastOpen) return false; // nearest bracket behind us is 》
  const fwd = text.slice(index, index + 60);
  return fwd.indexOf("》") >= 0;
}

function detectAgreementParties(doc: RedactionInput, add: AddCandidate): void {
  for (const match of doc.text.matchAll(AGREEMENT_PARTY_RE)) {
    const first = cleanChineseValue(match[1] ?? "");
    const second = cleanChineseValue(match[2] ?? "");
    const firstStart = (match.index ?? 0) + match[0].indexOf(match[1] ?? "");
    const secondStart = (match.index ?? 0) + match[0].indexOf(match[2] ?? "");
    if (isPlausibleContextPerson(first))
      add(
        first,
        "PERSON",
        2,
        "Chinese agreement party heading",
        doc.name,
        firstStart,
      );
    if (isPlausibleContextPerson(second))
      add(
        second,
        "PERSON",
        2,
        "Chinese agreement party heading",
        doc.name,
        secondStart,
      );
  }
}

// Signature / authorization names: a signature-context label immediately
// followed by a parenthesized 2-4 Han-char name (签字：（张三）, 盖章：（李四）,
// 经办人：（王五）). The parenthesized form is the trust anchor; a bare 2-4
// Han run in prose would be far too FP-prone. SIGNATURE_NON_NAME excludes
// seal/placeholder tokens (盖章/公章/略/待定/附件) that share the shape.
function detectSignatureNames(doc: RedactionInput, add: AddCandidate): void {
  const re = new RegExp(
    `(?:${labelAlt(SIGNATURE_CONTEXT_LABELS)})` +
      `\s*[：:]?\s*` +
      `[（(]([\u3400-\u9fff·]{2,4})[）)]`,
    "g",
  );
  for (const match of doc.text.matchAll(re)) {
    const name = match[1] ?? "";
    if (SIGNATURE_NON_NAME.has(name)) continue;
    const nameStart = (match.index ?? 0) + match[0].lastIndexOf(name);
    add(
      name,
      "PERSON",
      2,
      "Chinese signature / authorization name",
      doc.name,
      nameStart,
    );
  }
}

// Court judgment signature blocks: the role title is spaced out with full-width
// spaces for alignment (审　判　长　　刘玉蓉 / 书　记　员　　朱健芳) and the role is
// separated from the name by full-width spaces, not a colon. The colon-anchored
// label rules cannot reach these, so presiding judges, judges, people's
// assessors, law clerks, and judge's assistants leaked. The detection is line-
// anchored (the spaced role title must START a line) and the name is a 2-4 Han
// run, which keeps it from firing on prose such as "审判长主持庭审".
const COURT_SIGNATURE_TITLES = [
  "人民陪审员",
  "审判长",
  "审判员",
  "书记员",
  "法官助理",
];
// Build a pattern that allows an optional full-width/half-width space between
// each character of a title, e.g. 审　判　长. Full-width space is U+3000.
function spacedTitlePattern(title: string): string {
  return title
    .split("")
    .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\s\\u3000]?");
}
const COURT_SIGNATURE_RE = new RegExp(
  `(^|\\n)[\\s\\u3000]*(?:${COURT_SIGNATURE_TITLES.map(spacedTitlePattern).join("|")})[\\s\\u3000]+([\\u3400-\\u9fff·]{2,4})`,
  "g",
);
function detectCourtSignatureNames(
  doc: RedactionInput,
  add: AddCandidate,
): void {
  for (const match of doc.text.matchAll(COURT_SIGNATURE_RE)) {
    const name = match[2] ?? "";
    if (SIGNATURE_NON_NAME.has(name)) continue;
    const nameStart = (match.index ?? 0) + match[0].lastIndexOf(name);
    add(
      name,
      "PERSON",
      2,
      "Chinese court signature name",
      doc.name,
      nameStart,
    );
  }
}

// Honorific-suffixed bare person names (X先生 / X女士 / X小姐) in running text.
// Public company announcements, news, and meeting minutes introduce people this
// way with NO label anchor, which is the single biggest source of unlabeled
// PERSON spans. The 先生/女士/小姐 honorific almost exclusively follows a
// personal name in business/legal Chinese, so a name-shaped prefix is a strong
// signal. Two guards keep it readable:
//   1. The match must start at a NON-Han boundary OR immediately after a
//      role-introduction trigger (董事长/总经理/提名/聘任/…). This prevents the
//      name from being sliced out of a longer word and lets names that follow a
//      title (董事长李铁先生) be caught cleanly.
//   2. A stoplist rejects common-noun prefixes that could appear in prose
//      (各位先生, 两位女士), so generic address text is not redacted.
const HONORIFIC_TRIGGERS = [
  "副董事长",
  "独立董事",
  "董事长",
  "总经理",
  "副总经理",
  "副总裁",
  "总裁",
  "监事长",
  "监事",
  "董事",
  // Broader corporate / government role titles that routinely introduce a
  // named person before an honorific suffix (总监, 主管, 主任, 部长) in
  // company announcements, meeting minutes, and regulatory filings.
  "执行总监",
  "副总监",
  "技术总监",
  "财务总监",
  "市场总监",
  "运营总监",
  "人力总监",
  "销售总监",
  "研发总监",
  "设计总监",
  "项目总监",
  "艺术总监",
  "品牌总监",
  "合规总监",
  "风控总监",
  "行政总监",
  "总监",
  "主管",
  "主任",
  "部长",
  "副部长",
  "提名",
  "选举",
  "聘任",
  "任命",
  "委派",
  "委聘",
  "代表",
  "主持人",
  "主持",
  "介绍",
  "邀请",
  "感谢",
  "请教",
  "咨询",
];
// Common-noun prefixes that can directly precede 先生/女士 in prose but are NOT
// personal names. Kept conservative: real two-character names that happen to be
// listed here would be rare and the trade-off favours readability.
const HONORIFIC_NON_NAME = new Set([
  "各位",
  "大家",
  "所有",
  "两位",
  "几位",
  "一名",
  "这位",
  "那位",
  "本位",
  "每位",
  "某位",
  "以上",
  "以下",
  "通过",
  "关于",
  "对于",
  "先生",
  "女士",
  "小姐",
]);
// A captured "name" that STARTS with one of these is not a personal name: it
// means a boundary-anchored match swallowed a preceding verb/trigger/greeting
// (欢迎各位先生 -> "欢迎各位", 提名李四女士 -> "提名李四", 选举张三先生 ->
// "选举张三"). Real names never begin with these tokens.
const HONORIFIC_NAME_BAD_PREFIX =
  /^(?:欢迎|感谢|提名|选举|聘任|任命|委派|委聘|介绍|邀请|请教|咨询|代表|主持|审查|关于|对于|通过|各位|大家|所有|这位|那位|每位|这些|那些)/;
const HONORIFIC_RE = /([\u3400-\u9fff·]{2,4}?|[A-Za-z \-'.]{2,40}?)(先生|女士|小姐)/g;
function detectHonorificNames(doc: RedactionInput, add: AddCandidate): void {
  const text = doc.text;
  // Scan each honorific with a NON-GREEDY 2-4 Han name so the shortest name run
  // before the honorific is preferred (董事长李铁先生 -> "李铁"). Then clean and
  // anchor the result.
  for (const match of text.matchAll(HONORIFIC_RE)) {
    const origName = match[1] ?? "";
    let name = origName.trim();
    let nameStart = (match.index ?? 0) + origName.indexOf(name);
    // The honorific begins right after the captured name run.
    const honorificStart = nameStart + name.length;
    // 1. If the name absorbed a preceding verb/trigger (提名李四女士 ->
    //    "提名李四", 欢迎各位先生 -> "欢迎各位"), strip the leading token whole
    //    until the remainder looks like a personal name.
    let bad = name.match(HONORIFIC_NAME_BAD_PREFIX);
    while (bad && name.length - bad[0].length >= 2) {
      nameStart += bad[0].length;
      name = name.slice(bad[0].length);
      bad = name.match(HONORIFIC_NAME_BAD_PREFIX);
    }
    // 2. If a role title directly precedes the name, one or more of its trailing
    //    chars may have leaked into the captured name (董事长李铁先生 ->
    //    "事长李铁"). Strip leading chars while the text ending at the new start
    //    still forms a full trigger, so the title stays readable and the name is
    //    correct.
    while (name.length > 2) {
      const snapped = snapHonorificNameStart(text, nameStart);
      if (snapped === nameStart) break;
      nameStart = snapped;
      name = text.slice(nameStart, honorificStart);
    }
    const isHan = /[\u3400-\u9fff]/.test(name);
    if (name.length < 2 || (isHan ? name.length > 4 : name.length > 40)) continue;
    if (HONORIFIC_NON_NAME.has(name)) continue;
    if (SIGNATURE_NON_NAME.has(name)) continue;
    if (HONORIFIC_NAME_BAD_PREFIX.test(name)) continue;
    // 3. Anchor: the char before the name must be a non-Han boundary OR a role-
    //    introduction trigger must end there.
    const before = text[nameStart - 1] ?? "";
    const beforeWindow = text.slice(Math.max(0, nameStart - 6), nameStart);
    const boundaryOk = before === "" || !HAN_RE.test(before);
    const triggerOk = HONORIFIC_TRIGGER_AT_END_RE.test(beforeWindow);
    if (!boundaryOk && !triggerOk) continue;
    add(
      name,
      "PERSON",
      2,
      "Chinese honorific-suffixed name",
      doc.name,
      nameStart,
    );
  }
}

// If a role title's last char leaked into the captured name (董事长陈大文 ->
// captured name starts at 长), return the index right after the title so the
// title stays readable. `nameStart` is where the captured name begins; the leaked
// char is text[nameStart]. We check whether text[nameStart - n + 1 .. nameStart]
// equals a trigger of length n; if so the real name starts at nameStart+1.
function snapHonorificNameStart(text: string, nameStart: number): number {
  for (const trigger of HONORIFIC_TRIGGERS_SORTED) {
    // Original: trigger ends exactly at nameStart (one char leaked into name).
    const seg = text.slice(
      Math.max(0, nameStart - trigger.length + 1),
      nameStart + 1,
    );
    if (seg === trigger) return nameStart + 1;
    // When a multi-char suffix of the trigger leaked into the captured name
    // (e.g. "技术总监杨明" -> captured "总监杨明", the 2-char suffix "总监"
    // of trigger "技术总监" leaked), advance past the leaked suffix.
    for (let suffixLen = 2; suffixLen < trigger.length; suffixLen += 1) {
      const suffix = trigger.slice(-suffixLen);
      const atNameStart = text.slice(nameStart, nameStart + suffixLen);
      if (suffix === atNameStart) return nameStart + suffixLen;
    }
  }
  return nameStart;
}
const HONORIFIC_TRIGGERS_SORTED = [...HONORIFIC_TRIGGERS].sort(
  (a, b) => b.length - a.length,
);
const HONORIFIC_TRIGGER_AT_END_RE = new RegExp(
  `(?:${[...HONORIFIC_TRIGGERS]
    .sort((a, b) => b.length - a.length)
    .join("|")})$`,
);

function applyLabelRules(
  doc: RedactionInput,
  labels: string[],
  kind: CandidateKind,
  level: number,
  reason: string,
  add: AddCandidate,
  validate: (value: string) => boolean,
  split: (value: string) => string[] = (value) => [value],
  prepare: (rawValue: string) => string = (value) => value,
): void {
  const re = new RegExp(
    `(?:${labelAlt(labels)})${LABEL_SYNONYM_PARENS}${LABEL_SEP}${VALUE_UNTIL_HARD_STOP}`,
    "g",
  );
  for (const match of doc.text.matchAll(re)) {
    const rawValue = prepare(match[1] ?? "");
    const rawValueStart =
      (match.index ?? 0) + match[0].length - (match[1] ?? "").length;
    for (const part of split(rawValue)) {
      const value = cleanChineseValue(part);
      if (isPlaceholder(value) || !validate(value)) continue;
      const offsetInRaw = rawValue.indexOf(part);
      const pos =
        offsetInRaw >= 0 ? rawValueStart + offsetInRaw : rawValueStart;
      add(value, kind, level, reason, doc.name, pos);
    }
  }
}

function splitChineseList(value: string): string[] {
  // Names delimited by 、, ，, ;, ；, or ／ → split on the first delimiter found.
  const delimResult = value
    .split(/[、，,；;\/]/)
    .map(cleanChineseValue)
    .filter(Boolean);
  if (delimResult.length > 1) return delimResult;
  // Space-separated name lists (e.g. "齐海粟 胡萍 孙云飚 马贺 赵心怡" in
  // 评审专家 lists). Only split when every fragment looks like a 2-3 char
  // Chinese personal name so prose is not accidentally fragmented.
  const spaceResult = value.split(/\s+/).map(cleanChineseValue).filter(Boolean);
  if (spaceResult.length > 1 && spaceResult.every((v) => /^[㐀-鿿]{2,3}$/.test(v))) {
    return spaceResult;
  }
  return delimResult;
}

function isPlausibleContextPerson(value: string): boolean {
  return (
    PERSON_RE.test(value) &&
    !CHINESE_ROLE_TERMS.has(value) &&
    !CHINESE_DEMOGRAPHIC_TERMS.has(value)
  );
}

function isPlausibleOrg(value: string): boolean {
  return ORG_RE.test(value) && HAN_RE.test(value);
}

function isPlausibleAddress(value: string): boolean {
  return (
    value.length >= 4 &&
    value.length <= 80 &&
    (ADDRESS_SUFFIX_RE.test(value) || /[A-Za-z]{3,}/.test(value)) &&
    !isPlaceholder(value)
  );
}

// Truncate a labeled address value at the next inline sub-label. Directory /
// header lines commonly chain several labeled fields on one line, e.g.
//   地址：北京市东城区虚构路27号 邮编：100000 总机：01000000000
// Without this guard the address value swallows the 邮编/phone text. The guard
// cuts at the first whitespace-prefixed contact/address sub-label so the
// following fields stay readable (and are redacted by their own label rules).
const ADDRESS_NEXT_LABEL_RE =
  /\s+(?:邮编|邮政编码|编码|总机|电话|联系电话|传真|邮箱|电子邮箱|电邮|网址|网站|联系人|联系|账号|开户行|收款单位|收款行)\s*[：:]/;
function trimAddressAtNextLabel(rawValue: string): string {
  const m = rawValue.match(ADDRESS_NEXT_LABEL_RE);
  if (!m || m.index === undefined) return rawValue;
  return rawValue.slice(0, m.index);
}

// Bare USCC must pass the GB 32100-2015 checksum AND contain at least one
// letter. The letter requirement is essential for bare detection: the check
// character can itself be a digit, so ~32% of random 18-digit runs pass the
// checksum (e.g. "123456789012345678"). A real USCC's organization-identifier
// portion (GB 11714, positions 9-17) is effectively always alphanumeric, so
// this requirement keeps recall high on real codes while killing the digit-run
// false-positive catastrophe. An all-digit USCC that legitimately exists would
// still be caught by the labeled rule (统一社会信用代码：…).
function isPlausibleBareUscc(value: string): boolean {
  return (
    isValidUscc(value) && /[A-Za-z]/.test(value) && !/(.)\1{8,}/.test(value)
  );
}

// Bare 万/亿 amount guard: the match (e.g. "80万") must not be followed by a
// counter noun (万人/1万个/3万年) nor by 元 (covered by the 万元/亿元 rules),
// otherwise it is a quantifier rather than a money amount. The regex is
// ANCHORED to the start of the lookahead window so a counter char appearing
// later in the window (e.g. `20万外的部分` where 部 is a counter at offset 2)
// does not cause a false rejection.
function isPlausibleBareWanYi(
  text: string,
  match: { text: string; index: number },
): boolean {
  const after = text.slice(
    match.index + match.text.length,
    match.index + match.text.length + 4,
  );
  if (after.startsWith("元")) return false;
  return !WAN_YI_COUNTER_AFTER.test(after);
}

// Contact-handle label value guard (微信号/QQ号/支付宝). Accepts a WeChat-style
// username, a numeric QQ number, or any non-placeholder token containing a
// letter or digit. Label-bound only, so the FP surface is just the value after
// the label.
function isPlausibleContactHandle(value: string): boolean {
  if (isPlaceholder(value)) return false;
  if (WECHAT_ID_RE.test(value)) return true;
  // Numeric QQ/handle (5-12 digits).
  if (/^\d{5,12}$/.test(value)) return true;
  // Email-shaped Alipay account.
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(value)) return true;
  // Generic handle with at least one letter/digit and no spaces.
  return /^[A-Za-z0-9._-]{4,30}$/.test(value);
}

// Legal/finance reference value guard: accept the Latin project-ref shape OR a
// Chinese court-document shape ([YYYY]…号), but always require a digit. This
// keeps prose such as "流水线生产" / "凭证管理" / "许可证制度" readable because
// the label regex already requires the label+colon anchor and the value after
// it stops at a hard stop, so a bare noun phrase is the only FP risk.
function isPlausibleRefValue(value: string): boolean {
  if (!/\d/.test(value)) return false;
  return (
    PROJECT_REF_RE.test(value) ||
    /[（(]\d{4}[)）][\u3400-\u9fff]{0,8}\d{0,6}号/.test(value) ||
    /[\u3400-\u9fff]{1,8}[〔［[]\d{4}[〕］\]]\d{1,5}号/.test(value) ||
    /[\u3400-\u9fff]{2,8}【\d{4}】(?:第?\d{1,6}(?:-\d{1,4})?)号/.test(value)
  );
}
