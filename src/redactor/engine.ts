import {
  AMBIGUOUS_PERSON_TOKENS,
  KNOWN_ORGS,
  LOCATION_TERMS,
  MATTER_TERMS,
  PROPER_NOUN_STOP_TERMS,
  SINGLE_PERSON_STOPWORDS,
} from "./rules";
import {
  Candidate,
  CandidateKind,
  LEVELS,
  RedactionInput,
  RedactionLevel,
  RedactionOptions,
  RedactionResult,
  SerializableCandidate,
} from "./types";

const WORD_ANCHOR_RE = /<span\s+id="_Toc\d+"\s+class="anchor"\s*><\/span>/gi;
const WORD_TOC_NESTED_LINK_RE = /\[([^\[\]\n]+?)\s+\[(\d+)\]\(#_Toc\d+\)\]\(#_Toc\d+\)/g;
const WORD_TOC_SIMPLE_LINK_RE = /\[([^\[\]\n]+)\]\(#_Toc\d+\)/g;
const OCR_SPACED_EMAIL_RE = /(?:[A-Za-z0-9._%+-]\s*){2,}@\s*[A-Za-z0-9.-]+\.[A-Za-z]{2,}/gi;

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
  return cleaned.length >= 2 && !["the", "and", "or", "of", "to", "in", "for", "with"].includes(cleaned);
}

function normalizeForDedupe(value: string): string {
  return cleanValue(value)
    .replace(/^(?:Mr|Ms|Mrs|Miss|Dr|Professor|Prof)\.?\s+/i, "")
    .replace(/['’]s$/i, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patternForValue(value: string): RegExp {
  const escaped = escapeRegExp(value).replace(/\\\s+/g, "\\s+");
  if (/^[A-Za-z0-9_ .,'’&$:/()%-]+$/.test(value)) {
    return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "g");
  }
  return new RegExp(escaped, "g");
}

function levelName(level: number): RedactionLevel {
  if (level <= 1) return "light";
  if (level === 2) return "balanced";
  return "strict";
}

function looksOrgishOrProjectish(value: string): boolean {
  return /^Project\s+[A-Z]/.test(value) || /(University|Bank|Management|Agreement|Park|Company|Partners|Capital|Exchange|Group|Holdings|Committee)/.test(value);
}

export class Detector {
  private candidates = new Map<string, Candidate>();

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
    return [...this.candidates.values()].sort((a, b) => a.firstPos - b.firstPos || a.minLevel - b.minLevel || a.kind.localeCompare(b.kind));
  }

  private key(kind: CandidateKind, value: string): string {
    return `${kind}\u0000${value}`;
  }

  private add(value: string, kind: CandidateKind, minLevel: number, reason: string, source: string, pos: number): void {
    const cleaned = cleanValue(value);
    if (!meaningful(cleaned)) return;

    if (kind === "PHONE") {
      const digits = cleaned.replace(/\D/g, "");
      if (digits.length < 7) return;
      if (/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned)) return;
      if (/^(?:19|20)\d{6}$/.test(digits)) return;
    }

    if (kind === "PERSON") {
      const stripped = cleaned.replace(/^(?:Mr|Ms|Mrs|Miss|Dr|Professor|Prof)\.?\s+/i, "").replace(/['’]s$/i, "");
      if (!stripped.includes(" ") && AMBIGUOUS_PERSON_TOKENS.has(stripped) && stripped === cleaned) return;
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
  }

  private detectDirectPatterns(doc: RedactionInput): void {
    const patterns: Array<[CandidateKind, RegExp, number, string]> = [
      ["EMAIL", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, 1, "email address"],
      ["EMAIL", OCR_SPACED_EMAIL_RE, 1, "OCR-spaced email address"],
      ["PHONE", /(?<![\w/])(?:\+?\d[\d ()-]{6,}\d)(?![\w/])/g, 1, "phone-like digit sequence"],
      ["URL", /https?:\/\/[^\s)>\]]+/g, 1, "URL"],
      ["INTERNAL_LINK", /\]\(([^)]+\.pdf)\)/g, 2, "markdown link to source file"],
      ["ADDRESS", /\b(?:Unit|Room|Rm|Suite|Flat)\s+[A-Z0-9-]+,?\s+\d+\/F,?\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,5}\s+(?:Building|Tower|Centre|Center|House|Plaza),?\s+\d+\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\s+(?:Road|Street|Avenue|Rd|St)(?:,?\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})*/g, 1, "inline address phrase"],
      ["CASE_REF", /\bHKIAC Arbitration No\.\s*[A-Z]?\d+\b/g, 1, "arbitration number"],
      ["CASE_REF", /\bHKIAC\/[A-Z]?\d+\b/g, 1, "case shorthand"],
      ["BUSINESS_ID", /\b(?:CR|BR|Company|Registered|Registration|Business Registration)\s+No\.?\s*[:#]?\s*[A-Z0-9-]{5,}\b/gi, 1, "business registration number"],
      ["BUSINESS_ID", /\b(?:company number|registered no\.?|registration no\.?)\s*[:：]?\s*[A-Z0-9-]{5,}\b/gi, 1, "business registration label"],
      ["BUNDLE_REF", /\b[A-Z]\/\d{2,5}\/\d{2,6}\b/g, 2, "bundle reference"],
      ["EXHIBIT_REF", /\b[RCDEF]-\d{1,4}\b/g, 2, "exhibit reference"],
      ["EXHIBIT_REF", /\b[CR]L-\d{1,4}\b/g, 2, "legal authority reference"],
      ["PROCEDURAL_REF", /(?<![A-Za-z0-9])PO\s+No(?:\\\.|\.)?\s*\d+(?!\d)/gi, 2, "procedural reference"],
      ["PROCEDURAL_REF", /(?<![A-Za-z0-9])Procedural\s+Order\s+No(?:\\\.|\.)?\s*\d+(?!\d)/gi, 2, "procedural order reference"],
      ["TRANSCRIPT_REF", /\bDay\s+\d+\s*,?\s*pp\.?\s*\d+(?:\s*-\s*\d+)?\b/g, 2, "transcript reference"],
      ["DATE", /\b\d{4}\.\d{2}\.\d{2}\b/g, 2, "numeric date"],
      ["DATE", /\b\d{1,2}\s*-\s*\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g, 2, "date range"],
      ["DATE", /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g, 2, "written date"],
      ["DATE", /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g, 2, "month-year date"],
      ["AMOUNT", /\b(?:US\\?\$|HK\\?\$|USD|HKD|RMB|EUR|Euro|Euros)\s?\d[\d,.]*(?:\s*(?:million|billion|m|bn|mm))?(?:\/[A-Za-z]+)?\b/gi, 2, "currency amount"],
      ["AMOUNT", /\b\d[\d,.]*\s?(?:US\\?\$|HK\\?\$|USD|HKD|RMB|EUR|Euro|Euros)(?:\/[A-Za-z]+)?\b/gi, 2, "suffix currency amount"],
      ["AMOUNT", /\b\d[\d,]*(?:\s+ordinary)?\s+shares\b/gi, 2, "share count"],
      ["AMOUNT", /^\s*\d{4,}\s*$/gm, 2, "standalone large number"],
      ["AMOUNT", /\b\d[\d,.]*\s?(?:million|billion)\b/g, 2, "large amount"],
      ["AMOUNT", /(?<![\w.])\d{1,3}(?:\.\d+)?%(?!\w)/g, 2, "percentage"],
      ["BRAND", /(?<![A-Za-z0-9])[A-Z][A-Z0-9-]{2,}(?=(?:-|\s+)(?:brand|branded|related|trademarks?|products?|INTERNATIONAL|International|GLOBAL|Global))/g, 2, "brand/product mark context"],
      ["CHANNEL", /\b(?:Current|Sales)\s+channel\s*[:=]\s*([A-Z][A-Za-z0-9._&' -]{2,60})/g, 2, "sales channel label"],
      ["NON_LATIN_TEXT", /[\u3400-\u9fff][\u3400-\u9fff·]{1,}/g, 2, "non-Latin duplicate text"],
    ];

    for (const [kind, regex, level, reason] of patterns) {
      for (const match of doc.text.matchAll(regex)) {
        this.add(match[1] ?? match[0], kind, level, reason, doc.name, match.index ?? 0);
      }
    }
  }

  private detectLabelValues(doc: RedactionInput): void {
    const labelPatterns: Array<[RegExp, CandidateKind, number, string]> = [
      [/^\s*Client\s*[:：]\s*(.+)$/i, "PERSON_OR_ORG", 1, "client label"],
      [/^\s*Prepared for\s*[:：]\s*(.+)$/i, "PERSON_OR_ORG", 1, "prepared-for label"],
      [/^\s*Address\s*[:：]\s*(.+)$/i, "ADDRESS", 1, "address label"],
      [/^\s*Attention\s*[:：]\s*(.+)$/i, "PERSON", 1, "attention list"],
      [/^\s*(?:Phone|Telephone|Tel\.?)\s*[:：]\s*(.+)$/i, "PHONE", 1, "phone label"],
      [/^\s*(?:Email|E-mail)\s*[:：]\s*(.+)$/i, "EMAIL", 1, "email label"],
      [/^\s*Account No\.?\s*[:：]\s*(.+)$/i, "CASE_REF", 1, "account label"],
      [/^\s*Matter No\.?\s*[:：]\s*(.+)$/i, "CASE_REF", 1, "matter label"],
      [/^\s*Ref\.?\s*[:：]\s*(.+)$/i, "CASE_REF", 1, "reference label"],
    ];

    for (const line of doc.text.split(/\r?\n/)) {
      const stripped = line.trim();
      if (!stripped) continue;
      const pos = doc.text.indexOf(line);
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
      const emails = value.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g);
      return emails ?? [value];
    }
    if (kind === "PERSON" || kind === "PERSON_OR_ORG") {
      return value.split(/\s*\/\s*|；|;|\s+and\s+/i).map(cleanValue).filter(Boolean);
    }
    return value.split(/\s*\/\s*|；|;/).map(cleanValue).filter(Boolean);
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
        if (this.addressContinuationStop(candidate) || !this.looksLikeAddressContinuation(candidate)) break;
        this.add(candidate, "ADDRESS", 1, "address continuation", doc.name, offsets[cursor]);
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
        this.add(visible, "ADDRESS", 1, "standalone address-looking line", doc.name, pos);
      }
    }
  }

  private addressContinuationStop(line: string): boolean {
    if (/^\s*(?:Email|E-mail|Phone|Telephone|Tel\.?|Attention|Ref\.?|Client|Prepared for)\s*[:：]/i.test(line)) return true;
    if (/^\s*\d+\.\s+/.test(line)) return true;
    const visible = visibleLineText(line);
    return visible === "HKIAC" || visible.startsWith("Legal Representatives for") || visible.startsWith("For the Tribunal");
  }

  private looksLikeAddressContinuation(line: string): boolean {
    const plain = visibleLineText(line);
    return /\b(?:Floor|Tower|Road|Street|Avenue|Central|Queensway|House|Centre|Center|Place|Chambers)\b/i.test(plain) || (/\d/.test(plain) && plain.includes(","));
  }

  private looksLikeStandaloneAddressLine(line: string): boolean {
    if (line.length > 100) return false;
    if (/^\d+\.\s+/.test(line)) return false;
    const hasAddressUnit = /\b(?:UNIT|ROOM|RM|SUITE|FLAT|FLOOR|BLDG|BUILDING|TOWER|BLOCK)\b|(?:\d+\/F|\/F\b)/i.test(line);
    const hasStreetTerm = /\b(?:ROAD|RD|STREET|ST|AVENUE|AVE|LANE|LN|DRIVE|DR|COMM|COMMERCIAL|CENTRAL|WAN CHAI|QUEENSWAY|KOWLOON)\b/i.test(line);
    return (hasAddressUnit && /[A-Z]/.test(line)) || (hasStreetTerm && /\d/.test(line));
  }

  private detectPeople(doc: RedactionInput): void {
    const titlePattern = /\b(?:Mr|Ms|Mrs|Miss|Dr|Professor|Prof)\.?\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3})\b/g;
    for (const match of doc.text.matchAll(titlePattern)) {
      const full = match[0].replace(/['’]s$/i, "");
      const captured = cleanValue(match[1]).replace(/['’]s$/i, "");
      this.add(full, "PERSON", 1, "title plus person name", doc.name, match.index ?? 0);
      if (captured.includes(" ")) this.add(captured, "PERSON", 1, "name after title", doc.name, (match.index ?? 0) + full.indexOf(match[1]));
    }

    const contextPatterns: Array<[RegExp, string]> = [
      [/\b(?:Witness Statement of|Expert Report of|Opinion in .* concerning|Independent Expert Report of)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})/g, "witness/expert heading"],
      [/\(([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\)/g, "parenthetical person"],
      [/\b(?:from|to|between|and|by)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})(?:\s+to|\s+and|\s*:|\s*,|\))/g, "communication context"],
      [/\b(?:as|called|named|identified as|translation as)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\b/g, "alternate name"],
      [/\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+(?:gave|gives|says|said|states|stated|testified|maintained|explained|accepted|denies|disputes|rejects|responds)\b/g, "full name before witness verb"],
      [/\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+(?:was|is|were|are|had been)\s+(?:involved|present|appointed|engaged|copied|responsible)\b/g, "full name before state verb"],
    ];

    for (const [regex, reason] of contextPatterns) {
      for (const match of doc.text.matchAll(regex)) {
        const name = cleanValue(match[1]);
        if (this.looksLikePersonName(name)) this.add(name, "PERSON", 2, reason, doc.name, (match.index ?? 0) + match[0].indexOf(match[1]));
      }
    }

    for (const match of doc.text.matchAll(/\bBetween\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+and\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})/g)) {
      for (const name of [match[1], match[2]]) {
        if (this.looksLikePersonName(name)) this.add(name, "PERSON", 2, "agreement party heading", doc.name, (match.index ?? 0) + match[0].indexOf(name));
      }
    }

    for (const match of doc.text.matchAll(/^[^\S\r\n]*([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})\s+and\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,3})[^\S\r\n]*$/gm)) {
      for (const name of [match[1], match[2]]) {
        if (this.looksLikePersonName(name)) this.add(name, "PERSON", 2, "standalone agreement party line", doc.name, (match.index ?? 0) + match[0].indexOf(name));
      }
    }

    for (const match of doc.text.matchAll(/\b([A-Z][A-Za-z'’-]+)\s+v\s+[A-Z][A-Za-z'’-]+\b/g)) {
      if (this.looksLikeSinglePersonToken(match[1])) this.add(match[1], "PERSON", 2, "case caption name", doc.name, match.index ?? 0);
    }

    for (const match of doc.text.matchAll(/>([A-Z][A-Z'’.-]+(?:\s+[A-Z][A-Z'’.-]+){1,3})</g)) {
      const titleCase = cleanValue(match[1]).toLocaleLowerCase().replace(/\b\w/g, (char) => char.toLocaleUpperCase());
      if (this.looksLikePersonName(titleCase)) this.add(match[1], "PERSON", 2, "all-caps table person", doc.name, match.index ?? 0);
    }

    for (const match of doc.text.matchAll(/^[^\S\r\n]*([A-Z][A-Z'’.-]+(?:[^\S\r\n]+[A-Z][A-Z'’.-]+){1,3})[^\S\r\n]*$/gm)) {
      const titleCase = cleanValue(match[1]).toLocaleLowerCase().replace(/\b\w/g, (char) => char.toLocaleUpperCase());
      if (this.looksLikePersonName(titleCase)) this.add(match[1], "PERSON", 2, "all-caps line person", doc.name, match.index ?? 0);
    }
  }

  private detectOrganizations(doc: RedactionInput): void {
    const suffixes = [
      "Limited",
      "LIMITED",
      "Ltd",
      "LTD",
      "LLC",
      "Inc",
      "INC",
      "Corporation",
      "CORPORATION",
      "Corp",
      "CORP",
      "Company",
      "COMPANY",
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
      "Law Offices",
      "Lovells",
      "Deloitte",
      "Colliers",
      "Savills",
      "Ogier",
    ].join("|");
    const orgPattern = new RegExp(`(?<![A-Za-z0-9])[A-Z][A-Za-z'&.(),-]+(?:\\s+[A-Z][A-Za-z'&.(),-]+){0,6}\\s+(?:${suffixes})(?![A-Za-z0-9])`, "g");
    for (const match of doc.text.matchAll(orgPattern)) {
      if (match[0].toLocaleLowerCase() !== "working group") this.add(match[0], "ORG", 2, "organization suffix", doc.name, match.index ?? 0);
    }

    const orgWithParentheticalPattern = new RegExp(
      `(?<![A-Za-z0-9])[A-Z][A-Z0-9'&.,-]+(?:\\s+[A-Z][A-Z0-9'&.,-]+){0,6}(?:\\s+\\\\?\\([A-Z][A-Z\\s&.,-]+\\\\?\\))\\s+(?:${suffixes})(?![A-Za-z0-9])`,
      "g",
    );
    for (const match of doc.text.matchAll(orgWithParentheticalPattern)) {
      this.add(match[0], "ORG", 2, "organization with parenthetical", doc.name, match.index ?? 0);
    }

    for (const match of doc.text.matchAll(/>([A-Z][A-Z0-9&.,'() -]{3,80}\b(?:LIMITED|LTD|GROUP|COMPANY|CORPORATION|CORP|BANK|PARTNERS|HOLDINGS))</g)) {
      this.add(match[1], "ORG", 2, "all-caps table organization", doc.name, match.index ?? 0);
    }

    for (const value of KNOWN_ORGS) {
      for (const match of doc.text.matchAll(new RegExp(`\\b${escapeRegExp(value)}\\b`, "gi"))) {
        this.add(match[0], "ORG", 2, "known organization", doc.name, match.index ?? 0);
      }
    }
  }

  private detectMatterTerms(doc: RedactionInput): void {
    for (const match of doc.text.matchAll(/\bProject\s+[A-Z][A-Za-z0-9_-]+\b/g)) {
      this.add(match[0], "PROJECT", 2, "project name", doc.name, match.index ?? 0);
    }
    for (const value of MATTER_TERMS) {
      for (const match of doc.text.matchAll(new RegExp(escapeRegExp(value), "gi"))) {
        this.add(match[0], "PROJECT_OR_ISSUE", 2, "matter glossary term", doc.name, match.index ?? 0);
      }
    }
  }

  private detectLocations(doc: RedactionInput): void {
    for (const value of LOCATION_TERMS) {
      for (const match of doc.text.matchAll(new RegExp(escapeRegExp(value), "gi"))) {
        this.add(match[0], "LOCATION", 2, "location dictionary", doc.name, match.index ?? 0);
      }
    }
  }

  private detectStrictProperNouns(doc: RedactionInput): void {
    const counts = new Map<string, number>();
    const firstPos = new Map<string, number>();
    for (const match of doc.text.matchAll(/\b[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){1,4}\b/g)) {
      const value = cleanValue(match[0]);
      if (PROPER_NOUN_STOP_TERMS.has(value) || /^(?:Is|Can|Whether|The|A|An)\s+/.test(value)) continue;
      if (this.hasStrongerCandidate(value)) continue;
      if (/(Statement|Report|Agreement|Examination|Evidence|Assets|Group|Road|Park|Hotel|University|Exchange)/.test(value) || this.looksLikePersonName(value)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
        if (!firstPos.has(value)) firstPos.set(value, match.index ?? 0);
      }
    }
    for (const [value, count] of counts) {
      if (count >= 2) this.add(value, "PROPER_NOUN", 3, "repeated capitalized phrase", doc.name, firstPos.get(value) ?? 0);
    }
  }

  private detectCustomTerms(doc: RedactionInput): void {
    for (const term of this.customTerms.map(cleanValue).filter(Boolean)) {
      for (const match of doc.text.matchAll(new RegExp(escapeRegExp(term), "gi"))) {
        this.add(match[0], "CUSTOM", 1, "user custom term", doc.name, match.index ?? 0);
      }
    }
  }

  private addPersonAliases(): void {
    const people = [...this.candidates.values()].filter((c) => c.kind === "PERSON");
    const fullNames = [
      ...new Set(
        people
          .map((c) => c.value.replace(/^(?:Mr|Ms|Mrs|Miss|Dr|Professor|Prof)\.?\s+/i, "").replace(/['’]s$/i, ""))
          .filter((value) => /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+$/.test(value)),
      ),
    ];

    const sourcesByName = new Map(fullNames.map((name) => [name, people.find((p) => p.value.includes(name.split(" ")[0])) ?? people[0]]));
    const surnames = new Set(fullNames.map((name) => name.split(/\s+/).at(-1) ?? ""));
    const givenNames = new Map<string, string[]>();
    for (const name of fullNames) {
      const given = name.split(/\s+/)[0];
      givenNames.set(given, [...(givenNames.get(given) ?? []), name]);
    }

    for (const doc of this.docs) {
      for (const surname of surnames) {
        if (!surname || AMBIGUOUS_PERSON_TOKENS.has(surname)) continue;
        if (surname.length <= 2 && !["Li", "Xu", "Mu"].includes(surname)) continue;
        const source = sourcesByName.get(fullNames.find((name) => name.endsWith(surname)) ?? fullNames[0]);
        if (!source) continue;
        const titleRe = new RegExp(`\\b(?:Mr|Ms|Mrs|Miss|Dr|Professor|Prof)\\.?\\s+${escapeRegExp(surname)}\\b`, "g");
        for (const match of doc.text.matchAll(titleRe)) this.add(match[0], "PERSON", source.minLevel, "title plus surname alias", doc.name, match.index ?? 0);
        const verbRe = new RegExp(`\\b${escapeRegExp(surname)}(?:'s|’s)?\\s+(?:(?:also|further)\\s+)?(?:says|said|states|stated|denies|accepts|accepted|explains|explained|adds|maintained|described|disputes|testified|gave|rejects|responds|recalls|argues|contends)\\b`, "g");
        for (const match of doc.text.matchAll(verbRe)) this.add(match[0].split(/\s+/)[0], "PERSON", source.minLevel, "bare surname in witness sentence", doc.name, match.index ?? 0);
      }

      for (const [given, names] of givenNames) {
        const allowedShortGiven = ["Li", "Xu", "Mu"].includes(given);
        if (names.length !== 1 || (!this.looksLikeSinglePersonToken(given) && !allowedShortGiven)) continue;
        const source = sourcesByName.get(names[0]);
        if (!source) continue;
        const commRe = new RegExp(`\\b(?:to|from|with|by|copying|copied to|sent to|emailed to|not copied to)\\s+${escapeRegExp(given)}(?![A-Za-z0-9])`, "g");
        for (const match of doc.text.matchAll(commRe)) this.add(given, "PERSON", source.minLevel, "given alias in communication context", doc.name, match.index ?? 0);
        const responseRe = new RegExp(`\\b${escapeRegExp(given)}(?:'s|’s)\\s+Response(?![A-Za-z0-9])`, "g");
        for (const match of doc.text.matchAll(responseRe)) this.add(match[0].split(/['’]/)[0], "PERSON", source.minLevel, "given alias in response heading", doc.name, match.index ?? 0);
        const verbRe = new RegExp(`\\b${escapeRegExp(given)}(?:'s|’s)?\\s+(?:says|said|states|stated|denies|accepts|accepted|explains|explained|adds|maintained|described|disputes|testified|gave|rejects|responds|recalls|argues|contends)(?![A-Za-z0-9])`, "g");
        for (const match of doc.text.matchAll(verbRe)) this.add(match[0].split(/\s+/)[0], "PERSON", source.minLevel, "given alias before witness verb", doc.name, match.index ?? 0);
      }
    }
  }

  private finalizeCandidates(): void {
    for (const [key, candidate] of [...this.candidates.entries()]) {
      if (candidate.kind === "PROPER_NOUN" && this.hasStrongerCandidate(candidate.value)) this.candidates.delete(key);
      if (candidate.kind === "PERSON" && this.hasStrongerNonPersonCandidate(candidate.value)) this.candidates.delete(key);
      if (candidate.kind === "PERSON" && looksOrgishOrProjectish(candidate.value)) this.candidates.delete(key);
    }
  }

  private looksLikeSinglePersonToken(name: string): boolean {
    return /^[A-Z][A-Za-z'’-]{2,20}$/.test(name) && !name.toLocaleUpperCase().startsWith(name) && !SINGLE_PERSON_STOPWORDS.has(name);
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
    if (tokens.some((token) => token.length > 1 && token === token.toLocaleUpperCase())) return false;
    if (tokens.some((token) => SINGLE_PERSON_STOPWORDS.has(token))) return false;
    return true;
  }

  private hasStrongerCandidate(value: string): boolean {
    const normalized = normalizeForDedupe(value);
    return [...this.candidates.values()].some((candidate) => candidate.kind !== "PROPER_NOUN" && normalizeForDedupe(candidate.value) === normalized);
  }

  private hasStrongerNonPersonCandidate(value: string): boolean {
    const normalized = normalizeForDedupe(value);
    return [...this.candidates.values()].some((candidate) => !["PERSON", "PROPER_NOUN"].includes(candidate.kind) && normalizeForDedupe(candidate.value) === normalized);
  }
}

function canonicalPersonKeys(candidates: Candidate[]): Map<string, string> {
  const people = candidates.filter((c) => c.kind === "PERSON");
  const fullNames = [
    ...new Set(
      people
        .map((c) => c.value.replace(/^(?:Mr|Ms|Mrs|Miss|Dr|Professor|Prof)\.?\s+/i, "").replace(/['’]s$/i, ""))
        .filter((value) => /^[A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+)+$/.test(value)),
    ),
  ];

  const surnameToFull = new Map<string, string[]>();
  for (const name of fullNames) {
    const surname = name.split(/\s+/).at(-1) ?? "";
    surnameToFull.set(surname, [...(surnameToFull.get(surname) ?? []), name]);
  }

  const canonical = new Map<string, string>();
  for (const candidate of people) {
    const stripped = candidate.value.replace(/^(?:Mr|Ms|Mrs|Miss|Dr|Professor|Prof)\.?\s+/i, "").replace(/['’]s$/i, "");
    if (fullNames.includes(stripped)) {
      canonical.set(`PERSON\u0000${candidate.value}`, `PERSON\u0000${stripped}`);
      continue;
    }
    if (/^[A-Z][A-Za-z'’-]+$/.test(stripped)) {
      const matches = surnameToFull.get(stripped) ?? [];
      if (new Set(matches).size === 1) canonical.set(`PERSON\u0000${candidate.value}`, `PERSON\u0000${matches[0]}`);
    }
  }
  return canonical;
}

function tokenMap(candidates: Candidate[]): Map<string, string> {
  const canonical = canonicalPersonKeys(candidates);
  const counters = new Map<CandidateKind, number>();
  const mapping = new Map<string, string>();

  for (const candidate of [...candidates].sort((a, b) => a.firstPos - b.firstPos || a.kind.localeCompare(b.kind))) {
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
      if (cells && cells.slice(0, 4).map((c) => c.replace(/[*_`]/g, "").trim().toLocaleLowerCase()).join("|") === "date|bundle ref|exhibit number|description") {
        inChronology = true;
        return line;
      }
      if (inChronology && cells && cells.every((c) => /^:?-{2,}:?$/.test(c))) return line;
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
  const cells = trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
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
    while (index + 1 < lines.length && !/^\d+\.\s+[A-Z][A-Z ()/&-]+$/.test(visibleLineText(lines[index + 1]))) index += 1;
  }
  return output.join("\n");
}

function visibleLineText(line: string): string {
  return cleanValue(line.replace(/<[^>]+>/g, "").replace(/[*_`]/g, ""));
}

function startsLegalContactSection(line: string): boolean {
  const visible = visibleLineText(line);
  return visible === "For the Tribunal" || visible === "HKIAC" || visible.startsWith("Legal Representatives for");
}

function sanitizeText(text: string, candidates: Candidate[], mapping: Map<string, string>, level: number): string {
  const applicable = candidates.filter((candidate) => candidate.minLevel <= level).sort((a, b) => {
    const aIsNonLatin = a.kind === "NON_LATIN_TEXT" ? 1 : 0;
    const bIsNonLatin = b.kind === "NON_LATIN_TEXT" ? 1 : 0;
    return aIsNonLatin - bIsNonLatin || b.value.length - a.value.length;
  });
  let result = quarantineLegalContactSections(applyChronologyPolicy(stripWordAnchors(text), level), level);
  for (const candidate of applicable) {
    const key = `${candidate.kind}\u0000${candidate.value}`;
    let token = mapping.get(key) ?? candidate.kind;
    if (/['’]s$/i.test(candidate.value)) token += "'s";
    result = result.replace(patternForValue(candidate.value), token);
  }
  return result;
}

export function redactDocuments(inputs: RedactionInput[], options: RedactionOptions): RedactionResult {
  const detector = new Detector(inputs, options.customTerms ?? []);
  const candidates = detector.detect();
  const mapping = tokenMap(candidates);
  const level = LEVELS[options.level];

  const documents = inputs.map((doc, index) => ({
    name: `Document ${String(index + 1).padStart(3, "0")}`,
    originalLength: doc.text.length,
    sanitized: sanitizeText(doc.text, candidates, mapping, level),
  }));

  const combinedMarkdown = [
    "# Sanitized Document Pack",
    "",
    ...documents.flatMap((doc) => [`## Document: ${doc.name}`, "", doc.sanitized.trim(), ""]),
  ].join("\n").trimEnd() + "\n";

  const serializable: SerializableCandidate[] = candidates.map((candidate) => ({
    value: candidate.value,
    replacement: mapping.get(`${candidate.kind}\u0000${candidate.value}`) ?? candidate.kind,
    kind: candidate.kind,
    level: levelName(candidate.minLevel),
    reason: candidate.reason,
    sources: [...candidate.sources].sort(),
  }));

  const counts: Record<string, number> = {};
  for (const candidate of candidates.filter((candidate) => candidate.minLevel <= level)) {
    counts[candidate.kind] = (counts[candidate.kind] ?? 0) + 1;
  }

  return { documents, combinedMarkdown, candidates: serializable, counts };
}
