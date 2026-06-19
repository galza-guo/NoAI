#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const ENGINE_SOURCE_RE = /^src\/redactor\/(chinese|engine|rules|types|version)\.ts$/;
const CHINESE_RULE_SOURCE_RE = /^src\/redactor\/chinese\.ts$/;
const GENERAL_RULE_SOURCE_RE = /^src\/redactor\/rules\.ts$/;
const SHARED_ENGINE_SOURCE_RE = /^src\/redactor\/(engine|types)\.ts$/;
const VERSION_FILE = "src/redactor/version.ts";
const CHANGELOG_FILE = "docs/engine-changelog.md";

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

function stagedFile(path) {
  try {
    return git(["show", `:${path}`]);
  } catch {
    return "";
  }
}

function headFile(path) {
  try {
    return git(["show", `HEAD:${path}`]);
  } catch {
    return "";
  }
}

function stringConst(source, name) {
  return source.match(new RegExp(`${name}\\s*=\\s*"([^"]+)"`))?.[1] ?? "";
}

function numberConst(source, name) {
  const value = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`))?.[1] ?? "";
  return value ? Number(value) : 0;
}

function versionState(source) {
  const engine = stringConst(source, "ENGINE_VERSION");
  const general = numberConst(source, "GENERAL_RULES_VERSION");
  const chinese = numberConst(source, "CHINESE_RULES_VERSION");
  return {
    engine,
    general,
    chinese,
    label:
      engine && general && chinese
        ? `NoAI redaction engine ${engine} (general r${general}, chinese r${chinese})`
        : "",
  };
}

function sameVersionState(left, right) {
  return (
    left.engine === right.engine &&
    left.general === right.general &&
    left.chinese === right.chinese
  );
}

function fail(message) {
  console.error(`\nEngine version check failed:\n${message}\n`);
  console.error("When redaction engine source changes, also update:");
  console.error(`- ${VERSION_FILE}`);
  console.error(`- ${CHANGELOG_FILE}`);
  console.error("\nVersioning rules:");
  console.error("- ENGINE_VERSION: shared engine/API/review-metadata changes");
  console.error("- GENERAL_RULES_VERSION: English/general deterministic rule changes");
  console.error("- CHINESE_RULES_VERSION: Chinese deterministic rule changes");
  console.error(
    '- Changelog heading: "## NoAI redaction engine X.Y.Z (general rN, chinese rM) - YYYY-MM-DD"\n',
  );
  process.exit(1);
}

const staged = git(["diff", "--cached", "--name-only"])
  .split("\n")
  .filter(Boolean);

const engineChanged = staged.some(
  (path) => ENGINE_SOURCE_RE.test(path) && path !== VERSION_FILE,
);

if (!engineChanged) process.exit(0);

const versionStaged = staged.includes(VERSION_FILE);
const changelogStaged = staged.includes(CHANGELOG_FILE);

if (!versionStaged || !changelogStaged) {
  fail("Engine source changed, but the engine version/changelog was not staged.");
}

const nextVersion = versionState(stagedFile(VERSION_FILE));
const previousVersion = versionState(headFile(VERSION_FILE));

if (!/^\d+\.\d+\.\d+$/.test(nextVersion.engine)) {
  fail(
    `ENGINE_VERSION must be plain semver like "1.0.1"; found "${nextVersion.engine}".`,
  );
}

if (!Number.isInteger(nextVersion.general) || nextVersion.general < 1) {
  fail("GENERAL_RULES_VERSION must be a positive integer.");
}

if (!Number.isInteger(nextVersion.chinese) || nextVersion.chinese < 1) {
  fail("CHINESE_RULES_VERSION must be a positive integer.");
}

const engineVersionChanged = nextVersion.engine !== previousVersion.engine;
const generalRulesChanged = nextVersion.general !== previousVersion.general;
const chineseRulesChanged = nextVersion.chinese !== previousVersion.chinese;

if (previousVersion.engine && sameVersionState(nextVersion, previousVersion)) {
  fail(
    `Version identity is still ${nextVersion.label}; bump ENGINE_VERSION, GENERAL_RULES_VERSION, or CHINESE_RULES_VERSION for this engine change.`,
  );
}

if (staged.some((path) => GENERAL_RULE_SOURCE_RE.test(path)) && !generalRulesChanged) {
  fail("src/redactor/rules.ts changed; bump GENERAL_RULES_VERSION.");
}

if (staged.some((path) => CHINESE_RULE_SOURCE_RE.test(path)) && !chineseRulesChanged) {
  fail("src/redactor/chinese.ts changed; bump CHINESE_RULES_VERSION.");
}

if (
  staged.some((path) => SHARED_ENGINE_SOURCE_RE.test(path)) &&
  !engineVersionChanged &&
  !generalRulesChanged &&
  !chineseRulesChanged
) {
  fail(
    "Shared engine source changed; bump ENGINE_VERSION or the affected ruleset version.",
  );
}

const stagedChangelog = stagedFile(CHANGELOG_FILE);
if (!stagedChangelog.includes(`## ${nextVersion.label} - `)) {
  fail(`Changelog must contain a heading like "## ${nextVersion.label} - YYYY-MM-DD".`);
}
