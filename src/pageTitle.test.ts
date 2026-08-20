import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexSource = readFileSync("index.html", "utf8");
const mainSource = readFileSync(new URL("./main.ts", import.meta.url), "utf8");

describe("page title", () => {
  it("uses the current NoAI title in the static shell and workspace route", () => {
    const title = "NoAI - Local, Safe Redaction for AI Tools";

    expect(indexSource).toContain(`<title>${title}</title>`);
    expect(mainSource).toContain(`title: "${title}"`);
  });
});
