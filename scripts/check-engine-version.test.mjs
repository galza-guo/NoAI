import { execFileSync, spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const scriptPath = join(repoRoot, "scripts/check-engine-version.mjs");
const tempRepos = [];

function runGit(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function writeFixtureRepo() {
  const cwd = mkdtempSync(join(tmpdir(), "noai-version-check-"));
  tempRepos.push(cwd);
  mkdirSync(join(cwd, "src/redactor"), { recursive: true });
  mkdirSync(join(cwd, "docs"), { recursive: true });
  writeFileSync(join(cwd, "src/redactor/engine.ts"), "export const engine = true;\n");
  writeFileSync(join(cwd, "src/redactor/rules.ts"), "export const rules = true;\n");
  writeFileSync(join(cwd, "src/redactor/chinese.ts"), "export const chinese = true;\n");
  writeFileSync(
    join(cwd, "src/redactor/version.ts"),
    [
      'export const ENGINE_VERSION = "1.4.6";',
      "export const GENERAL_RULES_VERSION = 1;",
      "export const CHINESE_RULES_VERSION = 1;",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(cwd, "docs/engine-changelog.md"),
    [
      "# Redaction Engine Changelog",
      "",
      "## NoAI redaction engine 1.4.6 (general r1, chinese r1) - 2026-06-19",
      "",
      "- Baseline.",
      "",
    ].join("\n"),
  );
  runGit(cwd, ["init"]);
  runGit(cwd, ["config", "user.email", "test@example.com"]);
  runGit(cwd, ["config", "user.name", "Version Test"]);
  runGit(cwd, ["add", "."]);
  runGit(cwd, ["commit", "-m", "baseline"]);
  return cwd;
}

function runCheck(cwd) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const cwd of tempRepos.splice(0)) {
    rmSync(cwd, { recursive: true, force: true });
  }
});

describe("engine version pre-commit check", () => {
  it("allows a general rules-only bump when general rule source changes", () => {
    const cwd = writeFixtureRepo();
    writeFileSync(join(cwd, "src/redactor/rules.ts"), "export const rules = 'changed';\n");
    writeFileSync(
      join(cwd, "src/redactor/version.ts"),
      [
        'export const ENGINE_VERSION = "1.4.6";',
        "export const GENERAL_RULES_VERSION = 2;",
        "export const CHINESE_RULES_VERSION = 1;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(cwd, "docs/engine-changelog.md"),
      [
        "# Redaction Engine Changelog",
        "",
        "## NoAI redaction engine 1.4.6 (general r2, chinese r1) - 2026-06-19",
        "",
        "- General rule tuning.",
        "",
        "## NoAI redaction engine 1.4.6 (general r1, chinese r1) - 2026-06-19",
        "",
        "- Baseline.",
        "",
      ].join("\n"),
    );
    runGit(cwd, ["add", "."]);

    const result = runCheck(cwd);

    expect(result.status).toBe(0);
  });

  it("allows shared engine plumbing for a ruleset-only change without bumping engine semver", () => {
    const cwd = writeFixtureRepo();
    writeFileSync(join(cwd, "src/redactor/engine.ts"), "export const engine = 'rule plumbing';\n");
    writeFileSync(
      join(cwd, "src/redactor/version.ts"),
      [
        'export const ENGINE_VERSION = "1.4.6";',
        "export const GENERAL_RULES_VERSION = 2;",
        "export const CHINESE_RULES_VERSION = 1;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(cwd, "docs/engine-changelog.md"),
      [
        "# Redaction Engine Changelog",
        "",
        "## NoAI redaction engine 1.4.6 (general r2, chinese r1) - 2026-06-19",
        "",
        "- General ruleset plumbing.",
        "",
        "## NoAI redaction engine 1.4.6 (general r1, chinese r1) - 2026-06-19",
        "",
        "- Baseline.",
        "",
      ].join("\n"),
    );
    runGit(cwd, ["add", "."]);

    const result = runCheck(cwd);

    expect(result.status).toBe(0);
  });

  it("rejects a Chinese source change that does not bump the Chinese rules version", () => {
    const cwd = writeFixtureRepo();
    writeFileSync(join(cwd, "src/redactor/chinese.ts"), "export const chinese = 'changed';\n");
    writeFileSync(
      join(cwd, "src/redactor/version.ts"),
      [
        'export const ENGINE_VERSION = "1.4.7";',
        "export const GENERAL_RULES_VERSION = 1;",
        "export const CHINESE_RULES_VERSION = 1;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(cwd, "docs/engine-changelog.md"),
      [
        "# Redaction Engine Changelog",
        "",
        "## NoAI redaction engine 1.4.7 (general r1, chinese r1) - 2026-06-19",
        "",
        "- Shared metadata change.",
        "",
        "## NoAI redaction engine 1.4.6 (general r1, chinese r1) - 2026-06-19",
        "",
        "- Baseline.",
        "",
      ].join("\n"),
    );
    runGit(cwd, ["add", "."]);

    const result = runCheck(cwd);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("CHINESE_RULES_VERSION");
  });
});
