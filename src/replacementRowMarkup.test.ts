import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const cssSource = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("replacement row markup", () => {
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
});
