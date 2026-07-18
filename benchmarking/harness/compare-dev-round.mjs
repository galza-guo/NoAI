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

// Two annotators rarely produce identical offsets for the same finding
// (multi-line addresses, trailing punctuation, honorifics). Treat spans as
// the same finding when they overlap substantially, so boundary preferences
// do not inflate the target set with phantom misses.
const CONSENSUS_OVERLAP_RATIO = 0.5;

function overlapRatio(left, right) {
  const intersection =
    Math.min(left.end, right.end) - Math.max(left.start, right.start);
  if (intersection <= 0) return 0;
  const union = Math.max(left.end, right.end) - Math.min(left.start, right.start);
  return union > 0 ? intersection / union : 0;
}

function annotationSortKey(annotation) {
  return [
    annotation.docId,
    annotation.action,
    annotation.start,
    annotation.end,
    annotation.label,
    annotation.severity,
    annotation.text,
  ].join("\u0000");
}

function canonicalPair(left, right) {
  return annotationSortKey(left).localeCompare(annotationSortKey(right)) <= 0
    ? [left, right]
    : [right, left];
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

// Pair up annotations from the two independent annotators symmetrically. A
// pair is a consensus finding when docId, action, label, and severity match and
// the spans overlap by at least CONSENSUS_OVERLAP_RATIO. The shared
// intersection is the headline target. Unmatched spans become leads, while
// overlapping label/severity mismatches become explicit disagreements.
// The union of two LLM annotators is NOT a trustworthy target: it maximizes
// each model's idiosyncrasies, and chasing union recall is how document-
// specific rules end up rejected at audit.
function compareAnnotations(claudeBatch, agentBatch) {
  const claudeAll = flattenBatch(claudeBatch).sort(
    (a, b) => a.docId.localeCompare(b.docId) || a.start - b.start,
  );
  const agentAll = flattenBatch(agentBatch).sort(
    (a, b) => a.docId.localeCompare(b.docId) || a.start - b.start,
  );

  const candidatePairs = [];
  for (const claude of claudeAll) {
    for (const agent of agentAll) {
      if (claude.docId !== agent.docId || claude.action !== agent.action) continue;
      const ratio = overlapRatio(claude, agent);
      if (ratio < CONSENSUS_OVERLAP_RATIO) continue;
      const [first, second] = canonicalPair(claude, agent);
      candidatePairs.push({
        claude,
        agent,
        ratio,
        compatible:
          claude.label === agent.label && claude.severity === agent.severity,
        tieBreak: `${annotationSortKey(first)}\u0001${annotationSortKey(second)}`,
      });
    }
  }
  candidatePairs.sort(
    (left, right) =>
      Number(right.compatible) - Number(left.compatible) ||
      right.ratio - left.ratio ||
      left.tieBreak.localeCompare(right.tieBreak),
  );

  const matchedClaude = new Set();
  const matchedAgent = new Set();
  const consensus = [];
  const disagreements = [];
  for (const pair of candidatePairs) {
    if (matchedClaude.has(pair.claude) || matchedAgent.has(pair.agent)) continue;
    matchedClaude.add(pair.claude);
    matchedAgent.add(pair.agent);
    const [first, second] = canonicalPair(pair.claude, pair.agent);
    if (pair.compatible) {
      const start = Math.max(first.start, second.start);
      const end = Math.min(first.end, second.end);
      const textOffset = start - first.start;
      consensus.push({
        ...first,
        id: `consensus-${String(consensus.length + 1).padStart(4, "0")}`,
        start,
        end,
        text: first.text.slice(textOffset, textOffset + (end - start)),
        annotatorSpans: [
          { start: first.start, end: first.end },
          { start: second.start, end: second.end },
        ],
        overlapRatio: Number(pair.ratio.toFixed(3)),
      });
    } else {
      disagreements.push({
        id: `disagreement-${String(disagreements.length + 1).padStart(4, "0")}`,
        docId: first.docId,
        action: first.action,
        overlapRatio: Number(pair.ratio.toFixed(3)),
        annotations: [first, second],
      });
    }
  }

  const claudeOnly = claudeAll.filter(
    (annotation) => !matchedClaude.has(annotation),
  );
  const agentOnly = agentAll.filter(
    (annotation) => !matchedAgent.has(annotation),
  );

  const leads = [
    ...claudeOnly.map((annotation) => ({ ...annotation, annotator: "claude" })),
    ...agentOnly.map((annotation) => ({ ...annotation, annotator: "agent" })),
  ].map((annotation, index) => ({
    ...annotation,
    id: `lead-${String(index + 1).padStart(4, "0")}`,
  }));

  return {
    consensus,
    claudeOnly,
    agentOnly,
    leads,
    disagreements,
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

function emptyPredictionSupport() {
  return {
    spans: { total: 0, confirmed: 0, uncertain: 0, unsupported: 0 },
    chars: {
      total: 0,
      confirmed: 0,
      uncertain: 0,
      unsupported: 0,
      confirmedPrecision: 1,
      possiblePrecision: 1,
    },
  };
}

function addPredictionSupport(target, confirmedScore, possibleScore) {
  const confirmedSpans = confirmedScore.predicted.spans.overlappingRedact;
  const possibleSpans = possibleScore.predicted.spans.overlappingRedact;
  const confirmedChars = confirmedScore.predicted.chars.overlappingRedact;
  const possibleChars = possibleScore.predicted.chars.overlappingRedact;
  const totalSpans = confirmedScore.predicted.spans.total;
  const totalChars = confirmedScore.predicted.chars.total;

  target.spans.total += totalSpans;
  target.spans.confirmed += confirmedSpans;
  target.spans.uncertain += possibleSpans - confirmedSpans;
  target.spans.unsupported += totalSpans - possibleSpans;
  target.chars.total += totalChars;
  target.chars.confirmed += confirmedChars;
  target.chars.uncertain += possibleChars - confirmedChars;
  target.chars.unsupported += totalChars - possibleChars;
  target.chars.confirmedPrecision = target.chars.total
    ? target.chars.confirmed / target.chars.total
    : 1;
  target.chars.possiblePrecision = target.chars.total
    ? (target.chars.confirmed + target.chars.uncertain) / target.chars.total
    : 1;
}

function withoutAmbiguousPredictionMetrics(score) {
  const { predicted: _predicted, ...recallAndKeepScore } = score;
  return recallAndKeepScore;
}

function combinedSeverityBucket(bySeverity, severities) {
  const combined = { total: 0, covered: 0 };
  for (const severity of severities) {
    const bucket = bySeverity?.[severity];
    if (!bucket) continue;
    combined.total += bucket.total ?? 0;
    combined.covered += bucket.covered ?? 0;
  }
  combined.recall = combined.total ? combined.covered / combined.total : 1;
  return combined;
}

function markdownSummary(report) {
  const hardSeverity = combinedSeverityBucket(report.summary.bySeverity, [
    "critical",
    "high",
  ]);
  const lines = [
    "# Dev Round Comparison Summary",
    "",
    `- Round: ${report.suiteId}`,
    `- Level: ${report.level}`,
    `- Engine version: ${report.engineVersionLabel ?? report.engineVersion}`,
    `- Consensus annotations (headline target): ${report.annotationComparison.consensus.length}`,
    `- Leads (single-annotator, excluded from headline): claude-only ${report.annotationComparison.claudeOnly.length}, agent-only ${report.annotationComparison.agentOnly.length}`,
    "",
    "## Engine Score Against Annotator Consensus",
    "",
    `- Critical/high-severity span recall: ${percent(hardSeverity.recall)} (${hardSeverity.covered}/${hardSeverity.total})`,
    `- Redaction span recall: ${percent(report.summary.redact.spans.recall)} (${report.summary.redact.spans.covered}/${report.summary.redact.spans.total})`,
    `- Redaction character recall: ${percent(report.summary.redact.chars.recall)}`,
    `- Keep-span clean rate: ${percent(report.summary.keep.spans.cleanRate)} (${report.summary.keep.spans.clean}/${report.summary.keep.spans.total})`,
    `- Prediction support: confirmed ${report.predictionSupport.spans.confirmed}, uncertain ${report.predictionSupport.spans.uncertain}, unsupported ${report.predictionSupport.spans.unsupported} of ${report.predictionSupport.spans.total}`,
    `- Character precision range: ${percent(report.predictionSupport.chars.confirmedPrecision)} confirmed to ${percent(report.predictionSupport.chars.possiblePrecision)} including uncertain findings`,
    "",
    "## By Severity",
    "",
    "| Severity | Spans | Covered | Partial | Missed | Span recall |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const [severity, bucket] of Object.entries(
    report.summary.bySeverity ?? {},
  ).sort()) {
    lines.push(
      `| ${severity} | ${bucket.total} | ${bucket.covered} | ${bucket.partial} | ${bucket.missed} | ${percent(bucket.recall)} |`,
    );
  }
  lines.push(
    "",
    "## By Label",
    "",
    "| Label | Spans | Covered | Partial | Missed | Span recall |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const [label, bucket] of Object.entries(report.summary.byLabel).sort()) {
    lines.push(
      `| ${label} | ${bucket.total} | ${bucket.covered} | ${bucket.partial} | ${bucket.missed} | ${percent(bucket.recall)} |`,
    );
  }
  lines.push(
    "",
    "## Leads",
    "",
    "Single-annotator spans are not scoring targets. Triage each lead before",
    "turning it into a finding: an unmatched span may be a real miss the other",
    "annotator overlooked, or one model's idiosyncrasy that should be dropped.",
    "",
    `- Redact leads already covered by the engine: ${report.leads.summary.redact.spans.covered}/${report.leads.summary.redact.spans.total}`,
    `- Uncovered redact leads: ${report.leads.summary.redact.spans.total - report.leads.summary.redact.spans.covered}`,
    `- Annotation disagreements needing judgment: ${report.annotationComparison.disagreements.length}`,
  );
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
  const consensusByDoc = annotationsByDoc(annotationComparison.consensus);
  const leadsByDoc = annotationsByDoc(annotationComparison.leads);
  const uncertainByDoc = annotationsByDoc([
    ...annotationComparison.leads,
    ...annotationComparison.disagreements.flatMap(
      (disagreement) => disagreement.annotations,
    ),
  ]);

  const documentScores = [];
  const headlineScores = [];
  const leadScores = [];
  const predictionSupport = emptyPredictionSupport();
  const warnings = [...(engineOutput.warnings ?? [])];
  for (const doc of index.documents) {
    const output = outputByDoc.get(doc.docId);
    if (!output) {
      warnings.push(`${doc.docId}: missing engine output`);
      continue;
    }
    const predicted = extractPredictedSpans(output.reviewDocument.segments);
    const score = scoreDocument(
      doc.docId,
      consensusByDoc.get(doc.docId) ?? [],
      predicted,
    );
    const possibleSupportScore = scoreDocument(
      doc.docId,
      [
        ...(consensusByDoc.get(doc.docId) ?? []),
        ...(uncertainByDoc.get(doc.docId) ?? []),
      ],
      predicted,
    );
    addPredictionSupport(predictionSupport, score, possibleSupportScore);
    headlineScores.push(score);
    documentScores.push({
      docId: doc.docId,
      title: doc.title,
      category: doc.category,
      score: withoutAmbiguousPredictionMetrics(score),
    });
    leadScores.push(
      scoreDocument(doc.docId, leadsByDoc.get(doc.docId) ?? [], predicted),
    );
  }

  const report = {
    schemaVersion: "1.2.0",
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
      consensus: annotationComparison.consensus,
      claudeOnly: annotationComparison.claudeOnly,
      agentOnly: annotationComparison.agentOnly,
      disagreements: annotationComparison.disagreements,
    },
    warnings,
    documents: documentScores,
    // Headline metrics: engine vs annotator-consensus spans only.
    summary: withoutAmbiguousPredictionMetrics(
      summarizeSuiteScores(headlineScores),
    ),
    predictionSupport,
    // Single-annotator spans, scored for triage only ("how many leads does
    // the engine already cover"), never a target to optimize.
    leads: {
      spans: annotationComparison.leads,
      summary: withoutAmbiguousPredictionMetrics(
        summarizeSuiteScores(leadScores),
      ),
    },
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
