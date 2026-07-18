#!/usr/bin/env node
// Hard gate for dev-loop rounds: compares a candidate NAIR score report
// against the last ACCEPTED score report and fails on regressions the
// aggregate headline number hides (per-label, per-severity, per-category,
// keep-span violations, precision).
//
// Motivation: the engine is deterministic and the suite is frozen, so any
// covered-span loss between two reports is a real regression, not noise.
// Workers historically gated only on overall span recall, which let a
// per-label ORG regression (general r32) and a compounding collapse
// (r33-r34, 69.7% -> 54.5%) ride through to audit. This script makes the
// auditor's by-breakdown check a precondition for starting the next loop.
//
// Workflow:
//   1. Integrator keeps the last accepted full score report per suite/level
//      (e.g. reports/accepted-score-balanced.json, copied on acceptance).
//   2. Worker scores the candidate engine with score-current-engine.mjs
//      into their round folder.
//   3. Worker runs this gate. Exit 0 = clean pass; exit 1 = revert; exit 2 =
//      configuration error; exit 3 = integrator review required for warnings.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.log(`Usage: node benchmarking/harness/gate-dev-round.mjs --baseline <accepted-report.json> --candidate <candidate-report.json> [options]

Compares two score-current-engine.mjs JSON reports for the SAME suite and
level. Prints a verdict with reasons and exits 0 (pass), 1 (fail), 2
(usage/config error), or 3 (warnings require integrator review).

Options:
  --baseline <path>              Last accepted score report JSON (required)
  --candidate <path>             Candidate score report JSON (required)
  --out <path>                   Write the gate report as Markdown
  --json <path>                  Write the gate report as JSON
  --max-overall-span-loss <n>    Overall covered redact spans may drop by at
                                 most n before FAIL (default 0)
  --max-label-span-loss <n>      A single label may lose at most n covered
                                 spans before FAIL; smaller losses WARN
                                 (default 0)
  --max-severity-span-loss <n>   critical/high severities may lose at most n
                                 covered spans before FAIL (default 0)
  --max-category-span-loss <n>   A document category may lose at most n
                                 covered spans before FAIL; smaller losses
                                 WARN (default 0)
  --max-keep-violation-gain <n>  Keep-span violations may increase by at most
                                 n before FAIL (default 0)
  --max-precision-drop <x>       Char precision proxy may drop by at most x
                                 (fraction, e.g. 0.03) before FAIL; tolerated
                                 drops WARN (default 0)
