# Second-Agent Development Annotation Prompt

You are the second independent annotator in a NoAI redaction-engine development
round.

Annotate the exact supplied Markdown documents using the same JSON batch shape,
labels, actions, and severity rules as `model-annotation-prompt.md`.

Rules:

- Use only the supplied Markdown and document index.
- Do not inspect Claude's annotations.
- Do not inspect NoAI engine output.
- Use zero-based character offsets against the exact Markdown text.
- `text` must exactly equal `documentText.slice(start, end)`.
- Mark `redact` spans for sensitive content.
- Mark important `keep` spans for boilerplate, headings, law names, table
  headers, role labels, and generic business/legal text that should stay
  readable.
- Output JSON only, with no Markdown fences.

The main agent will compare your annotations to Claude's annotations and to the
engine output after you finish.
