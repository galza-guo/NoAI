function spanLength(span) {
  return Math.max(0, span.end - span.start);
}

function ratio(numerator, denominator) {
  return denominator === 0 ? 1 : numerator / denominator;
}

export function overlapLength(left, right) {
  return Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start));
}

function coveredChars(target, spans) {
  const intersections = spans
    .map((span) => ({
      start: Math.max(target.start, span.start),
      end: Math.min(target.end, span.end),
    }))
    .filter((span) => span.end > span.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  let total = 0;
  let cursor = -1;
  for (const span of intersections) {
    const start = Math.max(span.start, cursor);
    if (span.end > start) {
      total += span.end - start;
      cursor = span.end;
    }
  }
  return total;
}

function emptyBucket() {
  return {
    total: 0,
    covered: 0,
    partial: 0,
    missed: 0,
    charsTotal: 0,
    charsCovered: 0,
    recall: 1,
  };
}

function addGoldToBucket(bucket, annotation, coveredCharCount, threshold) {
  const length = spanLength(annotation);
  const coverage = ratio(coveredCharCount, length);
  bucket.total += 1;
  bucket.charsTotal += length;
  bucket.charsCovered += coveredCharCount;
  if (coverage >= threshold) bucket.covered += 1;
  else if (coveredCharCount > 0) bucket.partial += 1;
  else bucket.missed += 1;
  bucket.recall = ratio(bucket.covered, bucket.total);
}

export function extractPredictedSpans(segments) {
  const spans = [];
  let cursor = 0;
  for (const segment of segments) {
    if (typeof segment.value === "string" && typeof segment.kind === "string") {
      const start = cursor;
      const end = start + segment.value.length;
      spans.push({
        start,
        end,
        kind: segment.kind,
        text: segment.value,
      });
      cursor = end;
    } else {
      cursor += segment.text.length;
    }
  }
  return spans;
}

export function reconstructOriginalText(segments) {
  return segments
    .map((segment) =>
      typeof segment.value === "string" && typeof segment.kind === "string"
        ? segment.value
        : segment.text,
    )
    .join("");
}

export function scoreDocument(
  docId,
  goldAnnotations,
  predictedSpans,
  options = {},
) {
  const coverageThreshold = options.coverageThreshold ?? 0.8;
  const redactions = goldAnnotations.filter((annotation) => annotation.action === "redact");
  const keepSpans = goldAnnotations.filter((annotation) => annotation.action === "keep");
  const byLabel = {};
  const bySeverity = {};

  let redactCharsTotal = 0;
  let redactCharsCovered = 0;
  let redactCovered = 0;
  let redactPartial = 0;
  let redactMissed = 0;

  for (const annotation of redactions) {
    const covered = coveredChars(annotation, predictedSpans);
    const length = spanLength(annotation);
    const coverage = ratio(covered, length);
    redactCharsTotal += length;
    redactCharsCovered += covered;
    if (coverage >= coverageThreshold) redactCovered += 1;
    else if (covered > 0) redactPartial += 1;
    else redactMissed += 1;

    byLabel[annotation.label] ??= emptyBucket();
    bySeverity[annotation.severity] ??= emptyBucket();
    addGoldToBucket(byLabel[annotation.label], annotation, covered, coverageThreshold);
    addGoldToBucket(bySeverity[annotation.severity], annotation, covered, coverageThreshold);
  }

  let keepViolated = 0;
  let keepCharsTotal = 0;
  let keepCharsViolated = 0;
  for (const keep of keepSpans) {
    const overlap = coveredChars(keep, predictedSpans);
    keepCharsTotal += spanLength(keep);
    keepCharsViolated += overlap;
    if (overlap > 0) keepViolated += 1;
  }

  let predictedCharsTotal = 0;
  let predictedCharsOverRedact = 0;
  let predictedCharsOverKeep = 0;
  let predictedOverlappingRedact = 0;
  let predictedViolatingKeep = 0;
  let predictedUnsupported = 0;

  for (const predicted of predictedSpans) {
    const length = spanLength(predicted);
    const redactOverlap = coveredChars(predicted, redactions);
    const keepOverlap = coveredChars(predicted, keepSpans);
    predictedCharsTotal += length;
    predictedCharsOverRedact += redactOverlap;
    predictedCharsOverKeep += keepOverlap;
    if (redactOverlap > 0) predictedOverlappingRedact += 1;
    if (keepOverlap > 0) predictedViolatingKeep += 1;
    if (redactOverlap === 0 && keepOverlap === 0) predictedUnsupported += 1;
  }

  return {
    docId,
    redact: {
      spans: {
        total: redactions.length,
        covered: redactCovered,
        partial: redactPartial,
        missed: redactMissed,
        recall: ratio(redactCovered, redactions.length),
      },
      chars: {
        total: redactCharsTotal,
        covered: redactCharsCovered,
        recall: ratio(redactCharsCovered, redactCharsTotal),
      },
    },
    keep: {
      spans: {
        total: keepSpans.length,
        violated: keepViolated,
        clean: keepSpans.length - keepViolated,
        cleanRate: ratio(keepSpans.length - keepViolated, keepSpans.length),
      },
      chars: {
        total: keepCharsTotal,
        violated: keepCharsViolated,
        cleanRate: ratio(keepCharsTotal - keepCharsViolated, keepCharsTotal),
      },
    },
    predicted: {
      spans: {
        total: predictedSpans.length,
        overlappingRedact: predictedOverlappingRedact,
        violatingKeep: predictedViolatingKeep,
        unsupported: predictedUnsupported,
      },
      chars: {
        total: predictedCharsTotal,
        overlappingRedact: predictedCharsOverRedact,
        overlappingKeep: predictedCharsOverKeep,
        precision: ratio(predictedCharsOverRedact, predictedCharsTotal),
      },
    },
    byLabel,
    bySeverity,
  };
}

function aggregateBuckets(docScores, key) {
  const buckets = {};
  for (const score of docScores) {
    for (const [name, bucket] of Object.entries(score[key])) {
      buckets[name] ??= emptyBucket();
      buckets[name].total += bucket.total;
      buckets[name].covered += bucket.covered;
      buckets[name].partial += bucket.partial;
      buckets[name].missed += bucket.missed;
      buckets[name].charsTotal += bucket.charsTotal;
      buckets[name].charsCovered += bucket.charsCovered;
      buckets[name].recall = ratio(buckets[name].covered, buckets[name].total);
    }
  }
  return buckets;
}

export function summarizeSuiteScores(docScores) {
  const summary = {
    documents: docScores.length,
    redact: {
      spans: { total: 0, covered: 0, partial: 0, missed: 0, recall: 1 },
      chars: { total: 0, covered: 0, recall: 1 },
    },
    keep: {
      spans: { total: 0, violated: 0, clean: 0, cleanRate: 1 },
      chars: { total: 0, violated: 0, cleanRate: 1 },
    },
    predicted: {
      spans: {
        total: 0,
        overlappingRedact: 0,
        violatingKeep: 0,
        unsupported: 0,
      },
      chars: {
        total: 0,
        overlappingRedact: 0,
        overlappingKeep: 0,
        precision: 1,
      },
    },
    byLabel: aggregateBuckets(docScores, "byLabel"),
    bySeverity: aggregateBuckets(docScores, "bySeverity"),
  };

  for (const score of docScores) {
    summary.redact.spans.total += score.redact.spans.total;
    summary.redact.spans.covered += score.redact.spans.covered;
    summary.redact.spans.partial += score.redact.spans.partial;
    summary.redact.spans.missed += score.redact.spans.missed;
    summary.redact.chars.total += score.redact.chars.total;
    summary.redact.chars.covered += score.redact.chars.covered;

    summary.keep.spans.total += score.keep.spans.total;
    summary.keep.spans.violated += score.keep.spans.violated;
    summary.keep.spans.clean += score.keep.spans.clean;
    summary.keep.chars.total += score.keep.chars.total;
    summary.keep.chars.violated += score.keep.chars.violated;

    summary.predicted.spans.total += score.predicted.spans.total;
    summary.predicted.spans.overlappingRedact += score.predicted.spans.overlappingRedact;
    summary.predicted.spans.violatingKeep += score.predicted.spans.violatingKeep;
    summary.predicted.spans.unsupported += score.predicted.spans.unsupported;
    summary.predicted.chars.total += score.predicted.chars.total;
    summary.predicted.chars.overlappingRedact += score.predicted.chars.overlappingRedact;
    summary.predicted.chars.overlappingKeep += score.predicted.chars.overlappingKeep;
  }

  summary.redact.spans.recall = ratio(
    summary.redact.spans.covered,
    summary.redact.spans.total,
  );
  summary.redact.chars.recall = ratio(
    summary.redact.chars.covered,
    summary.redact.chars.total,
  );
  summary.keep.spans.cleanRate = ratio(summary.keep.spans.clean, summary.keep.spans.total);
  summary.keep.chars.cleanRate = ratio(
    summary.keep.chars.total - summary.keep.chars.violated,
    summary.keep.chars.total,
  );
  summary.predicted.chars.precision = ratio(
    summary.predicted.chars.overlappingRedact,
    summary.predicted.chars.total,
  );

  return summary;
}
