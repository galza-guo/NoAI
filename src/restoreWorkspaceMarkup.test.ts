import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const mainSource = readFileSync("src/main.ts", "utf8");

describe("restore workspace markup", () => {
  it("adds a Redact and Restore workspace mode switch", () => {
    expect(mainSource).toContain('type WorkspaceMode = "redact" | "restore";');
    expect(mainSource).toContain('data-workspace-mode="redact"');
    expect(mainSource).toContain('data-workspace-mode="restore"');
  });

  it("uses restore panel labels that mirror the redaction workspace", () => {
    expect(mainSource).toContain("AI Outputs");
    expect(mainSource).toContain("Restored Draft");
    expect(mainSource).toContain("Restore Map");
  });
});
