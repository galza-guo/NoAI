#!/usr/bin/env node
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { reconstructOriginalText } from "./score-utils.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const LEVELS = new Set(["light", "balanced", "heavy"]);

function usage() {
  console.log(`Usage: node benchmarking/harness/run-dev-round-engine.mjs --round-dir <path> [options]

Options:
  --round-dir <path>       Dev-round directory containing model-input/
  --levels <list>          Comma-separated levels (default: balanced)
`);
}

function parseArgs(argv) {
  const args = { roundDir: "", levels: ["balanced"] };
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
    if (arg === "--levels") {
      args.levels = (argv[++index] ?? "")
        .split(",")
        .map((level) => level.trim())
        .filter(Boolean);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function markdownPath(path) {
  return resolve(root, path);
}

async function runEngine(docs, level) {
  const tempDir = mkdtempSync(join(tmpdir(), "noai-dev-engine-"));
  try {
    const inputPath = join(tempDir, "input-documents.json");
    const outputPath = join(tempDir, "engine-output.json");
    const bundlePath = join(tempDir, "run-current-engine-entry.mjs");

    writeFileSync(inputPath, JSON.stringify(docs), "utf8");
    await build({
      entryPoints: [join(root, "benchmarking/harness/run-current-engine-entry.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: bundlePath,
      logLevel: "silent",
    });

    const result = spawnSync(process.execPath, [bundlePath, inputPath, outputPath, level], {
      cwd: root,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      throw new Error(
        [
          `Engine runner failed with exit code ${result.status}`,
          result.stdout.trim(),
          result.stderr.trim(),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
    return readJson(outputPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function runDevRoundEngine(options) {
  const roundDir = resolve(options.roundDir ?? "");
  if (!roundDir) throw new Error("--round-dir is required");
  const levels = options.levels ?? ["balanced"];
  for (const level of levels) {
    if (!LEVELS.has(level)) throw new Error(`Invalid level: ${level}`);
  }

  const index = readJson(join(roundDir, "model-input", "document-index.json"));
  const docs = index.documents.map((doc) => ({
    docId: doc.docId,
    title: doc.title,
    name: `${doc.docId}.md`,
    text: readFileSync(markdownPath(doc.markdownPath), "utf8"),
    markdownPath: markdownPath(doc.markdownPath),
  }));

  const outputDir = join(roundDir, "engine-output");
  mkdirSync(outputDir, { recursive: true });

  const reports = [];
  for (const level of levels) {
    const engineOutput = await runEngine(docs, level);
    const warnings = [];
    const textByDoc = new Map(docs.map((doc) => [doc.docId, doc.text]));
    for (const output of engineOutput.outputs) {
      const reconstructed = reconstructOriginalText(output.reviewDocument.segments);
      const source = textByDoc.get(output.docId);
      if (source !== reconstructed) {
        warnings.push(
          `${output.docId}: reconstructed engine text length ${reconstructed.length} differs from source length ${source?.length ?? 0}; offsets may be transformed`,
        );
      }
    }

    const firstOutput = engineOutput.outputs[0];
    const report = {
      schemaVersion: "1.0.0",
      suiteId: index.suiteId,
      level,
      engineVersion: firstOutput?.engineVersion ?? "",
      engineVersionLabel: firstOutput?.engineVersionLabel ?? firstOutput?.engineVersion ?? "",
      engineVersionInfo: firstOutput?.engineVersionInfo,
      generatedAt: new Date().toISOString(),
      warnings,
      outputs: engineOutput.outputs,
    };
    writeFileSync(
      join(outputDir, `${level}.json`),
      JSON.stringify(report, null, 2) + "\n",
      "utf8",
    );
    reports.push(report);
  }
  return reports;
}

async function main() {
  const reports = await runDevRoundEngine(parseArgs(process.argv.slice(2)));
  for (const report of reports) {
    console.log(
      `Wrote ${report.level} engine output for ${report.suiteId} (${report.outputs.length} docs)`,
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
