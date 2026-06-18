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

const USCC_LABELS = ["统一社会信用代码", "社会信用代码"];
const PRC_ID_LABELS = ["身份证件号码", "居民身份证号", "身份证号码", "身份证号"];
const PHONE_LABELS = ["联系电话", "联系方式", "手机号码", "电话", "手机", "传真"];
const BANK_ACCOUNT_LABELS = [
  "银行账号",
  "开户账号",
  "对公账号",
  "收款账号",
  "账号",
];
const ADDRESS_LABELS = [
  "注册地址",
  "办公地址",
  "联系地址",
  "通讯地址",
  "住所",
  "住址",
  "地址",
];
const PERSON_LABELS = [
  "法定代表人",
  "项目负责人",
  "签字会计师",
  "委托代理人",
  "经办律师",
  "授权代表",
  "联系人",
  "负责人",
  "经办人",
  "姓名",
];
const ORG_LABELS = [
  "代理机构",
  "公司名称",
  "机构全称",
  "单位名称",
  "供应商",
  "采购人",
  "当事人",
  "中标人",
  "投标人",
  "甲方",
  "乙方",
];
const PROJECT_REF_LABELS = [
  "项目编号",
  "采购编号",
  "招标编号",
  "公告编号",
  "合同编号",
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
const RMB_WAN_YUAN_RE =
  /(?:人民币\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*万元/g;
const RMB_YI_YUAN_RE =
  /(?:人民币\s*)?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*亿元/g;
const RMB_YUAN_RE = /\d+(?:,\d{3})*(?:\.\d+)?\s*元(?!年|旦|素)/g;
const FULLWIDTH_YEN_RE = /\uFFE5\s*\d{1,3}(?:,\d{3})*(?:\.\d+)?/g;
const REGULATORY_DOC_NO_RE =
  /[\u3400-\u9fff]{1,8}[〔［\[]\d{4}[〕］\]]\d{1,5}号/g;
const COURT_CASE_NO_RE =
  /[（(]\d{4}[)）][\u3400-\u9fff]{1,4}\d{0,4}[\u3400-\u9fff]{1,8}第?\d{1,6}号/g;
const AGREEMENT_PARTY_RE =
  /由\s*([\u3400-\u9fff·]{2,6})\s*与\s*([\u3400-\u9fff·]{2,6})\s*就/g;
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

const USCC_RE = /^[0-9A-HJ-NPQRTUWXY]{18}$/;
const PRC_ID_RE = /^[1-9]\d{16}[\dXx]$/;
const PHONE_RE = /^(?:\+?86[-\s]?)?(?:1[3-9]\d{9}|0\d{2,3}[-\s]?\d{7,8})$/;
const BANK_ACCOUNT_RE = /^\d{16,19}$/;
const PROJECT_REF_RE = /^(?=[A-Za-z0-9._/-]*\d)[A-Za-z0-9._/-]{4,50}$/;
const PERSON_RE = /^[\u3400-\u9fff·]{2,6}$/;
const ORG_RE = /^[\u3400-\u9fffA-Za-z0-9()（）·.&' -]{2,60}$/;
const ADDRESS_SUFFIX_RE =
  /省|市|区|县|镇|乡|村|路|街|道|号|室|楼|栋|幢|大厦|广场|中心|工业区|开发区|园区/;

export function hasHanText(text: string): boolean {
  return HAN_RE.test(text);
}

export function detectChinese(doc: RedactionInput, add: AddCandidate): void {
  if (!hasHanText(doc.text)) return;

  detectChineseDirectPatterns(doc, add);
  detectChineseLabelValues(doc, add);
}

function cleanChineseValue(raw: string): string {
  return raw
    .trim()
    .replace(
      /^[\s,.;:()[\]{}<>"'“”‘’、，。；：]+|[\s,.;:()[\]{}<>"'“”‘’、，。；：]+$/g,
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
  applyRegex(doc, CHINESE_DATE_RE, "DATE", 2, "Chinese date", add);
  applyRegex(doc, RMB_WAN_YUAN_RE, "AMOUNT", 2, "RMB wan-yuan amount", add);
  applyRegex(doc, RMB_YI_YUAN_RE, "AMOUNT", 2, "RMB yi-yuan amount", add);
  applyRegex(doc, FULLWIDTH_YEN_RE, "AMOUNT", 2, "fullwidth-yen amount", add);
  applyRegex(doc, RMB_YUAN_RE, "AMOUNT", 2, "RMB yuan amount", add, (match) => {
    const before = doc.text.slice(Math.max(0, match.index - 4), match.index);
    const after = doc.text[match.index + match.text.length] ?? "";
    return !before.includes("单价") && !/[\/／]/.test(after);
  });
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
    COURT_CASE_NO_RE,
    "CASE_REF",
    1,
    "Chinese court case number",
    add,
  );
  detectAgreementParties(doc, add);
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

function detectChineseLabelValues(doc: RedactionInput, add: AddCandidate): void {
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
    3,
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
  );
  applyLabelRules(
    doc,
    PERSON_LABELS,
    "PERSON",
    2,
    "Chinese person label",
    add,
    (v) => PERSON_RE.test(v),
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
}

function detectAgreementParties(doc: RedactionInput, add: AddCandidate): void {
  for (const match of doc.text.matchAll(AGREEMENT_PARTY_RE)) {
    const first = cleanChineseValue(match[1] ?? "");
    const second = cleanChineseValue(match[2] ?? "");
    const firstStart = (match.index ?? 0) + match[0].indexOf(match[1] ?? "");
    const secondStart = (match.index ?? 0) + match[0].indexOf(match[2] ?? "");
    if (isPlausibleContextPerson(first))
      add(first, "PERSON", 2, "Chinese agreement party heading", doc.name, firstStart);
    if (isPlausibleContextPerson(second))
      add(second, "PERSON", 2, "Chinese agreement party heading", doc.name, secondStart);
  }
}

function applyLabelRules(
  doc: RedactionInput,
  labels: string[],
  kind: CandidateKind,
  level: number,
  reason: string,
  add: AddCandidate,
  validate: (value: string) => boolean,
  split: (value: string) => string[] = (value) => [value],
): void {
  const re = new RegExp(
    `(?:${labelAlt(labels)})${LABEL_SEP}${VALUE_UNTIL_HARD_STOP}`,
    "g",
  );
  for (const match of doc.text.matchAll(re)) {
    const rawValue = match[1] ?? "";
    const rawValueStart =
      (match.index ?? 0) + match[0].length - rawValue.length;
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
  return value.split(/[、，,；;\/]/).map(cleanChineseValue).filter(Boolean);
}

function isPlausibleContextPerson(value: string): boolean {
  return PERSON_RE.test(value) && !CHINESE_ROLE_TERMS.has(value);
}

function isPlausibleOrg(value: string): boolean {
  return ORG_RE.test(value) && HAN_RE.test(value);
}

function isPlausibleAddress(value: string): boolean {
  return (
    value.length >= 4 &&
    value.length <= 80 &&
    ADDRESS_SUFFIX_RE.test(value) &&
    !isPlaceholder(value)
  );
}
