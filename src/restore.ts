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

export interface BuildRestoreKeyOptions {
  appVersion: string;
  engineVersion: string;
  level: RedactionLevel;
  entries: ReplacementEntry[];
  now?: () => Date;
}

export function isSafeRestoreToken(value: string): boolean {
  return /^[A-Z][A-Z0-9]*_(?:0{2}[1-9]|0[1-9]\d|[1-9]\d{2,})$/.test(
    value,
  );
}

export function buildRestoreKey(options: BuildRestoreKeyOptions): RestoreKey {
  const counts = new Map<string, number>();
  for (const entry of options.entries) {
    if (entry.count <= 0) continue;
    counts.set(entry.replacement, (counts.get(entry.replacement) ?? 0) + 1);
  }

  return {
    kind: RESTORE_KEY_KIND,
    version: RESTORE_KEY_VERSION,
    appVersion: options.appVersion,
    engineVersion: options.engineVersion,
    createdAt: (options.now ?? (() => new Date()))().toISOString(),
    level: options.level,
    entries: options.entries
      .filter((entry) => entry.count > 0)
      .map((entry) => ({
        replacement: entry.replacement,
        value: entry.value,
        kind: entry.kind,
        reason: entry.reason,
        sources: entry.sources,
        safe: isSafeRestoreToken(entry.replacement),
        ambiguous: (counts.get(entry.replacement) ?? 0) > 1,
      })),
  };
}
