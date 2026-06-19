import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDevRound } from "./create-dev-round.mjs";

const tempRoots = [];

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "noai-create-dev-round-"));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("createDevRound", () => {
  it("creates the standard private dev-round structure and manifest", () => {
    const baseDir = join(tempRoot(), "dev-rounds");

    const result = createDevRound({
      baseDir,
      roundId: "2026-06-19-sec-correspondence",
      theme: "SEC correspondence names and filing refs",
      sourceMode: "user",
      now: "2026-06-19T00:00:00.000Z",
    });

    expect(result.roundDir).toBe(
      join(baseDir, "2026-06-19-sec-correspondence"),
    );
    for (const name of [
      "source",
      "model-input",
      "engine-output",
      "annotations",
      "comparison",
      "scratch",
    ]) {
      expect(existsSync(join(result.roundDir, name))).toBe(true);
    }

    const manifest = JSON.parse(
      readFileSync(join(result.roundDir, "round-manifest.json"), "utf8"),
    );
    expect(manifest).toEqual({
      schemaVersion: "1.0.0",
      roundId: "2026-06-19-sec-correspondence",
      createdAt: "2026-06-19T00:00:00.000Z",
      theme: "SEC correspondence names and filing refs",
      sourceMode: "user",
      documents: [],
    });
  });

  it("rejects unsafe round ids and existing folders unless forced", () => {
    const baseDir = join(tempRoot(), "dev-rounds");
    createDevRound({
      baseDir,
      roundId: "safe-round",
      theme: "first",
      sourceMode: "user",
      now: "2026-06-19T00:00:00.000Z",
    });

    expect(() =>
      createDevRound({
        baseDir,
        roundId: "../unsafe",
        theme: "bad",
        sourceMode: "user",
      }),
    ).toThrow(/Unsafe round id/);

    expect(() =>
      createDevRound({
        baseDir,
        roundId: "safe-round",
        theme: "again",
        sourceMode: "user",
      }),
    ).toThrow(/already exists/);

    expect(() =>
      createDevRound({
        baseDir,
        roundId: "safe-round",
        theme: "again",
        sourceMode: "mixed",
        force: true,
        now: "2026-06-20T00:00:00.000Z",
      }),
    ).not.toThrow();
  });
});
