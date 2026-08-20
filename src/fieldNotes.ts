export type FieldNoteBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "blockquote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "image"; alt: string; src: string; caption?: string };

export interface FieldNote {
  slug: string;
  title: string;
  dateLabel: string;
  dateTime?: string;
  summary: string;
  blocks: FieldNoteBlock[];
}

interface FieldNoteMeta {
  slug?: string;
  title?: string;
  date?: string;
  datetime?: string;
  summary?: string;
}

export function parseFieldNoteMdx(source: string): FieldNote {
  const { meta, body } = parseFrontmatter(source);
  const slug = requiredMeta(meta.slug, "slug");
  const title = requiredMeta(meta.title, "title");
  const dateLabel = requiredMeta(meta.date, "date");
  const summary = requiredMeta(meta.summary, "summary");

  return {
    slug,
    title,
    dateLabel,
    dateTime: meta.datetime,
    summary,
    blocks: parseBlocks(body),
  };
}

export function renderFieldNoteArticle(note: FieldNote): string {
  return `
    <article class="field-note-article">
      ${note.blocks.map(renderFieldNoteBlock).join("")}
    </article>
  `;
}

function parseFrontmatter(source: string): { meta: FieldNoteMeta; body: string } {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("Field note is missing frontmatter.");
  }

  const meta: FieldNoteMeta = {};
  match[1].split("\n").forEach((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key === "slug") meta.slug = value;
    if (key === "title") meta.title = value;
    if (key === "date") meta.date = value;
    if (key === "datetime") meta.datetime = value;
    if (key === "summary") meta.summary = value;
  });

  return { meta, body: match[2] };
}

function requiredMeta(value: string | undefined, key: string): string {
  if (!value) throw new Error(`Field note is missing ${key}.`);
  return value;
}

function parseBlocks(body: string): FieldNoteBlock[] {
  return body
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map(parseBlock);
}

function parseBlock(chunk: string): FieldNoteBlock {
  const heading = chunk.match(/^(#{2,3})\s+(.+)$/);
  if (heading) {
    return {
      type: "heading",
      level: heading[1].length as 2 | 3,
      text: heading[2].trim(),
    };
  }

  const image = chunk.match(/^!\[([^\]]*)\]\((\S+)(?:\s+"([^"]+)")?\)$/);
  if (image) {
    return {
      type: "image",
      alt: image[1],
      src: image[2],
      caption: image[3],
    };
  }

  const lines = chunk.split("\n");
  const quoteLines = lines.map((line) => line.match(/^>\s?(.+)$/));
  if (quoteLines.every(Boolean)) {
    return {
      type: "blockquote",
      text: quoteLines.map((line) => line![1].trim()).join("\n"),
    };
  }

  const orderedItems = lines.map((line) => line.match(/^\d+\.\s+(.+)$/));
  if (orderedItems.every(Boolean)) {
    return {
      type: "list",
      ordered: true,
      items: orderedItems.map((item) => item![1].trim()),
    };
  }

  const unorderedItems = lines.map((line) => line.match(/^[-*]\s+(.+)$/));
  if (unorderedItems.every(Boolean)) {
    return {
      type: "list",
      ordered: false,
      items: unorderedItems.map((item) => item![1].trim()),
    };
  }

  return {
    type: "paragraph",
    text: chunk.replace(/\n+/g, " "),
  };
}

function renderFieldNoteBlock(block: FieldNoteBlock): string {
  if (block.type === "heading") {
    return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
  }

  if (block.type === "image") {
    const caption = block.caption
      ? `<figcaption>${escapeHtml(block.caption)}</figcaption>`
      : "";
    return `
      <figure class="field-note-figure">
        <img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" loading="lazy" />
        ${caption}
      </figure>
    `;
  }

  if (block.type === "list") {
    const tag = block.ordered ? "ol" : "ul";
    const items = block.items
      .map((item) => `<li>${renderInlineMarkdown(item)}</li>`)
      .join("");
    return `<${tag}>${items}</${tag}>`;
  }

  if (block.type === "blockquote") {
    const lines = block.text
      .split("\n")
      .map(renderInlineMarkdown)
      .join("<br>");
    return `<blockquote>${lines}</blockquote>`;
  }

  return `<p>${renderInlineMarkdown(block.text)}</p>`;
}

function renderInlineMarkdown(value: string): string {
  const tokenPattern = /(`[^`\n]+`|==[^=\n]+==|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  let html = "";
  let lastIndex = 0;

  for (const match of value.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;
    html += escapeHtml(value.slice(lastIndex, index));

    if (token.startsWith("`")) {
      html += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
    } else if (token.startsWith("==")) {
      html += `<mark>${escapeHtml(token.slice(2, -2))}</mark>`;
    } else if (token.startsWith("**")) {
      html += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
    } else {
      html += `<em>${escapeHtml(token.slice(1, -1))}</em>`;
    }

    lastIndex = index + token.length;
  }

  return html + escapeHtml(value.slice(lastIndex));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
