import { describe, expect, it } from "vitest";
import {
  exitCodeForVerdict,
  gateReports,
  renderGateMarkdown,
} from "./gate-dev-round.mjs";

function labelBucket(total, covered) {
  return { total, covered, partial: 0, missed: total - covered, recall: total ? covered / total : 0 };
}

function report({
  suiteId = "NAIR-test",
  level = "balanced",
  coverageThreshold = 0.8,
  suiteFingerprint = "suite-fingerprint",
  engineVersionLabel = "engine test",
  spansTotal = 100,
  spansCovered = 70,
  keepViolated = 3,
  precision = 0.55,
  byLabel = { PERSON: labelBucket(40, 30), ORG: labelBucket(30, 20) },
  bySeverity = { critical: labelBucket(10, 9), high: labelBucket(30, 20), medium: labelBucket(60, 41) },
  documents = [
    {
      docId: "doc-001",
      category: "contract",
      score: { redact: { spans: { total: 60, covered: 45 } } },
    },
    {
      docId: "doc-002",
      category: "litigation",
      score: { redact: { spans: { total: 40, covered: 25 } } },
    },
  ],
} = {}) {
  return {
    suiteId,
    level,
    coverageThreshold,
    suiteFingerprint,
    engineVersionLabel,
    summary: {
      redact: {
        spans: {
          total: spansTotal,
          covered: spansCovered,
          recall: spansTotal ? spansCovered / spansTotal : 0,
        },
        chars: { total: 1000, covered: 700, recall: 0.7 },
      },
      keep: {
        spans: { total: 50, violated: keepViolated, clean: 50 - keepViolated, cleanRate: (50 - keepViolated) / 50 },
      },
      predicted: {
        spans: { total: 120, unsupported: 30 },
        chars: { precision },
      },
      byLabel,
      bySeverity,
    },
    documents,
  };
}

describe("gateReports", () => {
  it("passes when the candidate matches or improves the baseline", () => {
    const baseline = report();
    const candidate = report({
      spansCovered: 72,
      byLabel: { PERSON: labelBucket(40, 32), ORG: labelBucket(30, 20) },
      bySeverity: { critical: labelBucket(10, 9), high: labelBucket(30, 21), medium: labelBucket(60, 42) },
      documents: [
        { docId: "doc-001", category: "contract", score: { redact: { spans: { total: 60, covered: 47 } } } },
        { docId: "doc-002", category: "litigation", score: { redact: { spans: { total: 40, covered: 25 } } } },
      ],
    });
    const result = gateReports(baseline, candidate);
    expect(result.verdict).toBe("PASS");
    expect(result.failures).toEqual([]);
  });

  it("fails on an overall covered-span drop", () => {
    const result = gateReports(report(), report({ spansCovered: 69 }));
    expect(result.verdict).toBe("FAIL");
    expect(result.failures.join("\n")).toContain("Overall covered redact spans");
  });

  it("fails on a hidden per-label regression even when overall recall holds", () => {
    // The r32 scenario: ORG loses spans while PERSON gains, overall flat.
    const candidate = report({
      spansCovered: 70,
      byLabel: { PERSON: labelBucket(40, 33), ORG: labelBucket(30, 17) },
    });
    const result = gateReports(report(), candidate);
    expect(result.verdict).toBe("FAIL");
    expect(result.failures.join("\n")).toContain("Label ORG lost 3 covered spans");
  });

  it("fails by default on a single-span label loss", () => {
    const candidate = report({
      spansCovered: 70,
      byLabel: { PERSON: labelBucket(40, 31), ORG: labelBucket(30, 19) },
    });
    const result = gateReports(report(), candidate);
    expect(result.verdict).toBe("FAIL");
    expect(result.failures.join("\n")).toContain("Label ORG lost 1 covered span");
  });

  it("fails on any critical/high severity covered loss", () => {
    const candidate = report({
      bySeverity: { critical: labelBucket(10, 8), high: labelBucket(30, 20), medium: labelBucket(60, 42) },
    });
    const result = gateReports(report(), candidate);
    expect(result.verdict).toBe("FAIL");
    expect(result.failures.join("\n")).toContain("Severity critical lost 1 covered spans");
  });

  it("fails on new keep-span violations", () => {
    const result = gateReports(report(), report({ keepViolated: 4 }));
    expect(result.verdict).toBe("FAIL");
    expect(result.failures.join("\n")).toContain("Keep-span violations increased");
  });

  it("fails on a document-category loss above the threshold", () => {
    const candidate = report({
      documents: [
        { docId: "doc-001", category: "contract", score: { redact: { spans: { total: 60, covered: 42 } } } },
        { docId: "doc-002", category: "litigation", score: { redact: { spans: { total: 40, covered: 28 } } } },
      ],
    });
    const result = gateReports(report(), candidate);
    expect(result.verdict).toBe("FAIL");
    expect(result.failures.join("\n")).toContain("Category contract lost 3 covered spans");
  });

  it("fails by default on any precision drop", () => {
    const failing = gateReports(report(), report({ precision: 0.5 }));
    expect(failing.verdict).toBe("FAIL");
    expect(failing.failures.join("\n")).toContain("precision proxy dropped");

    const smallDrop = gateReports(report(), report({ precision: 0.54 }));
    expect(smallDrop.verdict).toBe("FAIL");
    expect(smallDrop.failures.join("\n")).toContain("precision proxy dropped");
  });

  it("rejects mismatched suite or level", () => {
    expect(() => gateReports(report(), report({ level: "heavy" }))).toThrow(
      /disagree on level/,
    );
  });

  it("rejects reports when the benchmark target changed", () => {
    expect(() =>
      gateReports(report(), report({ spansTotal: 99, spansCovered: 70 })),
    ).toThrow(/gold redact span total/i);
  });

  it("rejects different suite fingerprints", () => {
    expect(() =>
      gateReports(report(), report({ suiteFingerprint: "different-suite" })),
    ).toThrow(/suite fingerprint/i);
  });

  it("rejects invalid gate tolerances instead of failing open", () => {
    expect(() =>
      gateReports(report(), report({ spansCovered: 0 }), {
        maxOverallSpanLoss: Number.NaN,
      }),
    ).toThrow(/maxOverallSpanLoss/);
    expect(() =>
      gateReports(report(), report(), { maxLabelSpanLoss: -1 }),
    ).toThrow(/maxLabelSpanLoss/);
  });

  it("labels tolerated regressions as PASS WITH WARNINGS", () => {
    const candidate = report({
      spansCovered: 70,
      byLabel: { PERSON: labelBucket(40, 31), ORG: labelBucket(30, 19) },
    });
    const result = gateReports(report(), candidate, { maxLabelSpanLoss: 1 });
    expect(result.verdict).toBe("PASS WITH WARNINGS");
    expect(result.warnings.join("\n")).toContain("Label ORG lost 1 covered span");
    expect(exitCodeForVerdict(result.verdict)).toBe(3);
  });

  it("renders a markdown report with verdict and reasons", () => {
    const result = gateReports(report(), report({ spansCovered: 69 }));
    const markdown = renderGateMarkdown(result);
    expect(markdown).toContain("# Dev-Round Gate: FAIL");
    expect(markdown).toContain("## Failures");
  });
});
