#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const LABELS = new Set([
  "EMAIL",
  "PHONE",
  "URL",
  "INTERNAL_LINK",
  "ADDRESS",
  "POSTCODE",
  "NATIONAL_ID",
  "BANK_ACCOUNT",
  "BUSINESS_ID",
  "CASE_REF",
  "BUNDLE_REF",
  "EXHIBIT_REF",
  "TRANSCRIPT_REF",
  "PROCEDURAL_REF",
  "DATE",
  "AMOUNT",
  "PERSON",
  "ORG",
  "PERSON_OR_ORG",
  "PROJECT",
  "PROJECT_OR_ISSUE",
  "LOCATION",
  "BRAND",
  "CHANNEL",
  "NON_LATIN_TEXT",
  "MUST_KEEP",
  "OTHER",
]);

const SEVERITIES = new Set(["critical", "high", "medium", "low", "none"]);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

const [annotationPath, sourceTextPath] = process.argv.slice(2);

if (!annotationPath) {
  console.log(
    "Usage: node benchmarking/harness/validate-annotation-file.mjs <annotation.json> [source.md]",
  );
  process.exit(0);
}

let file;
try {
  file = JSON.parse(readFileSync(annotationPath, "utf8"));
} catch (error) {
  fail(`Could not read annotation JSON: ${error.message}`);
  process.exit();
}

const sourceText =
  sourceTextPath === undefined ? undefined : readFileSync(sourceTextPath, "utf8");

if (file.schemaVersion !== "1.0.0") fail("schemaVersion must be 1.0.0");
if (typeof file.suiteId !== "string" || file.suiteId.length === 0)
  fail("suiteId is required");
if (typeof file.docId !== "string" || file.docId.length === 0)
  fail("docId is required");
if (!/^[a-f0-9]{64}$/.test(file.sourceTextSha256 ?? ""))
  fail("sourceTextSha256 must be a lowercase SHA-256 hex digest");
if (!Array.isArray(file.annotations)) fail("annotations must be an array");

if (sourceText !== undefined) {
  const actualHash = sha256(sourceText);
  if (actualHash !== file.sourceTextSha256)
    fail(
      `sourceTextSha256 mismatch: annotation has ${file.sourceTextSha256}, source text is ${actualHash}`,
    );
}

const ids = new Set();

for (const [index, annotation] of (file.annotations ?? []).entries()) {
  const where = `annotations[${index}]`;
  if (typeof annotation.id !== "string" || annotation.id.length === 0) {
    fail(`${where}.id is required`);
  } else if (ids.has(annotation.id)) {
    fail(`${where}.id duplicates ${annotation.id}`);
  } else {
    ids.add(annotation.id);
  }

  if (!["redact", "keep"].includes(annotation.action))
    fail(`${where}.action must be redact or keep`);
  if (!LABELS.has(annotation.label)) fail(`${where}.label is unknown`);
  if (!Number.isInteger(annotation.start) || annotation.start < 0)
    fail(`${where}.start must be a non-negative integer`);
  if (!Number.isInteger(annotation.end) || annotation.end <= annotation.start)
    fail(`${where}.end must be greater than start`);
  if (typeof annotation.text !== "string" || annotation.text.length === 0)
    fail(`${where}.text is required`);
  if (!SEVERITIES.has(annotation.severity))
    fail(`${where}.severity is unknown`);
  if (
    annotation.confidence !== undefined &&
    (typeof annotation.confidence !== "number" ||
      annotation.confidence < 0 ||
      annotation.confidence > 1)
  )
    fail(`${where}.confidence must be between 0 and 1`);
  if (typeof annotation.reason !== "string" || annotation.reason.length === 0)
    fail(`${where}.reason is required`);
  if (annotation.action === "keep" && annotation.severity !== "none")
    fail(`${where}.severity must be none for keep annotations`);
  if (annotation.action === "redact" && annotation.severity === "none")
    fail(`${where}.severity cannot be none for redact annotations`);

  if (sourceText !== undefined) {
    const actual = sourceText.slice(annotation.start, annotation.end);
    if (actual !== annotation.text)
      fail(
        `${where}.text does not match source span: expected ${JSON.stringify(
          actual,
        )}, got ${JSON.stringify(annotation.text)}`,
      );
  }
}

if (process.exitCode) process.exit();

console.log(
  `Validated ${file.annotations.length} annotations for ${file.suiteId}/${file.docId}`,
);
