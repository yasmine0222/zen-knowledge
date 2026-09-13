import { prisma } from "@/lib/prisma";
import { embedQuery, toVectorLiteral } from "@/lib/ingestion/embed";
import { env } from "@/lib/env";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentVersionId: string;
  documentTitle: string;
  version: number;
  content: string;
  position: number;
  similarity: number;
}

/**
 * Cosine-similarity search over chunks, scoped to `authorizedDocumentIds`.
 * The id-set is embedded in the SQL WHERE clause itself — this is the
 * permission-filtered-retrieval requirement: the query can only ever see
 * chunks belonging to documents the caller is already authorized for.
 */
export async function searchChunks(
  question: string,
  authorizedDocumentIds: string[],
  opts: { topK?: number; minSimilarity?: number } = {}
): Promise<RetrievedChunk[]> {
  if (authorizedDocumentIds.length === 0) return [];

  const topK = opts.topK ?? env.RETRIEVAL_TOP_K;
  const minSimilarity = opts.minSimilarity ?? env.RETRIEVAL_MIN_SIMILARITY;

  const queryVector = toVectorLiteral(await embedQuery(question));
  const pgArrayLiteral = `{${authorizedDocumentIds.map((id) => `"${id}"`).join(",")}}`;

  const rows = await prisma.$queryRaw<
    {
      id: string;
      documentId: string;
      documentVersionId: string;
      content: string;
      position: number;
      title: string;
      version: number;
      similarity: number;
    }[]
  >`
    SELECT c.id, c."documentId", c."documentVersionId", c.content, c.position,
           d.title, dv.version,
           1 - (c.embedding <=> ${queryVector}::vector) AS similarity
    FROM chunks c
    JOIN documents d ON d.id = c."documentId"
    JOIN document_versions dv ON dv.id = c."documentVersionId"
    WHERE c."isActive" = true
      AND c."documentId" = ANY(${pgArrayLiteral}::text[])
    ORDER BY c.embedding <=> ${queryVector}::vector
    LIMIT ${topK}
  `;

  return rows
    .filter((r) => r.similarity >= minSimilarity)
    .map((r) => ({
      chunkId: r.id,
      documentId: r.documentId,
      documentVersionId: r.documentVersionId,
      documentTitle: r.title,
      version: r.version,
      content: r.content,
      position: r.position,
      similarity: r.similarity,
    }));
}
