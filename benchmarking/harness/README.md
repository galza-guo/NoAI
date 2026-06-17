# Benchmark Harness

This folder holds local benchmark utilities.

The first utility, `validate-annotation-file.mjs`, checks that an annotation
file is structurally sane and that character spans match the source text.

Future harness pieces should:

- Run the current NoAI engine against a frozen suite.
- Compare engine spans with gold `redact` and `keep` spans.
- Produce aggregate reports without requiring agents to inspect sealed document
  contents.
- Compare one engine version against another.

Do not make harness scripts upload documents or call remote models.
