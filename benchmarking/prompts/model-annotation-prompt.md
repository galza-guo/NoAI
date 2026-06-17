# Model Annotation Prompt

You are annotating a NoAI redaction benchmark document.

NoAI is a deterministic, browser-only redaction tool for business and legal
documents. Your task is to propose character-span annotations for sensitive
content that should be redacted, plus important business/legal boilerplate that
should remain readable.

## Rules

- Annotate against the exact text supplied below.
- Use zero-based character offsets.
- `start` is inclusive. `end` is exclusive.
- The `text` field must exactly equal `documentText.slice(start, end)`.
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
  "docId": "<doc-id>",
  "sourceTextSha256": "<sha256-of-exact-document-text>",
  "annotator": "<model-name>",
  "createdAt": "<YYYY-MM-DD>",
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
```

## Document Metadata

- suiteId: `<suite-id>`
- docId: `<doc-id>`
- sourceTextSha256: `<sha256>`

## Document Text

```text
<paste exact extracted benchmark text here>
```
