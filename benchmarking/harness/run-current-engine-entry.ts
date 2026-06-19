import { readFileSync, writeFileSync } from "node:fs";
import { redactDocuments } from "../../src/redactor/engine";
import type { RedactionLevel } from "../../src/redactor/types";

interface InputDocument {
  docId: string;
  name: string;
  text: string;
}

const [inputPath, outputPath, levelArg] = process.argv.slice(2);

if (!inputPath || !outputPath || !levelArg) {
  console.error(
    "Usage: run-current-engine-entry <input-documents.json> <output.json> <level>",
  );
  process.exit(1);
}

const level = levelArg as RedactionLevel;
const documents = JSON.parse(readFileSync(inputPath, "utf8")) as InputDocument[];

const outputs = documents.map((doc) => {
  const result = redactDocuments([{ name: doc.name, text: doc.text }], { level });
  return {
    docId: doc.docId,
    engineVersion: result.engineVersion,
    engineVersionLabel: result.engineVersionLabel,
    engineVersionInfo: result.engineVersionInfo,
    counts: result.counts,
    entries: result.entries,
    reviewDocument: result.documents[0],
  };
});

writeFileSync(
  outputPath,
  JSON.stringify({ level, outputs }, null, 2) + "\n",
  "utf8",
);
