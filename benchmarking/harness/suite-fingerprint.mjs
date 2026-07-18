import { createHash } from "node:crypto";

function annotationKey(annotation) {
  return [
    annotation.start,
    annotation.end,
    annotation.action,
    annotation.label,
    annotation.severity,
    annotation.text,
  ].join("\u0000");
}

export function createSuiteFingerprint(target) {
  const normalized = {
    suiteId: target.suiteId,
    documents: [...target.documents]
      .sort((left, right) => left.docId.localeCompare(right.docId))
      .map((doc) => ({
        docId: doc.docId,
        sourceTextSha256: doc.sourceTextSha256,
        category: doc.category ?? null,
        annotations: [...doc.annotations]
          .sort((left, right) =>
            annotationKey(left).localeCompare(annotationKey(right)),
          )
          .map((annotation) => ({
            action: annotation.action,
            label: annotation.label,
            severity: annotation.severity,
            start: annotation.start,
            end: annotation.end,
            text: annotation.text,
          })),
      })),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
