import {
  AMBIGUOUS_PERSON_TOKENS,
  BUILDING_KEYWORDS,
  COMMON_TITLE_WORDS,
  CONTRACT_DEFINED_TERM_TOKENS,
  GENERAL_ORGS,
  KNOWN_ORGS,
  LOCATION_TERMS,
  MATTER_TERMS,
  ORG_NAME_TAIL_TOKENS,
  PROPER_NOUN_STOP_TERMS,
  SINGLE_PERSON_STOPWORDS,
  STREET_SUFFIXES,
  UNIT_INDICATORS,
} from "./rules";
import {
  Candidate,
  CandidateKind,
  LEVELS,
  PreviewSegment,
  RedactionInput,
  RedactionLevel,
  RedactionOptions,
  ReplacementEntry,
  ReviewModel,
} from "./types";
import { ENGINE_VERSION } from "./version";

const WORD_ANCHOR_RE = /<span\s+id="_Toc\d+"\s+class="anchor"\s*><\/span>/gi;
const WORD_TOC_NESTED_LINK_RE =
  /\[([^\[\]\n]+?)\s+\[(\d+)\]\(#_Toc\d+\)\]\(#_Toc\d+\)/g;
const WORD_TOC_SIMPLE_LINK_RE = /\[([^\[\]\n]+)\]\(#_Toc\d+\)/g;
const OCR_SPACED_EMAIL_RE =
  /(?:[A-Za-z0-9._%+-]\s*){2,}@\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi;

const STREET_SUFFIX_ALT = STREET_SUFFIXES.join("|");
const UNIT_INDICATOR_ALT = UNIT_INDICATORS.join("|");
const BUILDING_KEYWORD_ALT = BUILDING_KEYWORDS.join("|");
const ADDRESS_UNIT_WORDS_ALT = [...UNIT_INDICATORS, ...BUILDING_KEYWORDS].join(
  "|",
);
const STANDALONE_UNIT_RE = new RegExp(
  String.raw`\b(?:${ADDRESS_UNIT_WORDS_ALT})\b|\b\d+\s*/\s*F\b`,
  "i",
);
const STANDALONE_STREET_RE = new RegExp(
  String.raw`\b(?:${STREET_SUFFIX_ALT})\b`,
  "i",
);
const STANDALONE_STREET_ADDRESS_RE = new RegExp(
  String.raw`\b\d+[A-Za-z]?\s+(?:[A-Z][A-Za-z'’-]*\s+){0,5}(?:${STREET_SUFFIX_ALT})\b`,
  "i",
);
const MONTH_ALT =
  "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const DAY_MONTH_DATE_RE = new RegExp(
  String.raw`\b\d{1,2}(?:st|nd|rd|th)?(?:\s+|-|/)(?:${MONTH_ALT})\.?(?:,?\s+|-|/)\d{2,4}\b`,
  "gi",
);
const DAY_MONTH_NO_YEAR_RE = new RegExp(
  String.raw`\b\d{1,2}(?:st|nd|rd|th)?(?:\s+|-|/)(?:${MONTH_ALT})\.?\b`,
  "gi",
);
const MONTH_DAY_DATE_RE = new RegExp(
  String.raw`\b(?:${MONTH_ALT})\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{2,4})?\b`,
  "gi",
);
const US_STATE_ALT =
  "A[LKZR]|C[AOT]|D[CE]|FL|GA|HI|I[ADLN]|K[SY]|LA|M[ADEHINOPST]|N[CDEHJMVY]|O[HKR]|P[AWR]|RI|S[CD]|T[NX]|UT|V[AIT]|W[AIVY]";
const PERSON_NAME_PATTERN = String.raw`[A-Z][A-Za-z'’-]+(?:[^\S\r\n]+[A-Z][A-Za-z'’-]+){1,3}`;
const PERSON_NAME_RE = new RegExp(PERSON_NAME_PATTERN, "g");

// Organization suffix tokens used to exclude company names from person alias
// generation. When a detected "person" name ends with one of these, it is
// almost certainly a company caught by a contextual pattern (e.g. "GoDaddy Inc"
// from "Respondent GoDaddy Inc"), not a real person.
const ORG_SUFFIX_NAME_TOKENS = new Set([
  "Inc",
  "Incorporated",
  "Corp",
  "Corporation",
  "LLC",
  "Ltd",
  "Limited",
  "LLP",
  "LLLP",
  "PLLC",
  "Company",
  "GmbH",
  "PLC",
]);
const PERSON_LIST_RE = new RegExp(
  String.raw`\b${PERSON_NAME_PATTERN}(?:(?:[^\S\r\n]*,[^\S\r\n]*|[^\S\r\n]*,?[^\S\r\n]+and[^\S\r\n]+)${PERSON_NAME_PATTERN})+`,
  "g",
);
const PERSON_TITLE_ALT = "Mr|Ms|Mrs|Miss|Dr|Professor|Prof|Sir|Dame|Lord|Lady";
const LEADING_PERSON_TITLE_RE = new RegExp(
  String.raw`^(?:${PERSON_TITLE_ALT})\.?\s+`,
  "i",
);
const ORGANIZATION_SUFFIXES = [
  "L\\.?L\\.?C\\.?",
  "Ltd",
  "LTD",
  "Limited",
  "LIMITED",
  "Inc",
  "INC",
  "Incorporated",
  "INCORPORATED",
  "Corp",
  "CORP",
  "Corporation",
  "CORPORATION",
  "Co\\.?",
  "CO\\.?",
  "Company",
  "COMPANY",
  "L\\.?P\\.?",
  "LLP",
  "LLLP",
  "PLLC",
  "N\\.?V\\.?",
  "B\\.?V\\.?",
  "S\\.?A\\.?",
  "GmbH",
  "GMBH",
  "AG",
  "PLC",
  "Pte",
  "Pty",
  "SARL",
  "SDN",
  "BHD",
  "Group",
  "GROUP",
  "Holdings",
  "HOLDINGS",
  "Partners",
  "PARTNERS",
  "Bank",
  "BANK",
  "Exchange",
  "EXCHANGE",
  "Committee",
  "COMMITTEE",
  "University",
  "UNIVERSITY",
  "Fund",
  "FUND",
  "Funds",
  "FUNDS",
  "Capital",
  "CAPITAL",
  "Management",
  "MANAGEMENT",
  "Analytics",
  "ANALYTICS",
  "Advisers",
  "ADVISERS",
  "Advisors",
  "ADVISORS",
  "Lawyers",
  "LAWYERS",
  "Associates",
  "ASSOCIATES",
  "Law Offices",
  "LAW OFFICES",
  "Lovells",
  "Deloitte",
  "Colliers",
  "Savills",
  "Ogier",
];
const ORGANIZATION_SUFFIX_ALT = ORGANIZATION_SUFFIXES.join("|");
const GENERIC_ORGANIZATION_SUFFIX_TOKENS = new Set([
  "Services",
  "Service",
  "Systems",
  "System",
  "Solutions",
  "Solution",
  "Group",
  "Groups",
  "Holdings",
  "Holding",
  "Partners",
  "Bank",
  "Exchange",
  "Committee",
  "University",
  "Fund",
  "Funds",
  "Capital",
  "Management",
  "Analytics",
  "Advisers",
  "Advisors",
  "Lawyers",
  "Associates",
]);

// Priority used to pick a single kind when the same exact surface string is
// detected under multiple kinds (lower wins). Keeps replacement tokens consistent.
const KIND_PRIORITY: Record<CandidateKind, number> = {
  CUSTOM: 0,
  NATIONAL_ID: 1,
  BANK_ACCOUNT: 2,
  BUSINESS_ID: 3,
  EMAIL: 4,
  PHONE: 5,
  URL: 6,
  INTERNAL_LINK: 7,
  CASE_REF: 8,
  BUNDLE_REF: 9,
  EXHIBIT_REF: 10,
  TRANSCRIPT_REF: 11,
  PROCEDURAL_REF: 12,
  POSTCODE: 13,
  ADDRESS: 14,
  DATE: 15,
  AMOUNT: 16,
  LOCATION: 17,
  BRAND: 18,
  CHANNEL: 19,
  NON_LATIN_TEXT: 20,
  ORG: 21,
  PROJECT: 22,
  PROJECT_OR_ISSUE: 23,
  DOCUMENT: 24,
  PERSON_OR_ORG: 25,
  PERSON: 26,
  PROPER_NOUN: 27,
};

function cleanValue(raw: string): string {
  return raw
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .trim()
    .replace(/^[\s,.;:()[\]{}<>"'“”‘’]+|[\s,.;:()[\]{}<>"'“”‘’]+$/g, "")
    .replace(/\s+/g, " ");
}

function meaningful(value: string): boolean {
  const cleaned = cleanValue(value);
  return (
    cleaned.length >= 2 &&
    !["the", "and", "or", "of", "to", "in", "for", "with"].includes(cleaned)
  );
}

function normalizeForDedupe(value: string): string {
  return cleanValue(value)
    .replace(LEADING_PERSON_TITLE_RE, "")
    .replace(/['’]s$/i, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function levelName(level: number): RedactionLevel {
  if (level <= 1) return "light";
  if (level === 2) return "balanced";
  return "strict";
}

function normalizedContractTermToken(token: string): string {
  return token
    .replace(/['’]s$/i, "")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

function isContractDefinedTermToken(token: string): boolean {
  return CONTRACT_DEFINED_TERM_TOKENS.has(normalizedContractTermToken(token));
}

function looksLikeContractDefinedTermCandidate(name: string): boolean {
  const rawTokens = name
    .split(/\s+/)
    .map(normalizedContractTermToken)
    .filter((token) => token && !/^[A-Z]\.?$/.test(token));
  if (rawTokens.length < 2) return false;

  // Strip leading articles, ordinals, and caption words so that phrases
  // like "The Commission", "Before the Federal Trade", "First Claim for
  // Relief", and "United States" are evaluated on their substantive tokens.
  // Person names never start with these words.
  const LEADING_NOISE = new Set([
    "The",
    "A",
    "An",
    "This",
    "That",
    "These",
    "Those",
    "Such",
    "Said",
    "Before",
    "First",
    "Second",
    "Third",
    "Fourth",
    "Fifth",
    "Sixth",
    "Seventh",
    "Eighth",
    "Ninth",
    "Tenth",
    "Other",
    "In",
    "Of",
  ]);
  const tokens = rawTokens.filter(
    (token, i) => i !== 0 || !LEADING_NOISE.has(token),
  );
  // Also strip a second leading noise word (e.g. "Before The").
  const finalTokens =
    tokens.length > 1 && LEADING_NOISE.has(tokens[0])
      ? tokens.slice(1)
      : tokens;
  if (finalTokens.length < 1) return false;

  const definedCount = finalTokens.filter((token) =>
    CONTRACT_DEFINED_TERM_TOKENS.has(token),
  ).length;

  // Reject role/defined-term phrases such as "Administrative Agent",
  // "Common Stock", and "Real Estate Taxes". Do not reject names merely
  // because a surname is also a contract word, e.g. "Jordan Price".
  //
  // Heuristics (in order of strength):
  //  - two or more structural tokens almost always means a heading, role,
  //    financial line item, or defined term ("Senior Vice President",
  //    "Cash Equivalents", "Risk Factors", "Staff Attorney"). Real person
  //    names rarely contain two financial/legal/heading words.
  //  - a structural token in the first position ("Administrative Agent",
  //    "Common Stock") is a defined-term shape.
  // A single structural token NOT in first position is allowed, so genuine
  // names whose surname happens to be a contract word ("Jordan Price",
  // "Patrick Cash") survive.
  if (definedCount >= 2) return true;
  return definedCount >= 1 && CONTRACT_DEFINED_TERM_TOKENS.has(finalTokens[0]);
}

function looksLikeGenericOrganizationPhrase(value: string): boolean {
  const tokens = value
    .split(/\s+/)
    .map(normalizedContractTermToken)
    .filter(Boolean);
  return (
    tokens.length >= 2 &&
    tokens.every(
      (token) =>
        isContractDefinedTermToken(token) ||
        COMMON_TITLE_WORDS.has(token) ||
        GENERIC_ORGANIZATION_SUFFIX_TOKENS.has(token),
    )
  );
}

export class Detector {
  private candidates = new Map<string, Candidate>();
  private readonly exactIndex = new Map<string, Set<CandidateKind>>();
  private readonly normIndex = new Map<string, Set<CandidateKind>>();

  constructor(
    private readonly docs: RedactionInput[],
    private readonly customTerms: string[] = [],
  ) {}

  detect(): Candidate[] {
    for (const doc of this.docs) {
      this.detectDirectPatterns(doc);
      this.detectLabelValues(doc);
      this.detectAddressContinuations(doc);
      this.detectStandaloneAddressLines(doc);
      this.detectPeople(doc);
      this.detectOrganizations(doc);
      this.detectMatterTerms(doc);
      this.detectLocations(doc);
      this.detectStrictProperNouns(doc);
      this.detectCustomTerms(doc);
    }
    this.addPersonAliases();
    this.finalizeCandidates();
    return [...this.candidates.values()].sort(
      (a, b) =>
        a.firstPos - b.firstPos ||
        a.minLevel - b.minLevel ||
        a.kind.localeCompare(b.kind),
    );
  }

  private key(kind: CandidateKind, value: string): string {
    return `${kind}\u0000${value}`;
  }

  private add(
    value: string,
    kind: CandidateKind,
    minLevel: number,
    reason: string,
    source: string,
    pos: number,
  ): void {
    const cleaned = cleanValue(value);
    if (!meaningful(cleaned)) return;

    if (kind === "PHONE") {
      const digits = cleaned.replace(/\D/g, "");
      if (digits.length < 7) return;
      if (/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned)) return;
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return;
      if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(cleaned)) return;
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleaned)) return;
      if (/^(?:19|20)\d{6}$/.test(digits)) return;
    }

    if (kind === "PERSON") {
      const stripped = cleaned
        .replace(LEADING_PERSON_TITLE_RE, "")
        .replace(/['’]s$/i, "");
      if (
        !stripped.includes(" ") &&
        AMBIGUOUS_PERSON_TOKENS.has(stripped) &&
        stripped === cleaned
      )
        return;
    }

    const key = this.key(kind, cleaned);
    const existing = this.candidates.get(key);
    if (existing) {
      existing.minLevel = Math.min(existing.minLevel, minLevel);
      existing.sources.add(source);
      existing.firstPos = Math.min(existing.firstPos, pos);
      return;
    }
    this.candidates.set(key, {
      value: cleaned,
      kind,
      minLevel,
      reason,
      firstPos: pos,
      sources: new Set([source]),
    });
    this.registerIndex(cleaned, kind);
  }

  private registerIndex(value: string, kind: CandidateKind): void {
    let exact = this.exactIndex.get(value);
    if (!exact) {
      exact = new Set();
      this.exactIndex.set(value, exact);
    }
    exact.add(kind);
    const normalized = normalizeForDedupe(value);
    let norm = this.normIndex.get(normalized);
    if (!norm) {
      norm = new Set();
      this.normIndex.set(normalized, norm);
    }
    norm.add(kind);
  }

  private detectDirectPatterns(doc: RedactionInput): void {
    const patterns: Array<[CandidateKind, RegExp, number, string]> = [
      [
        "EMAIL",
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        1,
        "email address",
      ],
      ["EMAIL", OCR_SPACED_EMAIL_RE, 1, "OCR-spaced email address"],
      [
        "PHONE",
        /(?<![\w/])(?:\+?\d[\d ()-]{6,}\d)(?![\w/])/g,
        1,
        "phone-like digit sequence",
      ],
      ["URL", /https?:\/\/[^\s)>\]]+/g, 1, "URL"],
      [
        "INTERNAL_LINK",
        /\]\(([^)]+\.pdf)\)/g,
        2,
        "markdown link to source file",
      ],
      [
        "ADDRESS",
        new RegExp(
          String.raw`(?<![A-Za-z0-9])(?:${UNIT_INDICATOR_ALT})\s+[A-Z0-9-]+,?\s+(?:\d+\s*/\s*F,?\s+)?[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,5}\s+(?:${BUILDING_KEYWORD_ALT})?,?\s+\d+\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+(?:${STREET_SUFFIX_ALT})(?:,?\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})*`,
          "g",
        ),
        1,
        "inline address phrase",
      ],
      [
        "ADDRESS",
        // Numbered street address without a leading unit indicator, e.g.
        // "1 Technology Drive" or "221 Baker Street". Requires a street
        // suffix so ordinary sentences with numbers are not caught.
        new RegExp(
          String.raw`(?<![A-Za-z0-9])\d{1,6}[A-Za-z]?\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,4}\s+(?:${STREET_SUFFIX_ALT})\b`,
          "g",
        ),
        1,
        "numbered street address",
      ],
      [
        "CASE_REF",
        /\bHKIAC Arbitration No\.\s*[A-Z]?\d+\b/g,
        1,
        "arbitration number",
      ],
      ["CASE_REF", /\bHKIAC\/[A-Z]?\d+\b/g, 1, "case shorthand"],
      ["NATIONAL_ID", /\b\d{3}-\d{2}-\d{4}\b/g, 1, "US Social Security number"],
      [
        "NATIONAL_ID",
        /\b[A-CEGHJ-PR-TW-Z]{2}(?:\s?\d){6}\s?[ABCD]\b/gi,
        1,
        "UK National Insurance number",
      ],
      [
        "NATIONAL_ID",
        /\bpassport\s*(?:no\.?|number)?\s*[:#]?\s*(\d{8,9})\b/gi,
        1,
        "passport number",
      ],
      [
        "BUSINESS_ID",
        /\b\d{2}-\d{7}\b/g,
        1,
        "US Employer Identification number",
      ],
      [
        "BANK_ACCOUNT",
        /\b(?:SWIFT|BIC)(?:\s*(?:code|address))?\s*[:#]?\s*([A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?)\b/g,
        2,
        "SWIFT/BIC code",
      ],
      [
        "BANK_ACCOUNT",
        /\b(?:sort\s+code|sort)\s*[:#]?\s*(\d{2}[-\s]\d{2}[-\s]\d{2})\b/gi,
        2,
        "UK bank sort code",
      ],
      ["BANK_ACCOUNT", /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]){10,30}\b/g, 1, "IBAN"],
      ["POSTCODE", /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g, 1, "UK postcode"],
      ["POSTCODE", /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/g, 1, "Canadian postcode"],
      ["POSTCODE", /\b\d{5}-\d{4}\b/g, 1, "US ZIP+4 code"],
      [
        "POSTCODE",
        // US 5-digit ZIP after a comma + state abbreviation, e.g.
        // "Austin, TX 78701". The comma context avoids catching references
        // such as "PO 12345" or "Internal ID 98765".
        new RegExp(String.raw`(?<=,\s)(?:${US_STATE_ALT})\s+\d{5}\b`, "g"),
        1,
        "US ZIP code after state",
      ],
      [
        "CASE_REF",
        /\[\d{4}\]\s*(?:UKSC|EWCA|EWHC|UKHL|UKPC|UKUT|EWFC|EWCOP)(?:\s+(?:Civ|Crim|Ch|QB|KB|Fam|Comm|Admin|Pat|TCC))?(?:\s+\d+)?(?:\s*\([A-Za-z]+\))?/g,
        1,
        "UK neutral citation",
      ],
      [
        "CASE_REF",
        /\b\d{1,2}:\d{2}-[A-Za-z]{2}-\d{4,5}\b/g,
        1,
        "US federal docket number",
      ],
      [
        "CASE_REF",
        // SEC / federal court shorthand: "Civ No. 02-CV-4963" or "02-cv-4963"
        /\b\d{2}\s*-?\s*(?:Civ|CV|cr|CR)\s*-?\s*\d{3,6}\b/gi,
        1,
        "US civil action docket shorthand",
      ],
      [
        "CASE_REF",
        // SEC complaint format: "21 Civ. 7925" or "21 Civ 7925"
        /\b\d{2}\s+Civ\.?\s+\d{3,6}\b/gi,
        1,
        "SEC civil action number",
      ],
      [
        "CASE_REF",
        /\bCase\s+No\.?\s*[:#]?\s*\d[\w-]*\b/gi,
        1,
        "case number reference",
      ],
      [
        "CASE_REF",
        /\b(?:HCA|HCMP|HCFI|CFI|CFA|FACA|FAMV)\s*(?:No\.?)?\s*\d+\s*(?:of|\/)\s*\d{4}\b/g,
        1,
        "Hong Kong court reference",
      ],
      [
        "BUSINESS_ID",
        /\b(?:CR|BR|Company|Registered|Registration|Business Registration)\s+No\.?\s*[:#]?\s*[A-Z0-9-]{5,}\b/gi,
        1,
        "business registration number",
      ],
      [
        "BUSINESS_ID",
        /\b(?:company number|registered no\.?|registration no\.?)\s*[:：]?\s*[A-Z0-9-]{5,}\b/gi,
        1,
        "business registration label",
      ],
      [
        "BUSINESS_ID",
        // SEC EDGAR accession number, e.g. "0001193125-17-033610". Always
        // 10 digits, dash, 2 digits, dash, 6 digits. Unique per filing.
        /\b\d{10}-\d{2}-\d{6}\b/g,
        1,
        "SEC EDGAR accession number",
      ],
      [
        "BUSINESS_ID",
        // SEC registration / file number attached to a label, e.g.
        // "Registration No. 333-265967" or "Registration Nos. 281901 and 282334".
        // The label context prevents ordinary 6-digit figures from matching.
        /\bRegistration\s+Nos?\.?\s*[:#]?\s*\d{3,}[A-Z0-9-]*(?:\s+(?:and|&)\s+\d{3,}[A-Z0-9-]*)*/gi,
        1,
        "SEC registration number",
      ],
      [
        "CASE_REF",
        // SEC Commission File Number / File No., e.g. "File No. 333-124741",
        // "File No. 0-18225", "File Nos. 333-214419 and 811-23211". The label
        // anchor avoids matching unrelated dddd-ddddd figures (dates, ranges).
        /\b(?:Commission\s+File\s+Number|File\s+Nos?)\.?(:?\s*[:#]?)?\s*\d{1,3}-\d{1,6}(?:\s+(?:and|&)\s*\d{1,3}-\d{1,6})*/gi,
        1,
        "SEC file number",
      ],
      ["BUNDLE_REF", /\b[A-Z]\/\d{2,5}\/\d{2,6}\b/g, 2, "bundle reference"],
      ["EXHIBIT_REF", /\b[RCDEF]-\d{1,4}\b/g, 2, "exhibit reference"],
      ["EXHIBIT_REF", /\b[CR]L-\d{1,4}\b/g, 2, "legal authority reference"],
      [
        "PROCEDURAL_REF",
        /(?<![A-Za-z0-9])PO\s+No(?:\\\.|\.)?\s*\d+(?!\d)/gi,
        2,
        "procedural reference",
      ],
      [
        "PROCEDURAL_REF",
        /(?<![A-Za-z0-9])Procedural\s+Order\s+No(?:\\\.|\.)?\s*\d+(?!\d)/gi,
        2,
        "procedural order reference",
      ],
      [
        "TRANSCRIPT_REF",
        /\bDay\s+\d+\s*,?\s*pp\.?\s*\d+(?:\s*-\s*\d+)?\b/g,
        2,
        "transcript reference",
      ],
      ["DATE", /\b\d{4}\.\d{2}\.\d{2}\b/g, 2, "numeric date"],
      [
        "DATE",
        /\b\d{1,2}\s*-\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g,
        2,
        "date range",
      ],
      [
        "DATE",
        /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g,
        2,
        "written date",
      ],
      ["DATE", DAY_MONTH_DATE_RE, 2, "day month date"],
      ["DATE", MONTH_DAY_DATE_RE, 2, "month day date"],
      ["DATE", DAY_MONTH_NO_YEAR_RE, 2, "day and month date"],
      [
        "DATE",
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g,
        2,
        "month-year date",
      ],
      ["DATE", /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, 2, "slash-separated date"],
      ["DATE", /\b\d{4}-\d{2}-\d{2}\b/g, 2, "ISO date"],
      ["DATE", /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g, 2, "dash-separated date"],
      ["DATE", /\bQ[1-4]\s+\d{4}\b/g, 2, "quarter and year"],
      ["DATE", /\bFY\s*\d{4}\b/gi, 2, "financial year reference"],
      [
        "DATE",
        /\b(?:financial|fiscal)\s+year\s+\d{4}\b/gi,
        2,
        "financial year reference",
      ],
      [
        "AMOUNT",
        /(?<![A-Za-z0-9])(?:US\\?\$|HK\\?\$|A\$|C\$|£|€|¥|₹|\$|GBP|USD|HKD|RMB|CNY|EUR|JPY|INR|AUD|CAD|Euros?|Sterling)\s?\d[\d,.]*(?:\s*(?:million|billion|m|bn|mm|k))?(?:\/[A-Za-z]+)?(?![A-Za-z0-9])/gi,
        2,
        "currency amount",
      ],
      [
        "AMOUNT",
        /(?<![A-Za-z0-9])\d[\d,.]*(?:\s*(?:million|billion|m|bn|mm|k))?\s?(?:US\\?\$|HK\\?\$|A\$|C\$|£|€|¥|₹|\$|GBP|USD|HKD|RMB|CNY|EUR|JPY|INR|AUD|CAD|Euros?|Sterling)(?:\/[A-Za-z]+)?(?![A-Za-z0-9])/gi,
        2,
        "suffix currency amount",
      ],
      ["AMOUNT", /\b\d[\d,]*(?:\s+ordinary)?\s+shares\b/gi, 2, "share count"],
      ["AMOUNT", /^\s*\d{4,}\s*$/gm, 2, "standalone large number"],
      ["AMOUNT", /\b\d[\d,.]*\s?(?:million|billion)\b/g, 2, "large amount"],
      ["AMOUNT", /(?<![\w.])\d{1,3}(?:\.\d+)?%(?!\w)/g, 2, "percentage"],
      [
        "BRAND",
        /(?<![A-Za-z0-9])[A-Z][A-Z0-9-]{2,}(?=(?:-|\s+)(?:brand|branded|related|trademarks?|products?|INTERNATIONAL|International|GLOBAL|Global))/g,
        2,
        "brand/product mark context",
      ],
      [
        "CHANNEL",
        /\b(?:Current|Sales)\s+channel\s*[:=]\s*([A-Z][A-Za-z0-9._&' -]{2,60})/g,
        2,
        "sales channel label",
      ],
      [
        "NON_LATIN_TEXT",
        /[\u3400-\u9fff][\u3400-\u9fff·]{1,}/g,
        2,
        "non-Latin duplicate text",
      ],
    ];

    for (const [kind, regex, level, reason] of patterns) {
      for (const match of doc.text.matchAll(regex)) {
        this.add(
          match[1] ?? match[0],
          kind,
          level,
          reason,
          doc.name,
          match.index ?? 0,
        );
      }
    }
  }

  private detectLabelValues(doc: RedactionInput): void {
    const labelPatterns: Array<[RegExp, CandidateKind, number, string]> = [
      [/^\s*Client\s*[:：]\s*(.+)$/i, "PERSON_OR_ORG", 1, "client label"],
      [
        /^\s*Prepared for\s*[:：]\s*(.+)$/i,
        "PERSON_OR_ORG",
        1,
        "prepared-for label",
      ],
      // Correspondence header labels. From/To/Cc/Bcc/Attn carry person or org
      // names; Re/Subject/Via carry matter text; Date carries a date. These are
      // the bread-and-butter fields of SEC correspondence and counsel letters.
      [/^\s*From\s*[:：]\s*(.+)$/i, "PERSON_OR_ORG", 1, "from label"],
      [/^\s*To\s*[:：]\s*(.+)$/i, "PERSON_OR_ORG", 1, "to label"],
      [
        /^\s*(?:Cc|CC|Bcc|BCC)\s*[:：]\s*(.+)$/i,
        "PERSON_OR_ORG",
        1,
        "cc label",
      ],
      [
        /^\s*(?:Attention|Attn)\.?\s*[:：]\s*(.+)$/i,
        "PERSON",
        1,
        "attention list",
      ],
      [
        /^\s*(?:Re|Subject)\s*[:：]\s*(.+)$/i,
        "PROJECT_OR_ISSUE",
        1,
        "re/subject label",
      ],
      [/^\s*Via\s*[:：]\s*(.+)$/i, "PROJECT_OR_ISSUE", 1, "via label"],
      [/^\s*Date\s*[:：]?\s*(.+)$/i, "DATE", 2, "date label"],
      [/^\s*Address\s*[:：]\s*(.+)$/i, "ADDRESS", 1, "address label"],
      [
        /^\s*(?:Phone|Telephone|Tel\.?|Mobile|Cell)\s*[:：]\s*(.+)$/i,
        "PHONE",
        1,
        "phone label",
      ],
      [/^\s*Fax\.?\s*[:：]\s*(.+)$/i, "PHONE", 1, "fax label"],
      [
        /^\s*Direct\s(?:Dial\s)?(?:No\.?)?\s*[:：]\s*(.+)$/i,
        "PHONE",
        1,
        "direct-dial label",
      ],
      [/^\s*(?:Email|E-mail)\s*[:：]\s*(.+)$/i, "EMAIL", 1, "email label"],
      [
        /^\s*(?:File|Commission File)\s+Nos?\.?\s*[:：]?\s*(.+)$/i,
        "CASE_REF",
        1,
        "file number label",
      ],
      [
        /^\s*Registration\s+Nos?\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "registration number label",
      ],
      [/^\s*Account No\.?\s*[:：]\s*(.+)$/i, "CASE_REF", 1, "account label"],
      [/^\s*Matter No\.?\s*[:：]\s*(.+)$/i, "CASE_REF", 1, "matter label"],
      [/^\s*Ref\.?\s*[:：]\s*(.+)$/i, "CASE_REF", 1, "reference label"],
    ];

    const lines = doc.text.split(/\r?\n/);
    let searchPos = 0;
    for (const line of lines) {
      const pos = doc.text.indexOf(line, searchPos);
      searchPos = pos + line.length + 1;
      const stripped = line.trim();
      if (!stripped) continue;
      for (const [regex, kind, level, reason] of labelPatterns) {
        const match = stripped.match(regex);
        if (!match) continue;
        for (const part of this.splitLabelValue(match[1], kind)) {
          this.add(part, kind, level, reason, doc.name, pos);
        }
      }
    }
  }

  private splitLabelValue(value: string, kind: CandidateKind): string[] {
    if (kind === "ADDRESS") return [value];
    if (kind === "EMAIL") {
      const emails = value.match(
        /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
      );
      return emails ?? [value];
    }
    if (kind === "PERSON" || kind === "PERSON_OR_ORG") {
      return value
        .split(/\s*\/\s*|；|;|\s+and\s+/i)
        .map(cleanValue)
        .filter(Boolean);
    }
    // Numeric identifier labels (case refs, business ids, phone, date) often
    // list several values separated by "and", "," or "/". Split on all of
    // them so each individual number is redacted on its own.
    return value
      .split(/\s*\/\s*|；|;|,|\s+and\s+/i)
      .map(cleanValue)
      .filter(Boolean);
  }

  private detectAddressContinuations(doc: RedactionInput): void {
    const lines = doc.text.split(/\r?\n/);
    const offsets: number[] = [];
    let searchPos = 0;
    for (const line of lines) {
      const pos = doc.text.indexOf(line, searchPos);
      offsets.push(pos);
      searchPos = pos + line.length + 1;
    }

    for (let index = 0; index < lines.length; index += 1) {
      if (!/^\s*Address\s*[:：]/i.test(lines[index])) continue;
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const candidate = lines[cursor].trim();
        if (!candidate) continue;
        if (
          this.addressContinuationStop(candidate) ||
          !this.looksLikeAddressContinuation(candidate)
        )
          break;
        this.add(
          candidate,
          "ADDRESS",
          1,
          "address continuation",
          doc.name,
          offsets[cursor],
        );
      }
    }
  }

  private detectStandaloneAddressLines(doc: RedactionInput): void {
    const lines = doc.text.split(/\r?\n/);
    let searchPos = 0;
    for (const line of lines) {
      const pos = doc.text.indexOf(line, searchPos);
      searchPos = pos + line.length + 1;
      const visible = visibleLineText(line);
      if (!visible) continue;
      if (this.looksLikeStandaloneAddressLine(visible)) {
        this.add(
          visible,
          "ADDRESS",
          1,
          "standalone address-looking line",
          doc.name,
          pos,
        );
      }
    }
  }

  private addressContinuationStop(line: string): boolean {
    if (
      /^\s*(?:Email|E-mail|Phone|Telephone|Tel\.?|Attention|Ref\.?|Client|Prepared for)\s*[:：]/i.test(
        line,
      )
    )
      return true;
    if (/^\s*\d+\.\s+/.test(line)) return true;
    const visible = visibleLineText(line);
    return (
      visible === "HKIAC" ||
      visible.startsWith("Legal Representatives for") ||
      visible.startsWith("For the Tribunal")
    );
  }

  private looksLikeAddressContinuation(line: string): boolean {
    const plain = visibleLineText(line);
    return (
      /\b(?:Floor|Tower|Road|Street|Avenue|Lane|Boulevard|Drive|Court|Place|Crescent|Way|Terrace|Parkway|Central|Queensway|House|Centre|Center|Chambers|Square|Gardens|Estate|Plaza|Block|Heights)\b/i.test(
        plain,
      ) ||
      (/\d/.test(plain) && plain.includes(","))
    );
  }

  private looksLikeStandaloneAddressLine(line: string): boolean {
    if (line.length > 100) return false;
    if (/^\d+\.\s+/.test(line)) return false;
    const startsAddressLike = new RegExp(
      String.raw`^\s*(?:\d|${ADDRESS_UNIT_WORDS_ALT}\b|Address\b|Registered\s+office\b|Mailing\s+address\b)`,
      "i",
    ).test(line);
    const hasAddressUnit = STANDALONE_UNIT_RE.test(line);
    const hasStreetTerm = STANDALONE_STREET_RE.test(line);
    const hasStreetAddress = STANDALONE_STREET_ADDRESS_RE.test(line);
    if (hasStreetAddress && !startsAddressLike) return false;
    return (
      hasStreetAddress ||
      (hasAddressUnit && /\d+\s*\/\s*F\b/i.test(line)) ||
      (hasAddressUnit && hasStreetTerm && /\d/.test(line) && line.includes(","))
    );
  }

  private detectPeople(doc: RedactionInput): void {
    // Title-led names use same-line whitespace only ([^\S\r\n]+) so that a
    // title at the start of a line (e.g. an Attention block) does not stitch
    // across newlines into the next person's title ("Mr. Tyler Howes\nMs. ...").
    const titlePattern = new RegExp(
      String.raw`\b(?:${PERSON_TITLE_ALT})\.?[^\S\r\n]+([A-Z][A-Za-z'’-]+(?:[^\S\r\n]+[A-Z][A-Za-z'’-]+){0,3})\b`,
      "g",
    );
    for (const match of doc.text.matchAll(titlePattern)) {
      const full = match[0].replace(/['’]s$/i, "");
      const captured = cleanValue(match[1]).replace(/['’]s$/i, "");
      this.add(
        full,
        "PERSON",
        1,
        "title plus person name",
        doc.name,
        match.index ?? 0,
      );
      if (captured.includes(" "))
        this.add(
          captured,
          "PERSON",
          1,
          "name after title",
          doc.name,
          (match.index ?? 0) + full.indexOf(match[1]),
        );
    }

    const contextPatterns: Array<[RegExp, string]> = [
      [
        /\b(?:Witness Statement of|Expert Report of|Opinion in .* concerning|Independent Expert Report of)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})/g,
        "witness/expert heading",
      ],
      [
        /\(([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\)/g,
        "parenthetical person",
      ],
      [
        /\b(?:from|to|between|and|by)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})(?:\s+to|\s+and|\s*:|\s*,|\))/g,
        "communication context",
      ],
      [
        /\b(?:called|named|identified as|translation as)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\b/g,
        "alternate name",
      ],
      [
        /\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+(?:gave|gives|says|said|states|stated|testified|maintained|explained|accepted|denies|disputes|rejects|responds)\b/g,
        "full name before witness verb",
      ],
      [
        /\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+(?:was|is|were|are|had been)\s+(?:involved|present|appointed|engaged|copied|responsible)\b/g,
        "full name before state verb",
      ],
      [
        // Litigation role label followed by a person name, e.g.
        // "Defendant Sergei Polevikov", "Relief Defendant Maryna Arystava".
        /\b(?:Defendant|Plaintiff|Respondent|Petitioner|Relief\s+Defendant|Intervenor|Relator|Decedent|Co-?Defendant|Co-?Plaintiff)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\b/g,
        "litigation role plus name",
      ],
    ];

    for (const [regex, reason] of contextPatterns) {
      for (const match of doc.text.matchAll(regex)) {
        const name = cleanValue(match[1]);
        if (this.looksLikePersonName(name))
          this.add(
            name,
            "PERSON",
            2,
            reason,
            doc.name,
            (match.index ?? 0) + match[0].indexOf(match[1]),
          );
      }
    }

    // Correspondence addresses lawyers by bare surname with the "Esq."
    // suffix ("Dear Thompson, Esq."). The surname may never appear with a
    // given name in the document, so alias generation cannot derive it; capture
    // it directly. The Esq. suffix is an unambiguous person (lawyer) signal.
    for (const match of doc.text.matchAll(
      /\b([A-Z][A-Za-z'’-]+),?[\s\u00A0]+Esq\.?\b/g,
    )) {
      const surname = cleanValue(match[1]);
      if (this.looksLikeSinglePersonToken(surname))
        this.add(
          surname,
          "PERSON",
          1,
          "surname with esq suffix",
          doc.name,
          (match.index ?? 0) + match[0].indexOf(match[1]),
        );
    }

    this.detectPersonLists(doc);
    this.detectStandalonePersonLines(doc);
    this.detectAttentionBlocks(doc);
    this.detectCaptionPersonnel(doc);
    this.detectCaptionPartyNames(doc);
    this.detectSignatureNames(doc);

    for (const match of doc.text.matchAll(
      /\bBetween\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+and\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})/g,
    )) {
      for (const name of [match[1], match[2]]) {
        if (this.looksLikePersonName(name))
          this.add(
            name,
            "PERSON",
            2,
            "agreement party heading",
            doc.name,
            (match.index ?? 0) + match[0].indexOf(name),
          );
      }
    }

    for (const match of doc.text.matchAll(
      /^[^\S\r\n]*([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+and\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})[^\S\r\n]*$/gm,
    )) {
      for (const name of [match[1], match[2]]) {
        if (this.looksLikePersonName(name))
          this.add(
            name,
            "PERSON",
            2,
            "standalone agreement party line",
            doc.name,
            (match.index ?? 0) + match[0].indexOf(name),
          );
      }
    }

    for (const match of doc.text.matchAll(
      /\b([A-Z][A-Za-z'’-]+)\s+v\s+[A-Z][A-Za-z'’-]+\b/g,
    )) {
      if (this.looksLikeSinglePersonToken(match[1]))
        this.add(
          match[1],
          "PERSON",
          2,
          "case caption name",
          doc.name,
          match.index ?? 0,
        );
    }

    for (const match of doc.text.matchAll(
      />([A-Z][A-Z'’.-]+(?:\s+[A-Z][A-Z'’.-]+){1,3})</g,
    )) {
      const titleCase = cleanValue(match[1])
        .toLocaleLowerCase()
        .replace(/\b\w/g, (char) => char.toLocaleUpperCase());
      if (this.looksLikePersonName(titleCase))
        this.add(
          match[1],
          "PERSON",
          2,
          "all-caps table person",
          doc.name,
          match.index ?? 0,
        );
    }

    for (const match of doc.text.matchAll(
      /^[^\S\r\n]*([A-Z][A-Z'’.-]+(?:[^\S\r\n]+[A-Z][A-Z'’.-]+){1,3})[^\S\r\n]*$/gm,
    )) {
      const titleCase = cleanValue(match[1])
        .toLocaleLowerCase()
        .replace(/\b\w/g, (char) => char.toLocaleUpperCase());
      if (this.looksLikePersonName(titleCase))
        this.add(
          match[1],
          "PERSON",
          2,
          "all-caps line person",
          doc.name,
          match.index ?? 0,
        );
    }
  }

  private detectPersonLists(doc: RedactionInput): void {
    for (const match of doc.text.matchAll(PERSON_LIST_RE)) {
      for (const nameMatch of match[0].matchAll(PERSON_NAME_RE)) {
        const name = cleanValue(nameMatch[0]);
        if (!this.looksLikePersonName(name)) continue;
        this.add(
          name,
          "PERSON",
          2,
          "title-case person in list",
          doc.name,
          (match.index ?? 0) + (nameMatch.index ?? 0),
        );
      }
    }
  }

  private detectStandalonePersonLines(doc: RedactionInput): void {
    const lines = doc.text.split(/\r?\n/);
    let searchPos = 0;
    for (const line of lines) {
      const pos = doc.text.indexOf(line, searchPos);
      searchPos = pos + line.length + 1;
      const visible = visibleLineText(line);
      const candidate = visible.replace(/^[*-]\s+/, "").replace(/:$/, "");
      if (!new RegExp(String.raw`^${PERSON_NAME_PATTERN}$`).test(candidate))
        continue;
      if (!this.looksLikePersonName(candidate)) continue;
      this.add(
        candidate,
        "PERSON",
        2,
        "standalone title-case person line",
        doc.name,
        pos + line.indexOf(visible),
      );
    }
  }

  // Name lists under correspondence "Attention:"/"Attn:" labels. Recipients
  // are frequently stacked one per line (often without a repeated title), so
  // the generic title / list detectors miss continuation names. This scans the
  // labelled line and following name-shaped lines until a blank line or a line
  // that is clearly not a name. Mirrors detectCaptionPersonnel but for the
  // softer correspondence block and without requiring heavy indentation.
  private detectAttentionBlocks(doc: RedactionInput): void {
    const lines = doc.text.split(/\r?\n/);
    const labelRe = /^\s*(?:Attention|Attn)\.?\s*[:：]\s*(.*)$/i;
    // A continuation name line: an optional leading title, then 2-4 name tokens
    // (allowing middle initials), optionally followed by a role after a comma.
    const nameRe =
      /^\s*(?:(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+)?([A-Z][A-Za-z''.-]+(?:[\s\u00A0]+(?:[A-Z]\.?|[A-Z][A-Za-z''.-]+)){1,3})(?:\s*,\s*[A-Za-z ./-]{2,40})?\s*$/;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const labelMatch = line.match(labelRe);
      if (!labelMatch) continue;
      const pos = doc.text.indexOf(line, 0);
      // First name(s) may sit on the same line as the label.
      const rest = labelMatch[1].trim();
      if (rest) {
        const same = rest.match(nameRe);
        if (same) {
          const name = cleanValue(same[1]);
          if (this.looksLikePersonName(name))
            this.add(
              name,
              "PERSON",
              1,
              "attention block name",
              doc.name,
              pos + line.indexOf(same[1], line.indexOf(rest)),
            );
        } else {
          // Same line may list several comma/"and"-separated names.
          for (const piece of rest.split(/\s*,\s*|\s+and\s+/i)) {
            const m = piece.match(nameRe);
            if (!m) continue;
            const name = cleanValue(m[1]);
            if (this.looksLikePersonName(name))
              this.add(
                name,
                "PERSON",
                1,
                "attention block name",
                doc.name,
                pos + line.indexOf(piece),
              );
          }
        }
      }
      // Continuation lines: keep consuming while they look like name lines.
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        const nextPos = doc.text.indexOf(next, 0);
        const visible = visibleLineText(next);
        if (!visible.trim()) break;
        const m = next.match(nameRe);
        if (!m) break;
        const name = cleanValue(m[1]);
        if (!this.looksLikePersonName(name)) break;
        this.add(
          name,
          "PERSON",
          1,
          "attention block continuation",
          doc.name,
          nextPos + next.indexOf(m[1]),
        );
      }
    }
  }

  // Caption-block personnel listings in litigation/regulatory filings.
  // Detects names listed under labels like COMMISSIONERS:, JUDGE:, BEFORE:,
  // MAGISTRATE JUDGE: and on continuation lines after such labels. Handles
  // middle initials and trailing role suffixes (e.g. ", Chair").
  private detectCaptionPersonnel(doc: RedactionInput): void {
    const lines = doc.text.split(/\r?\n/);
    let searchPos = 0;
    let inCaptionBlock = false;
    const labelRe =
      /^\s*(?:COMMISSIONERS|JUDGES?|MAGISTRATE\s+JUDGE|BEFORE|PRESIDING|SITTING)\s*[:：]\s*(.*)$/i;
    // A continuation line is heavily indented and contains a title-case name.
    // It ends when we hit a blank line or a line with little leading whitespace.
    const continuationRe =
      /^\s{8,}([A-Z][A-Za-z''.-]+(?:\s+(?:[A-Z]\.?|[A-Z][A-Za-z''.-]+)){1,4})(?:\s*,\s*[A-Za-z ]+)?\s*$/;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const pos = doc.text.indexOf(line, searchPos);
      searchPos = pos + line.length + 1;
      const labelMatch = line.match(labelRe);
      if (labelMatch) {
        inCaptionBlock = true;
        // The first name may be on the same line as the label.
        const rest = labelMatch[1].trim();
        if (rest) {
          const nameMatch = rest.match(
            /^([A-Z][A-Za-z''.-]+(?:\s+(?:[A-Z]\.?|[A-Z][A-Za-z''.-]+)){1,4})(?:\s*,\s*[A-Za-z ]+)?\s*$/,
          );
          if (nameMatch) {
            const name = cleanValue(nameMatch[1]);
            if (this.looksLikePersonName(name))
              this.add(
                name,
                "PERSON",
                2,
                "caption-block personnel",
                doc.name,
                pos + line.indexOf(nameMatch[1]),
              );
          }
        }
        continue;
      }
      if (inCaptionBlock) {
        const visible = visibleLineText(line);
        if (!visible.trim()) {
          inCaptionBlock = false;
          continue;
        }
        // Match continuation names on the raw line (preserving indentation).
        const contMatch = line.match(continuationRe);
        if (contMatch) {
          const name = cleanValue(contMatch[1]);
          if (this.looksLikePersonName(name))
            this.add(
              name,
              "PERSON",
              2,
              "caption-block continuation",
              doc.name,
              pos + line.indexOf(contMatch[1]),
            );
        } else {
          // Non-matching line ends the block unless it's a separator.
          if (!/^[=_\-]{3,}\s*$/.test(visible)) inCaptionBlock = false;
        }
      }
    }
  }

  // All-caps party names in court/agency captions, e.g.
  //   SERGEI POLEVIKOV,                    Defendant,
  //   MARYNA ARYSTAVA,                     Relief Defendant.
  // These lines mix the all-caps name with other content (roles, captions),
  // so the standalone all-caps line detector misses them. The role may appear
  // on the same line or on a separate line below the name.
  private detectCaptionPartyNames(doc: RedactionInput): void {
    // Pattern 1: all-caps name followed by a comma and a role on the same line.
    const sameLineRe =
      /(?:^|\n)[^\S\r\n]*([A-Z][A-Z''.-]+(?:[^\S\r\n]+[A-Z][A-Z''.-]+){1,5})\s*,\s*(?:(?:Plaintiff|Defendant|Respondent|Petitioner|Relief\s+Defendant|Intervenor|Relator|Decedent)s?\.?)[^\S\r\n]*(?:,|\.|$)/g;
    for (const match of doc.text.matchAll(sameLineRe)) {
      this.registerCaptionPartyName(match[1], match, doc);
    }

    // Pattern 2: all-caps name with trailing comma anywhere on the line,
    // where a litigation role appears within the next few lines. This catches
    // the caption format common in federal court filings where the name is
    // followed by other caption text and the role appears on a separate line.
    const nameOnlyRe =
      /(?:^|\n)[^\S\r\n]*([A-Z][A-Z''.-]+(?:[^\S\r\n]+[A-Z][A-Z''.-]+){1,5})\s*,/g;
    for (const match of doc.text.matchAll(nameOnlyRe)) {
      // Look ahead a few lines for a role label to confirm this is a caption.
      const after = doc.text.slice(match.index ?? 0, (match.index ?? 0) + 300);
      if (
        /(?:Plaintiff|Defendant|Respondent|Petitioner|Relief\s+Defendant|Intervenor|Relator|Decedent)s?[\s.,]/i.test(
          after,
        )
      ) {
        this.registerCaptionPartyName(match[1], match, doc);
      }
    }
  }

  private registerCaptionPartyName(
    rawName: string,
    match: RegExpMatchArray,
    doc: RedactionInput,
  ): void {
    const raw = rawName.trim();
    // Reject address-like lines (start with a digit or contain a state+ZIP pattern
    // immediately after the name comma).
    if (/^\d/.test(raw)) return;
    const matchEnd = (match.index ?? 0) + (match[0]?.length ?? 0);
    const afterInSource = doc.text.slice(matchEnd, matchEnd + 30);
    if (/^\s*,?\s*[A-Z]{2}\s+\d{5}/.test(afterInSource)) return;
    const titleCase = raw
      .toLocaleLowerCase()
      .replace(/\b\w/g, (c) => c.toLocaleUpperCase());
    if (!this.looksLikePersonName(titleCase)) return;
    this.add(
      raw,
      "PERSON",
      2,
      "caption party name",
      doc.name,
      (match.index ?? 0) +
        (match[0].indexOf(raw) >= 0 ? match[0].indexOf(raw) : 0),
    );
  }

  private detectSignatureNames(doc: RedactionInput): void {
    // Signatory names appear in execution/signature blocks after markers such
    // as "/s/", "By:", "Name:", or "Printed Name". They frequently use middle
    // initials ("Jennifer L. Cue"), initials-led forms ("L. A. Wong",
    // "T.A.P. Girardot"), lowercase particles ("J.F.P. de Groot"), or leading
    // titles ("Dr. Shirish Phulgaonkar") that the general detector misses, and
    // they may be printed in ALL CAPS. Capture and validate them here.
    const markerRe =
      /(?:\/s\/|\/S\/|\bName\s*:|\bPrinted Name\b\s*:|\bBy\s*:)/g;
    // A name token is a capitalized word/initial(s) cluster, or a lowercase
    // surname particle (de, van, von, ...). Tokens are separated by spaces/tabs
    // only (never newlines) so unrelated capitalized words are not stitched.
    const particle =
      "de|da|dos|das|du|del|della|di|van|von|der|den|ten|ter|le|la|el|bin|al";
    const token = `[A-Z][A-Za-z.'’-]+|(?:${particle})`;
    const nameRe = new RegExp(
      `([A-Z][A-Za-z.'’-]+(?:[^\\S\\r\\n]+(?:${token})){1,5})`,
      "g",
    );
    const orgSuffix = new RegExp(
      String.raw`\b(?:${ORGANIZATION_SUFFIX_ALT})\b\.?$`,
      "i",
    );
    const titleRe = LEADING_PERSON_TITLE_RE;
    const text = doc.text;
    for (const marker of text.matchAll(markerRe)) {
      let start = (marker.index ?? 0) + marker[0].length;
      // Skip separators (spaces, table pipes, underscores, slashes) that often
      // sit between a marker and the name, e.g. "| By: | /s/ Kirk Blosch |".
      if (/^[^\S\r\n]*\/s\//i.test(text.slice(start))) {
        start += text.slice(start).match(/^[^\S\r\n]*\/s\//i)?.[0].length ?? 0;
      }
      while (start < text.length && /[^\S\r\n]|[|_/]/.test(text[start]))
        start += 1;
      nameRe.lastIndex = start;
      const nameMatch = nameRe.exec(text);
      if (!nameMatch || (nameMatch.index ?? 0) !== start) continue;
      const surface = cleanValue(nameMatch[1]);
      // Register the full surface plus the leading-title-stripped form so body
      // occurrences without the title (e.g. "Shirish Phulgaonkar") also match.
      const forms = new Set<string>([surface]);
      if (titleRe.test(surface)) forms.add(surface.replace(titleRe, ""));
      for (const form of forms) {
        if (!this.isValidSignatureName(form, orgSuffix)) continue;
        this.registerSignatureName(form, doc.name, nameMatch.index ?? 0);
      }
    }
  }

  private registerSignatureName(
    surface: string,
    source: string,
    pos: number,
  ): void {
    // Register the surface exactly as printed so it matches the document text
    // (auto entries are case-sensitive, and particles like "de Groot" must keep
    // their lowercase form). When the printed form is ALL CAPS we additionally
    // register a title-cased version so mixed-case occurrences elsewhere match.
    this.addSignatureCandidate(surface, source, pos);
    if (surface === surface.toLocaleUpperCase()) {
      const titleCase = surface
        .toLocaleLowerCase()
        .replace(/\b\w/g, (char) => char.toLocaleUpperCase());
      if (titleCase !== surface)
        this.addSignatureCandidate(titleCase, source, pos);
    }
  }

  private addSignatureCandidate(
    value: string,
    source: string,
    pos: number,
  ): void {
    this.add(value, "PERSON", 1, "signature block name", source, pos);
  }

  private isValidSignatureName(name: string, orgSuffix: RegExp): boolean {
    if (orgSuffix.test(name)) return false;
    if (name.includes("&") || /\b(?:LP|LLP)\b/.test(name)) return false;
    const tokens = name.split(/\s+/);
    if (tokens.length < 2 || tokens.length > 6) return false;
    // At least one substantial capitalized token (a real given/surname, not a
    // lone initial or particle).
    const substantial = tokens.filter(
      (token) => /^[A-Z]/.test(token) && token.replace(/[.]/g, "").length >= 3,
    );
    if (substantial.length === 0) return false;
    // Reject role/defined-term phrases, but do not reject a real signatory
    // merely because their surname is also a contract word ("Jordan Price").
    if (looksLikeContractDefinedTermCandidate(name)) return false;
    if (tokens.some((token) => SINGLE_PERSON_STOPWORDS.has(token)))
      return false;
    return true;
  }

  private detectOrganizations(doc: RedactionInput): void {
    // Organization names live on a single line; use same-line whitespace
    // (\\s in the compiled regex, written here as \\s) so the suffix pattern
    // cannot stitch together several all-caps heading lines that happen to end
    // in a suffix word (e.g. "... TABLE OF CONTENTS MANAGEMENT").
    const orgPattern = new RegExp(
      `(?<![A-Za-z0-9])[A-Z][A-Za-z'&.(),-]+(?:[^\\S\\r\\n]+[A-Z][A-Za-z'&.(),-]+){0,6}[^\\S\\r\\n]+(?:${ORGANIZATION_SUFFIX_ALT})(?![A-Za-z0-9])`,
      "g",
    );
    for (const match of doc.text.matchAll(orgPattern)) {
      if (
        match[0].toLocaleLowerCase() !== "working group" &&
        !LEADING_PERSON_TITLE_RE.test(match[0]) &&
        !looksLikeGenericOrganizationPhrase(match[0])
      )
        this.add(
          match[0],
          "ORG",
          2,
          "organization suffix",
          doc.name,
          match.index ?? 0,
        );
    }

    const orgWithParentheticalPattern = new RegExp(
      `(?<![A-Za-z0-9])[A-Z][A-Z0-9'&.,-]+(?:\\s+[A-Z][A-Z0-9'&.,-]+){0,6}(?:\\s+\\\\?\\([A-Z][A-Z\\s&.,-]+\\\\?\\))\\s+(?:${ORGANIZATION_SUFFIX_ALT})(?![A-Za-z0-9])`,
      "g",
    );
    for (const match of doc.text.matchAll(orgWithParentheticalPattern)) {
      this.add(
        match[0],
        "ORG",
        2,
        "organization with parenthetical",
        doc.name,
        match.index ?? 0,
      );
    }

    for (const match of doc.text.matchAll(
      />([A-Z][A-Z0-9&.,'() -]{3,80}\b(?:LIMITED|LTD|GROUP|COMPANY|CORPORATION|CORP|BANK|PARTNERS|HOLDINGS))</g,
    )) {
      this.add(
        match[1],
        "ORG",
        2,
        "all-caps table organization",
        doc.name,
        match.index ?? 0,
      );
    }

    for (const value of KNOWN_ORGS) {
      for (const match of doc.text.matchAll(
        new RegExp(
          "(?<![A-Za-z0-9])" + escapeRegExp(value) + "(?![A-Za-z0-9])",
          "gi",
        ),
      )) {
        this.add(
          match[0],
          "ORG",
          2,
          "known organization",
          doc.name,
          match.index ?? 0,
        );
      }
    }

    for (const value of GENERAL_ORGS) {
      for (const match of doc.text.matchAll(
        new RegExp(
          "(?<![A-Za-z0-9])" + escapeRegExp(value) + "(?![A-Za-z0-9])",
          "gi",
        ),
      )) {
        this.add(
          match[0],
          "ORG",
          2,
          "recognized global organization",
          doc.name,
          match.index ?? 0,
        );
      }
    }
  }

  private detectMatterTerms(doc: RedactionInput): void {
    for (const match of doc.text.matchAll(
      /\bProject\s+[A-Z][A-Za-z0-9_-]+\b/g,
    )) {
      this.add(
        match[0],
        "PROJECT",
        2,
        "project name",
        doc.name,
        match.index ?? 0,
      );
    }
    for (const value of MATTER_TERMS) {
      for (const match of doc.text.matchAll(
        new RegExp(escapeRegExp(value), "gi"),
      )) {
        this.add(
          match[0],
          "PROJECT_OR_ISSUE",
          2,
          "matter glossary term",
          doc.name,
          match.index ?? 0,
        );
      }
    }
  }

  private detectLocations(doc: RedactionInput): void {
    for (const value of LOCATION_TERMS) {
      for (const match of doc.text.matchAll(
        new RegExp(escapeRegExp(value), "gi"),
      )) {
        this.add(
          match[0],
          "LOCATION",
          2,
          "location dictionary",
          doc.name,
          match.index ?? 0,
        );
      }
    }
  }

  private detectStrictProperNouns(doc: RedactionInput): void {
    const counts = new Map<string, number>();
    const firstPos = new Map<string, number>();
    const eligible = new Map<string, boolean>();
    const indicator =
      /(Statement|Report|Agreement|Examination|Evidence|Assets|Group|Road|Park|Hotel|University|Exchange|Board|Council|Authority|Department|Ministry|Agency|Foundation|Trust|Society|Institute|Association|Federation|Bureau|Service|Services|Enterprises|Solutions|Systems|Technologies|Partnership|Holding|Holdings)/;
    for (const match of doc.text.matchAll(
      /\b[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,4}\b/g,
    )) {
      const value = cleanValue(match[0]);
      if (
        PROPER_NOUN_STOP_TERMS.has(value) ||
        /^(?:Is|Can|Whether|The|A|An)\s+/.test(value)
      )
        continue;
      if (this.hasStrongerCandidate(value)) continue;
      const isIndicator = indicator.test(value);
      const isPerson = this.looksLikePersonName(value);
      if (isIndicator || isPerson) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
        if (!eligible.has(value)) eligible.set(value, true);
        if (!firstPos.has(value)) firstPos.set(value, match.index ?? 0);
        continue;
      }
      // Generic capitalized phrase: only eligible if it is not made of common
      // title-case words, and requires a higher repetition threshold.
      const tokens = value.split(/\s+/);
      const allCommon = tokens.every(
        (token) =>
          SINGLE_PERSON_STOPWORDS.has(token) || COMMON_TITLE_WORDS.has(token),
      );
      if (!allCommon) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
        eligible.set(value, false);
        if (!firstPos.has(value)) firstPos.set(value, match.index ?? 0);
      }
    }
    for (const [value, count] of counts) {
      const threshold = eligible.get(value) ? 2 : 3;
      if (count >= threshold)
        this.add(
          value,
          "PROPER_NOUN",
          3,
          "repeated capitalized phrase",
          doc.name,
          firstPos.get(value) ?? 0,
        );
    }
  }

  private detectCustomTerms(doc: RedactionInput): void {
    for (const term of this.customTerms.map(cleanValue).filter(Boolean)) {
      for (const match of doc.text.matchAll(
        new RegExp(escapeRegExp(term), "gi"),
      )) {
        this.add(
          match[0],
          "CUSTOM",
          1,
          "user custom term",
          doc.name,
          match.index ?? 0,
        );
      }
    }
  }

  private addPersonAliases(): void {
    const people = [...this.candidates.values()].filter(
      (c) => c.kind === "PERSON",
    );
    const fullNames = [
      ...new Set(
        people
          .map((c) =>
            c.value.replace(LEADING_PERSON_TITLE_RE, "").replace(/['’]s$/i, ""),
          )
          .filter((value) =>
            /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+$/.test(value),
          ),
      ),
    ];

    const sourcesByName = new Map(
      fullNames.map((name) => [
        name,
        people.find((p) => p.value.includes(name.split(" ")[0])) ?? people[0],
      ]),
    );
    const isAliasToken = (token: string): boolean =>
      !!token &&
      !AMBIGUOUS_PERSON_TOKENS.has(token) &&
      !isContractDefinedTermToken(token);
    const surnames = new Set(
      fullNames
        .map((name) => name.split(/\s+/).at(-1) ?? "")
        .filter(
          (token) =>
            isAliasToken(token) &&
            !ORG_SUFFIX_NAME_TOKENS.has(token.replace(/\.$/, "")),
        ),
    );
    // Signatories often sign with a shorter form of their printed name
    // (e.g. "Michael Hollan Messinger" signs as "Michael Messinger"). Build a
    // first+last alias for every multi-part full name so those shorter forms
    // are redacted consistently too.
    const firstLastAliases = new Set<string>();
    for (const name of fullNames) {
      const parts = name.split(/\s+/);
      if (parts.length >= 3)
        firstLastAliases.add(`${parts[0]} ${parts.at(-1)}`);
    }
    const givenNames = new Map<string, string[]>();
    for (const name of fullNames) {
      const given = name.split(/\s+/)[0];
      if (!isAliasToken(given)) continue;
      givenNames.set(given, [...(givenNames.get(given) ?? []), name]);
    }

    for (const doc of this.docs) {
      for (const surname of surnames) {
        if (!surname || AMBIGUOUS_PERSON_TOKENS.has(surname)) continue;
        if (surname.length <= 2 && !["Li", "Xu", "Mu"].includes(surname))
          continue;
        const source = sourcesByName.get(
          fullNames.find((name) => name.endsWith(surname)) ?? fullNames[0],
        );
        if (!source) continue;
        const titleRe = new RegExp(
          `\\b(?:${PERSON_TITLE_ALT})\\.?\\s+${escapeRegExp(surname)}\\b`,
          "g",
        );
        for (const match of doc.text.matchAll(titleRe))
          this.add(
            match[0],
            "PERSON",
            source.minLevel,
            "title plus surname alias",
            doc.name,
            match.index ?? 0,
          );
        const verbRe = new RegExp(
          `\\b${escapeRegExp(surname)}(?:'s|’s)?\\s+(?:(?:also|further)\\s+)?(?:says|said|states|stated|denies|accepts|accepted|explains|explained|adds|maintained|described|disputes|testified|gave|rejects|responds|recalls|argues|contends)\\b`,
          "g",
        );
        for (const match of doc.text.matchAll(verbRe))
          this.add(
            match[0].split(/\s+/)[0],
            "PERSON",
            source.minLevel,
            "bare surname in witness sentence",
            doc.name,
            match.index ?? 0,
          );
      }

      // Register first+last aliases derived from longer full names (e.g. a
      // "Michael Hollan Messinger" printed name yields "Michael Messinger").
      for (const alias of firstLastAliases) {
        const source = sourcesByName.get(
          fullNames.find(
            (name) =>
              name.startsWith(`${alias.split(" ")[0]} `) &&
              name.endsWith(` ${alias.split(" ").at(-1)}`),
          ) ?? fullNames[0],
        );
        if (!source) continue;
        const re = new RegExp(
          `(?<![A-Za-z0-9])${escapeRegExp(alias)}(?![A-Za-z0-9])`,
          "g",
        );
        for (const match of doc.text.matchAll(re))
          this.add(
            alias,
            "PERSON",
            source.minLevel,
            "first and last name alias",
            doc.name,
            match.index ?? 0,
          );
      }

      for (const [given, names] of givenNames) {
        const allowedShortGiven = ["Li", "Xu", "Mu"].includes(given);
        // If multiple names share the same given token, prefer names that do
        // NOT end with an org suffix (e.g. prefer "GoDaddy Trust Center" over
        // "GoDaddy Inc"). This prevents company names caught by contextual
        // patterns from blocking short-form person aliases.
        const effectiveNames =
          names.length > 1
            ? names.filter(
                (n) =>
                  !ORG_SUFFIX_NAME_TOKENS.has(
                    n.split(/\s+/).at(-1)?.replace(/\.$/, "") ?? "",
                  ),
              )
            : names;
        const effective = effectiveNames.length >= 1 ? effectiveNames : names;
        if (
          effective.length !== 1 ||
          (!this.looksLikeSinglePersonToken(given) && !allowedShortGiven)
        )
          continue;
        const source = sourcesByName.get(effective[0]);
        if (!source) continue;
        const commRe = new RegExp(
          `\\b(?:to|from|with|by|copying|copied to|sent to|emailed to|not copied to)\\s+${escapeRegExp(given)}(?![A-Za-z0-9])`,
          "g",
        );
        for (const match of doc.text.matchAll(commRe))
          this.add(
            given,
            "PERSON",
            source.minLevel,
            "given alias in communication context",
            doc.name,
            match.index ?? 0,
          );
        const responseRe = new RegExp(
          `\\b${escapeRegExp(given)}(?:'s|’s)\\s+Response(?![A-Za-z0-9])`,
          "g",
        );
        for (const match of doc.text.matchAll(responseRe))
          this.add(
            match[0].split(/['’]/)[0],
            "PERSON",
            source.minLevel,
            "given alias in response heading",
            doc.name,
            match.index ?? 0,
          );
        const verbRe = new RegExp(
          `\\b${escapeRegExp(given)}(?:'s|’s)?\\s+(?:says|said|states|stated|denies|accepts|accepted|explains|explained|adds|maintained|described|disputes|testified|gave|rejects|responds|recalls|argues|contends)(?![A-Za-z0-9])`,
          "g",
        );
        for (const match of doc.text.matchAll(verbRe))
          this.add(
            match[0].split(/\s+/)[0],
            "PERSON",
            source.minLevel,
            "given alias before witness verb",
            doc.name,
            match.index ?? 0,
          );
      }
    }
  }

  private finalizeCandidates(): void {
    // When the same exact surface string was detected under multiple kinds,
    // keep a single winner so replacement stays consistent. Prefer the lowest
    // minLevel so a strict-only detection can never shadow a lighter one and
    // remove a redaction that used to apply at lower levels.
    for (const [value, kinds] of this.exactIndex) {
      if (kinds.size <= 1) continue;
      let winner: CandidateKind | null = null;
      let bestLevel = Number.POSITIVE_INFINITY;
      let bestPriority = Number.POSITIVE_INFINITY;
      for (const kind of kinds) {
        const candidate = this.candidates.get(this.key(kind, value));
        const level = candidate ? candidate.minLevel : Number.POSITIVE_INFINITY;
        const priority = KIND_PRIORITY[kind];
        if (
          level < bestLevel ||
          (level === bestLevel && priority < bestPriority)
        ) {
          bestLevel = level;
          bestPriority = priority;
          winner = kind;
        }
      }
      for (const kind of kinds) {
        if (kind === winner) continue;
        this.candidates.delete(this.key(kind, value));
      }
    }
    for (const [key, candidate] of [...this.candidates.entries()]) {
      if (
        candidate.kind === "PROPER_NOUN" &&
        this.hasStrongerCandidate(candidate.value)
      )
        this.candidates.delete(key);
      if (
        candidate.kind === "PERSON" &&
        this.hasStrongerNonPersonCandidate(candidate.value)
      )
        this.candidates.delete(key);
    }
  }

  private looksLikeSinglePersonToken(name: string): boolean {
    return (
      /^[A-Z][A-Za-z'’-]{2,20}$/.test(name) &&
      !name.toLocaleUpperCase().startsWith(name) &&
      !SINGLE_PERSON_STOPWORDS.has(name)
    );
  }

  private looksLikePersonName(name: string): boolean {
    const badTerms = [
      "Arbitration No",
      "Table Contents",
      "Witness Statement",
      "Expert Report",
      "Companies Ordinance",
      "Listing Rules",
      "Memorandum of Understanding",
      "IPO Lead",
      "Due Diligence",
      "PRC Law",
      "Mainland China",
      "Civil Code",
      "Hong Kong",
      "Mountain Road",
      "Working Group Meeting",
      "Document Request Schedule",
      "Related-Party Transactions",
      "Deputy Chief Financial Officer",
      "Chief Operating Officer",
    ];
    if (badTerms.some((term) => name.includes(term))) return false;
    const tokens = name.split(/\s+/);
    if (tokens.length < 2 || tokens.length > 4) return false;
    if (
      tokens.some(
        (token) =>
          token.replace(/[^A-Za-z]/g, "").length >= 2 &&
          token === token.toLocaleUpperCase(),
      )
    )
      return false;
    // Person names do not contain standalone function words. A title-cased
    // "And/Of/For/The/..." inside a candidate is a strong heading/phrase
    // signal ("Scope And Transferability", "Use Of Proceeds", "Table Of
    // Contents", "At Month End"). This never appears in a real personal name.
    const FUNCTION_WORDS = new Set([
      "And",
      "Or",
      "Of",
      "For",
      "To",
      "In",
      "On",
      "At",
      "By",
      "As",
      "Nor",
      "No",
      "The",
      "A",
      "An",
      "Vs",
      "Versus",
    ]);
    if (tokens.some((token) => FUNCTION_WORDS.has(token))) return false;
    // A multiword candidate whose final token is an organization tail
    // (Systems, Airlines, Bank, Partners, ...) is a company caught by a
    // contextual/list detector, not a person. Suppress it here so it does
    // not pollute person alias generation ("Cisco", "Sabre", ...). Genuine
    // surnames are deliberately excluded from ORG_NAME_TAIL_TOKENS.
    const lastToken = tokens.at(-1)?.replace(/\.$/, "") ?? "";
    if (tokens.length >= 2 && ORG_NAME_TAIL_TOKENS.has(lastToken)) return false;
    // Reject defined-term phrases (e.g. "Administrative Agent", "Common Stock",
    // "Base Rent") without suppressing people whose surname is also a contract
    // word, such as "Jordan Price".
    if (looksLikeContractDefinedTermCandidate(name)) return false;
    // SINGLE_PERSON_STOPWORDS includes AMBIGUOUS_PERSON_TOKENS (He, May, Will,
    // Mark, Rose, etc.) which are legitimate first names. For multi-word names
    // we only reject tokens that are NOT ambiguous person names — words like
    // "Company", "Court", "Government" that are never plausible name components.
    if (
      tokens.some(
        (token) =>
          SINGLE_PERSON_STOPWORDS.has(token) &&
          !AMBIGUOUS_PERSON_TOKENS.has(token),
      )
    )
      return false;
    return true;
  }

  private hasStrongerCandidate(value: string): boolean {
    const normalized = normalizeForDedupe(value);
    return [...this.candidates.values()].some(
      (candidate) =>
        candidate.kind !== "PROPER_NOUN" &&
        normalizeForDedupe(candidate.value) === normalized,
    );
  }

  private hasStrongerNonPersonCandidate(value: string): boolean {
    const normalized = normalizeForDedupe(value);
    return [...this.candidates.values()].some(
      (candidate) =>
        !["PERSON", "PROPER_NOUN"].includes(candidate.kind) &&
        normalizeForDedupe(candidate.value) === normalized,
    );
  }
}

function canonicalPersonKeys(candidates: Candidate[]): Map<string, string> {
  const people = candidates.filter((c) => c.kind === "PERSON");
  const fullNames = [
    ...new Set(
      people
        .map((c) =>
          c.value.replace(LEADING_PERSON_TITLE_RE, "").replace(/['’]s$/i, ""),
        )
        .filter((value) =>
          /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+$/.test(value),
        )
        .filter((value) => {
          const last = value.split(/\s+/).at(-1)?.replace(/\.$/, "") ?? "";
          return !ORG_SUFFIX_NAME_TOKENS.has(last);
        }),
    ),
  ];

  const surnameToFull = new Map<string, string[]>();
  for (const name of fullNames) {
    const surname = name.split(/\s+/).at(-1) ?? "";
    surnameToFull.set(surname, [...(surnameToFull.get(surname) ?? []), name]);
  }

  const canonical = new Map<string, string>();
  for (const candidate of people) {
    const stripped = candidate.value
      .replace(LEADING_PERSON_TITLE_RE, "")
      .replace(/['’]s$/i, "");
    if (fullNames.includes(stripped)) {
      canonical.set(
        `PERSON\u0000${candidate.value}`,
        `PERSON\u0000${stripped}`,
      );
      continue;
    }
    if (/^[A-Z][A-Za-z'’-]+$/.test(stripped)) {
      const matches = surnameToFull.get(stripped) ?? [];
      if (new Set(matches).size === 1)
        canonical.set(
          `PERSON\u0000${candidate.value}`,
          `PERSON\u0000${matches[0]}`,
        );
    }
  }
  return canonical;
}

function tokenMap(candidates: Candidate[]): Map<string, string> {
  const canonical = canonicalPersonKeys(candidates);
  const counters = new Map<CandidateKind, number>();
  const mapping = new Map<string, string>();

  for (const candidate of [...candidates].sort(
    (a, b) => a.firstPos - b.firstPos || a.kind.localeCompare(b.kind),
  )) {
    const key = `${candidate.kind}\u0000${candidate.value}`;
    const canonicalKey = canonical.get(key) ?? key;
    const existing = mapping.get(canonicalKey);
    if (existing) {
      mapping.set(key, existing);
      continue;
    }
    const next = (counters.get(candidate.kind) ?? 0) + 1;
    counters.set(candidate.kind, next);
    const token = `${candidate.kind}_${String(next).padStart(3, "0")}`;
    mapping.set(canonicalKey, token);
    mapping.set(key, token);
  }
  return mapping;
}

function stripWordAnchors(text: string): string {
  return text
    .replace(WORD_ANCHOR_RE, "")
    .replace(WORD_TOC_NESTED_LINK_RE, "$1 $2")
    .replace(WORD_TOC_SIMPLE_LINK_RE, "$1");
}

function applyChronologyPolicy(text: string, level: number): string {
  if (level < LEVELS.strict) return text;
  const lines = text.split(/\r?\n/);
  let inChronology = false;
  let row = 0;
  return lines
    .map((line) => {
      const cells = splitMarkdownRow(line);
      if (
        cells &&
        cells
          .slice(0, 4)
          .map((c) => c.replace(/[*_`]/g, "").trim().toLocaleLowerCase())
          .join("|") === "date|bundle ref|exhibit number|description"
      ) {
        inChronology = true;
        return line;
      }
      if (inChronology && cells && cells.every((c) => /^:?-{2,}:?$/.test(c)))
        return line;
      if (inChronology && cells) {
        row += 1;
        cells[0] = `CHRONO_DATE_${String(row).padStart(3, "0")}`;
        cells[1] = `CHRONO_BUNDLE_${String(row).padStart(3, "0")}`;
        cells[2] = `CHRONO_EXHIBIT_${String(row).padStart(3, "0")}`;
        return `| ${cells.join(" | ")} |`;
      }
      inChronology = false;
      return line;
    })
    .join("\n");
}

function splitMarkdownRow(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  const cells = trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  return cells.length >= 4 ? cells : null;
}

function quarantineLegalContactSections(text: string, level: number): string {
  if (level < LEVELS.strict) return text;
  const lines = text.split(/\r?\n/);
  const output: string[] = [];
  let counter = 0;
  for (let index = 0; index < lines.length; index += 1) {
    if (!startsLegalContactSection(lines[index])) {
      output.push(lines[index]);
      continue;
    }
    counter += 1;
    output.push(`[CONTACT_SECTION_${String(counter).padStart(3, "0")}]`);
    while (
      index + 1 < lines.length &&
      !/^\d+\.\s+[A-Z][A-Z ()/&-]+$/.test(visibleLineText(lines[index + 1]))
    )
      index += 1;
  }
  return output.join("\n");
}

function visibleLineText(line: string): string {
  return cleanValue(line.replace(/<[^>]+>/g, "").replace(/[*_`]/g, ""));
}

function startsLegalContactSection(line: string): boolean {
  const visible = visibleLineText(line);
  return (
    visible === "For the Tribunal" ||
    visible === "HKIAC" ||
    visible.startsWith("Legal Representatives for")
  );
}

/** Deterministic stable id for a candidate/entry so edits survive re-detection. */
function entryId(kind: CandidateKind, value: string): string {
  return `${kind}:${encodeURIComponent(value)}`;
}

function customTermEntries(customTerms: string[]): ReplacementEntry[] {
  const seen = new Set<string>();
  const entries: ReplacementEntry[] = [];
  for (const term of customTerms.map(cleanValue).filter(Boolean)) {
    const normalized = normalizeForDedupe(term);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push({
      id: entryId("CUSTOM", term),
      value: term,
      replacement: `CUSTOM_${String(entries.length + 1).padStart(3, "0")}`,
      kind: "CUSTOM",
      level: "light",
      reason: "user custom term",
      sources: ["manual"],
      count: 0,
      manual: true,
      matchCase: false,
    });
  }
  return entries;
}

/** Build the matching regexp for an entry, honoring case sensitivity. */
function matcherRegExp(entry: ReplacementEntry): RegExp {
  // Escape, then fold any whitespace run (including the non-breaking spaces
  // U+00A0 / U+2007 that HTML-to-text converters emit) into \s+ so a value
  // captured with one space kind still matches another in the source text.
  const escaped = escapeRegExp(entry.value).replace(/(?:\\\s|\s)+/g, "\\s+");
  const flags = entry.matchCase ? "g" : "gi";
  if (/^[A-Za-z0-9_ .,'’&$:/()%-]+$/.test(entry.value)) {
    return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, flags);
  }
  return new RegExp(escaped, flags);
}

/** Replacement text for a value, preserving the existing possessive behavior. */
function replacementFor(entry: ReplacementEntry): string {
  return /['’]s$/i.test(entry.value)
    ? `${entry.replacement}'s`
    : entry.replacement;
}

/**
 * Merge freshly detected candidates with user-supplied entries.
 *
 * - Existing entry ids preserve user edits (replacement, manual, matchCase).
 * - Manual entries are included even when the detector did not find them.
 * - Detection metadata (sources, level, reason, count) is always recomputed.
 */
function buildEntries(
  candidates: Candidate[],
  mapping: Map<string, string>,
  userEntries: ReplacementEntry[],
  removedEntryIds: Set<string>,
  level: number,
  transformedTexts: string[],
): ReplacementEntry[] {
  const userById = new Map<string, ReplacementEntry>();
  for (const userEntry of userEntries) {
    userById.set(userEntry.id, userEntry);
  }
  const manualOverrideValues = new Set(
    userEntries
      .filter((entry) => entry.manual)
      .map((entry) => normalizeForDedupe(entry.value)),
  );

  const occurrenceCount = (entry: ReplacementEntry): number => {
    if (LEVELS[entry.level] > level) return 0;

    const re = matcherRegExp(entry);
    let count = 0;
    for (const text of transformedTexts) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        count += 1;
        if (match.index === re.lastIndex) re.lastIndex += 1;
      }
    }
    return count;
  };

  const seenIds = new Set<string>();
  const entries: ReplacementEntry[] = [];

  for (const candidate of candidates) {
    const id = entryId(candidate.kind, candidate.value);
    if (removedEntryIds.has(id)) continue;
    if (
      !userById.has(id) &&
      manualOverrideValues.has(normalizeForDedupe(candidate.value))
    ) {
      continue;
    }
    seenIds.add(id);
    const token =
      mapping.get(`${candidate.kind}\u0000${candidate.value}`) ??
      candidate.kind;
    const userEntry = userById.get(id);
    const base: ReplacementEntry = {
      id,
      value: candidate.value,
      replacement: token,
      kind: candidate.kind,
      level: levelName(candidate.minLevel),
      reason: candidate.reason,
      sources: [...candidate.sources].sort(),
      count: 0,
      manual: false,
      matchCase: true,
    };
    const merged = userEntry
      ? {
          ...base,
          replacement: userEntry.replacement,
          manual: userEntry.manual,
          matchCase: userEntry.matchCase,
        }
      : base;
    merged.count = occurrenceCount(merged);
    entries.push(merged);
  }

  // Manual (and any other) user entries that were not produced by detection.
  for (const userEntry of userEntries) {
    if (seenIds.has(userEntry.id)) continue;
    if (removedEntryIds.has(userEntry.id)) continue;
    const standalone: ReplacementEntry = { ...userEntry, count: 0 };
    standalone.count = occurrenceCount(standalone);
    entries.push(standalone);
  }

  // Stable order: detected entries by first position, then manual entries.
  const firstPosById = new Map(
    candidates.map((c) => [entryId(c.kind, c.value), c.firstPos] as const),
  );
  entries.sort((a, b) => {
    const ap = firstPosById.get(a.id) ?? Number.POSITIVE_INFINITY;
    const bp = firstPosById.get(b.id) ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;
    return a.value.localeCompare(b.value);
  });

  return entries;
}

/**
 * Split a document into ordered preview segments and sanitized text.
 *
 * Matching priority for overlapping spans (first wins):
 * 1. Manual entries before automatic entries.
 * 2. Latin text before non-Latin text.
 * 3. Longer values before shorter values.
 */
function buildSegments(
  text: string,
  entries: ReplacementEntry[],
  level: number,
): { segments: PreviewSegment[]; sanitized: string } {
  const transformed = quarantineLegalContactSections(
    applyChronologyPolicy(stripWordAnchors(text), level),
    level,
  );

  const applicable = entries
    .filter((entry) => LEVELS[entry.level] <= level)
    .sort((a, b) => {
      const aManual = a.manual ? 0 : 1;
      const bManual = b.manual ? 0 : 1;
      if (aManual !== bManual) return aManual - bManual;
      const aNonLatin = a.kind === "NON_LATIN_TEXT" ? 1 : 0;
      const bNonLatin = b.kind === "NON_LATIN_TEXT" ? 1 : 0;
      if (aNonLatin !== bNonLatin) return aNonLatin - bNonLatin;
      return b.value.length - a.value.length;
    });

  type Span = { start: number; end: number; entry: ReplacementEntry };
  const spans: Span[] = [];
  for (const entry of applicable) {
    const re = matcherRegExp(entry);
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(transformed)) !== null) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        entry,
      });
      if (match.index === re.lastIndex) re.lastIndex += 1;
    }
  }

  spans.sort((a, b) => {
    const aManual = a.entry.manual ? 0 : 1;
    const bManual = b.entry.manual ? 0 : 1;
    if (aManual !== bManual) return aManual - bManual;
    const aNonLatin = a.entry.kind === "NON_LATIN_TEXT" ? 1 : 0;
    const bNonLatin = b.entry.kind === "NON_LATIN_TEXT" ? 1 : 0;
    if (aNonLatin !== bNonLatin) return aNonLatin - bNonLatin;
    const lenDiff = b.end - b.start - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return a.start - b.start;
  });

  const occupied = new Array<boolean>(transformed.length).fill(false);
  const chosen: Span[] = [];
  for (const span of spans) {
    let free = true;
    for (let i = span.start; i < span.end; i += 1) {
      if (occupied[i]) {
        free = false;
        break;
      }
    }
    if (!free) continue;
    chosen.push(span);
    for (let i = span.start; i < span.end; i += 1) occupied[i] = true;
  }

  chosen.sort((a, b) => a.start - b.start);
  const segments: PreviewSegment[] = [];
  const sanitizedParts: string[] = [];
  let cursor = 0;
  for (const span of chosen) {
    if (span.start > cursor) {
      const plain = transformed.slice(cursor, span.start);
      segments.push({ text: plain });
      sanitizedParts.push(plain);
    }
    const original = transformed.slice(span.start, span.end);
    const replacement = replacementFor(span.entry);
    segments.push({
      text: replacement,
      entryId: span.entry.id,
      value: original,
      replacement,
      kind: span.entry.kind,
    });
    sanitizedParts.push(replacement);
    cursor = span.end;
  }
  if (cursor < transformed.length) {
    const plain = transformed.slice(cursor);
    segments.push({ text: plain });
    sanitizedParts.push(plain);
  }

  return { segments, sanitized: sanitizedParts.join("") };
}

export function redactDocuments(
  inputs: RedactionInput[],
  options: RedactionOptions,
): ReviewModel {
  const legacyCustomEntries = customTermEntries(options.customTerms ?? []);
  const detector = new Detector(inputs);
  const candidates = detector.detect();
  const mapping = tokenMap(candidates);
  const level = LEVELS[options.level];

  const transformedTexts = inputs.map((doc) =>
    quarantineLegalContactSections(
      applyChronologyPolicy(stripWordAnchors(doc.text), level),
      level,
    ),
  );
  const entries = buildEntries(
    candidates,
    mapping,
    [...legacyCustomEntries, ...(options.entries ?? [])],
    new Set(options.removedEntryIds ?? []),
    level,
    transformedTexts,
  );

  const documents = inputs.map((doc, index) => {
    const docId = `doc-${String(index + 1).padStart(3, "0")}`;
    const name = `Document ${String(index + 1).padStart(3, "0")}`;
    const { segments, sanitized } = buildSegments(doc.text, entries, level);
    return {
      id: docId,
      name,
      originalLength: doc.text.length,
      sanitized,
      segments,
    };
  });

  const combinedMarkdown =
    [
      "# Sanitized Document Pack",
      "",
      ...documents.flatMap((doc) => [
        `## Document: ${doc.name}`,
        "",
        doc.sanitized.trim(),
        "",
      ]),
    ]
      .join("\n")
      .trimEnd() + "\n";

  const counts: Record<string, number> = {};
  for (const entry of entries.filter((entry) => LEVELS[entry.level] <= level)) {
    counts[entry.kind] = (counts[entry.kind] ?? 0) + entry.count;
  }

  return {
    engineVersion: ENGINE_VERSION,
    documents,
    combinedMarkdown,
    entries,
    counts,
  };
}
