import type { RetrievedChunk } from "@/lib/retrieval/search";

export interface Citation {
  marker: number;
  documentId: string;
  documentTitle: string;
  version: number;
  chunkId: string;
  excerpt: string;
}

/** Builds the citation list for every source actually offered to the model, indexed by [n]. */
export function buildCitations(sources: RetrievedChunk[]): Citation[] {
  return sources.map((s, i) => ({
    marker: i + 1,
    documentId: s.documentId,
    documentTitle: s.documentTitle,
    version: s.version,
    chunkId: s.chunkId,
    excerpt: s.content.slice(0, 240),
  }));
}
