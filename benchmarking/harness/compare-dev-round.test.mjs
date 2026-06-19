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
                { text: "Jane <" },
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

    expect(report.annotationComparison.agreed).toHaveLength(2);
    expect(report.annotationComparison.agentOnly).toHaveLength(1);
    expect(report.summary.redact.spans.total).toBe(2);
    expect(report.summary.redact.spans.covered).toBe(1);
    expect(report.summary.redact.spans.missed).toBe(1);
    expect(report.summary.keep.spans.clean).toBe(1);
    expect(
      readFileSync(join(roundDir, "comparison", "round-summary.md"), "utf8"),
    ).toContain("Redaction span recall");
  });
});
