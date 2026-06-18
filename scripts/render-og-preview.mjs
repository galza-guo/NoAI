import { createWriteStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { get } from "node:https";
import {
  createCanvas,
  GlobalFonts,
  loadImage,
} from "@napi-rs/canvas";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const fontDir = join(root, "node_modules", ".cache", "noai-og-fonts");
const outPath = join(root, "public", "noai-og-preview.png");

const fonts = [
  {
    family: "Newsreader",
    file: "Newsreader-500.ttf",
    url: "https://fonts.gstatic.com/s/newsreader/v26/cY9qfjOCX1hbuyalUrK49dLac06G1ZGsZBtoBCzBDXXD9JVF438wSo_ADA.ttf",
  },
  {
    family: "Newsreader",
    file: "Newsreader-700.ttf",
    url: "https://fonts.gstatic.com/s/newsreader/v26/cY9qfjOCX1hbuyalUrK49dLac06G1ZGsZBtoBCzBDXXD9JVF438wn4jADA.ttf",
  },
  {
    family: "Poppins",
    file: "Poppins-600.ttf",
    url: "https://fonts.gstatic.com/s/poppins/v24/pxiByp8kv8JHgFVrLEj6V1s.ttf",
  },
];

async function download(url, path) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await readFile(path);
    return;
  } catch {
    // Download below.
  }

  await new Promise((resolve, reject) => {
    get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        response.resume();
        return;
      }
      const stream = createWriteStream(path);
      response.pipe(stream);
      stream.on("finish", () => {
        stream.close(resolve);
      });
      stream.on("error", reject);
    }).on("error", reject);
  });
}

function drawCenteredText(ctx, text, y, options) {
  const {
    font,
    color,
    lineHeight,
    x = 600,
    lines = text.split("\n"),
  } = options;
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  lines.forEach((line, index) => {
    ctx.fillText(line, x, y + index * lineHeight);
  });
}

async function main() {
  await mkdir(fontDir, { recursive: true });
  for (const font of fonts) {
    const fontPath = join(fontDir, font.file);
    await download(font.url, fontPath);
    GlobalFonts.registerFromPath(fontPath, font.family);
  }

  const canvas = createCanvas(1200, 630);
  const ctx = canvas.getContext("2d");

  const colors = {
    bg: "#f6f8fb",
    ink: "#132033",
    muted: "#5a6472",
    redaction: "#a7342f",
    accent: "#1e3a5f",
  };

  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, 1200, 630);

  const logo = await loadImage(join(root, "public", "logo.png"));
  const logoWidth = 168;
  const logoHeight = Math.round((logo.height / logo.width) * logoWidth);
  ctx.drawImage(logo, 76, 66, logoWidth, logoHeight);

  drawCenteredText(ctx, "You don't trust AI.\nNeither do we.", 232, {
    font: '700 78px "Newsreader"',
    color: colors.ink,
    lineHeight: 86,
  });

  drawCenteredText(
    ctx,
    "Sanitize your documents locally.\nNothing leaves your device.",
    427,
    {
      font: '500 38px "Newsreader"',
      color: colors.muted,
      lineHeight: 54,
    },
  );

  // Small redaction-tape punctuation, echoing the in-app strike motif without
  // turning the card into an illustration.
  ctx.save();
  ctx.translate(510, 548);
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(178, 0);
  ctx.lineTo(166, 8);
  ctx.lineTo(-12, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  await writeFile(outPath, canvas.toBuffer("image/png"));
  console.log(outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
