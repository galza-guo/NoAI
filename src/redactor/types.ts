export type RedactionLevel = "light" | "balanced" | "strict";

export const LEVELS: Record<RedactionLevel, number> = {
  light: 1,
  balanced: 2,
  strict: 3,
};

export type CandidateKind =
  | "EMAIL"
  | "PHONE"
  | "URL"
  | "INTERNAL_LINK"
  | "ADDRESS"
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
