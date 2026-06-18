import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("replacement row markup", () => {
  it("centers workspace panel titles against the full header width", () => {
    expect(cssSource).toMatch(
      /\.panel-head\s*{[^}]*position:\s*relative;[^}]*display:\s*flex;/,
    );
    expect(cssSource).toMatch(
      /\.workspace-grid\s+\.panel-head h2\s*{[^}]*position:\s*absolute;[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/,
    );
  });

  it("keeps disabled icon buttons muted instead of filled", () => {
    expect(cssSource).toMatch(
      /\.icon-button:disabled\s*{[^}]*background:\s*transparent;[^}]*border-color:\s*transparent;[^}]*opacity:\s*0\.36;/,
    );
  });

  it("places hit counts as a left overlay and unredact before the input", () => {
    expect(mainSource).toMatch(
      /<div class="entry-row"[\s\S]*<span class="entry-hit-count"[\s\S]*<div class="entry-source">[\s\S]*<s class="entry-value"/,
    );
    expect(mainSource).toMatch(
      /<div class="entry-controls">[\s\S]*<button[\s\S]*class="entry-delete"[\s\S]*<\/button>[\s\S]*<input/,
    );
    expect(cssSource).toMatch(
      /\.entry-hit-count\s*{[^}]*position:\s*absolute;[^}]*opacity:\s*0;[^}]*font-weight:\s*700;/,
    );
    expect(cssSource).toMatch(
      /\.entry-row:hover\s+\.entry-hit-count,[\s\S]*\.entry-row:focus-within\s+\.entry-hit-count\s*{[^}]*opacity:\s*1;/,
    );
    expect(cssSource).toMatch(
      /\.entry-value\s*{[^}]*text-decoration-line:\s*line-through;[^}]*text-decoration-color:\s*var\(--strike-color,\s*currentColor\);/,
    );
    expect(cssSource).not.toMatch(/\.entry-value::after/);
  });

  it("adds a category-level unredact button beside the category toggle", () => {
    expect(mainSource).toMatch(
      /<div class="cat-head-row">[\s\S]*<button[^>]*class="cat-head[\s\S]*data-toggle-kind=/,
    );
    expect(mainSource).toMatch(
      /<button[\s\S]*class="cat-delete"[\s\S]*data-delete-kind=/,
    );
    expect(mainSource).toContain("function deleteEntries(");
    expect(cssSource).toMatch(
      /\.cat-head-row:hover\s+\.cat-delete,[\s\S]*\.cat-head-row:focus-within\s+\.cat-delete\s*{[^}]*opacity:\s*1;/,
    );
  });

  it("adds a redactions sidebar toggle that mirrors the documents collapse pattern", () => {
    expect(mainSource).toContain("redactionsCollapsed: boolean;");
    expect(mainSource).toMatch(
      /<button id="redactions-toggle"[\s\S]*class="icon-button redactions-toggle"[\s\S]*aria-label="Collapse redactions sidebar"/,
    );
    expect(mainSource).toMatch(
      /redactionsToggle\.addEventListener\("click"[\s\S]*state\.redactionsCollapsed = !state\.redactionsCollapsed;[\s\S]*renderReplacements\(\);/,
    );
    expect(cssSource).toMatch(
      /\.workspace-grid\.redactions-collapsed\s*{[^}]*grid-template-columns:[^}]*56px;/,
    );
    expect(cssSource).toMatch(
      /\.redactions-toggle i\s*{[^}]*transform:\s*scaleX\(-1\);/,
    );
  });

  it("explains that old Word doc files need conversion first", () => {
    expect(mainSource).toContain(
      "Old Word .doc files are not supported yet. Please save as .docx, .txt, or .pdf first.",
    );
  });
});
