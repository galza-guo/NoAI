import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cssSource = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("collapsed replacement categories", () => {
  it("removes hidden category body hit areas", () => {
    expect(cssSource).toMatch(
      /\.cat-items-grid\.collapsed\s*{[^}]*pointer-events:\s*none;/,
    );
    expect(cssSource).toMatch(
      /\.cat-items-grid\.collapsed\s+\.cat-items\s*{[^}]*padding:\s*0;/,
    );
  });
});
