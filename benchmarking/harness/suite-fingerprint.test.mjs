import { describe, expect, it } from "vitest";
import { createSuiteFingerprint } from "./suite-fingerprint.mjs";

function target() {
  return {
    suiteId: "NAIR-test",
    documents: [
      {
        docId: "doc-002",
        sourceTextSha256: "source-b",
        category: "contract",
        annotations: [
          {
            action: "redact",
            label: "ORG",
            severity: "high",
            start: 10,
            end: 20,
            text: "Example Co",
          },
        ],
      },
      {
        docId: "doc-001",
        sourceTextSha256: "source-a",
        category: "letter",
        annotations: [
          {
            action: "keep",
            label: "MUST_KEEP",
            severity: "none",
            start: 0,
            end: 4,
            text: "Dear",
          },
        ],
      },
    ],
  };
}

describe("createSuiteFingerprint", () => {
  it("is order-independent but changes when the scoring target changes", () => {
    const original = target();
    const reordered = target();
    reordered.documents.reverse();
    const changed = target();
    changed.documents[0].annotations[0].end = 19;

    expect(createSuiteFingerprint(reordered)).toBe(
      createSuiteFingerprint(original),
    );
    expect(createSuiteFingerprint(changed)).not.toBe(
      createSuiteFingerprint(original),
    );
  });
});
