export type RedactionLevel = "light" | "balanced" | "heavy";

export const LEVELS: Record<RedactionLevel, number> = {
  light: 1,
  balanced: 2,
  heavy: 3,
};

export type CandidateKind =
  | "EMAIL"
  | "PHONE"
  | "URL"
  | "INTERNAL_LINK"
  | "ADDRESS"
  | "POSTCODE"
  | "NATIONAL_ID"
  | "BANK_ACCOUNT"
  | "BUSINESS_ID"
  | "CASE_REF"
  | "BUNDLE_REF"
  | "EXHIBIT_REF"
  | "TRANSCRIPT_REF"
  | "PROCEDURAL_REF"
  | "DATE"
  | "AMOUNT"
  | "LOCATION"
  | "BRAND"
  | "CHANNEL"
  | "NON_LATIN_TEXT"
  | "PERSON"
  | "PERSON_OR_ORG"
  | "ORG"
  | "PROJECT"
  | "PROJECT_OR_ISSUE"
  | "DOCUMENT"
  | "PROPER_NOUN"
  | "CUSTOM";

export interface Candidate {
  value: string;
  kind: CandidateKind;
  minLevel: number;
  reason: string;
  firstPos: number;
  sources: Set<string>;
}

export interface SerializableCandidate {
  value: string;
  replacement: string;
  kind: CandidateKind;
  level: RedactionLevel;
  reason: string;
  sources: string[];
}

export interface RedactionInput {
  name: string;
  text: string;
}

export interface RedactionOptions {
  level: RedactionLevel;
  customTerms?: string[];
  /** Optional caller-supplied organization names. Empty by default. */
  knownOrganizations?: string[];
  /** Optional caller-supplied matter/project terms. Empty by default. */
  matterTerms?: string[];
  /** Optional caller-supplied location terms, added to generic city coverage. */
  locations?: string[];
  /** Optional user-edited or manually added replacement entries. */
  entries?: ReplacementEntry[];
  /** Entry ids the user deleted from the current review session. */
  removedEntryIds?: string[];
}

/** A document loaded into the review session, kept in memory only. */
export interface RedactionDocument {
  id: string;
  name: string;
  originalName?: string;
  originalLength: number;
  text: string;
}

/** A single redactable term with its replacement metadata. */
export interface ReplacementEntry {
  /** Stable id derived from kind + value so edits survive re-detection. */
  id: string;
  /** Original surface text to match. */
  value: string;
  /** Replacement token or label, editable by the user. */
  replacement: string;
  kind: CandidateKind;
  level: RedactionLevel;
  reason: string;
  /** Document names where this value was detected, or `["manual"]`. */
  sources: string[];
  /** Occurrence count across all input documents for the selected level. */
  count: number;
  /** True for user-added entries; manual entries win over automatic ones. */
  manual: boolean;
  /** Case-insensitive matching is used when false (manual entries default). */
  matchCase: boolean;
}

/** One slice of a document preview: plain text or a redacted span. */
export interface PreviewSegment {
  text: string;
  entryId?: string;
  value?: string;
  replacement?: string;
  kind?: CandidateKind;
}

/** A document with sanitized export text and ordered preview segments. */
export interface ReviewDocument {
  id: string;
  name: string;
  originalLength: number;
  sanitized: string;
  segments: PreviewSegment[];
}

/** Review model returned by the logic layer. */
export interface ReviewModel {
  engineVersion: string;
  engineVersionLabel: string;
  engineVersionInfo: {
    engine: string;
    label: string;
    rulesets: {
      general: number;
      chinese: number;
    };
  };
  documents: ReviewDocument[];
  combinedMarkdown: string;
  entries: ReplacementEntry[];
  counts: Record<string, number>;
}

export interface RedactionResult {
  documents: Array<{
    name: string;
    originalLength: number;
    sanitized: string;
  }>;
  combinedMarkdown: string;
  candidates: SerializableCandidate[];
  counts: Record<string, number>;
}
