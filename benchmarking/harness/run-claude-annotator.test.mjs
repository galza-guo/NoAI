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
import {
  buildClaudeAnnotationPrompt,
  runClaudeAnnotator,
} from "./run-claude-annotator.mjs";

const tempRoots = [];

function tempRound() {
  const roundDir = mkdtempSync(join(tmpdir(), "noai-claude-annotator-"));
  tempRoots.push(roundDir);
  mkdirSync(join(roundDir, "model-input"), { recursive: true });
  mkdirSync(join(roundDir, "annotations"), { recursive: true });
  return roundDir;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function writeRoundInput(roundDir, text = "Email jane@example.com") {
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
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("runClaudeAnnotator", () => {
  it("builds a batch prompt from the round index and document text", () => {
    const roundDir = tempRound();
    writeRoundInput(roundDir, "Email jane@example.com");

    const prompt = buildClaudeAnnotationPrompt({ roundDir });

    expect(prompt).toContain("# Batch Model Annotation Prompt");
    expect(prompt).toContain("sample-round");
    expect(prompt).toContain("doc-001");
    expect(prompt).toContain("Email jane@example.com");
  });

  it("calls claude -p once and writes valid JSON output", () => {
    const roundDir = tempRound();
    writeRoundInput(roundDir);
    const calls = [];
    const batch = {
      schemaVersion: "1.0.0",
      suiteId: "sample-round",
      annotator: "claude-test",
      createdAt: "2026-06-19",
      documents: [],
    };

    const result = runClaudeAnnotator({
      roundDir,
      runner: (command, args) => {
        calls.push({ command, args });
        return { status: 0, stdout: JSON.stringify(batch), stderr: "" };
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe("claude");
    expect(calls[0].args[0]).toBe("-p");
    expect(result.outputPath).toBe(
      join(roundDir, "annotations", "claude.batch.json"),
    );
    expect(JSON.parse(readFileSync(result.outputPath, "utf8"))).toEqual(batch);
  });

  it("fails clearly when claude returns non-JSON", () => {
    const roundDir = tempRound();
    writeRoundInput(roundDir);

    expect(() =>
      runClaudeAnnotator({
        roundDir,
        runner: () => ({ status: 0, stdout: "not json", stderr: "" }),
      }),
    ).toThrow(/non-JSON/);
  });
});
