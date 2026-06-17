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

const [batchPath, indexPath] = process.argv.slice(2);

if (!batchPath || !indexPath) {
  console.log(
  "Usage: node benchmarking/harness/validate-batch-annotation-file.mjs <batch-annotations.json> <document-index.json>",
  );
  process.exit(0);
}

let batch;
let index;
try {
  batch = JSON.parse(readFileSync(batchPath, "utf8"));
  index = JSON.parse(readFileSync(indexPath, "utf8"));
} catch (error) {
  fail(`Could not read JSON: ${error.message}`);
  process.exit();
}

if (batch.schemaVersion !== "1.0.0") fail("schemaVersion must be 1.0.0");
if (typeof batch.suiteId !== "string" || batch.suiteId.length === 0)
  fail("suiteId is required");
if (typeof batch.annotator !== "string" || batch.annotator.length === 0)
  fail("annotator is required");
if (!Array.isArray(batch.documents)) fail("documents must be an array");

if (index.suiteId !== batch.suiteId)
  fail(`suiteId mismatch: batch=${batch.suiteId}, index=${index.suiteId}`);

const indexByDoc = new Map(
  (index.documents ?? []).map((doc) => [doc.docId, doc]),
);

for (const [docIndex, doc] of (batch.documents ?? []).entries()) {
  const whereDoc = `documents[${docIndex}]`;
  if (typeof doc.docId !== "string" || doc.docId.length === 0) {
    fail(`${whereDoc}.docId is required`);
    continue;
  }
  const indexDoc = indexByDoc.get(doc.docId);
  if (!indexDoc) {
    fail(`${whereDoc}.docId is not in document index: ${doc.docId}`);
    continue;
  }
  if (doc.sourceTextSha256 !== indexDoc.sourceTextSha256)
    fail(`${whereDoc}.sourceTextSha256 does not match document index`);

  let sourceText = "";
  try {
    sourceText = readFileSync(indexDoc.markdownPath, "utf8");
  } catch (error) {
    fail(`${whereDoc}: could not read ${indexDoc.markdownPath}: ${error.message}`);
    continue;
  }

  const actualHash = sha256(sourceText);
  if (actualHash !== indexDoc.sourceTextSha256)
    fail(`${whereDoc}: markdown hash does not match document index`);

  if (!Array.isArray(doc.annotations)) {
    fail(`${whereDoc}.annotations must be an array`);
    continue;
  }

  const ids = new Set();
  for (const [annIndex, annotation] of doc.annotations.entries()) {
    const where = `${whereDoc}.annotations[${annIndex}]`;
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
  `Validated ${batch.documents.length} documents for ${batch.suiteId} (${batch.annotator})`,
);
