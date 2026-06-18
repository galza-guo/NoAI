import { describe, expect, it } from "vitest";
import { parseFieldNoteMdx, renderFieldNoteArticle } from "./fieldNotes";

const TEMPLATE_MDX = `---
slug: template
title: Field note title
date: Date
summary: A short subheading for the note.
---

Opening paragraph for the field note.

## Main section

Plain text under the main section.

![Screenshot of the redaction review](/field-notes/template.png "Caption text for the image.")

### Smaller section

Closing paragraph.
`;

describe("field note mdx", () => {
  it("parses frontmatter and supported article blocks", () => {
    const note = parseFieldNoteMdx(TEMPLATE_MDX);

    expect(note.slug).toBe("template");
    expect(note.title).toBe("Field note title");
    expect(note.dateLabel).toBe("Date");
    expect(note.summary).toBe("A short subheading for the note.");
    expect(note.blocks).toEqual([
      { type: "paragraph", text: "Opening paragraph for the field note." },
      { type: "heading", level: 2, text: "Main section" },
      { type: "paragraph", text: "Plain text under the main section." },
      {
        type: "image",
        alt: "Screenshot of the redaction review",
        src: "/field-notes/template.png",
        caption: "Caption text for the image.",
      },
      { type: "heading", level: 3, text: "Smaller section" },
      { type: "paragraph", text: "Closing paragraph." },
    ]);
  });

  it("renders the prescribed article template and escapes text", () => {
    const note = parseFieldNoteMdx(
      TEMPLATE_MDX.replace("Closing paragraph.", "Closing <script>alert(1)</script>."),
    );

    expect(renderFieldNoteArticle(note)).toContain(
      '<article class="field-note-article">',
    );
    expect(renderFieldNoteArticle(note)).toContain(
      '<figure class="field-note-figure">',
    );
    expect(renderFieldNoteArticle(note)).toContain(
      "Closing &lt;script&gt;alert(1)&lt;/script&gt;.",
    );
  });
});
