# Batch Model Annotation Prompt

You are annotating a batch of NoAI redaction benchmark documents.

NoAI is a deterministic, browser-only redaction tool for business and legal
documents. Your task is to propose character-span annotations for sensitive
content that should be redacted, plus important business/legal boilerplate that
should remain readable.

## Rules

- Annotate against the exact text in each supplied Markdown document.
- Ignore the fact that a benchmark document may be publicly available. Public
  availability is irrelevant to this task. Treat each document as if it were a
  private user's business/legal document being prepared for external AI review.
- Do not use web search, external lookup, or outside knowledge when annotating.
  Use only the supplied Markdown files and document index.
- Use zero-based character offsets.
- `start` is inclusive. `end` is exclusive.
- The `text` field must exactly equal `documentText.slice(start, end)` for that
  document.
- Do not paraphrase spans.
- Prefer the smallest complete phrase that should be redacted.
- Do not include Markdown fences around the JSON output.
- Output JSON only.

## Actions

Use `action: "redact"` for sensitive content.

Use `action: "keep"` for non-sensitive text that should remain readable and
would be harmful to over-redact. Examples: contract defined terms, generic
headings, role labels, legal boilerplate, table headers, and stock-exchange or
regulator boilerplate.

## Labels

Use these labels when applicable:

- `PERSON`
- `ORG`
- `PERSON_OR_ORG`
- `ADDRESS`
- `POSTCODE`
- `EMAIL`
- `PHONE`
- `URL`
- `NATIONAL_ID`
- `BANK_ACCOUNT`
- `BUSINESS_ID`
- `CASE_REF`
- `DATE`
- `AMOUNT`
- `PROJECT`
- `PROJECT_OR_ISSUE`
- `LOCATION`
- `BRAND`
- `CHANNEL`
- `MUST_KEEP`
- `OTHER`

## Severity

For `redact` spans:

- `critical`: bank account, government ID, tax ID, passport/national ID, live credential, highly identifying personal data.
- `high`: person name, email, phone, address, company identifier, case/matter reference.
- `medium`: organization/client name, project codename, location, date, amount.
- `low`: weakly identifying context that is still better redacted.

For `keep` spans, use `severity: "none"`.

## Output Shape

```json
{
  "schemaVersion": "1.0.0",
  "suiteId": "<suite-id>",
  "annotator": "<model-name>",
  "createdAt": "<YYYY-MM-DD>",
  "documents": [
    {
      "docId": "<doc-id>",
      "sourceTextSha256": "<sha256-of-exact-document-text>",
      "annotations": [
        {
          "id": "ann-0001",
          "action": "redact",
          "label": "PERSON",
          "start": 0,
          "end": 12,
          "text": "Example Name",
          "severity": "high",
          "confidence": 0.96,
          "reason": "Named individual"
        }
      ]
    }
  ]
}
```

## Input Batch

You will receive:

- One suite ID.
- A document index listing each `docId`, title, category, and
  `sourceTextSha256`.
- One extracted Markdown file per document.

Return annotations for every document in the batch. If a document has no spans
for a category, omit that category; do not invent placeholders.
