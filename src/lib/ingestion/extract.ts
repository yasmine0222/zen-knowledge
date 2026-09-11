import mammoth from "mammoth";

export class ExtractionError extends Error {}

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
