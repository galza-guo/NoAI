#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const DEFAULT_PROMPT_PATH = join(root, "benchmarking/prompts/model-annotation-prompt.md");

function usage() {
  console.log(`Usage: node benchmarking/harness/run-claude-annotator.mjs --round-dir <path>

Options:
  --round-dir <path>       Dev-round directory containing model-input/
  --out <path>             Output path (default: <round-dir>/annotations/claude.batch.json)
`);
}

function parseArgs(argv) {
  const args = { roundDir: "", out: "" };
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
    if (arg === "--out") {
      args.out = resolve(argv[++index] ?? "");
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function defaultRunner(command, args, options) {
  return spawnSync(command, args, options);
}

function resolveFromRoot(path) {
  return resolve(root, path);
}

export function buildClaudeAnnotationPrompt(options) {
  const roundDir = resolve(options.roundDir ?? "");
  if (!roundDir) throw new Error("--round-dir is required");
  const promptTemplate = readFileSync(
    options.promptPath ?? DEFAULT_PROMPT_PATH,
    "utf8",
  );
  const index = readJson(join(roundDir, "model-input", "document-index.json"));
  const documents = index.documents.map((doc) => ({
    ...doc,
    text: readFileSync(resolveFromRoot(doc.markdownPath), "utf8"),
  }));

  return [
    promptTemplate.trimEnd(),
    "",
    "## Round Metadata",
    "",
    `Suite ID: ${index.suiteId}`,
    "",
    "Document index:",
    "",
    "```json",
    JSON.stringify(index, null, 2),
    "```",
    "",
    "## Documents",
    "",
    ...documents.flatMap((doc) => [
      `### ${doc.docId}: ${doc.title ?? doc.docId}`,
      "",
      "```text",
      doc.text,
      "```",
      "",
    ]),
  ].join("\n");
}

export function runClaudeAnnotator(options) {
  const roundDir = resolve(options.roundDir ?? "");
  if (!roundDir) throw new Error("--round-dir is required");
  const outputPath =
    options.out ?? join(roundDir, "annotations", "claude.batch.json");
  mkdirSync(dirname(outputPath), { recursive: true });

  const prompt = buildClaudeAnnotationPrompt(options);
  const runner = options.runner ?? defaultRunner;
  const result = runner("claude", ["-p", prompt], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      [
        `claude -p failed with exit code ${result.status}`,
        result.stdout?.trim(),
        result.stderr?.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(String(result.stdout ?? "").trim());
  } catch (error) {
    throw new Error(`claude -p returned non-JSON output: ${error.message}`);
  }
  writeFileSync(outputPath, JSON.stringify(parsed, null, 2) + "\n", "utf8");
  return { outputPath, batch: parsed };
}

async function main() {
  const result = runClaudeAnnotator(parseArgs(process.argv.slice(2)));
  console.log(`Wrote Claude annotations: ${result.outputPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
