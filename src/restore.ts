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
  count: number;
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
  occurrences: RestoreOccurrence[];
  createdAt: string;
  updatedAt: string;
}

export interface RestoreOccurrence {
  id: string;
  token: string;
  value: string;
  kind: CandidateKind;
  start: number;
  end: number;
  state: "restored" | "redacted";
}

export interface RestoredTextOccurrence {
  token: string;
  value: string;
  kind: CandidateKind;
  start: number;
  end: number;
}

export interface RestoredTextResult {
  text: string;
  occurrences: RestoredTextOccurrence[];
}

export interface BuildRestoreKeyOptions {
  appVersion: string;
  engineVersion: string;
  level: RedactionLevel;
  entries: ReplacementEntry[];
  now?: () => Date;
}

const TOKEN_RE = /\b[A-Z][A-Z0-9]*_\d{3,}\b/g;

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
        count: entry.count,
        safe: isSafeRestoreToken(entry.replacement),
        ambiguous: (counts.get(entry.replacement) ?? 0) > 1,
      })),
  };
}

function entryStatus(entry: RestoreEntry | undefined): RestoreMatch["status"] {
  if (!entry) return "unknown";
  if (entry.ambiguous) return "ambiguous";
  if (!entry.safe) return "unsafe";
  return "restorable";
}

function entryByReplacement(key: RestoreKey): Map<string, RestoreEntry> {
  const map = new Map<string, RestoreEntry>();
  for (const entry of key.entries) {
    map.set(entry.replacement, entry);
  }
  return map;
}

export function restorePastedTextWithOccurrences(
  text: string,
  key: RestoreKey | null,
): RestoredTextResult {
  if (!key) return { text, occurrences: [] };
  const entries = entryByReplacement(key);
  const occurrences: RestoredTextOccurrence[] = [];
  let restored = "";
  let sourceIndex = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const token = match[0];
    const matchIndex = match.index;
    restored += text.slice(sourceIndex, matchIndex);
    const entry = entries.get(token);
    if (entry && entry.safe && !entry.ambiguous) {
      const start = restored.length;
      restored += entry.value;
      occurrences.push({
        token,
        value: entry.value,
        kind: entry.kind,
        start,
        end: restored.length,
      });
    } else {
      restored += token;
    }
    sourceIndex = matchIndex + token.length;
  }

  restored += text.slice(sourceIndex);
  return { text: restored, occurrences };
}

export function restorePastedText(text: string, key: RestoreKey | null): string {
  return restorePastedTextWithOccurrences(text, key).text;
}

export function scanRestoreMatches(
  text: string,
  key: RestoreKey | null,
): RestoreMatch[] {
  const counts = new Map<string, number>();
  for (const match of text.matchAll(TOKEN_RE)) {
    counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  }
  const entries = key ? entryByReplacement(key) : new Map<string, RestoreEntry>();
  return [...counts.entries()]
    .map(([token, count]) => {
      const entry = entries.get(token);
      return { token, count, status: entryStatus(entry), entry };
    })
    .sort((a, b) => a.token.localeCompare(b.token));
}

export function parseRestoreKey(source: string): RestoreKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("This Restore file is not valid JSON.");
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as RestoreKey).kind !== RESTORE_KEY_KIND ||
    (parsed as RestoreKey).version !== RESTORE_KEY_VERSION ||
    !Array.isArray((parsed as RestoreKey).entries)
  ) {
    throw new Error("This is not a NoAI Restore file.");
  }

  const key = parsed as RestoreKey;
  for (const item of key.entries) {
    if (
      typeof item.replacement !== "string" ||
      typeof item.value !== "string" ||
      typeof item.kind !== "string" ||
      typeof item.reason !== "string" ||
      !Array.isArray(item.sources) ||
      (item.count !== undefined && typeof item.count !== "number") ||
      typeof item.safe !== "boolean" ||
      typeof item.ambiguous !== "boolean"
    ) {
      throw new Error("This is not a NoAI Restore file.");
    }
    item.count ??= 1;
  }

  return key;
}
