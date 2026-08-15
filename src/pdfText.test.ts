import { describe, expect, it } from "vitest";
import { PdfTextItemLike, reconstructPdfText } from "./pdfText";
import { redactDocuments } from "./redactor/engine";

function item(str: string, x: number, y: number, width: number, hasEOL = false): PdfTextItemLike {
  return { str, transform: [10, 0, 0, 10, x, y], width, height: 10, hasEOL };
}

describe("PDF text reconstruction", () => {
  it("preserves labelled rows and standalone signature names", () => {
    const text = reconstructPdfText([
      item("Seller:", 68, 637, 28),
      item(" ", 96, 637, 2.5),
      item("Evelyn Marlowe", 98.5, 637, 67),
      item("Target:", 68, 624, 32),
      item(" ", 100, 624, 2.5),
      item("Silver Quay Diagnostics Limited", 102.5, 624, 130),
      item("Signed for discussion purposes by:", 68, 161, 139),
      item("Evelyn Marlowe", 68, 143, 70),
      item("Seller", 68, 130, 23),
    ]);

    expect(text).toBe(
      [
        "Seller: Evelyn Marlowe",
        "Target: Silver Quay Diagnostics Limited",
        "Signed for discussion purposes by:",
        "Evelyn Marlowe",
        "Seller",
      ].join("\n"),
    );
  });

  it("keeps styled fragments and punctuation together on one visual line", () => {
    const text = reconstructPdfText([
      item("Purchase price:", 68, 500, 60),
      item(" ", 128, 500, 2.5),
      item("HK$48,500,000", 130.5, 500, 65),
      item(". A deposit follows.", 195.5, 500, 85, true),
      item("Next paragraph", 68, 482, 60),
    ]);

    expect(text).toBe("Purchase price: HK$48,500,000. A deposit follows.\nNext paragraph");
  });

  it("uses a small baseline tolerance for mixed font runs", () => {
    const text = reconstructPdfText([
      item("Date:", 68, 700, 20),
      item("14 September 2026", 92, 700.8, 80),
      item("Governing law: Hong Kong law", 68, 687, 130),
    ]);

    expect(text).toBe("Date: 14 September 2026\nGoverning law: Hong Kong law");
  });

  it("retains enough PDF structure for Balanced to redact a signature name", () => {
    const text = reconstructPdfText([
      item("Seller:", 68, 637, 28),
      item(" ", 96, 637, 2.5),
      item("Elena Fairchild", 98.5, 637, 67),
      item("Target: Cedar Quay Systems Limited", 68, 624, 145),
      item("Signed for discussion purposes by:", 68, 161, 139),
      item("Elena Fairchild", 68, 143, 70),
      item("Seller", 68, 130, 23),
    ]);

    const output = redactDocuments([{ name: "sample.pdf", text }], {
      level: "balanced",
      customTerms: [],
    }).combinedMarkdown;

    expect(output).not.toContain("Elena Fairchild");
    expect(output).toContain("PERSON_");
  });
});
