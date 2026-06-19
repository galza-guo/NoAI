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
import { runDevRoundEngine } from "./run-dev-round-engine.mjs";

const tempRoots = [];

function tempRound() {
  const roundDir = mkdtempSync(join(tmpdir(), "noai-run-engine-"));
  tempRoots.push(roundDir);
  mkdirSync(join(roundDir, "model-input"), { recursive: true });
  return roundDir;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("runDevRoundEngine", () => {
  it("runs the current engine for a dev round and writes level output", async () => {
    const roundDir = tempRound();
    const text = "Contact Jane Rivers at jane.rivers@example.com.";
    const markdownPath = join(roundDir, "model-input", "doc-001.md");
    writeFileSync(markdownPath, text);
    writeFileSync(
      join(roundDir, "model-input", "document-index.json"),
      JSON.stringify({
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
      }),
    );

    const reports = await runDevRoundEngine({
      roundDir,
      levels: ["balanced"],
    });

    expect(reports).toHaveLength(1);
    expect(reports[0].suiteId).toBe("sample-round");
    expect(reports[0].level).toBe("balanced");
    expect(reports[0].engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(reports[0].outputs[0].docId).toBe("doc-001");
    expect(reports[0].outputs[0].counts.EMAIL).toBe(1);
    expect(reports[0].warnings).toEqual([]);

    const written = JSON.parse(
      readFileSync(join(roundDir, "engine-output", "balanced.json"), "utf8"),
    );
    expect(written.outputs[0].reviewDocument.segments).toEqual(
      reports[0].outputs[0].reviewDocument.segments,
    );
  });
});
