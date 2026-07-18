import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { compareDevRound } from "./compare-dev-round.mjs";

const tempRoots = [];

function tempRound() {
  const roundDir = mkdtempSync(join(tmpdir(), "noai-compare-dev-round-"));
  tempRoots.push(roundDir);
  mkdirSync(join(roundDir, "model-input"), { recursive: true });
  mkdirSync(join(roundDir, "annotations"), { recursive: true });
  mkdirSync(join(roundDir, "engine-output"), { recursive: true });
  return roundDir;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function annotation(id, action, label, start, end, text, severity = "high") {
  return {
    id,
    action,
    label,
    start,
    end,
    text,
    severity: action === "keep" ? "none" : severity,
    confidence: 0.9,
    reason: `${label} ${action}`,
  };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("compareDevRound", () => {
  it("compares independent annotations to engine spans and writes reports", () => {
    const roundDir = tempRound();
    const text = "Jane <jane@example.com> Common Stock remains.";
    const markdownPath = join(roundDir, "model-input", "doc-001.md");
    writeFileSync(markdownPath, text);
    const index = {
      schemaVersion: "1.0.0",
      suiteId: "sample-round",
      documents: [
        {
          docId: "doc-001",
          title: "sample",
          markdownPath,
          sourceTextSha256: sha256(text),
        },
      ],
    };
    writeFileSync(
      join(roundDir, "model-input", "document-index.json"),
      JSON.stringify(index),
    );

    const email = annotation(
      "ann-001",
      "redact",
      "EMAIL",
      6,
      22,
      "jane@example.com",
    );
    const keep = annotation(
      "ann-002",
      "keep",
      "MUST_KEEP",
      24,
      36,
      "Common Stock",
      "none",
    );
    writeFileSync(
      join(roundDir, "annotations", "claude.batch.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        annotator: "claude-test",
        documents: [
          {
            docId: "doc-001",
            sourceTextSha256: sha256(text),
            annotations: [email, keep],
          },
        ],
      }),
    );
    writeFileSync(
      join(roundDir, "annotations", "agent.batch.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        annotator: "agent-test",
        documents: [
          {
            docId: "doc-001",
            sourceTextSha256: sha256(text),
            annotations: [
              email,
              keep,
              annotation("ann-003", "redact", "PERSON", 0, 4, "Jane"),
            ],
          },
        ],
      }),
    );
    writeFileSync(
      join(roundDir, "engine-output", "balanced.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        level: "balanced",
        engineVersion: "1.2.3",
        warnings: [],
        outputs: [
          {
            docId: "doc-001",
            reviewDocument: {
              segments: [
                {
                  text: "PERSON_001",
                  value: "Jane",
                  replacement: "PERSON_001",
                  kind: "PERSON",
                },
                { text: " <" },
                {
                  text: "EMAIL_001",
                  value: "jane@example.com",
                  replacement: "EMAIL_001",
                  kind: "EMAIL",
                },
                { text: "> Common Stock remains." },
              ],
            },
          },
        ],
      }),
    );

    const report = compareDevRound({
      roundDir,
      level: "balanced",
      claudePath: "",
      agentPath: "",
    });

    // Headline target is annotator consensus (email + keep). The agent-only
    // "Jane" span is a lead, not a scored miss.
    expect(report.annotationComparison.consensus).toHaveLength(2);
    expect(report.annotationComparison.agentOnly).toHaveLength(1);
    expect(report.summary.redact.spans.total).toBe(1);
    expect(report.summary.redact.spans.covered).toBe(1);
    expect(report.summary.redact.spans.missed).toBe(0);
    expect(report.summary.keep.spans.clean).toBe(1);
    expect(report.leads.spans).toHaveLength(1);
    expect(report.leads.spans[0].annotator).toBe("agent");
    expect(report.leads.summary.redact.spans.total).toBe(1);
    expect(report.leads.summary.redact.spans.covered).toBe(1);
    expect(report.predictionSupport.spans.confirmed).toBe(1);
    expect(report.predictionSupport.spans.uncertain).toBe(1);
    expect(report.predictionSupport.spans.unsupported).toBe(0);
    expect(report.predictionSupport.chars.confirmedPrecision).toBeLessThan(1);
    expect(report.predictionSupport.chars.possiblePrecision).toBe(1);
    expect(report.summary.predicted).toBeUndefined();
    expect(report.documents[0].score.predicted).toBeUndefined();
    expect(report.leads.summary.predicted).toBeUndefined();

    const summaryMarkdown = readFileSync(
      join(roundDir, "comparison", "round-summary.md"),
      "utf8",
    );
    expect(summaryMarkdown).toContain("Redaction span recall");
    expect(summaryMarkdown).toContain("Annotator Consensus");
    expect(summaryMarkdown).toContain("Critical/high-severity span recall");
    expect(summaryMarkdown).toContain("## Leads");
  });

  it("matches boundary-shifted spans as consensus instead of phantom misses", () => {
    const roundDir = tempRound();
    const text = "Contact: Jane Q. Doe, 12 Sample Road, Springfield.";
    const markdownPath = join(roundDir, "model-input", "doc-001.md");
    writeFileSync(markdownPath, text);
    const index = {
      schemaVersion: "1.0.0",
      suiteId: "sample-round",
      documents: [
        {
          docId: "doc-001",
          title: "sample",
          markdownPath,
          sourceTextSha256: sha256(text),
        },
      ],
    };
    writeFileSync(
      join(roundDir, "model-input", "document-index.json"),
      JSON.stringify(index),
    );

    // Claude marks the address without the trailing city; the agent includes
    // it. Same finding, different boundary preference: must count as ONE
    // consensus span, not two separate targets.
    const claudeAddress = annotation(
      "ann-001",
      "redact",
      "ADDRESS",
      22,
      36,
      "12 Sample Road",
    );
    const agentAddress = annotation(
      "ann-101",
      "redact",
      "ADDRESS",
      22,
      49,
      "12 Sample Road, Springfield",
    );
    writeFileSync(
      join(roundDir, "annotations", "claude.batch.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        annotator: "claude-test",
        documents: [
          {
            docId: "doc-001",
            sourceTextSha256: sha256(text),
            annotations: [claudeAddress],
          },
        ],
      }),
    );
    writeFileSync(
      join(roundDir, "annotations", "agent.batch.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        annotator: "agent-test",
        documents: [
          {
            docId: "doc-001",
            sourceTextSha256: sha256(text),
            annotations: [agentAddress],
          },
        ],
      }),
    );
    writeFileSync(
      join(roundDir, "engine-output", "balanced.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        level: "balanced",
        engineVersion: "1.2.3",
        warnings: [],
        outputs: [
          {
            docId: "doc-001",
            reviewDocument: {
              segments: [
                { text: "Contact: Jane Q. Doe, " },
                {
                  text: "ADDRESS_001",
                  value: "12 Sample Road",
                  replacement: "ADDRESS_001",
                  kind: "ADDRESS",
                },
                { text: ", Springfield." },
              ],
            },
          },
        ],
      }),
    );

    const report = compareDevRound({
      roundDir,
      level: "balanced",
      claudePath: "",
      agentPath: "",
    });

    expect(report.annotationComparison.consensus).toHaveLength(1);
    expect(report.annotationComparison.claudeOnly).toHaveLength(0);
    expect(report.annotationComparison.agentOnly).toHaveLength(0);
    expect(report.leads.spans).toHaveLength(0);
    expect(report.summary.redact.spans.total).toBe(1);
    expect(report.summary.redact.spans.covered).toBe(1);

    // The same independent annotations must produce the same consensus target
    // and score regardless of which annotator file is called "claude".
    writeFileSync(
      join(roundDir, "annotations", "claude.batch.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        annotator: "claude-test",
        documents: [
          {
            docId: "doc-001",
            sourceTextSha256: sha256(text),
            annotations: [agentAddress],
          },
        ],
      }),
    );
    writeFileSync(
      join(roundDir, "annotations", "agent.batch.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        annotator: "agent-test",
        documents: [
          {
            docId: "doc-001",
            sourceTextSha256: sha256(text),
            annotations: [claudeAddress],
          },
        ],
      }),
    );

    const swappedReport = compareDevRound({
      roundDir,
      level: "balanced",
      claudePath: "",
      agentPath: "",
    });

    expect(swappedReport.annotationComparison.consensus[0].start).toBe(
      report.annotationComparison.consensus[0].start,
    );
    expect(swappedReport.annotationComparison.consensus[0].end).toBe(
      report.annotationComparison.consensus[0].end,
    );
    expect(swappedReport.summary.redact.spans).toEqual(
      report.summary.redact.spans,
    );

    writeFileSync(
      join(roundDir, "annotations", "claude.batch.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        annotator: "claude-test",
        documents: [
          {
            docId: "doc-001",
            sourceTextSha256: sha256(text),
            annotations: [claudeAddress],
          },
        ],
      }),
    );
    writeFileSync(
      join(roundDir, "annotations", "agent.batch.json"),
      JSON.stringify({
        schemaVersion: "1.0.0",
        suiteId: "sample-round",
        annotator: "agent-test",
        documents: [
          {
            docId: "doc-001",
            sourceTextSha256: sha256(text),
            annotations: [{ ...agentAddress, label: "ORG" }],
          },
        ],
      }),
    );

    const disagreementReport = compareDevRound({
      roundDir,
      level: "balanced",
      claudePath: "",
      agentPath: "",
    });
    expect(disagreementReport.annotationComparison.consensus).toHaveLength(0);
    expect(disagreementReport.annotationComparison.disagreements).toHaveLength(1);
    expect(disagreementReport.leads.spans).toHaveLength(0);
    expect(disagreementReport.predictionSupport.spans.uncertain).toBe(1);
    expect(disagreementReport.predictionSupport.spans.unsupported).toBe(0);
  });
});
