import mammoth from "mammoth";
import * as pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

export class ExtractionError extends Error {}

// pdf-parse (via pdfjs-dist) always runs its "fake worker" in Node.js
// (real Worker threads aren't used server-side), which internally does
// `await import(workerSrc)` with a bundler-relative path — that breaks
// under Turbopack's dev SSR bundling ("Setting up fake worker failed:
// Cannot find module '...pdf.worker.mjs'"), failing every real PDF.
// pdfjs checks `globalThis.pdfjsWorker` before attempting that dynamic
// import, so pre-registering it via a normal static import (which
// Turbopack bundles correctly, unlike a runtime-computed path) skips the
// broken code path entirely. This is pdfjs-dist's documented pattern for
// bundled Node environments.
(globalThis as unknown as { pdfjsWorker: typeof pdfjsWorker }).pdfjsWorker = pdfjsWorker;

/** Extracts plain text from an uploaded file buffer based on its mime type. */
export async function extractText(data: Buffer, mimeType: string): Promise<string> {
  let text: string;

  if (mimeType === "application/pdf") {
    text = await extractPdf(data);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: data });
    text = result.value;
  } else if (mimeType === "text/plain" || mimeType === "text/markdown") {
    text = data.toString("utf-8");
  } else {
    throw new ExtractionError(`Type de fichier non supporté: ${mimeType}`);
  }

  const cleaned = cleanText(text);

  // Edge case: scanned / empty PDF — extraction succeeds but yields no usable text.
  if (cleaned.length < 20) {
    throw new ExtractionError(
      "Aucun texte exploitable extrait (document probablement scanné/image). Un traitement OCR est nécessaire avant indexation."
    );
  }

  return cleaned;
}

async function extractPdf(data: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
