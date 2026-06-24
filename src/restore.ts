import type {
  CandidateKind,
  RedactionLevel,
  ReplacementEntry,
} from "./redactor/types";

export const RESTORE_KEY_KIND = "noai.restore-key";
export const RESTORE_KEY_VERSION = 1;

export interface RestoreEntry {
  replacement: string;
  value: string;
  kind: CandidateKind;
  reason: string;
  sources: string[];
  safe: boolean;
  ambiguous: boolean;
}

export interface RestoreKey {
  kind: typeof RESTORE_KEY_KIND;
  version: typeof RESTORE_KEY_VERSION;
  appVersion: string;
  engineVersion: string;
  createdAt: string;
  level: RedactionLevel;
  entries: RestoreEntry[];
}

export interface RestoreMatch {
  token: string;
  count: number;
  status: "restorable" | "unknown" | "unsafe" | "ambiguous";
  entry?: RestoreEntry;
}

export interface RestoreOutput {
  id: string;
  title: string;
  redactedInput: string;
  restoredDraft: string;
  createdAt: string;
  updatedAt: string;
}

export function isSafeRestoreToken(value: string): boolean {
  return /^[A-Z][A-Z0-9]*_(?:0{2}[1-9]|0[1-9]\d|[1-9]\d{2,})$/.test(
    value,
  );
}
