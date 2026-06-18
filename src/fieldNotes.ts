export type FieldNoteBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
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

  return `<p>${renderInlineMarkdown(block.text)}</p>`;
}

function renderInlineMarkdown(value: string): string {
  let html = "";
  let index = 0;

  while (index < value.length) {
    const open = value.indexOf("*", index);
    if (open === -1) {
      html += escapeHtml(value.slice(index));
      break;
    }

    const close = value.indexOf("*", open + 1);
    const content = close === -1 ? "" : value.slice(open + 1, close);

    if (close === -1 || content.length === 0 || content.trim() !== content) {
      html += escapeHtml(value.slice(index, open + 1));
      index = open + 1;
      continue;
    }

    html += escapeHtml(value.slice(index, open));
    html += `<em>${escapeHtml(content)}</em>`;
    index = close + 1;
  }

  return html;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
