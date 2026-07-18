# Dev-Loop Safety Tightening Design

## Goal

Make dev-round comparison and benchmark gating fail safely, remain neutral
between annotators, and describe uncertain findings honestly.

## Comparison design

Annotation pairing will be symmetric. Candidate pairs must share document and
action and overlap by at least 50%. Pairs are selected in descending overlap
order with deterministic tie-breaking, so swapping annotator files cannot
change the result. A headline consensus finding also requires matching label
and severity. Its scored boundary is the intersection: the text both
annotators explicitly selected. Label or severity disagreements are reported
for human triage and excluded from headline scoring.

Headline recall remains consensus-only. Prediction support is reported
separately in three groups: confirmed by consensus, uncertain support from a
lead or disagreement, and unsupported by either. Character precision becomes
a range whose lower bound counts only consensus and whose upper bound includes
uncertain findings.

## Gate design

The gate will fail closed. Its default loss allowances become zero. Invalid or
negative numeric options are configuration errors. Reports with different
suite identity, level, coverage threshold, gold totals, label totals, severity
totals, category totals, document sets, or suite fingerprints cannot be
compared.

New score reports will contain a deterministic suite fingerprint derived from
the document index and gold annotations. Legacy accepted reports without a
fingerprint remain comparable through the structural checks, with a warning;
new baselines should be regenerated to obtain the stronger check.

## Process design

Gate documentation will distinguish `PASS`, `PASS WITH WARNINGS`, and `FAIL`.
Warnings require integrator review and do not constitute an unattended clean
pass. Stopword additions move out of the unlimited low-risk vocabulary lane
because they suppress detections. Gate-level instructions will say to run all
levels that have accepted baselines, currently Balanced.

## Verification

Tests will first reproduce annotator-order dependence, lead misclassification,
changed-target PASS behavior, permissive defaults, and invalid numeric options.
After implementation, targeted harness tests, the complete test suite, build,
engine-version check, and diff checks will run.
