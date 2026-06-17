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
});
