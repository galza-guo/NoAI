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
// OCR-spaced email: each character is separated by whitespace, as produced by
// some PDF-to-text extractors on letterhead logos (e.g. "j o h n @ a c m e . c o m").
// The local AND domain parts must be made of SINGLE characters separated by
// whitespace, so a normal multi-word sentence that merely ends in an email
// address ("... email to atwork.USbenefits@allegion.com") is NOT swallowed.
// The previous form `(?:[chars]\s*){2,}@...` greedily stitched whole sentences.
const OCR_SPACED_EMAIL_RE =
  /(?<![A-Za-z0-9@.])(?:[A-Za-z0-9._%+-]\s){3,}@\s?(?:[A-Za-z0-9.-]\s?){3,}[A-Za-z]{2,4}(?![A-Za-z0-9])/gi;

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
// Government / regulator agency tail words. A capitalized phrase containing
// one of these as a token identifies the regulator itself (e.g. "Drug
// Administration", "Trade Commission", "Human Services", "Information
// Commissioner's Office") in enforcement/compliance notices, never a person.
// Used to stop the communication-context, list, and "X and Y" standalone-line
// person detectors from carving agency-name fragments out as people. These
// words are never plausible personal-name components.
const GOV_AGENCY_TOKENS = new Set([
  "Administration",
  "Commission",
  "Department",
  "Agency",
  "Bureau",
  "Authority",
  "Directorate",
  "Inspectorate",
  "Office",
  "Services",
  "Council",
  "Court",
  "Tribunal",
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
// Organization suffixes split into two tiers by how they may be attached:
//
// LEGAL_FORM_ORG_SUFFIXES are structural entity markers (Inc, LLC, Corp, Ltd,
// PLC, GmbH, ...). They may follow a comma ("Northwind Logistics, LLC") as
// well as a plain space, because the ", <LegalSuffix>" form is standard.
//
// GENERIC_TAIL_ORG_SUFFIXES are softer tail words (Group, Capital, Management,
// Partners, Bank, Fund, ...). They may only follow a plain space, never a
// comma, so a person name followed by a role is not turned into an
// organization (e.g. "Aldo Brennan, Group General Counsel" is left alone).
const LEGAL_FORM_ORG_SUFFIXES = [
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
];
const GENERIC_TAIL_ORG_SUFFIXES = [
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
const ORGANIZATION_SUFFIXES = [
  ...LEGAL_FORM_ORG_SUFFIXES,
  ...GENERIC_TAIL_ORG_SUFFIXES,
];
const LEGAL_FORM_ORG_SUFFIX_ALT = LEGAL_FORM_ORG_SUFFIXES.join("|");
const GENERIC_TAIL_ORG_SUFFIX_ALT = GENERIC_TAIL_ORG_SUFFIXES.join("|");
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
  return "heavy";
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

function isValidIsin(value: string): boolean {
  const isin = value.toLocaleUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) return false;
  const numeric = [...isin]
    .map((char) =>
      /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char,
    )
    .join("");
  let sum = 0;
  let doubleDigit = false;
  for (let index = numeric.length - 1; index >= 0; index -= 1) {
    let digit = Number(numeric[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
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
      this.detectLabelContinuationValues(doc);
      this.detectAddressContinuations(doc);
      this.detectStandaloneAddressLines(doc);
      this.detectPeople(doc);
      this.detectOrganizations(doc);
      this.detectMatterTerms(doc);
      this.detectLocations(doc);
      this.detectHeavyProperNouns(doc);
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

    if (reason === "ISIN securities identifier" && !isValidIsin(cleaned))
      return;

    if (kind === "PHONE") {
      const digits = cleaned.replace(/\D/g, "");
      if (digits.length < 7) return;
      if (/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned)) return;
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return;
      if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(cleaned)) return;
      if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleaned)) return;
      if (/^(?:19|20)\d{6}$/.test(digits)) return;
      // A US ZIP+4 (ddddd-dddd) is a postcode, not a phone number. Without this
      // guard the generic phone regex captures ZIP+4 codes and, because PHONE
      // outranks POSTCODE in KIND_PRIORITY, the postcode is mislabeled.
      if (/^\d{5}-\d{4}$/.test(cleaned)) return;
      // SEC file/registration numbers look like d{1,3}-d{1,6} (e.g. "333-45346",
      // "0-18225"). When they appear without their label they are caught by the
      // phone regex; defer to the filing-number detectors by skipping only the
      // 5- or 6-digit suffix shape. Do not skip normal local phones such as
      // "555-0142".
      if (/^\d{1,3}-\d{5,6}$/.test(cleaned)) return;
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
      [
        "PHONE",
        // Common US toll-free/business form such as "1.844.623.9008" or
        // "844.623.9008". Keeping the final segment at four digits avoids IP
        // addresses and most European decimal/amount formats.
        /(?<![\w.])(?:\+?\d{1,3}\.)?\d{3}\.\d{3}\.\d{4}(?![A-Za-z0-9]|\.\d)/g,
        1,
        "dot-separated phone number",
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
        // suffix so ordinary sentences with numbers are not caught. Allows an
        // optional single/double-letter directional abbreviation as the first
        // token ("6409 E. Nisbet Road", "5435 NE Dawson Creek Drive") because
        // the main token class requires a 2+ letter capitalized word.
        new RegExp(
          String.raw`(?<![A-Za-z0-9])\d{1,6}[A-Za-z]?\s+(?:(?:[NSEW]\.?|[NS][EW])\s+)?[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,4}\s+(?:${STREET_SUFFIX_ALT})\b`,
          "g",
        ),
        1,
        "numbered street address",
      ],
      [
        "ADDRESS",
        // UK business correspondence often writes the whole address on one
        // line: "Suite 400, 77 King William Street, London EC4N 7BL". The
        // postcode anchor keeps this from swallowing ordinary numbered prose.
        new RegExp(
          String.raw`(?<![A-Za-z0-9])(?:(?:Suite|Unit|Room|Floor|Level)\s+[A-Z0-9-]+,?\s+)?\d{1,6}[A-Za-z]?\s+[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,4}\s+(?:${STREET_SUFFIX_ALT}),?\s+[A-Z][A-Za-z'’ -]{2,40}\s+[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}(?:,?\s+(?:United Kingdom|UK|England|Scotland|Wales|Northern Ireland))?`,
          "g",
        ),
        1,
        "UK full address line",
      ],
      ["ADDRESS", /\bP\.?\s*O\.?\s+Box\s+\d{1,10}\b/gi, 1, "post office box"],
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
        "POSTCODE",
        // Singapore 6-digit postal code, always written after the word
        // "Singapore" (e.g. "Singapore 228208"). The location anchor is
        // required because a bare 6-digit number is usually a figure, not a
        // postcode.
        /\bSingapore\s+(\d{6})\b/gi,
        1,
        "Singapore postal code",
      ],
      [
        "POSTCODE",
        // Dutch postal code "1234 AB" (four digits, space, two letters), only
        // when an office/address label anchors the same line. A bare "1234 AB"
        // can be an exhibit/range/table token, so it is not enough on its own.
        /\b(?:registered\s+office|branch\s+office|principal\s+office|postal\s+address|mailing\s+address|registered\s+address|office|address)\s*[:：][^\r\n]{0,80}\b(\d{4}\s+[A-Z]{2})\b/gi,
        1,
        "Dutch postal code after address label",
      ],
      [
        "POSTCODE",
        // Same Dutch shape, anchored by a following Netherlands country line.
        /\b(\d{4}\s+[A-Z]{2})\s+[A-Z][A-Za-z' -]+,\s+(?:The\s+)?Netherlands\b/g,
        1,
        "Dutch postal code before Netherlands",
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
        // The value char class is case-insensitive (the `i` flag) so the label
        // matches regardless of case. To stop the class from swallowing an
        // ordinary word that follows the label (e.g. "Company notifies" was
        // matched as "Company" + "No" + "tifies"), require the value to contain
        // at least one digit via a lookahead. Real registration numbers always
        // contain a digit.
        /\b(?:CR|BR|Company|Registered|Registration|Business Registration)\s+No\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Z0-9-]{5,}\b/gi,
        1,
        "business registration number",
      ],
      [
        "BUSINESS_ID",
        /\b(?:company number|registered no\.?|registration no\.?)\s*[:：]?\s*(?=[A-Za-z0-9-]*\d)[A-Z0-9-]{5,}\b/gi,
        1,
        "business registration label",
      ],
      [
        "BUSINESS_ID",
        /\b(?:CRN|Company\s+Registration\s+Number|Companies\s+House\s+(?:No\.?|Number))\s*(?:\([^)]*\))?\s*[:#]?\s*([A-Z]{0,2}\s?\d{5,8})\b/gi,
        1,
        "company registration number label",
      ],
      [
        "BUSINESS_ID",
        /\bSRA\s+ID\s*[:#]?\s*(\d{4,8})\b/gi,
        1,
        "professional regulator identifier",
      ],
      [
        "BUSINESS_ID",
        /\bHMRC\s+reference\s*[:#]?\s*[A-Z0-9]{2,4}\/[A-Z0-9]\/[A-Z0-9]{3,10}\b/gi,
        1,
        "HMRC reference",
      ],
      [
        "CASE_REF",
        /\b(?:Matter|Matter\s+Reference|Internal\s+Matter\s+Reference)\s*[:#]\s*([A-Z]{2,10}\/\d{2,4}\/\d{2,6})\b/gi,
        1,
        "matter reference label",
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
        // NOTE: the separator group must be NON-capturing (?:...) not (:?...);
        // otherwise match[1] holds the separator whitespace and the file number
        // is silently discarded by the `match[1] ?? match[0]` value rule.
        /\b(?:Commission\s+File\s+Number|File\s+Nos?)\.?(?:\s*[:#]?)?\s*\d{1,3}-\d{1,6}(?:\s+(?:and|&)\s*\d{1,3}-\d{1,6})*/gi,
        1,
        "SEC file number",
      ],
      [
        "BUSINESS_ID",
        // Exchange stock / securities code, label-bound. HKEX forms write
        // "(Stock Code: 1193)" or "Stock code (if listed) 01919"; the code
        // identifies the listed issuer and is sensitive. The label anchor is
        // required because a bare 4-5 digit number is usually a figure.
        /\bStock\s+Code(?:\s*\(if listed\))?\s*[:#]?\s*(\d{3,6})\b/gi,
        1,
        "stock/securities code",
      ],
      [
        "BUSINESS_ID",
        // ISIN (International Securities Identification Number): 2-letter
        // country code + 9 alphanumeric + 1 check digit, e.g. GB00B63HMG49.
        // The fixed length and leading 2 letters make the format distinctive.
        /\b([A-Z]{2}[A-Z0-9]{9}\d)\b/g,
        1,
        "ISIN securities identifier",
      ],
      [
        "BUSINESS_ID",
        // SEDOL (UK/LSE security identifier), 7 alphanumeric characters, only
        // matched after the "SEDOL" label because a bare 7-char token is too
        // ambiguous (matches many words/codes).
        /\bSEDOL(?:\s*(?:code|number|no\.?))?\s*[:#]?\s*([A-Z0-9]{7})\b/gi,
        1,
        "SEDOL securities identifier",
      ],
      [
        "BUSINESS_ID",
        // LEI (Legal Entity Identifier): 20 characters, first 4 are the LOU
        // code, then 12 alphanumeric, ending in 2 check digits. Only matched
        // after an "LEI"/"Legal Entity Identifier" label to avoid catching
        // arbitrary 20-char alphanumeric runs (hashes, base64, etc.).
        /\b(?:LEI|Legal\s+Entity\s+Identifier)(?:\s*(?:code|number|no\.?))?\s*[:#]?\s*([A-Z0-9]{18}[0-9]{2})\b/gi,
        1,
        "LEI legal entity identifier",
      ],
      [
        "BUSINESS_ID",
        // Australian Business Number (ABN): 11 digits, conventionally written
        // grouped as "XX XXX XXX XXX". The ABN label is required so ordinary
        // 11-digit runs (e.g. spaced share counts) are not caught.
        /\bABN\s*[:#]?\s*(\d{2}\s\d{3}\s\d{3}\s\d{3})\b/gi,
        1,
        "Australian Business Number",
      ],
      [
        "BUSINESS_ID",
        // Australian Company Number (ACN) / Registered Body Number (ARBN):
        // 9 digits, conventionally grouped "XXX XXX XXX". Label-bound.
        /\b(?:ACN|ARBN)\s*[:#]?\s*(\d{3}\s\d{3}\s\d{3})\b/gi,
        1,
        "Australian company/body number",
      ],
      [
        "BUSINESS_ID",
        // Procurement document reference numbers, label-bound. Solicitation,
        // RFP/RFQ, Purchase Order, PO, Contract, Requisition, Vendor, Invoice,
        // Bid, Tender, and Quote numbers all identify a specific transaction or
        // supplier and are sensitive. The label + qualifier anchor is required
        // so bare figures, table quantities, and version numbers stay readable.
        // The full labeled phrase is the candidate value (consistent with SEC
        // file/registration numbers), so only the labeled occurrence is
        // redacted — a bare number elsewhere remains readable. The value must
        // contain at least one digit so prose words after a label are ignored.
        /\b(?:Solicitation|RFP|RFQ|RFI|IFB|Purchase\s+Order|PO|Contract|Requisition|Vendor|Invoice|Bid|Tender|Quote|Quotation)\s+(?:Nos?|Numbers?|IDs?|Reference|Code)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "procurement document reference",
      ],
      [
        "BUSINESS_ID",
        // Same procurement labels used as bare field headers followed directly
        // by a colon/hash and a value, e.g. "Purchase Order: PO-CCS-009876",
        // "Reference: PAY-2026-0042", "Vendor: V12345". The colon/hash is
        // required to distinguish this from prose ("issue a purchase order for
        // the goods"); the digit lookahead rejects values that are plain prose.
        /\b(?:Solicitation|RFP|RFQ|RFI|IFB|Purchase\s+Order|PO|Contract|Requisition|Vendor|Invoice|Bid|Tender|Quote|Quotation|Reference)\s*[:#]\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "procurement reference label",
      ],
      [
        "BUSINESS_ID",
        // Compound payment/procurement reference labels, e.g. "Reference
        // Number for Payment: PAY-2026-0042". The extra "for ..." phrase is
        // common on remittance/bid forms. Keep this label-bound and require a
        // digit-containing value so ordinary "reference number for the table"
        // prose stays readable.
        /\bReference\s+(?:Nos?|Numbers?|IDs?|Code)\s+for\s+(?:Payment|Remittance|Bid|Tender|Quote|Quotation|Invoice|Purchase\s+Order|PO)\s*[:#]\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "compound procurement reference label",
      ],
      [
        "CASE_REF",
        // Regulator enforcement/compliance matter references, label-bound.
        // These cross-regulator labels identify a specific agency matter and
        // appear on FDA/FTC/EPA/EEOC/state AG/ICO enforcement letters and
        // orders: "Docket No.", "Complaint No.", "Charge No." (EEOC),
        // "Reference No." (ICO/FDA/Dear Healthcare Provider), "Matter No."
        // (inline form), and "CMS Case #" / "EEOC No." style agency-prefixed
        // codes. The label + qualifier anchor is required so bare figures and
        // prose stay readable; the value must contain a digit. The full labeled
        // phrase is the candidate value (consistent with SEC file numbers).
        /\b(?:Docket|Complaint|Charge|Reference|Matter)\s+(?:Nos?|Numbers?|IDs?)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{2,}\b/gi,
        1,
        "regulator matter reference",
      ],
      [
        "CASE_REF",
        // Agency-prefixed case/charge codes where the prefix itself is part of
        // the label, e.g. "CMS Case # 1-0429876-2026", "EEOC No. 35A-2026-1192",
        // "Document Control No. CMS-2026-088342". Label-bound; digit required so
        // a stray "Control No" prose fragment is not matched.
        /\b(?:CMS\s+Case|EEOC\s+Nos?|Document\s+Control\s+Nos?)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{2,}\b/gi,
        1,
        "agency case/charge reference",
      ],
      [
        "BUSINESS_ID",
        // Regulator establishment/registration identifiers, label-bound. These
        // identify the regulated entity rather than a matter and appear on
        // FDA/CMS/EPA/ICO notices: "FEI No." (FDA Firm Establishment
        // Identifier), "Establishment Identifier", "Provider No." (CMS),
        // "ICO Registration", "Registry No." / "EPA Registry No.". The label
        // anchor is required because a bare number is usually a figure.
        /\b(?:FEI|Establishment\s+Identifier|Provider\s+Nos?|ICO\s+Registration|(?:EPA\s+)?Registry\s+Nos?)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{2,}\b/gi,
        1,
        "regulator establishment/registration identifier",
      ],
      [
        "BUSINESS_ID",
        // Finance operations document references, label-bound. Remittance Advice
        // No. and Customer No. identify a specific payment document or customer
        // account on invoices, remittance advice, and accounts-payable forms.
        // Consistent with procurement references, the full labeled phrase is the
        // candidate value and the value must contain a digit so prose and bare
        // figures (table quantities, item codes) stay readable.
        /\b(?:Remittance\s+Advice|Remittance|Customer)\s+(?:Nos?|Numbers?|IDs?|Reference|Code)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "finance document reference",
      ],
      [
        "BUSINESS_ID",
        // "Payment Reference" / "Payment Ref" as a compound label (no separate
        // qualifier), e.g. "Payment Reference: PAY-2026-5512-CUST2099". The word
        // boundary after Reference/Ref (and digit lookahead) keeps prose such as
        // "the payment reference will follow" readable while catching the labeled
        // reference. Required because the bare-colon "Reference:" detector only
        // matches the trailing "Reference:" substring, leaving "Payment " unscoped.
        /\bPayment\s+(?:References?|Ref)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "payment reference label",
      ],
      [
        "BUSINESS_ID",
        // Tax identifiers, label-bound. VAT Registration No. (UK/EU), VAT No.,
        // VAT ID, Tax ID, Tax No., Tax Identification No., and Taxpayer ID all
        // identify a taxable entity. A bare number is usually a figure, so the
        // label anchor is required; the value must contain a digit so prose stays
        // readable. Bare "TIN" is deliberately excluded because lowercase "tin"
        // is a common word.
        /\b(?:VAT\s+(?:Registration\s+)?(?:Nos?|Numbers?|IDs?)|Tax(?:payer)?\s+(?:Identification\s+)?(?:IDs?|Nos?|Numbers?))\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "tax identifier label",
      ],
      [
        "BUSINESS_ID",
        // UK/EU VAT references are often written as "VAT registration: GB 123
        // 4567 89" without "No." or "ID". Keep it label-bound and require the
        // country/digit grouping so rates like "VAT: 20%" stay readable.
        /\bVAT\s+(?:registration|reg\.?|number|no\.?|id)\b\.?\s*[:#]?\s*([A-Z]{2}\s?\d{3}\s?\d{4}\s?\d{2}|\d{9,12})\b/gi,
        1,
        "VAT registration label",
      ],
      [
        "BANK_ACCOUNT",
        // Bank account number, label-bound. Distinct from IBAN (format-bound)
        // and from the generic abbreviated "Account No." case reference, a
        // "Bank Account No." / "Bank Account Number" / "Account Number" field
        // on an invoice or remittance names the payee's bank account. Restricted
        // to the "Bank Account" label or the full word "Account Number" so the
        // existing abbreviated "Account No." (CASE_REF) behavior is unchanged.
        // Without this rule a digit-only account number is mislabeled as PHONE.
        /\b(?:Bank\s+Account\s+(?:Nos?|Numbers?)|Account\s+Number)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{4,}\b/gi,
        1,
        "bank account number label",
      ],
      [
        "BUSINESS_ID",
        // HR / payroll identifiers, label-bound. Employee ID, Personnel No.,
        // Payroll ID, Employee Number, etc. identify a specific person or payroll
        // account on employment agreements, offer letters, and internal HR/payroll
        // forms. Consistent with finance/procurement references, the full labeled
        // phrase is the candidate value and the value must contain a digit so
        // prose (e.g. "Employee Number of staff", "Employee ID: pending") and
        // bare figures stay readable. Without these rules the trailing digit run
        // is mislabeled as PHONE and the alphabetic prefix leaks.
        /\b(?:Employee|Personnel|Payroll)\s+(?:IDs?|Nos?|Numbers?)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "HR/payroll identifier label",
      ],
      [
        "BUSINESS_ID",
        // Compound HR/payroll reference labels, mirroring the Round 8
        // "Payment Reference" rule. "Payroll Reference" / "Shareholder Reference"
        // are two-word labels with no separate qualifier; the bare-colon
        // "Reference:" detector only matches the trailing substring and left the
        // "Payroll " / "Shareholder " prefix unscoped. The value must contain a
        // digit so prose (e.g. "the payroll reference will follow") stays readable.
        /\b(?:Payroll|Shareholder)\s+(?:References?|Ref)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "compound HR/payroll reference label",
      ],
      [
        "BUSINESS_ID",
        // Equity award identifiers, label-bound. Grant No., Grant ID, Grant
        // Number, Equity Grant ID, Option Grant No., and Award ID identify a
        // specific equity grant on option/RSU award notices and employment
        // agreements. Consistent with finance references, the full labeled phrase
        // is the candidate value and the value must contain a digit so prose and
        // bare figures stay readable. Without this rule the trailing digit run is
        // mislabeled as PHONE and the grant prefix leaks.
        /\b(?:Equity\s+Grant|Option\s+Grant|Grant|Award)\s+(?:IDs?|Nos?|Numbers?)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "equity award identifier label",
      ],
      [
        "BUSINESS_ID",
        // Share certificate identifiers, label-bound. Certificate No., Certificate
        // Number, Share Certificate No., and the bare-colon "Share Certificate:"
        // field identify a specific share certificate on cap-table excerpts and
        // equity award notices. Label-bound and digit-required so prose and bare
        // figures stay readable. Without this rule the trailing digit run is
        // mislabeled as PHONE and the certificate prefix leaks.
        /\b(?:Share\s+Certificate|Certificate)\s+(?:IDs?|Nos?|Numbers?)\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "share certificate identifier label",
      ],
      [
        "BUSINESS_ID",
        // Bare-colon "Share Certificate:" field (no qualifier), e.g.
        // "Share Certificate: SHC-778210". The colon anchor distinguishes this
        // from prose ("the share certificate of incorporation"); the digit
        // lookahead rejects prose values.
        /\bShare\s+Certificate\s*[:#]\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "share certificate label",
      ],
      [
        "BUSINESS_ID",
        // Governance document references, label-bound. Written Consent (board
        // written consent reference) and Approval ID (internal approval memo)
        // identify a specific corporate record. The bare-colon "Written Consent:"
        // form is common because the qualifier is often omitted. Label-bound and
        // digit-required so prose ("by written consent of the board",
        // "subject to approval") and bare figures stay readable. Without this
        // rule the trailing digit run is mislabeled as PHONE/DATE and the prefix
        // leaks.
        /\b(?:Written\s+Consent\s+(?:IDs?|Nos?|Numbers?)|Approval\s+(?:IDs?|Nos?|Numbers?))\b\.?\s*[:#]?\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "governance reference label",
      ],
      [
        "BUSINESS_ID",
        // Bare-colon "Written Consent:" field (qualifier omitted), e.g.
        // "Written Consent: WC-2026-014". The colon anchor + digit requirement
        // keeps prose such as "by written consent of the board" readable.
        /\bWritten\s+Consent\s*[:#]\s*(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]{3,}\b/gi,
        1,
        "written consent label",
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
      // HKEX/SGX regulatory returns (e.g. FF301) carry a "Submitted by:"
      // field naming the company secretary / authorised officer who filed
      // the return. That is a personal name and must be redacted.
      [
        /^\s*Submitted by\s*[:：]\s*(.+)$/i,
        "PERSON_OR_ORG",
        1,
        "submitted-by label",
      ],
      // ASX/HKEX forms label the director/entity whose interests are reported.
      // "Name of Director" carries a person; "Name of entity" carries an org.
      [
        /^\s*Name of Director\s*[:：]?\s*(.+)$/i,
        "PERSON",
        1,
        "director-name label",
      ],
      // Procurement documents (SAM.gov solicitations, public bids, RFP/RFQ
      // responses) label the buying/bidding contact with "Contact Person" or
      // "Procurement Officer". That value is a personal name and must redact.
      // "Authorized Representative" and "Buyer" are also common person labels.
      [
        /^\s*(?:Contact\s+Person|Procurement\s+Officer|Procurement\s+Contact)\s*[:：]\s*(.+)$/i,
        "PERSON",
        1,
        "procurement contact label",
      ],
      [
        /^\s*(?:Buyer\s+Name|Bidder\s+Name)\s*[:：]\s*(.+)$/i,
        "PERSON_OR_ORG",
        1,
        "procurement party-name label",
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
      [/^\s*Date\s*[:：]\s*(.+)$/i, "DATE", 2, "date label"],
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
      // Regulator enforcement/compliance reference labels that name a specific
      // agency matter. These appear on FDA/FTC/EPA/EEOC/state AG/ICO letters and
      // orders and are kept label-bound so bare figures stay readable.
      [
        /^\s*(?:Docket|Complaint|Charge|Reference)\s*Nos?\.?\s*[:：]?\s*(.+)$/i,
        "CASE_REF",
        1,
        "regulator matter label",
      ],
      [
        /^\s*(?:CMS\s+Case|EEOC\s+Nos?|Document\s+Control\s+Nos?)\b\.?\s*[:：]?\s*(.+)$/i,
        "CASE_REF",
        1,
        "agency case/charge label",
      ],
      // Regulator establishment/registration identifiers that name the
      // regulated entity itself (not a matter). Label-bound.
      [
        /^\s*(?:FEI|Establishment\s+Identifier|Provider\s+Nos?|ICO\s+Registration|(?:EPA\s+)?Registry\s*Nos?)\b\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "regulator establishment/registration label",
      ],
      // FDA/regulated-industry notices label the inspected firm's name with
      // "Firm Name:". That value is a company (PERSON_OR_ORG), not a person.
      [/^\s*Firm Name\s*[:：]\s*(.+)$/i, "PERSON_OR_ORG", 1, "firm-name label"],
      // State AG / corporate filings register a named agent for service of
      // process with "Registered Agent:". The value may be a person or a
      // corporate agent service, so treat it as PERSON_OR_ORG.
      [
        /^\s*Registered Agent\s*[:：]\s*(.+)$/i,
        "PERSON_OR_ORG",
        1,
        "registered-agent label",
      ],
      // Finance operations reference labels (invoices, remittance advice,
      // accounts-payable forms). Remittance Advice No., Customer No., Payment
      // Reference, VAT/Tax identifiers, and Bank Account No. name a specific
      // payment document, account, or taxable entity. Kept label-bound so bare
      // figures, table quantities, and item codes stay readable. The
      // abbreviated "Account No." stays CASE_REF (above); only the explicit
      // "Bank Account" label and full-word "Account Number" become BANK_ACCOUNT.
      [
        /^\s*(?:Remittance\s+Advice|Remittance|Customer)\s+(?:Nos?|Numbers?|IDs?|Reference|Code)\b\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "finance document reference label",
      ],
      [
        /^\s*Payment\s+(?:References?|Ref)\b\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "payment reference label",
      ],
      [
        /^\s*(?:VAT\s+(?:Registration\s+)?(?:Nos?|Numbers?|IDs?)|Tax(?:payer)?\s+(?:Identification\s+)?(?:IDs?|Nos?|Numbers?))\b\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "tax identifier label",
      ],
      [
        /^\s*Bank\s+Account\s+(?:Nos?|Numbers?)\b\.?\s*[:：]?\s*(.+)$/i,
        "BANK_ACCOUNT",
        1,
        "bank account number label",
      ],
      [
        /^\s*Account\s+Number\b\.?\s*[:：]?\s*(.+)$/i,
        "BANK_ACCOUNT",
        1,
        "account number label",
      ],
      // HR / payroll identifier labels (employment agreements, offer letters,
      // internal HR/payroll forms). Line-anchored companions to the inline
      // BUSINESS_ID rules above; the shared digit guard rejects prose values
      // such as "Employee ID: pending" and multi-value lines are split.
      [
        /^\s*(?:Employee|Personnel|Payroll)\s+(?:IDs?|Nos?|Numbers?)\b\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "HR/payroll identifier label",
      ],
      [
        /^\s*(?:Payroll|Shareholder)\s+(?:References?|Ref)\b\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "compound HR/payroll reference label",
      ],
      // Equity award identifier labels (option/RSU award notices, employment
      // agreements, cap-table excerpts). Line-anchored companions to the inline
      // BUSINESS_ID rules; digit guard rejects prose values.
      [
        /^\s*(?:Equity\s+Grant|Option\s+Grant|Grant|Award)\s+(?:IDs?|Nos?|Numbers?)\b\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "equity award identifier label",
      ],
      [
        /^\s*(?:Share\s+Certificate|Certificate)\s+(?:IDs?|Nos?|Numbers?)\b\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "share certificate identifier label",
      ],
      [
        /^\s*Share\s+Certificate\s*[:：]\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "share certificate label",
      ],
      // Governance reference labels (board minutes, written consents, internal
      // approval memos). Line-anchored companions to the inline BUSINESS_ID
      // rules; digit guard rejects prose such as "Written Consent: to be filed".
      [
        /^\s*(?:Written\s+Consent\s+(?:IDs?|Nos?|Numbers?)|Approval\s+(?:IDs?|Nos?|Numbers?))\b\.?\s*[:：]?\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "governance reference label",
      ],
      [
        /^\s*Written\s+Consent\s*[:：]\s*(.+)$/i,
        "BUSINESS_ID",
        1,
        "written consent label",
      ],
      [/^\s*Ref\.?\s*[:：]\s*(.+)$/i, "CASE_REF", 1, "reference label"],
    ];

    const lines = doc.text.split(/\r?\n/);
    let searchPos = 0;
    for (const line of lines) {
      const pos = doc.text.indexOf(line, searchPos);
      searchPos = pos + line.length + 1;
      const stripped = line.trim().replace(/^[-*]\s+/, "");
      if (!stripped) continue;
      for (const [regex, kind, level, reason] of labelPatterns) {
        const match = stripped.match(regex);
        if (!match) continue;
        for (const part of this.splitLabelValue(match[1], kind)) {
          if (
            (kind === "CASE_REF" ||
              kind === "BUSINESS_ID" ||
              kind === "BANK_ACCOUNT") &&
            !/\d/.test(part)
          )
            continue;
          // Attention/Attn labels occasionally point at a department or role
          // rather than a person (e.g. "Attention: Legal Department",
          // "Attn: Human Resources"). Skip values that are contract/role
          // boilerplate so those lines stay readable, matching the body-text
          // person validators.
          if (
            kind === "PERSON" &&
            (looksLikeContractDefinedTermCandidate(part) ||
              this.looksLikeDepartmentOrRole(part))
          )
            continue;
          // From/To/Cc labels in stock-exchange forms often address the
          // listing venue itself (e.g. "To: Hong Kong Exchanges and Clearing
          // Limited"). That is regulatory boilerplate, not a redactable party;
          // skip fragments that are part of a regulated exchange-entity name so
          // the venue stays readable.
          if (
            (kind === "PERSON" || kind === "PERSON_OR_ORG") &&
            this.isExchangeEntityFragment(part)
          )
            continue;
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

  private detectLabelContinuationValues(doc: RedactionInput): void {
    const lines = doc.text.split(/\r?\n/);
    const offsets: number[] = [];
    let searchPos = 0;
    for (const line of lines) {
      const pos = doc.text.indexOf(line, searchPos);
      offsets.push(pos);
      searchPos = pos + line.length + 1;
    }

    const personOrOrgLabelRe =
      /^\s*(?:To|From|Cc|CC|Bcc|BCC|Client|Prepared for|Firm Name|Registered Agent)\s*[:：]\s*$/i;
    const personLabelRe =
      /^\s*(?:Attention|Attn|Contact Person|Procurement Officer|Procurement Contact)\.?\s*[:：]\s*$/i;

    for (let index = 0; index < lines.length - 1; index += 1) {
      const line = lines[index];
      const kind: CandidateKind | null = personLabelRe.test(line)
        ? "PERSON"
        : personOrOrgLabelRe.test(line)
          ? "PERSON_OR_ORG"
          : null;
      if (!kind) continue;

      const nextIndex = index + 1;
      const candidate = cleanValue(lines[nextIndex]);
      if (!candidate || /[:：]$/.test(candidate)) continue;
      if (!this.looksLikeContinuationLabelValue(candidate, kind)) continue;
      this.add(
        candidate,
        kind,
        1,
        "label continuation value",
        doc.name,
        offsets[nextIndex],
      );
    }
  }

  private looksLikeContinuationLabelValue(
    value: string,
    kind: CandidateKind,
  ): boolean {
    if (
      /^(?:Whom It May Concern|Dear Sir(?:s)?|Dear Madam|Dear Sir or Madam)$/i.test(
        value,
      )
    )
      return false;
    if (this.looksLikeDepartmentOrRole(value)) return false;
    if (looksLikeContractDefinedTermCandidate(value)) return false;
    if (ORG_SUFFIX_NAME_TOKENS.has(value.split(/\s+/).at(-1) ?? ""))
      return true;
    if (
      kind === "PERSON_OR_ORG" &&
      /(?:Inc\.?|LLC|Ltd\.?|Limited|Corp\.?|Corporation|Company|PLC|GmbH)$/i.test(
        value,
      )
    )
      return true;

    const nameLike =
      /^(?:(?:Mr|Mrs|Ms|Miss|Dr|Prof|Professor|Sir|Dame)\.?\s+)?[A-Z][A-Za-z'’-]+(?:\s+(?:[A-Z]\.?|[A-Z][A-Za-z'’-]+)){1,4}$/.test(
        value,
      );
    if (!nameLike) return false;
    const withoutTitle = value.replace(LEADING_PERSON_TITLE_RE, "");
    const substantialTokens = withoutTitle
      .split(/\s+/)
      .filter((token) => /^[A-Z][A-Za-z'’-]{2,}$/.test(token));
    if (substantialTokens.length < 2) return false;
    return !withoutTitle
      .split(/\s+/)
      .some((token) => GOV_AGENCY_TOKENS.has(token.replace(/\.$/, "")));
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
        // The communication-context pattern (from/to/between/and/by ...) can
        // catch a company/agency fragment when a conjunction sits inside an
        // entity name (e.g. "and Clearing Limited" from "Hong Kong Exchanges and
        // Clearing Limited", or "Human Services Food" stitched across "Health
        // and Human Services / Food and Drug Administration"). Skip a capture
        // that ends in a legal-form suffix, OR that contains any org-tail /
        // government-agency token, because those identify an organization, not a
        // person. The litigation-role pattern is excluded from this guard because
        // "Respondent Northwind Inc" must still be captured (as a company) so its
        // standalone form remains redactable.
        const lastTok = name.split(/\s+/).at(-1)?.replace(/\.$/, "") ?? "";
        const ctxTokens = name.split(/\s+/).map((t) => t.replace(/\.$/, ""));
        if (
          reason === "communication context" &&
          (ORG_SUFFIX_NAME_TOKENS.has(lastTok) ||
            ctxTokens.some(
              (t) => GOV_AGENCY_TOKENS.has(t) || ORG_NAME_TAIL_TOKENS.has(t),
            ))
        )
          continue;
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
      /\b([A-Z][A-Za-z'’-]+(?:[\s\u00A0]+[A-Z][A-Za-z'’-]+){0,3}),?[\s\u00A0]+Esq\.?\b/g,
    )) {
      const name = cleanValue(match[1]);
      if (
        this.looksLikePersonName(name) ||
        this.looksLikeSinglePersonToken(name)
      )
        this.add(
          name,
          "PERSON",
          1,
          "name with esq suffix",
          doc.name,
          (match.index ?? 0) + match[0].indexOf(match[1]),
        );
    }

    for (const match of doc.text.matchAll(
      /^[^\S\r\n]*(?:[-*]\s*)?([A-Z][A-Za-z'’-]+(?:[^\S\r\n]+[A-Z][A-Za-z'’-]+){1,3})[^\S\r\n]+[—-][^\r\n]*\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gm,
    )) {
      const name = cleanValue(match[1]);
      if (this.looksLikePersonName(name))
        this.add(
          name,
          "PERSON",
          1,
          "contact line before email",
          doc.name,
          (match.index ?? 0) + match[0].indexOf(match[1]),
        );
    }

    const businessContactPatterns: Array<[RegExp, string]> = [
      [
        /\b(?:lead\s+(?:partner|counsel|adviser|advisor)|matter\s+partner|relationship\s+manager|account\s+manager|case\s+handler)(?:\s+on\s+this\s+matter)?\s+is\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\b/g,
        "named business contact",
      ],
      [
        /\b(?:conduct|work|file|matter)\s+will\s+be\s+handled\s+by\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\b/g,
        "handled-by business contact",
      ],
    ];
    for (const [regex, reason] of businessContactPatterns) {
      for (const match of doc.text.matchAll(regex)) {
        const name = cleanValue(match[1]);
        if (this.looksLikePersonName(name))
          this.add(
            name,
            "PERSON",
            1,
            reason,
            doc.name,
            (match.index ?? 0) + match[0].indexOf(match[1]),
          );
      }
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
        if (!this.looksLikePersonName(name)) continue;
        // A "X and Y" standalone line can stitch across a conjunction inside
        // an entity name (e.g. "Hong Kong Exchanges and Clearing Limited" ->
        // "Clearing Limited") or across adjacent agency lines. Organization and
        // agency fragments are not people; skip them, mirroring detectPersonLists.
        const lastTok = name.split(/\s+/).at(-1)?.replace(/\.$/, "") ?? "";
        const tokens = name.split(/\s+/).map((t) => t.replace(/\.$/, ""));
        if (
          ORG_SUFFIX_NAME_TOKENS.has(lastTok) ||
          tokens.some(
            (t) => GOV_AGENCY_TOKENS.has(t) || ORG_NAME_TAIL_TOKENS.has(t),
          )
        )
          continue;
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
        // A list pattern can stitch across a conjunction inside an entity
        // name ("Hong Kong Exchanges and Clearing Limited" -> "Clearing
        // Limited") or across adjacent agency lines ("Human Services / Food").
        // Organization and agency fragments are not people; skip them here.
        const lastTok = name.split(/\s+/).at(-1)?.replace(/\.$/, "") ?? "";
        const tokens = name
          .split(/\s+/)
          .map((token) => token.replace(/\.$/, ""));
        if (
          this.isExchangeEntityFragment(name) ||
          ORG_SUFFIX_NAME_TOKENS.has(lastTok) ||
          tokens.some(
            (token) =>
              GOV_AGENCY_TOKENS.has(token) || ORG_NAME_TAIL_TOKENS.has(token),
          )
        )
          continue;
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
      // Strip a leading "Dear" salutation ("Dear Darcy Bomford,") so the
      // captured name is the person, not the greeting word. The remainder is
      // still validated as a standalone person line below.
      const candidate = visible
        .replace(/^[*-]\s+/, "")
        .replace(/^Dear\s+/, "")
        .replace(/:$/, "");
      if (!new RegExp(String.raw`^${PERSON_NAME_PATTERN}$`).test(candidate))
        continue;
      if (!this.looksLikePersonName(candidate)) continue;
      const nameStart = pos + line.indexOf(candidate);
      this.add(
        candidate,
        "PERSON",
        2,
        "standalone title-case person line",
        doc.name,
        nameStart >= pos ? nameStart : pos + line.indexOf(visible),
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
      const isSignatureSlash = /^\/s\//i.test(marker[0]);
      // Skip separators (spaces, table pipes, underscores, slashes) that often
      // sit between a marker and the name, e.g. "| By: | /s/ Kirk Blosch |".
      if (/^[^\S\r\n]*\/s\//i.test(text.slice(start))) {
        start += text.slice(start).match(/^[^\S\r\n]*\/s\//i)?.[0].length ?? 0;
      }
      // For a "/s/" marker, regulator letter signature blocks frequently put
      // the printed name on the line immediately below the marker:
      //   /s/
      //   Judith A. Whitfield
      //   District Director
      // Allow crossing a single newline boundary (and surrounding horizontal
      // whitespace) in that case so the name is captured. Other markers
      // (Name:, By:, Printed Name:) keep the same-line behaviour.
      if (isSignatureSlash) {
        const nlMatch = text.slice(start).match(/^[^\S\r\n]*\r?\n[^\S\r\n]*/);
        if (nlMatch) {
          const nlEnd = start + nlMatch[0].length;
          // Only cross the newline if nothing but a name begins there; stop at a
          // second newline so we never stitch two unrelated lines.
          nameRe.lastIndex = nlEnd;
          const probe = nameRe.exec(text);
          if (probe && (probe.index ?? 0) === nlEnd) {
            start = nlEnd;
          }
        }
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
    // (\s in the compiled regex, written here as \s) so the suffix pattern
    // cannot stitch together several all-caps heading lines that happen to end
    // in a suffix word (e.g. "... TABLE OF CONTENTS MANAGEMENT").
    //
    // Tokens are joined only by same-line whitespace. Because the token itself
    // excludes periods, headings such as "Due Diligence. The Company" cannot be
    // stitched across a sentence boundary. Generic tail suffixes (Group,
    // Capital, ...) may only follow a plain space; legal-form suffixes (Inc,
    // LLC, ...) may also follow ", " so "Name, Inc" survives.
    const orgToken = String.raw`[A-Z][A-Za-z'&()-]*`;
    const ampersandOrgCore = String.raw`[A-Z][A-Za-z'()-]*(?:[^\S\r\n]+[A-Z][A-Za-z'()-]*){0,3}`;
    const ampersandOrgPattern = new RegExp(
      String.raw`(?<![A-Za-z0-9])${ampersandOrgCore}(?:[^\S\r\n]*&[^\S\r\n]*${ampersandOrgCore})+(?:[^\S\r\n]+(?:${GENERIC_TAIL_ORG_SUFFIX_ALT})|(?:[^\S\r\n]+|,\s+)(?:${LEGAL_FORM_ORG_SUFFIX_ALT}))(?![A-Za-z0-9])`,
      "g",
    );
    for (const match of doc.text.matchAll(ampersandOrgPattern)) {
      const surface = this.normalizeOrgSurface(match[0]);
      if (!surface || this.isGenericOrgBoilerplate(surface)) continue;
      this.add(
        surface,
        "ORG",
        2,
        "ampersand organization suffix",
        doc.name,
        (match.index ?? 0) + match[0].indexOf(surface),
      );
    }

    const orgPattern = new RegExp(
      String.raw`(?<![A-Za-z0-9])${orgToken}(?:[^\S\r\n]+${orgToken}){0,6}(?:[^\S\r\n]+(?:${GENERIC_TAIL_ORG_SUFFIX_ALT})|(?:[^\S\r\n]+|,\s+)(?:${LEGAL_FORM_ORG_SUFFIX_ALT}))(?![A-Za-z0-9])`,
      "g",
    );
    for (const match of doc.text.matchAll(orgPattern)) {
      const surface = this.normalizeOrgSurface(match[0]);
      if (!surface) continue;
      if (
        surface.toLocaleLowerCase() !== "working group" &&
        !LEADING_PERSON_TITLE_RE.test(surface) &&
        !looksLikeGenericOrganizationPhrase(surface) &&
        !this.isGenericOrgBoilerplate(surface)
      )
        this.add(
          surface,
          "ORG",
          2,
          "organization suffix",
          doc.name,
          (match.index ?? 0) + match[0].indexOf(surface),
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

  // Strip leading sentence-leading conjunctions/adverbs that the suffix
  // pattern may prepend when an organization name starts a sentence
  // (e.g. "Although DG Capital", "Moreover Goldman Sachs"). Returns the
  // trimmed surface, or null if nothing usable remains.
  private normalizeOrgSurface(raw: string): string | null {
    const LEADING = new Set([
      "Although",
      "Moreover",
      "Furthermore",
      "Additionally",
      "However",
      "While",
      "Whereas",
      "Because",
      "Since",
      "Once",
      "If",
      "When",
    ]);
    let surface = raw;
    const first = surface.split(/\s+/)[0];
    if (LEADING.has(first)) surface = surface.slice(first.length).trim();
    return surface || null;
  }

  // Detect department / role / function phrases that appear after an
  // "Attention:" label instead of a person name, e.g. "Legal Department",
  // "Human Resources", "Investor Relations", "Corporate Secretary". These
  // are not people and should remain readable. Returns true when the phrase
  // is built only from role/department tokens.
  private looksLikeDepartmentOrRole(value: string): boolean {
    const DEPARTMENT_ROLE_TOKENS = new Set([
      "Department",
      "Dept",
      "Resources",
      "Relations",
      "Office",
      "Division",
      "Services",
      "Legal",
      "Human",
      "Investor",
      "Corporate",
      "Secretary",
      "Treasury",
      "Finance",
      "Accounting",
      "Compliance",
      "Tax",
      "Risk",
      "Audit",
      "Operations",
      "Administration",
      "Marketing",
      "Sales",
      "Security",
      "Procurement",
      "Purchasing",
      "Facilities",
      "Technology",
      "Information",
    ]);
    const tokens = value.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return false;
    return tokens.every((token) => DEPARTMENT_ROLE_TOKENS.has(token));
  }

  // Reject generic org boilerplate that the suffix pattern turns into an ORG:
  // "The Company", "The Bank", "The Partnership", "The Firm", "The Fund",
  // "The Employer", "The Issuer". These are defined-term references, not
  // organization names, and redacting them destroys readability of contracts.
  // Also includes exchange/regulator fragments that the suffix detector carves
  // out of mandatory listing-venue disclaimers (e.g. "Clearing Limited" from
  // "Hong Kong Exchanges and Clearing Limited"), and section/role headings
  // that end in a legal-form suffix word ("CHANGE OF COMPANY").
  private isGenericOrgBoilerplate(surface: string): boolean {
    const GENERIC_ORG_BOILERPLATE = new Set([
      "The Company",
      "the Company",
      "The Bank",
      "the Bank",
      "The Partnership",
      "the Partnership",
      "The Firm",
      "the Firm",
      "The Fund",
      "the Fund",
      "The Employer",
      "the Employer",
      "The Issuer",
      "the Issuer",
      "The Corporation",
      "the Corporation",
      "The LLC",
      "The Committee",
      "the Committee",
      // Exchange / listing-venue disclaimer fragments.
      "Clearing Limited",
      "Stock Exchange",
      "The Stock Exchange",
      "Hong Kong Exchanges and Clearing",
      "London Stock Exchange",
      // Section / role headings ending in a legal-form suffix word.
      "CHANGE OF COMPANY",
    ]);
    return GENERIC_ORG_BOILERPLATE.has(surface);
  }

  // Detect fragments of regulated exchange-entity names that label-value
  // patterns carve out of "To:/From:/Cc:" lines in stock-exchange forms
  // (e.g. "Hong Kong Exchanges", "Clearing Limited" from "To: Hong Kong
  // Exchanges and Clearing Limited"). These are listing-venue boilerplate and
  // must stay readable rather than being redacted as a party.
  private isExchangeEntityFragment(value: string): boolean {
    const EXCHANGE_FRAGMENTS = new Set([
      "Hong Kong Exchanges",
      "Clearing Limited",
      "Stock Exchange",
      "The Stock Exchange",
      "London Stock Exchange",
      "Singapore Exchange",
    ]);
    return EXCHANGE_FRAGMENTS.has(value.trim());
  }

  private detectMatterTerms(doc: RedactionInput): void {
    for (const match of doc.text.matchAll(
      /\bProject\s+[A-Z][A-Za-z0-9_-]+\b/g,
    )) {
      const codename = match[0].replace(/^Project\s+/, "");
      // "Project Manager", "Project Coordinator", "Project Engineer" are job
      // titles, not project codenames. When the token after "Project" is itself
      // a role / defined-term word, the phrase names a role and must stay
      // readable instead of being redacted as a project (or turning the role
      // word into a project alias that then redacts every later "Manager").
      if (isContractDefinedTermToken(codename)) continue;
      this.add(
        match[0],
        "PROJECT",
        2,
        "project name",
        doc.name,
        match.index ?? 0,
      );
      if (
        codename.length > 3 &&
        !PROPER_NOUN_STOP_TERMS.has(codename) &&
        !SINGLE_PERSON_STOPWORDS.has(codename) &&
        !COMMON_TITLE_WORDS.has(codename)
      )
        this.add(
          codename,
          "PROJECT",
          2,
          "project codename alias",
          doc.name,
          (match.index ?? 0) + match[0].indexOf(codename),
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
        // Do not redact a location token that sits inside a regulated
        // exchange-entity name (e.g. "Hong Kong" in "Hong Kong Exchanges and
        // Clearing Limited" or "The Stock Exchange of Hong Kong Limited",
        // "London" in "London Stock Exchange", "Singapore" in "Singapore
        // Exchange"). These are listing-venue boilerplate and must stay
        // readable; the exchange name is preserved as a unit.
        const start = match.index ?? 0;
        const end = start + match[0].length;
        const window = doc.text
          .slice(Math.max(0, start - 24), end + 32)
          .replace(/\s+/g, " ");
        if (
          /Exchanges and Clearing/i.test(window) ||
          /Stock Exchange of Hong Kong/i.test(window) ||
          /London Stock Exchange/i.test(window) ||
          /Singapore Exchange/i.test(window)
        )
          continue;
        this.add(
          match[0],
          "LOCATION",
          2,
          "location dictionary",
          doc.name,
          start,
        );
      }
    }
  }

  private detectHeavyProperNouns(doc: RedactionInput): void {
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
    // minLevel so a heavy-only detection can never shadow a lighter one and
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
      "Proxy Form",
    ];
    if (badTerms.some((term) => name.includes(term))) return false;
    if (this.isExchangeEntityFragment(name)) return false;
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
    // Reject corporate-governance role / officer phrases that the contextual
    // detectors catch in listed-issuer filings ("Independent Non-executive
    // Directors", "Authorised Representative", "Chief Executive Officer",
    // "Non-Executive Director", "Company Secretary"). These are roles, not
    // people; the named officer is captured separately by the titled-name and
    // signature detectors.
    const ROLE_ENDINGS = new Set([
      "Directors",
      "Director",
      "Representative",
      "Secretary",
      "Chairman",
      "Chairperson",
      "Chair",
      "President",
      "Officer",
      "Manager",
      "Treasurer",
      "Auditor",
      "Registrar",
      "Proxy",
    ]);
    if (tokens.length >= 2 && ROLE_ENDINGS.has(lastToken)) return false;
    // Reject finance/operations document-section headings caught by the
    // standalone-line or list detectors on invoices, remittance advice, and
    // accounts-payable forms (e.g. "Remittance Advice", "Bank Details",
    // "Beneficiary Details", "Wire Instructions", "Line Items"). These are
    // section titles, not people; the heading nouns never appear as surnames.
    const DOCUMENT_HEADING_ENDINGS = new Set([
      "Advice",
      "Instructions",
      "Details",
      "Items",
      "Summary",
      "Method",
      "Information",
      "Table",
    ]);
    if (tokens.length >= 2 && DOCUMENT_HEADING_ENDINGS.has(lastToken))
      return false;
    // Reject government / regulator agency fragments caught by the
    // communication-context, list, or standalone-line detectors (e.g. "Drug
    // Administration", "Trade Commission", "Drug Administration Silver
    // Spring"). A personal name never contains an agency tail word
    // (Administration, Commission, Department, Bureau, Authority, ...) as any
    // token; these identify the regulator itself in enforcement/compliance
    // notices and must stay readable. See the module-level GOV_AGENCY_TOKENS.
    if (tokens.some((token) => GOV_AGENCY_TOKENS.has(token))) return false;
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
  if (level < LEVELS.heavy) return text;
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
  if (level < LEVELS.heavy) return text;
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
