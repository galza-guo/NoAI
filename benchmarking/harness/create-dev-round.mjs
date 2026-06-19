#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../..");
const DEFAULT_BASE_DIR = join(root, "benchmarking/private/dev-rounds");
const SOURCE_MODES = new Set(["user", "public-search", "mixed"]);
const ROUND_SUBDIRS = [
  "source",
  "model-input",
  "engine-output",
  "annotations",
  "comparison",
  "scratch",
];

function usage() {
  console.log(`Usage: node benchmarking/harness/create-dev-round.mjs --round <id> [options]

Options:
  --round <id>             Safe round id, e.g. 2026-06-19-sec-correspondence
  --theme <text>           Human-readable round theme
  --source-mode <mode>     user | public-search | mixed (default: user)
  --base-dir <path>        Dev-round base directory (default: benchmarking/private/dev-rounds)
  --force                  Replace an existing round folder
`);
}

function parseArgs(argv) {
  const args = {
    roundId: "",
    theme: "",
    sourceMode: "user",
    baseDir: DEFAULT_BASE_DIR,
    force: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--round") {
      args.roundId = argv[++index] ?? "";
      continue;
    }
    if (arg === "--theme") {
      args.theme = argv[++index] ?? "";
      continue;
    }
    if (arg === "--source-mode") {
      args.sourceMode = argv[++index] ?? "";
      continue;
    }
    if (arg === "--base-dir") {
      args.baseDir = resolve(argv[++index] ?? "");
      continue;
    }
    if (arg === "--force") {
      args.force = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function assertSafeRoundId(roundId) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(roundId)) {
    throw new Error(
      `Unsafe round id: ${roundId}. Use only letters, digits, dots, underscores, and dashes.`,
    );
  }
  if (roundId.includes("..") || roundId.includes("/") || roundId.includes("\\")) {
    throw new Error(`Unsafe round id: ${roundId}`);
  }
}

function readExistingManifest(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8"));
}

export function createDevRound(options) {
  const roundId = options.roundId;
  if (!roundId) throw new Error("--round is required");
  assertSafeRoundId(roundId);
  const sourceMode = options.sourceMode ?? "user";
  if (!SOURCE_MODES.has(sourceMode)) {
    throw new Error(`Invalid source mode: ${sourceMode}`);
  }

  const baseDir = resolve(options.baseDir ?? DEFAULT_BASE_DIR);
  const roundDir = join(baseDir, roundId);
  if (existsSync(roundDir)) {
    if (!options.force) {
      throw new Error(`Dev round already exists: ${roundDir}`);
    }
    rmSync(roundDir, { recursive: true, force: true });
  }

  mkdirSync(roundDir, { recursive: true });
  for (const subdir of ROUND_SUBDIRS) {
    mkdirSync(join(roundDir, subdir), { recursive: true });
  }

  const manifestPath = join(roundDir, "round-manifest.json");
  const manifest = readExistingManifest(manifestPath) ?? {
    schemaVersion: "1.0.0",
    roundId,
    createdAt: options.now ?? new Date().toISOString(),
    theme: options.theme ?? "",
    sourceMode,
    documents: [],
  };
  manifest.roundId = roundId;
  manifest.theme = options.theme ?? manifest.theme ?? "";
  manifest.sourceMode = sourceMode;
  manifest.documents ??= [];
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return { roundDir, manifestPath, manifest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = createDevRound(args);
  console.log(`Created dev round: ${result.roundDir}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
