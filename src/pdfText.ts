export interface PdfTextItemLike {
  str?: string;
  transform?: ArrayLike<number>;
  width?: number;
  height?: number;
  hasEOL?: boolean;
}

interface PositionedRun {
  x: number;
  y: number;
  width: number;
  height: number;
}

function positionOf(item: PdfTextItemLike): PositionedRun | null {
  const transform = item.transform;
  if (!transform || transform.length < 6) return null;

  const x = Number(transform[4]);
  const y = Number(transform[5]);
  const width = Number(item.width ?? 0);
  const height = Math.abs(Number(item.height ?? transform[3] ?? 0));
  if (![x, y, width, height].every(Number.isFinite)) return null;

  return { x, y, width, height };
}

/**
 * Rebuild visible PDF lines from PDF.js text runs.
 *
 * PDF.js returns positioned fragments rather than paragraphs. Flattening those
 * fragments with spaces discards useful document structure such as labelled
 * party rows and signature blocks. Preserve a newline whenever the baseline
 * moves, while still joining differently styled fragments on the same line.
 */
export function reconstructPdfText(items: PdfTextItemLike[]): string {
  const lines: string[] = [];
  let line = "";
  let baseline: number | null = null;
  let lineHeight = 0;
  let lastRight: number | null = null;

  const flush = () => {
    const normalized = line.replace(/[\t ]+/g, " ").trim();
    if (normalized) lines.push(normalized);
    line = "";
    baseline = null;
    lineHeight = 0;
    lastRight = null;
  };

  for (const item of items) {
    const value = item.str ?? "";
    if (!value) continue;

    const position = positionOf(item);
    if (line && position && baseline !== null) {
      const tolerance = Math.max(1.5, Math.min(lineHeight || position.height, position.height || lineHeight) * 0.25);
      if (Math.abs(position.y - baseline) > tolerance) flush();
    }

    if (!line) {
      line = value;
    } else if (/^\s+$/.test(value)) {
      if (!/\s$/.test(line)) line += " ";
    } else {
      const gap = position && lastRight !== null ? position.x - lastRight : 0;
      const gapThreshold = Math.max(0.35, (position?.height ?? lineHeight) * 0.04);
      const needsSpace = !/\s$/.test(line) && !/^\s/.test(value) && gap > gapThreshold;
      line += `${needsSpace ? " " : ""}${value}`;
    }

    if (position) {
      baseline ??= position.y;
      lineHeight = Math.max(lineHeight, position.height);
      lastRight = position.x + position.width;
    }

    if (item.hasEOL && value.trim()) flush();
  }

  flush();
  return lines.join("\n");
}
