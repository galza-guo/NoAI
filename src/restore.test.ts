import { describe, expect, it } from "vitest";
import type { ReplacementEntry } from "./redactor/types";
import { buildRestoreKey, isSafeRestoreToken } from "./restore";

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
