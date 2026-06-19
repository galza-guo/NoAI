import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { indexDevRoundDocs } from "./index-dev-round-docs.mjs";

const tempRoots = [];

function tempRound() {
  const roundDir = mkdtempSync(join(tmpdir(), "noai-index-dev-round-"));
  tempRoots.push(roundDir);
  mkdirSync(join(roundDir, "source"), { recursive: true });
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

describe("indexDevRoundDocs", () => {
  it("indexes markdown and text sources into deterministic model input files", () => {
    const roundDir = tempRound();
    writeFileSync(join(roundDir, "round-manifest.json"), JSON.stringify({
      schemaVersion: "1.0.0",
      roundId: "sample-round",
      documents: [],
    }));
    writeFileSync(join(roundDir, "source", "b-letter.txt"), "Beta text\r\n");
    writeFileSync(join(roundDir, "source", "a-contract.md"), "# Alpha\n");

    const result = indexDevRoundDocs({ roundDir });

    expect(result.documents.map((doc) => doc.docId)).toEqual([
      "doc-001",
      "doc-002",
    ]);
    expect(result.documents.map((doc) => doc.title)).toEqual([
      "a-contract",
      "b-letter",
    ]);
    expect(readFileSync(join(roundDir, "model-input", "doc-001.md"), "utf8"))
      .toBe("# Alpha\n");
    expect(readFileSync(join(roundDir, "model-input", "doc-002.md"), "utf8"))
      .toBe("Beta text\n");

    const index = JSON.parse(
      readFileSync(join(roundDir, "model-input", "document-index.json"), "utf8"),
    );
    expect(index.suiteId).toBe("sample-round");
    expect(index.documents[0].sourceTextSha256).toBe(sha256("# Alpha\n"));
    expect(index.documents[1].sourceTextSha256).toBe(sha256("Beta text\n"));
    expect(existsSync(index.documents[0].markdownPath)).toBe(true);
  });

  it("rejects unsupported source files with a clear message", () => {
    const roundDir = tempRound();
    writeFileSync(join(roundDir, "round-manifest.json"), JSON.stringify({
      schemaVersion: "1.0.0",
      roundId: "sample-round",
      documents: [],
    }));
    writeFileSync(join(roundDir, "source", "scan.pdf"), "%PDF");

    expect(() => indexDevRoundDocs({ roundDir })).toThrow(
      /Unsupported source file/,
    );
  });
});
