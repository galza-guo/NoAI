# Benchmark Harness

This folder holds local benchmark utilities.

`validate-annotation-file.mjs` checks that a single-document annotation file is
structurally sane and that character spans match the source text.

`validate-batch-annotation-file.mjs` checks the batch JSON returned from
`prompts/model-annotation-prompt.md` against a private suite
`model-input/document-index.json` file and the pure extracted Markdown files.

Future harness pieces should:

- Run the current NoAI engine against a frozen suite.
- Compare engine spans with gold `redact` and `keep` spans.
- Produce aggregate reports without requiring agents to inspect sealed document
  contents.
- Compare one engine version against another.

Do not make harness scripts upload documents or call remote models.
