import * as mammoth from "mammoth/mammoth.browser";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { RedactionInput } from "./redactor/types";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface MammothMarkdownResult {
  value: string;
  messages: Array<{ message?: string; type?: string }>;
}

type MammothWithMarkdown = typeof mammoth & {
  convertToMarkdown(input: { arrayBuffer: ArrayBuffer }, options?: Record<string, unknown>): Promise<MammothMarkdownResult>;
};

export interface ReadFileResult extends RedactionInput {
  warnings: string[];
}

export async function readFiles(files: File[]): Promise<ReadFileResult[]> {
  const results: ReadFileResult[] = [];
  for (const file of files) {
    results.push(await readFile(file));
  }
  return results;
}

async function readFile(file: File): Promise<ReadFileResult> {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase() ?? "";
  if (extension === "docx") return readDocx(file);
  if (extension === "pdf") return readPdf(file);
  if (extension === "md" || extension === "markdown" || extension === "txt") {
    return { name: file.name, text: await file.text(), warnings: [] };
  }
  throw new Error(`${file.name} is not a supported file type.`);
}

async function readDocx(file: File): Promise<ReadFileResult> {
  const arrayBuffer = await file.arrayBuffer();
  const markdownResult = await (mammoth as MammothWithMarkdown).convertToMarkdown(
    { arrayBuffer },
    {
      includeDefaultStyleMap: true,
      externalFileAccess: false,
    },
  );
  return {
    name: file.name,
    text: removeEmbeddedDataImages(markdownResult.value),
    warnings: markdownResult.messages.map((message) => message.message ?? message.type ?? "DOCX conversion warning"),
  };
}

function removeEmbeddedDataImages(markdown: string): string {
  return markdown.replace(/!\[[^\]]*]\(data:[^)]+\)/g, "[IMAGE_REMOVED]");
}

async function readPdf(file: File): Promise<ReadFileResult> {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];
  const warnings: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = (content.items as Array<{ str?: string }>)
      .map((item) => item.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(`## Page ${pageNumber}\n\n${text}`);
  }

  if (pages.every((page) => page.replace(/^## Page \d+/, "").trim().length === 0)) {
    warnings.push("No selectable text was found. Scanned-image PDFs need OCR before redaction.");
  }

  return {
    name: file.name,
    text: pages.join("\n\n"),
    warnings,
  };
}
