import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const mainSource = readFileSync("src/main.ts", "utf8");

describe("restore workspace markup", () => {
  it("adds a Redact and Restore workspace mode switch", () => {
    expect(mainSource).toContain('type WorkspaceMode = "redact" | "restore";');
    expect(mainSource).toContain('data-workspace-mode="redact"');
    expect(mainSource).toContain('data-workspace-mode="restore"');
    expect(mainSource).toMatch(
      /<header class="topbar">[\s\S]*class="brand-link"[\s\S]*class="workspace-mode-switch"[\s\S]*class="site-menu-wrap"/,
    );
    expect(mainSource).not.toMatch(
      /<h2 id="preview-title">Preview<\/h2>[\s\S]{0,800}class="workspace-mode-switch"/,
    );
  });

  it("uses restore panel labels that mirror the redaction workspace", () => {
    expect(mainSource).toContain("AI Outputs");
    expect(mainSource).toContain("Restored Draft");
    expect(mainSource).toContain("Restore Map");
  });

  it("tracks restore outputs and selected restore output", () => {
    expect(mainSource).toContain("restoreOutputs: RestoreOutput[];");
    expect(mainSource).toContain("selectedRestoreOutputId: string | null;");
    expect(mainSource).toContain("restoreKey: RestoreKey | null;");
  });

  it("renders restore-specific panels", () => {
    expect(mainSource).toContain("function renderRestoreOutputs");
    expect(mainSource).toContain("function renderRestoredDraft");
    expect(mainSource).toContain("function renderRestoreMap");
  });
});
