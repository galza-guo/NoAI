import { describe, expect, it } from "vitest";
import {
  extractPredictedSpans,
  scoreDocument,
  summarizeSuiteScores,
} from "./score-utils.mjs";

describe("benchmark score utilities", () => {
  it("extracts predicted spans from review segments using original segment lengths", () => {
    const spans = extractPredictedSpans([
      { text: "Hello " },
      {
        text: "PERSON_001",
        value: "Jane Smith",
        replacement: "PERSON_001",
        kind: "PERSON",
      },
      { text: " paid " },
      {
        text: "AMOUNT_001",
        value: "$1,000",
        replacement: "AMOUNT_001",
        kind: "AMOUNT",
      },
    ]);

    expect(spans).toEqual([
      { start: 6, end: 16, kind: "PERSON", text: "Jane Smith" },
      { start: 22, end: 28, kind: "AMOUNT", text: "$1,000" },
    ]);
  });

  it("scores redaction recall, precision, and keep-span violations", () => {
    const gold = [
      {
        id: "gold-0001",
        action: "redact",
        label: "PERSON",
        severity: "high",
        start: 10,
        end: 20,
        text: "Jane Smith",
      },
      {
        id: "gold-0002",
        action: "redact",
        label: "AMOUNT",
        severity: "medium",
        start: 30,
        end: 40,
        text: "$1,000.00",
      },
      {
        id: "gold-0003",
        action: "keep",
        label: "MUST_KEEP",
        severity: "none",
        start: 50,
        end: 60,
        text: "Section 1.",
      },
    ];
    const predicted = [
      { start: 8, end: 20, kind: "PERSON", text: "Ms Jane Smith" },
      { start: 30, end: 35, kind: "AMOUNT", text: "$1,00" },
      { start: 55, end: 58, kind: "PERSON", text: "ion" },
    ];

    const score = scoreDocument("sample", gold, predicted);

    expect(score.redact.spans.total).toBe(2);
    expect(score.redact.spans.covered).toBe(1);
    expect(score.redact.spans.partial).toBe(1);
    expect(score.redact.chars.recall).toBeCloseTo(0.75);
    expect(score.predicted.chars.precision).toBeCloseTo(15 / 20);
    expect(score.keep.spans.total).toBe(1);
    expect(score.keep.spans.violated).toBe(1);
    expect(score.bySeverity.high.covered).toBe(1);
    expect(score.bySeverity.medium.partial).toBe(1);
  });

  it("summarizes suite-level weighted scores", () => {
    const first = scoreDocument(
      "first",
      [
        {
          id: "gold-0001",
          action: "redact",
          label: "EMAIL",
          severity: "high",
          start: 0,
          end: 10,
          text: "a@b.co",
        },
      ],
      [{ start: 0, end: 10, kind: "EMAIL", text: "a@b.co" }],
    );
    const second = scoreDocument(
      "second",
      [
        {
          id: "gold-0001",
          action: "redact",
          label: "PHONE",
          severity: "high",
          start: 0,
          end: 10,
          text: "555-0100",
        },
      ],
      [],
    );

    const summary = summarizeSuiteScores([first, second]);

    expect(summary.redact.spans.recall).toBeCloseTo(0.5);
    expect(summary.redact.chars.recall).toBeCloseTo(0.5);
    expect(summary.predicted.chars.precision).toBeCloseTo(1);
  });
});
