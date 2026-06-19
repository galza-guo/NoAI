#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

function usage() {
  console.log(`Usage: node benchmarking/harness/index-dev-round-docs.mjs --round-dir <path>

Options:
  --round-dir <path>       Dev-round directory containing source/
`);
}

function parseArgs(argv) {
  const args = { roundDir: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--round-dir") {
      args.roundDir = resolve(argv[++index] ?? "");
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function normalizeText(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function readJsonIfExists(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

function titleFor(path) {
  const ext = extname(path);
  return basename(path, ext);
}

export function indexDevRoundDocs(options) {
  const roundDir = resolve(options.roundDir ?? "");
  if (!roundDir) throw new Error("--round-dir is required");
  const sourceDir = join(roundDir, "source");
  if (!existsSync(sourceDir)) throw new Error(`Missing source directory: ${sourceDir}`);

  const manifestPath = join(roundDir, "round-manifest.json");
  const manifest = readJsonIfExists(manifestPath) ?? {
    schemaVersion: "1.0.0",
    roundId: basename(roundDir),
    documents: [],
  };
  const sourceUrls = new Map(
    (manifest.documents ?? [])
      .filter((doc) => doc.sourcePath && doc.sourceUrl)
      .map((doc) => [basename(doc.sourcePath), doc.sourceUrl]),
  );

  const sourceFiles = readdirSync(sourceDir)
    .filter((name) => !name.startsWith("."))
    .map((name) => join(sourceDir, name))
    .filter((path) => statSync(path).isFile())
    .sort((left, right) => basename(left).localeCompare(basename(right)));

  for (const path of sourceFiles) {
    const ext = extname(path).toLocaleLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      throw new Error(
        `Unsupported source file: ${path}. Convert it to .md or .txt first.`,
      );
    }
  }

  const modelInputDir = join(roundDir, "model-input");
  mkdirSync(modelInputDir, { recursive: true });

  const documents = sourceFiles.map((sourcePath, index) => {
    const docId = `doc-${String(index + 1).padStart(3, "0")}`;
    const text = normalizeText(readFileSync(sourcePath, "utf8"));
    const markdownPath = join(modelInputDir, `${docId}.md`);
    writeFileSync(markdownPath, text, "utf8");
    const sourceName = basename(sourcePath);
    return {
      docId,
      title: titleFor(sourceName),
      category: "development",
      sourcePath,
      sourceUrl: sourceUrls.get(sourceName),
      markdownPath,
      sourceTextSha256: sha256(text),
    };
  });

  const index = {
    schemaVersion: "1.0.0",
    suiteId: manifest.roundId ?? basename(roundDir),
    createdAt: new Date().toISOString(),
    documents,
  };
  writeFileSync(
    join(modelInputDir, "document-index.json"),
    JSON.stringify(index, null, 2) + "\n",
    "utf8",
  );

  manifest.documents = documents.map((doc) => ({
    docId: doc.docId,
    title: doc.title,
    category: doc.category,
    sourcePath: doc.sourcePath,
    sourceUrl: doc.sourceUrl,
    markdownPath: doc.markdownPath,
    sourceTextSha256: doc.sourceTextSha256,
  }));
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return index;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const index = indexDevRoundDocs(args);
  console.log(`Indexed ${index.documents.length} documents for ${index.suiteId}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
