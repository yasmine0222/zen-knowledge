export interface TextChunk {
  content: string;
  position: number;
}

const WORDS_PER_CHUNK = 350; // ~500 tokens
const WORDS_OVERLAP = 40; // ~50 tokens

/** Splits text into overlapping word-window chunks, preferring paragraph boundaries. */
export function chunkText(text: string): TextChunk[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const words = paragraphs.join("\n\n").split(/\s+/).filter(Boolean);

  if (words.length === 0) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let position = 0;

  while (start < words.length) {
    const end = Math.min(start + WORDS_PER_CHUNK, words.length);
    const content = words.slice(start, end).join(" ");
    chunks.push({ content, position });
    position += 1;

    if (end === words.length) break;
    start = end - WORDS_OVERLAP;
  }

  return chunks;
}
