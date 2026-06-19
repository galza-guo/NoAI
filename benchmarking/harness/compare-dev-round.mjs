#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractPredictedSpans,
  scoreDocument,
  summarizeSuiteScores,
} from "./score-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function usage() {
  console.log(`Usage: node benchmarking/harness/compare-dev-round.mjs --round-dir <path> [options]

Options:
  --round-dir <path>       Dev-round directory
  --level <level>          Engine output level to compare (default: balanced)
  --claude <path>          Claude batch annotation path
  --agent <path>           Second-agent batch annotation path
`);
}

function parseArgs(argv) {
  const args = { roundDir: "", level: "balanced", claudePath: "", agentPath: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--round-dir") {
      args.roundDir = resolve(argv[++index] ?? "");
      continue;
    }
    if (arg === "--level") {
      args.level = argv[++index] ?? "balanced";
      continue;
    }
    if (arg === "--claude") {
      args.claudePath = resolve(argv[++index] ?? "");
      continue;
    }
    if (arg === "--agent") {
      args.agentPath = resolve(argv[++index] ?? "");
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function resolveFromRoot(path) {
  return resolve(root, path);
}

function annotationKey(docId, annotation) {
  return [
    docId,
    annotation.action,
    annotation.label,
    annotation.start,
    annotation.end,
    annotation.text,
  ].join("\u0000");
}

function loadSourceTexts(index) {
  const sources = new Map();
  for (const doc of index.documents) {
    const text = readFileSync(resolveFromRoot(doc.markdownPath), "utf8");
    if (sha256(text) !== doc.sourceTextSha256) {
      throw new Error(`${doc.docId}: sourceTextSha256 does not match document index`);
    }
    sources.set(doc.docId, text);
  }
  return sources;
}

function validateBatch(batch, index, sources, role) {
  if (batch.schemaVersion !== "1.0.0") {
    throw new Error(`${role}: schemaVersion must be 1.0.0`);
  }
  if (batch.suiteId !== index.suiteId) {
    throw new Error(`${role}: suiteId mismatch`);
  }
  const indexDocs = new Map(index.documents.map((doc) => [doc.docId, doc]));
  for (const doc of batch.documents ?? []) {
    const indexDoc = indexDocs.get(doc.docId);
    if (!indexDoc) throw new Error(`${role}: unknown docId ${doc.docId}`);
    if (doc.sourceTextSha256 !== indexDoc.sourceTextSha256) {
      throw new Error(`${role}: ${doc.docId} sourceTextSha256 mismatch`);
    }
    const source = sources.get(doc.docId);
    for (const [i, ann] of (doc.annotations ?? []).entries()) {
      const where = `${role}:${doc.docId}:annotations[${i}]`;
      if (!["redact", "keep"].includes(ann.action)) {
        throw new Error(`${where}.action must be redact or keep`);
      }
      if (!Number.isInteger(ann.start) || !Number.isInteger(ann.end) || ann.end <= ann.start) {
        throw new Error(`${where} has invalid offsets`);
      }
      const actual = source.slice(ann.start, ann.end);
      if (actual !== ann.text) {
        throw new Error(
          `${where}.text does not match source span: expected ${JSON.stringify(actual)}, got ${JSON.stringify(ann.text)}`,
        );
      }
    }
  }
}

function flattenBatch(batch) {
  const items = [];
  for (const doc of batch.documents ?? []) {
    for (const annotation of doc.annotations ?? []) {
      items.push({ docId: doc.docId, ...annotation });
    }
  }
  return items;
}

function compareAnnotations(claudeBatch, agentBatch) {
  const claude = new Map(
    flattenBatch(claudeBatch).map((annotation) => [
      annotationKey(annotation.docId, annotation),
      annotation,
    ]),
  );
  const agent = new Map(
    flattenBatch(agentBatch).map((annotation) => [
      annotationKey(annotation.docId, annotation),
      annotation,
    ]),
  );

  const agreed = [];
  const claudeOnly = [];
  const agentOnly = [];
  const union = new Map();

  for (const [key, annotation] of claude) {
    union.set(key, { ...annotation, id: `merged-${String(union.size + 1).padStart(4, "0")}` });
    if (agent.has(key)) agreed.push(annotation);
    else claudeOnly.push(annotation);
  }
  for (const [key, annotation] of agent) {
    if (!union.has(key)) {
      union.set(key, { ...annotation, id: `merged-${String(union.size + 1).padStart(4, "0")}` });
    }
    if (!claude.has(key)) agentOnly.push(annotation);
  }

  return {
    agreed,
    claudeOnly,
    agentOnly,
    mergedAnnotations: [...union.values()],
  };
}

function annotationsByDoc(annotations) {
  const byDoc = new Map();
  for (const annotation of annotations) {
    const list = byDoc.get(annotation.docId) ?? [];
    list.push(annotation);
    byDoc.set(annotation.docId, list);
  }
  return byDoc;
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function markdownSummary(report) {
  const lines = [
    "# Dev Round Comparison Summary",
    "",
    `- Round: ${report.suiteId}`,
    `- Level: ${report.level}`,
    `- Engine version: ${report.engineVersionLabel ?? report.engineVersion}`,
    `- Agreed annotations: ${report.annotationComparison.agreed.length}`,
    `- Claude-only annotations: ${report.annotationComparison.claudeOnly.length}`,
    `- Agent-only annotations: ${report.annotationComparison.agentOnly.length}`,
    "",
    "## Engine Score Against Annotation Union",
    "",
    `- Redaction span recall: ${percent(report.summary.redact.spans.recall)} (${report.summary.redact.spans.covered}/${report.summary.redact.spans.total})`,
    `- Redaction character recall: ${percent(report.summary.redact.chars.recall)}`,
    `- Keep-span clean rate: ${percent(report.summary.keep.spans.cleanRate)} (${report.summary.keep.spans.clean}/${report.summary.keep.spans.total})`,
    `- Unsupported predicted spans: ${report.summary.predicted.spans.unsupported}/${report.summary.predicted.spans.total}`,
    "",
    "## By Label",
    "",
    "| Label | Spans | Covered | Partial | Missed | Span recall |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [label, bucket] of Object.entries(report.summary.byLabel).sort()) {
    lines.push(
      `| ${label} | ${bucket.total} | ${bucket.covered} | ${bucket.partial} | ${bucket.missed} | ${percent(bucket.recall)} |`,
    );
  }
  if (report.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }
  return `${lines.join("\n")}\n`;
}

function defaultAgentPath(roundDir) {
  const agentPath = join(roundDir, "annotations", "agent.batch.json");
  if (existsSync(agentPath)) return agentPath;
  const legacyCodexPath = join(roundDir, "annotations", "codex.batch.json");
  if (existsSync(legacyCodexPath)) return legacyCodexPath;
  return agentPath;
}

export function compareDevRound(options) {
  const roundDir = resolve(options.roundDir ?? "");
  if (!roundDir) throw new Error("--round-dir is required");
  const level = options.level ?? "balanced";
  const index = readJson(join(roundDir, "model-input", "document-index.json"));
  const sources = loadSourceTexts(index);
  const claudePath =
    options.claudePath || join(roundDir, "annotations", "claude.batch.json");
  const agentPath = options.agentPath || defaultAgentPath(roundDir);
  const claudeBatch = readJson(claudePath);
  const agentBatch = readJson(agentPath);
  validateBatch(claudeBatch, index, sources, "claude");
  validateBatch(agentBatch, index, sources, "agent");

  const annotationComparison = compareAnnotations(claudeBatch, agentBatch);
  const engineOutput = readJson(join(roundDir, "engine-output", `${level}.json`));
  const outputByDoc = new Map(engineOutput.outputs.map((doc) => [doc.docId, doc]));
  const mergedByDoc = annotationsByDoc(annotationComparison.mergedAnnotations);

  const documentScores = [];
  const warnings = [...(engineOutput.warnings ?? [])];
  for (const doc of index.documents) {
    const output = outputByDoc.get(doc.docId);
    if (!output) {
      warnings.push(`${doc.docId}: missing engine output`);
      continue;
    }
    const predicted = extractPredictedSpans(output.reviewDocument.segments);
    const score = scoreDocument(doc.docId, mergedByDoc.get(doc.docId) ?? [], predicted);
    documentScores.push({
      docId: doc.docId,
      title: doc.title,
      category: doc.category,
      score,
    });
  }

  const report = {
    schemaVersion: "1.0.0",
    suiteId: index.suiteId,
    level,
    engineVersion: engineOutput.engineVersion,
    engineVersionLabel: engineOutput.engineVersionLabel,
    engineVersionInfo: engineOutput.engineVersionInfo,
    generatedAt: new Date().toISOString(),
    annotationFiles: {
      claude: claudePath,
      agent: agentPath,
    },
    annotationComparison: {
      agreed: annotationComparison.agreed,
      claudeOnly: annotationComparison.claudeOnly,
      agentOnly: annotationComparison.agentOnly,
    },
    warnings,
    documents: documentScores,
    summary: summarizeSuiteScores(documentScores.map((doc) => doc.score)),
  };

  const comparisonDir = join(roundDir, "comparison");
  mkdirSync(comparisonDir, { recursive: true });
  writeFileSync(
    join(comparisonDir, "engine-gap-report.json"),
    JSON.stringify(report, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    join(comparisonDir, "round-summary.md"),
    markdownSummary(report),
    "utf8",
  );

  return report;
}

async function main() {
  const report = compareDevRound(parseArgs(process.argv.slice(2)));
  console.log(
    `Compared ${report.suiteId} at ${report.level}: redaction recall ${percent(report.summary.redact.spans.recall)}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
