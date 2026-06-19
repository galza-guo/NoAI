function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function entryFromScoreReport(report) {
  const summary = report.summary;
  const engineVersionLabel = report.engineVersionLabel ?? report.engineVersion;
  return {
    runId: `${report.suiteId}:${engineVersionLabel}:${report.level}:${report.coverageThreshold}`,
    generatedAt: report.generatedAt,
    suiteId: report.suiteId,
    engineVersion: report.engineVersion,
    engineVersionLabel,
    level: report.level,
    coverageThreshold: report.coverageThreshold,
    redactSpanRecall: summary.redact.spans.recall,
    redactCharRecall: summary.redact.chars.recall,
    precisionProxy: summary.predicted.chars.precision,
    keepCleanRate: summary.keep.spans.cleanRate,
    redactSpansCovered: summary.redact.spans.covered,
    redactSpansTotal: summary.redact.spans.total,
    unsupportedPredictions: summary.predicted.spans.unsupported,
    predictedSpansTotal: summary.predicted.spans.total,
  };
}

export function upsertScoreHistory(history, report) {
  const entry = entryFromScoreReport(report);
  const entries = (history.entries ?? []).filter(
    (existing) => existing.runId !== entry.runId,
  );
  entries.push(entry);
  entries.sort((left, right) => {
    const dateOrder = left.generatedAt.localeCompare(right.generatedAt);
    if (dateOrder !== 0) return dateOrder;
    const suiteOrder = left.suiteId.localeCompare(right.suiteId);
    if (suiteOrder !== 0) return suiteOrder;
    const engineOrder = (left.engineVersionLabel ?? left.engineVersion).localeCompare(
      right.engineVersionLabel ?? right.engineVersion,
    );
    if (engineOrder !== 0) return engineOrder;
    return left.level.localeCompare(right.level);
  });

  return {
    schemaVersion: "1.0.0",
    updatedAt: report.generatedAt,
    entries,
  };
}

export function renderScoreHistoryMarkdown(history) {
  const lines = [
    "# Benchmark Score History",
    "",
    `Updated: ${history.updatedAt}`,
    "",
    "| Generated | Suite | Engine | Level | Span recall | Char recall | Precision proxy | Keep clean | Redact spans | Unsupported predictions |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];

  for (const entry of history.entries ?? []) {
    lines.push(
      `| ${entry.generatedAt} | ${entry.suiteId} | ${entry.engineVersionLabel ?? entry.engineVersion} | ${entry.level} | ${percent(entry.redactSpanRecall)} | ${percent(entry.redactCharRecall)} | ${percent(entry.precisionProxy)} | ${percent(entry.keepCleanRate)} | ${entry.redactSpansCovered}/${entry.redactSpansTotal} | ${entry.unsupportedPredictions}/${entry.predictedSpansTotal} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}
