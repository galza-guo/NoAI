import { describe, expect, it } from "vitest";
import type { ReplacementEntry } from "./redactor/types";
import {
  buildRestoreKey,
  isSafeRestoreToken,
  parseRestoreKey,
  restorePastedText,
  scanRestoreMatches,
} from "./restore";

function entry(overrides: Partial<ReplacementEntry>): ReplacementEntry {
  return {
    id: "PERSON:Jane%20Smith",
    value: "Jane Smith",
    replacement: "PERSON_001",
    kind: "PERSON",
    level: "balanced",
    reason: "titled person",
    sources: ["sample.md"],
    count: 2,
    manual: false,
    matchCase: true,
    ...overrides,
  };
}

describe("restore token safety", () => {
  it("accepts machine-style tokens", () => {
    expect(isSafeRestoreToken("PERSON_001")).toBe(true);
    expect(isSafeRestoreToken("ORG_002")).toBe(true);
    expect(isSafeRestoreToken("CUSTOM_123")).toBe(true);
  });

  it("rejects human-friendly labels", () => {
    expect(isSafeRestoreToken("Client")).toBe(false);
    expect(isSafeRestoreToken("Company")).toBe(false);
    expect(isSafeRestoreToken("A")).toBe(false);
    expect(isSafeRestoreToken("Supplier")).toBe(false);
  });
});

describe("private restore keys", () => {
  it("builds a restore key from countable entries", () => {
    const key = buildRestoreKey({
      appVersion: "0.0.0",
      engineVersion: "test-engine",
      level: "balanced",
      entries: [entry({})],
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    });

    expect(key.entries).toEqual([
      expect.objectContaining({
        replacement: "PERSON_001",
        value: "Jane Smith",
        safe: true,
        ambiguous: false,
      }),
    ]);
  });

  it("marks duplicate replacement labels as ambiguous", () => {
    const key = buildRestoreKey({
      appVersion: "0.0.0",
      engineVersion: "test-engine",
      level: "balanced",
      entries: [
        entry({ value: "Jane Smith", replacement: "PERSON_001" }),
        entry({
          id: "PERSON:John%20Smith",
          value: "John Smith",
          replacement: "PERSON_001",
        }),
      ],
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    });

    expect(key.entries.every((item) => item.ambiguous)).toBe(true);
  });

  it("keeps unsafe labels in the key but does not mark them safe", () => {
    const key = buildRestoreKey({
      appVersion: "0.0.0",
      engineVersion: "test-engine",
      level: "balanced",
      entries: [entry({ replacement: "Client" })],
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    });

    expect(key.entries[0]).toMatchObject({
      replacement: "Client",
      safe: false,
    });
  });
});

describe("restore text replacement", () => {
  it("restores safe known tokens in pasted text", () => {
    const key = buildRestoreKey({
      appVersion: "0.0.0",
      engineVersion: "test-engine",
      level: "balanced",
      entries: [entry({})],
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    });

    expect(restorePastedText("PERSON_001 signed.", key)).toBe(
      "Jane Smith signed.",
    );
  });

  it("leaves unknown, unsafe, and ambiguous labels unchanged", () => {
    const key = buildRestoreKey({
      appVersion: "0.0.0",
      engineVersion: "test-engine",
      level: "balanced",
      entries: [
        entry({ replacement: "Client" }),
        entry({ value: "Jane Smith", replacement: "PERSON_001" }),
        entry({
          id: "PERSON:John%20Smith",
          value: "John Smith",
          replacement: "PERSON_001",
        }),
      ],
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    });

    expect(restorePastedText("Client PERSON_001 PERSON_999", key)).toBe(
      "Client PERSON_001 PERSON_999",
    );
  });

  it("scans draft text for restorable and unknown tokens", () => {
    const key = buildRestoreKey({
      appVersion: "0.0.0",
      engineVersion: "test-engine",
      level: "balanced",
      entries: [entry({})],
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    });

    expect(scanRestoreMatches("PERSON_001 PERSON_001 ORG_999", key)).toEqual([
      expect.objectContaining({
        token: "ORG_999",
        count: 1,
        status: "unknown",
      }),
      expect.objectContaining({
        token: "PERSON_001",
        count: 2,
        status: "restorable",
      }),
    ]);
  });
});

describe("private restore key import", () => {
  it("parses a valid restore key JSON file", () => {
    const key = buildRestoreKey({
      appVersion: "0.0.0",
      engineVersion: "test-engine",
      level: "balanced",
      entries: [entry({})],
      now: () => new Date("2026-06-24T00:00:00.000Z"),
    });

    expect(parseRestoreKey(JSON.stringify(key))).toEqual(key);
  });

  it("rejects invalid restore key JSON", () => {
    expect(() => parseRestoreKey("{}")).toThrow(
      "not a NoAI private restore key",
    );
    expect(() => parseRestoreKey("{")).toThrow("not valid JSON");
  });
});
