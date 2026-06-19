import { describe, expect, it } from "vitest";
import {
  entryFromScoreReport,
  renderScoreHistoryMarkdown,
  upsertScoreHistory,
} from "./score-history.mjs";

const report = {
  suiteId: "benchmark-v1.0",
  level: "balanced",
  engineVersion: "1.4.2",
  engineVersionLabel: "NoAI redaction engine 1.4.2 (general r3, chinese r2)",
  coverageThreshold: 0.8,
  generatedAt: "2026-06-19T00:57:01.000Z",
  summary: {
    redact: {
      spans: { total: 973, covered: 576, recall: 576 / 973 },
      chars: { total: 13727, covered: 8705, recall: 8705 / 13727 },
    },
    keep: {
      spans: { total: 71, clean: 61, cleanRate: 61 / 71 },
    },
    predicted: {
      spans: { total: 1048, unsupported: 395 },
      chars: { total: 17381, overlappingRedact: 8705, precision: 8705 / 17381 },
    },
  },
};

describe("score history utilities", () => {
  it("extracts a compact comparable entry from a full score report", () => {
    expect(entryFromScoreReport(report)).toEqual({
      runId:
        "benchmark-v1.0:NoAI redaction engine 1.4.2 (general r3, chinese r2):balanced:0.8",
      generatedAt: "2026-06-19T00:57:01.000Z",
      suiteId: "benchmark-v1.0",
      engineVersion: "1.4.2",
      engineVersionLabel: "NoAI redaction engine 1.4.2 (general r3, chinese r2)",
      level: "balanced",
      coverageThreshold: 0.8,
      redactSpanRecall: 576 / 973,
      redactCharRecall: 8705 / 13727,
      precisionProxy: 8705 / 17381,
      keepCleanRate: 61 / 71,
      redactSpansCovered: 576,
      redactSpansTotal: 973,
      unsupportedPredictions: 395,
      predictedSpansTotal: 1048,
    });
  });

  it("replaces an existing same-suite/version/level entry instead of duplicating it", () => {
    const first = upsertScoreHistory(
      { schemaVersion: "1.0.0", updatedAt: "old", entries: [] },
      report,
    );
    const updated = upsertScoreHistory(first, {
      ...report,
      generatedAt: "2026-06-19T01:00:00.000Z",
      summary: {
        ...report.summary,
        redact: {
          ...report.summary.redact,
          spans: { total: 973, covered: 600, recall: 600 / 973 },
        },
      },
    });

    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0].generatedAt).toBe("2026-06-19T01:00:00.000Z");
    expect(updated.entries[0].redactSpansCovered).toBe(600);
  });

  it("keeps separate entries for the same engine semver with different ruleset labels", () => {
    const first = upsertScoreHistory(
      { schemaVersion: "1.0.0", updatedAt: "old", entries: [] },
      report,
    );
    const updated = upsertScoreHistory(first, {
      ...report,
      engineVersionLabel: "NoAI redaction engine 1.4.2 (general r4, chinese r2)",
      generatedAt: "2026-06-19T01:00:00.000Z",
    });

    expect(updated.entries).toHaveLength(2);
    expect(updated.entries.map((entry) => entry.engineVersionLabel)).toEqual([
      "NoAI redaction engine 1.4.2 (general r3, chinese r2)",
      "NoAI redaction engine 1.4.2 (general r4, chinese r2)",
    ]);
  });

  it("renders a Markdown table for quick historical review", () => {
    const history = upsertScoreHistory(
      { schemaVersion: "1.0.0", updatedAt: "old", entries: [] },
      report,
    );

    const markdown = renderScoreHistoryMarkdown(history);

    expect(markdown).toContain("| Generated | Suite | Engine | Level | Span recall | Char recall | Precision proxy | Keep clean |");
    expect(markdown).toContain("| 2026-06-19T00:57:01.000Z | benchmark-v1.0 | NoAI redaction engine 1.4.2 (general r3, chinese r2) | balanced | 59.2% | 63.4% | 50.1% | 85.9% | 576/973 | 395/1048 |");
  });
});
