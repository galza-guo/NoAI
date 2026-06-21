#!/usr/bin/env node
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import {
  extractPredictedSpans,
  reconstructOriginalText,
  scoreDocument,
  summarizeSuiteScores,
} from "./score-utils.mjs";
import {
  renderScoreHistoryMarkdown,
  upsertScoreHistory,
} from "./score-history.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");

function usage() {
  console.log(`Usage: node benchmarking/harness/score-current-engine.mjs [options]

Options:
  --suite <path>                 Suite directory (default: benchmarking/suites/benchmark-v1.0)
  --level <light|balanced|heavy> Redaction level to score (default: balanced)
  --out <path>                   JSON report path (default: <suite>/reports/current-engine-score-<level>.json)
  --history <path>               JSON history path (default: <suite>/reports/score-history.json)
  --no-history                   Do not update score history
  --coverage-threshold <number>  Span recall threshold (default: 0.8)
`);
}

function parseArgs(argv) {
  const args = {
    suite: join(root, "benchmarking/suites/benchmark-v1.0"),
    level: "balanced",
    out: "",
    history: "",
    recordHistory: true,
    coverageThreshold: 0.8,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--suite") {
      args.suite = resolve(argv[++index]);
      continue;
    }
    if (arg === "--level") {
      args.level = argv[++index];
      continue;
    }
    if (arg === "--out") {
      args.out = resolve(argv[++index]);
      continue;
    }
    if (arg === "--history") {
      args.history = resolve(argv[++index]);
      continue;
    }
    if (arg === "--no-history") {
      args.recordHistory = false;
      continue;
    }
    if (arg === "--coverage-threshold") {
      args.coverageThreshold = Number(argv[++index]);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!["light", "balanced", "heavy"].includes(args.level)) {
    throw new Error(`Invalid level: ${args.level}`);
  }
  if (!Number.isFinite(args.coverageThreshold) || args.coverageThreshold <= 0) {
    throw new Error("--coverage-threshold must be a positive number");
  }
  if (!args.out) {
    args.out = join(args.suite, "reports", `current-engine-score-${args.level}.json`);
  }
  if (!args.history) {
    args.history = join(args.suite, "reports", "score-history.json");
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function resolveSuitePath(suite, maybeRelativePath) {
  if (isAbsolute(maybeRelativePath)) return maybeRelativePath;

  const suiteName = basename(suite);
  const suiteRelativePrefix = `benchmarking/suites/${suiteName}/`;
  if (maybeRelativePath.startsWith(suiteRelativePrefix)) {
    return join(suite, maybeRelativePath.slice(suiteRelativePrefix.length));
  }

  const rootPath = resolve(root, maybeRelativePath);
  if (existsSync(rootPath)) return rootPath;

  return resolve(suite, maybeRelativePath);
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function f1(precision, recall) {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

async function runEngine(rootDir, docs, level) {
  const tempDir = mkdtempSync(join(tmpdir(), "noai-benchmark-"));
  try {
    const inputPath = join(tempDir, "input-documents.json");
    const outputPath = join(tempDir, "engine-output.json");
    const bundlePath = join(tempDir, "run-current-engine-entry.mjs");

    writeFileSync(inputPath, JSON.stringify(docs), "utf8");
    await build({
      entryPoints: [join(rootDir, "benchmarking/harness/run-current-engine-entry.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: bundlePath,
      logLevel: "silent",
    });

    const result = spawnSync(process.execPath, [bundlePath, inputPath, outputPath, level], {
      cwd: rootDir,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(
        [
          `Engine runner failed with exit code ${result.status}`,
          result.stdout.trim(),
          result.stderr.trim(),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
    return readJson(outputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function makeMarkdownReport(report) {
  const summary = report.summary;
  const precision = summary.predicted.chars.precision;
  const recall = summary.redact.chars.recall;
  const score = f1(precision, recall);

  const lines = [
    "# Current Engine Benchmark Score",
    "",
    `- Suite: ${report.suiteId}`,
    `- Level: ${report.level}`,
    `- Engine version: ${report.engineVersionLabel ?? report.engineVersion}`,
    `- Coverage threshold: ${(report.coverageThreshold * 100).toFixed(0)}% of each gold span`,
    "",
    "## Summary",
    "",
    `- Redaction span recall: ${percent(summary.redact.spans.recall)} (${summary.redact.spans.covered}/${summary.redact.spans.total})`,
    `- Redaction character recall: ${percent(summary.redact.chars.recall)}`,
    `- Precision proxy by characters: ${percent(summary.predicted.chars.precision)}`,
    `- Character F1: ${percent(score)}`,
    `- Keep-span clean rate: ${percent(summary.keep.spans.cleanRate)} (${summary.keep.spans.clean}/${summary.keep.spans.total} untouched)`,
    `- Unsupported predicted spans: ${summary.predicted.spans.unsupported}/${summary.predicted.spans.total}`,
    "",
    "## By Severity",
    "",
    "| Severity | Spans | Covered | Partial | Missed | Span recall | Character recall |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const [severity, bucket] of Object.entries(summary.bySeverity).sort()) {
    lines.push(
      `| ${severity} | ${bucket.total} | ${bucket.covered} | ${bucket.partial} | ${bucket.missed} | ${percent(bucket.recall)} | ${percent(bucket.charsCovered / bucket.charsTotal)} |`,
    );
  }

  lines.push(
    "",
    "## By Label",
    "",
    "| Label | Spans | Covered | Partial | Missed | Span recall | Character recall |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const [label, bucket] of Object.entries(summary.byLabel).sort(
    (left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]),
  )) {
    lines.push(
      `| ${label} | ${bucket.total} | ${bucket.covered} | ${bucket.partial} | ${bucket.missed} | ${percent(bucket.recall)} | ${percent(bucket.charsCovered / bucket.charsTotal)} |`,
    );
  }

  lines.push(
    "",
    "## By Document",
    "",
    "| Document | Redact recall | Char recall | Precision proxy | Keep clean | Predictions | Unsupported |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const doc of report.documents) {
    lines.push(
      `| ${doc.docId} | ${percent(doc.score.redact.spans.recall)} | ${percent(doc.score.redact.chars.recall)} | ${percent(doc.score.predicted.chars.precision)} | ${percent(doc.score.keep.spans.cleanRate)} | ${doc.score.predicted.spans.total} | ${doc.score.predicted.spans.unsupported} |`,
    );
  }

  if (report.warnings.length > 0) {
    lines.push("", "## Warnings", "");
    for (const warning of report.warnings) lines.push(`- ${warning}`);
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const suite = args.suite;
  const index = readJson(join(suite, "model-input/document-index.json"));
  const manifest = readJson(join(suite, "manifest.json"));

  const docs = index.documents.map((doc) => {
    const markdownPath = resolveSuitePath(suite, doc.markdownPath);
    return {
      docId: doc.docId,
      title: doc.title,
      name: `${doc.docId}.md`,
      text: readFileSync(markdownPath, "utf8"),
      markdownPath,
    };
  });

  const engineOutput = await runEngine(root, docs, args.level);
  const outputByDoc = new Map(engineOutput.outputs.map((doc) => [doc.docId, doc]));
  const manifestByDoc = new Map(manifest.documents.map((doc) => [doc.docId, doc]));
  const documentReports = [];
  const warnings = [];

  for (const doc of docs) {
    const goldPath =
      manifestByDoc.get(doc.docId)?.paths?.gold ??
      join(suite, "gold", `${doc.docId}.gold.json`);
    const gold = readJson(resolveSuitePath(suite, goldPath));
    const output = outputByDoc.get(doc.docId);
    if (!output) throw new Error(`Engine output missing ${doc.docId}`);
    const reviewDocument = output.reviewDocument;
    const reconstructed = reconstructOriginalText(reviewDocument.segments);
    if (reconstructed !== doc.text) {
      warnings.push(
        `${doc.docId}: reconstructed engine text length ${reconstructed.length} differs from source length ${doc.text.length}; offsets may be transformed`,
      );
    }
    const predicted = extractPredictedSpans(reviewDocument.segments);
    const score = scoreDocument(doc.docId, gold.annotations, predicted, {
      coverageThreshold: args.coverageThreshold,
    });
    documentReports.push({
      docId: doc.docId,
      title: doc.title,
      category: manifestByDoc.get(doc.docId)?.category,
      goldAnnotations: gold.annotations.length,
      predictedSpans: predicted.length,
      score,
    });
  }

  const summary = summarizeSuiteScores(documentReports.map((doc) => doc.score));
  const firstOutput = engineOutput.outputs[0];
  const engineVersion = firstOutput?.engineVersion ?? "unknown";
  const engineVersionLabel = firstOutput?.engineVersionLabel ?? engineVersion;
  const report = {
    suiteId: index.suiteId,
    level: args.level,
    engineVersion,
    engineVersionLabel,
    engineVersionInfo: firstOutput?.engineVersionInfo,
    coverageThreshold: args.coverageThreshold,
    generatedAt: new Date().toISOString(),
    summary,
    documents: documentReports,
    warnings,
  };

  writeFileSync(args.out, JSON.stringify(report, null, 2) + "\n", "utf8");
  const markdownOut = args.out.replace(/\.json$/i, ".md");
  writeFileSync(markdownOut, makeMarkdownReport(report), "utf8");

  let historyOut = "";
  let historyMarkdownOut = "";
  if (args.recordHistory) {
    const existingHistory = existsSync(args.history)
      ? readJson(args.history)
      : { schemaVersion: "1.0.0", updatedAt: report.generatedAt, entries: [] };
    const updatedHistory = upsertScoreHistory(existingHistory, report);
    historyOut = args.history;
    historyMarkdownOut = args.history.replace(/\.json$/i, ".md");
    writeFileSync(historyOut, JSON.stringify(updatedHistory, null, 2) + "\n", "utf8");
    writeFileSync(historyMarkdownOut, renderScoreHistoryMarkdown(updatedHistory), "utf8");
  }

  console.log(`Wrote ${args.out}`);
  console.log(`Wrote ${markdownOut}`);
  if (historyOut) {
    console.log(`Updated ${historyOut}`);
    console.log(`Updated ${historyMarkdownOut}`);
  }
  console.log(
    `${args.level} recall=${percent(summary.redact.spans.recall)} charRecall=${percent(summary.redact.chars.recall)} precision=${percent(summary.predicted.chars.precision)} keepClean=${percent(summary.keep.spans.cleanRate)}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
