#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const ENGINE_SOURCE_RE = /^src\/redactor\/(chinese|engine|rules|types|version)\.ts$/;
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

function engineVersion(source) {
  return source.match(/ENGINE_VERSION\s*=\s*"([^"]+)"/)?.[1] ?? "";
}

function fail(message) {
  console.error(`\nEngine version check failed:\n${message}\n`);
  console.error("When redaction engine source changes, also update:");
  console.error(`- ${VERSION_FILE}`);
  console.error(`- ${CHANGELOG_FILE}`);
  console.error("\nUse semantic versioning:");
  console.error("- patch: narrow bug fix or false-positive/false-negative tuning");
  console.error("- minor: new document family, detector category, or review metadata");
  console.error("- major: incompatible output/API/level semantics change\n");
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

const nextVersion = engineVersion(stagedFile(VERSION_FILE));
const previousVersion = engineVersion(headFile(VERSION_FILE));

if (!/^\d+\.\d+\.\d+$/.test(nextVersion)) {
  fail(`ENGINE_VERSION must be plain semver like "1.0.1"; found "${nextVersion}".`);
}

if (previousVersion && nextVersion === previousVersion) {
  fail(`ENGINE_VERSION is still ${nextVersion}; bump it for this engine change.`);
}

const stagedChangelog = stagedFile(CHANGELOG_FILE);
if (!stagedChangelog.includes(`## ${nextVersion} - `)) {
  fail(`Changelog must contain a heading like "## ${nextVersion} - YYYY-MM-DD".`);
}