`);
}

function parseArgs(argv) {
  const args = {
    baseline: "",
    candidate: "",
    out: "",
    json: "",
    maxOverallSpanLoss: 0,
    maxLabelSpanLoss: 0,
    maxSeveritySpanLoss: 0,
    maxCategorySpanLoss: 0,
    maxKeepViolationGain: 0,
    maxPrecisionDrop: 0,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--baseline") args.baseline = argv[++index];
    else if (arg === "--candidate") args.candidate = argv[++index];
    else if (arg === "--out") args.out = argv[++index];
    else if (arg === "--json") args.json = argv[++index];
    else if (arg === "--max-overall-span-loss")
      args.maxOverallSpanLoss = Number(argv[++index]);
    else if (arg === "--max-label-span-loss")
      args.maxLabelSpanLoss = Number(argv[++index]);
    else if (arg === "--max-severity-span-loss")
      args.maxSeveritySpanLoss = Number(argv[++index]);
    else if (arg === "--max-category-span-loss")
      args.maxCategorySpanLoss = Number(argv[++index]);
    else if (arg === "--max-keep-violation-gain")
      args.maxKeepViolationGain = Number(argv[++index]);
    else if (arg === "--max-precision-drop")
      args.maxPrecisionDrop = Number(argv[++index]);
    else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(2);
    }
  }
  return args;
}

const HARD_SEVERITIES = ["critical", "high"];
const COUNT_CONFIG_FIELDS = [
  "maxOverallSpanLoss",
  "maxLabelSpanLoss",
  "maxSeveritySpanLoss",
  "maxCategorySpanLoss",
  "maxKeepViolationGain",
];

function validateConfig(config) {
  for (const field of COUNT_CONFIG_FIELDS) {
    if (!Number.isInteger(config[field]) || config[field] < 0) {
      throw new Error(`${field} must be a non-negative integer.`);
    }
  }
  if (!Number.isFinite(config.maxPrecisionDrop) || config.maxPrecisionDrop < 0) {
    throw new Error("maxPrecisionDrop must be a non-negative number.");
  }
}

function categoryTotals(report) {
  const byCategory = new Map();
  for (const doc of report.documents ?? []) {
    const category = doc.category ?? "uncategorized";
    const spans = doc.score?.redact?.spans ?? { total: 0, covered: 0 };
    const bucket = byCategory.get(category) ?? { total: 0, covered: 0 };
    bucket.total += spans.total ?? 0;
    bucket.covered += spans.covered ?? 0;
    byCategory.set(category, bucket);
  }
  return byCategory;
}

function formatDelta(value) {
  return value > 0 ? `+${value}` : `${value}`;
}

function assertEqualTotal(name, baselineValue, candidateValue) {
  if (baselineValue !== candidateValue) {
    throw new Error(
      `Baseline and candidate reports disagree on ${name}: ` +
        `${baselineValue} vs ${candidateValue}. The benchmark target changed; ` +
        `create a new accepted baseline before running the gate.`,
    );
  }
}

function assertEqualBucketTotals(name, baselineBuckets, candidateBuckets) {
  const keys = new Set([
    ...Object.keys(baselineBuckets ?? {}),
    ...Object.keys(candidateBuckets ?? {}),
  ]);
  for (const key of [...keys].sort()) {
    assertEqualTotal(
      `${name} ${key} gold span total`,
      baselineBuckets?.[key]?.total ?? 0,
      candidateBuckets?.[key]?.total ?? 0,
    );
  }
}

function documentTargets(report) {
  return new Map(
    (report.documents ?? []).map((doc) => [
      doc.docId,
      {
        category: doc.category ?? "uncategorized",
        redactTotal: doc.score?.redact?.spans?.total ?? 0,
        keepTotal: doc.score?.keep?.spans?.total ?? 0,
      },
    ]),
  );
}

function assertComparableTargets(baseline, candidate, warnings) {
  assertEqualTotal(
    "gold redact span total",
    baseline.summary.redact.spans.total,
    candidate.summary.redact.spans.total,
  );
  assertEqualTotal(
    "gold keep span total",
    baseline.summary.keep.spans.total,
    candidate.summary.keep.spans.total,
  );
  assertEqualBucketTotals(
    "label",
    baseline.summary.byLabel,
    candidate.summary.byLabel,
  );
  assertEqualBucketTotals(
    "severity",
    baseline.summary.bySeverity,
    candidate.summary.bySeverity,
  );

  const baselineDocs = documentTargets(baseline);
  const candidateDocs = documentTargets(candidate);
  assertEqualTotal("document count", baselineDocs.size, candidateDocs.size);
  for (const [docId, base] of baselineDocs) {
    const cand = candidateDocs.get(docId);
    if (!cand) {
      throw new Error(`Candidate report is missing benchmark document ${docId}.`);
    }
    if (base.category !== cand.category) {
      throw new Error(
        `Benchmark document ${docId} changed category: ` +
          `${base.category} vs ${cand.category}.`,
      );
    }
    assertEqualTotal(
      `${docId} gold redact span total`,
      base.redactTotal,
      cand.redactTotal,
    );
    assertEqualTotal(
      `${docId} gold keep span total`,
      base.keepTotal,
      cand.keepTotal,
    );
  }

  if (baseline.suiteFingerprint && candidate.suiteFingerprint) {
    if (baseline.suiteFingerprint !== candidate.suiteFingerprint) {
      throw new Error(
        `Baseline and candidate reports disagree on suite fingerprint: ` +
          `${baseline.suiteFingerprint} vs ${candidate.suiteFingerprint}.`,
      );
    }
  } else {
    warnings.push(
      "One or both reports lack a suite fingerprint. Structural target checks " +
        "passed, but regenerate the accepted baseline for full identity checking.",
    );
  }
}

export function gateReports(baseline, candidate, options = {}) {
  const config = {
    maxOverallSpanLoss: options.maxOverallSpanLoss ?? 0,
    maxLabelSpanLoss: options.maxLabelSpanLoss ?? 0,
    maxSeveritySpanLoss: options.maxSeveritySpanLoss ?? 0,
    maxCategorySpanLoss: options.maxCategorySpanLoss ?? 0,
    maxKeepViolationGain: options.maxKeepViolationGain ?? 0,
    maxPrecisionDrop: options.maxPrecisionDrop ?? 0,
  };
  validateConfig(config);

  const failures = [];
  const warnings = [];

  for (const field of ["suiteId", "level", "coverageThreshold"]) {
    if (baseline[field] !== candidate[field]) {
      throw new Error(
        `Baseline and candidate reports disagree on ${field}: ` +
          `${baseline[field]} vs ${candidate[field]}. Gate reports must ` +
          `compare the same suite, level, and coverage threshold.`,
      );
    }
  }

  assertComparableTargets(baseline, candidate, warnings);

  const baseSpans = baseline.summary.redact.spans;
  const candSpans = candidate.summary.redact.spans;
  const overallLoss = baseSpans.covered - candSpans.covered;
  if (overallLoss > config.maxOverallSpanLoss) {
    failures.push(
      `Overall covered redact spans dropped ${baseSpans.covered} -> ` +
        `${candSpans.covered} (${formatDelta(-overallLoss)}), more than the ` +
        `allowed ${config.maxOverallSpanLoss}.`,
    );
  } else if (overallLoss > 0) {
    warnings.push(
      `Overall covered redact spans dropped ${baseSpans.covered} -> ` +
        `${candSpans.covered} (${formatDelta(-overallLoss)}).`,
    );
  }

  const baseKeep = baseline.summary.keep.spans;
  const candKeep = candidate.summary.keep.spans;
  const keepGain = (candKeep.violated ?? 0) - (baseKeep.violated ?? 0);
  if (keepGain > config.maxKeepViolationGain) {
    failures.push(
      `Keep-span violations increased ${baseKeep.violated} -> ` +
        `${candKeep.violated} (${formatDelta(keepGain)}), more than the ` +
        `allowed ${config.maxKeepViolationGain}.`,
    );
  } else if (keepGain > 0) {
    warnings.push(
      `Keep-span violations increased ${baseKeep.violated} -> ` +
        `${candKeep.violated} (${formatDelta(keepGain)}).`,
    );
  }

  const basePrecision = baseline.summary.predicted.chars.precision ?? 0;
  const candPrecision = candidate.summary.predicted.chars.precision ?? 0;
  const precisionDrop = basePrecision - candPrecision;
  if (precisionDrop > config.maxPrecisionDrop) {
    failures.push(
      `Char precision proxy dropped ${(basePrecision * 100).toFixed(1)}% -> ` +
        `${(candPrecision * 100).toFixed(1)}%, more than the allowed ` +
        `${(config.maxPrecisionDrop * 100).toFixed(1)} points.`,
    );
  } else if (precisionDrop > 0) {
    warnings.push(
      `Char precision proxy dropped ${(basePrecision * 100).toFixed(1)}% -> ` +
        `${(candPrecision * 100).toFixed(1)}%.`,
    );
  }

  const baseByLabel = baseline.summary.byLabel ?? {};
  const candByLabel = candidate.summary.byLabel ?? {};
  const labelRows = [];
  for (const label of Object.keys(baseByLabel).sort()) {
    const base = baseByLabel[label];
    const cand = candByLabel[label] ?? { total: 0, covered: 0 };
    const loss = (base.covered ?? 0) - (cand.covered ?? 0);
    labelRows.push({
      label,
      baseCovered: base.covered ?? 0,
      candCovered: cand.covered ?? 0,
      total: base.total ?? 0,
    });
    if (loss > config.maxLabelSpanLoss) {
      failures.push(
        `Label ${label} lost ${loss} covered spans (${base.covered} -> ` +
          `${cand.covered} of ${base.total}), more than the allowed ` +
          `${config.maxLabelSpanLoss}.`,
      );
    } else if (loss > 0) {
      warnings.push(
        `Label ${label} lost ${loss} covered span(s) (${base.covered} -> ` +
          `${cand.covered} of ${base.total}).`,
      );
    }
  }

  const baseBySeverity = baseline.summary.bySeverity ?? {};
  const candBySeverity = candidate.summary.bySeverity ?? {};
  for (const severity of HARD_SEVERITIES) {
    const base = baseBySeverity[severity];
    if (!base) continue;
    const cand = candBySeverity[severity] ?? { total: 0, covered: 0 };
    const loss = (base.covered ?? 0) - (cand.covered ?? 0);
    if (loss > config.maxSeveritySpanLoss) {
      failures.push(
        `Severity ${severity} lost ${loss} covered spans (${base.covered} ` +
          `-> ${cand.covered} of ${base.total}), more than the allowed ` +
          `${config.maxSeveritySpanLoss}.`,
      );
    } else if (loss > 0) {
      warnings.push(
        `Severity ${severity} lost ${loss} covered span(s) ` +
          `(${base.covered} -> ${cand.covered} of ${base.total}).`,
      );
    }
  }

  const baseByCategory = categoryTotals(baseline);
  const candByCategory = categoryTotals(candidate);
  for (const [category, base] of [...baseByCategory.entries()].sort()) {
    const cand = candByCategory.get(category) ?? { total: 0, covered: 0 };
    const loss = base.covered - cand.covered;
    if (loss > config.maxCategorySpanLoss) {
      failures.push(
        `Category ${category} lost ${loss} covered spans (${base.covered} ` +
          `-> ${cand.covered} of ${base.total}), more than the allowed ` +
          `${config.maxCategorySpanLoss}.`,
      );
    } else if (loss > 0) {
      warnings.push(
        `Category ${category} lost ${loss} covered span(s) (${base.covered} ` +
          `-> ${cand.covered} of ${base.total}).`,
      );
    }
  }

  const verdict =
    failures.length > 0
      ? "FAIL"
      : warnings.length > 0
        ? "PASS WITH WARNINGS"
        : "PASS";
  return {
    verdict,
    failures,
    warnings,
    config,
    suiteId: baseline.suiteId,
    level: baseline.level,
    baselineEngine: baseline.engineVersionLabel ?? baseline.engineVersion,
    candidateEngine: candidate.engineVersionLabel ?? candidate.engineVersion,
    overall: {
      baselineCovered: baseSpans.covered,
      candidateCovered: candSpans.covered,
      total: baseSpans.total,
      baselineKeepViolations: baseKeep.violated ?? 0,
      candidateKeepViolations: candKeep.violated ?? 0,
      baselinePrecision: basePrecision,
      candidatePrecision: candPrecision,
    },
    labels: labelRows,
  };
}

export function renderGateMarkdown(result) {
  const lines = [
    `# Dev-Round Gate: ${result.verdict}`,
    "",
    `- Suite: ${result.suiteId} (${result.level})`,
    `- Baseline: ${result.baselineEngine}`,
    `- Candidate: ${result.candidateEngine}`,
    `- Overall covered redact spans: ${result.overall.baselineCovered} -> ` +
      `${result.overall.candidateCovered} of ${result.overall.total}`,
    `- Keep-span violations: ${result.overall.baselineKeepViolations} -> ` +
      `${result.overall.candidateKeepViolations}`,
    `- Char precision proxy: ` +
      `${(result.overall.baselinePrecision * 100).toFixed(1)}% -> ` +
      `${(result.overall.candidatePrecision * 100).toFixed(1)}%`,
    "",
  ];
  if (result.failures.length > 0) {
    lines.push("## Failures", "");
    for (const failure of result.failures) lines.push(`- ${failure}`);
    lines.push("");
  }
  if (result.warnings.length > 0) {
    lines.push("## Warnings", "");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  if (result.failures.length === 0 && result.warnings.length === 0) {
    lines.push("No regressions detected against the accepted baseline.", "");
  }
  return lines.join("\n");
}

export function exitCodeForVerdict(verdict) {
  if (verdict === "PASS") return 0;
  if (verdict === "FAIL") return 1;
  if (verdict === "PASS WITH WARNINGS") return 3;
  throw new Error(`Unknown gate verdict: ${verdict}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.baseline || !args.candidate) {
    usage();
    process.exit(2);
  }
  let baseline;
  let candidate;
  try {
    baseline = JSON.parse(readFileSync(args.baseline, "utf8"));
    candidate = JSON.parse(readFileSync(args.candidate, "utf8"));
  } catch (error) {
    console.error(`Failed to read reports: ${error.message}`);
    process.exit(2);
  }

  let result;
  try {
    result = gateReports(baseline, candidate, args);
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  const markdown = renderGateMarkdown(result);
  console.log(markdown);
  if (args.out) writeFileSync(args.out, `${markdown}\n`);
  if (args.json) writeFileSync(args.json, `${JSON.stringify(result, null, 2)}\n`);
  process.exit(exitCodeForVerdict(result.verdict));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
