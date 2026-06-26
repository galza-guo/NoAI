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
    expect(mainSource).toContain("Restorations");
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

  it("uses header actions for Restore files", () => {
    expect(mainSource).toContain("restore-file-action");
    expect(mainSource).toContain("ph-arrow-square-out");
    expect(mainSource).toContain("ph-arrow-square-in");
    expect(mainSource).toContain("Save Restore file");
    expect(mainSource).toContain("Open Restore file");
    expect(mainSource).toContain("function restoreFileName");
    expect(mainSource).toContain("noai_restore-");
    expect(mainSource).toContain(", et al");
  });

  it("summarizes restorations like the redactions footer", () => {
    expect(mainSource).toContain("live Redact session");
    expect(mainSource).toContain("imported Restore file");
    expect(mainSource).toContain("from ${source}");
    expect(mainSource).not.toContain("Ready from current session");
  });

  it("renders restorations even after draft redactions are restored", () => {
    expect(mainSource).toContain("groupRestoreEntriesByKind");
    expect(mainSource).toContain("renderRestoreKeyEntryRow");
    expect(mainSource).toContain("state.restoreKey.entries.length === 0");
    expect(mainSource).toContain("No restorations saved here.");
  });
});
