#!/usr/bin/env node
// Builder for NAIR-CN benchmark-maintenance annotations.
// Not for engine development rounds: this reads sealed benchmark document text.
// Computes offsets programmatically; verifies text === slice(start,end).
//
// Usage:
//   node benchmarking/harness/naicn-build.mjs [--suite benchmarking/suites/NAIR-CN-v1.0] <specModulePath> <outPath>
//
// spec default-export shape:
//   {
//     docId, annotator,
//     redact: [ { needle, label, severity, reason, all?=true } ],
//     keep:   [ { needle, label, reason, all?=false, max?=N } ],
//   }
// `all` (default true for redact, false for keep): mark every occurrence.
// When `all` is false, `max` limits occurrences (default 1) starting from the first.
// Overlaps are resolved: longer span wins; on equal length, redact beats keep.
// Output annotations are sorted by start and re-id'd sequentially.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const USAGE =
  "Usage: node benchmarking/harness/naicn-build.mjs [--suite benchmarking/suites/NAIR-CN-v1.0] <specModulePath> <outPath>";

function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }
  let suiteDir = "benchmarking/suites/NAIR-CN-v1.0";
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--suite") {
      suiteDir = argv[i + 1];
      i += 1;
      continue;
    }
    positional.push(arg);
  }
  if (positional.length !== 2 || !suiteDir) {
    console.error(USAGE);
    process.exit(1);
  }
  return { suiteDir, specPath: positional[0], outPath: positional[1] };
}

const { suiteDir, specPath, outPath } = parseArgs(process.argv.slice(2));

const IDX = JSON.parse(
  readFileSync(`${suiteDir}/model-input/document-index.json`, "utf8"),
);
const DOC_BY_ID = new Map(IDX.documents.map((d) => [d.docId, d]));

const spec = (await import(pathToFileURL(specPath).href)).default;

const doc = DOC_BY_ID.get(spec.docId);
if (!doc) throw new Error(`unknown docId ${spec.docId}`);
const text = readFileSync(doc.markdownPath, "utf8");

function allIndexes(needle) {
  const out = [];
  let from = 0;
  while (true) {
    const s = text.indexOf(needle, from);
    if (s < 0) break;
    out.push(s);
    from = s + needle.length;
  }
  return out;
}

const candidates = [];
function addList(list, action) {
  for (const item of list) {
    if (!item.needle) throw new Error(`missing needle: ${JSON.stringify(item)}`);
    const positions = allIndexes(item.needle);
    if (positions.length === 0) {
      console.error(`NOT FOUND (${action} ${item.label}): ${JSON.stringify(item.needle)}`);
      process.exit(1);
    }
    const all = item.all ?? (action === "redact");
    const max = item.max ?? 1;
    const take = all ? positions.length : Math.min(max, positions.length);
    for (let k = 0; k < take; k += 1) {
      const start = positions[k];
      const end = start + item.needle.length;
      candidates.push({
        action,
        label: item.label,
        start,
        end,
        text: text.slice(start, end),
        severity: action === "keep" ? "none" : item.severity,
        reason: item.reason,
        confidence: item.confidence,
      });
    }
  }
}
addList(spec.redact ?? [], "redact");
addList(spec.keep ?? [], "keep");

// Verify each candidate slice matches the needle exactly.
for (const c of candidates) {
  if (text.slice(c.start, c.end) !== c.text) {
    console.error(`VERIFY FAIL: ${JSON.stringify(c.text)}`);
    process.exit(1);
  }
}

// Resolve overlaps. Sort by start, then by longer-length first, redact before keep.
candidates.sort((a, b) => {
  if (a.start !== b.start) return a.start - b.start;
  const la = a.end - a.start;
  const lb = b.end - b.start;
  if (la !== lb) return lb - la; // longer first
  return a.action === "redact" ? -1 : 1; // redact first
});

function overlaps(a, b) {
  return a.start < b.end && b.start < a.end;
}

const kept = [];
for (const c of candidates) {
  if (kept.some((k) => overlaps(k, c))) continue;
  kept.push(c);
}

kept.sort((a, b) => a.start - b.start || a.end - b.end);
const annotations = kept.map((c, i) => {
  const ann = {
    id: `ann-${String(i + 1).padStart(4, "0")}`,
    action: c.action,
    label: c.label,
    start: c.start,
    end: c.end,
    text: c.text,
    severity: c.severity,
    reason: c.reason,
  };
  if (c.confidence !== undefined) ann.confidence = c.confidence;
  return ann;
});

const out = {
  schemaVersion: "1.0.0",
  suiteId: IDX.suiteId,
  docId: spec.docId,
  sourceTextSha256: doc.sourceTextSha256,
  annotator: spec.annotator,
  createdAt: "2026-06-19",
  annotations,
};

writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`${spec.docId}: wrote ${annotations.length} annotations -> ${outPath}`);
