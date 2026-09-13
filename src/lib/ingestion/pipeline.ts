import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage/local";
import { extractText, ExtractionError } from "./extract";
import { chunkText } from "./chunk";
import { embedPassageBatch, toVectorLiteral } from "./embed";

/**
 * Runs the full ingestion pipeline for a document version: extract -> chunk -> embed -> publish.
 * Called directly on upload, and also reachable via /api/internal/ingest for the n8n
 * ingestion-pipeline workflow — same code path either way.
 */
export async function runIngestionPipeline(documentVersionId: string): Promise<void> {
  const version = await prisma.documentVersion.findUniqueOrThrow({
    where: { id: documentVersionId },
    include: { document: true },
  });

  try {
    const fileBuffer = await storage.read(version.filePath);

    const extractedText = await logStep(documentVersionId, "EXTRACT", () =>
      extractText(fileBuffer, version.mimeType)
    );

    const chunks = await logStep(documentVersionId, "CHUNK", async () => {
      const result = chunkText(extractedText);
      if (result.length === 0) {
        throw new ExtractionError("Aucun segment exploitable après découpage.");
      }
      return result;
    });

    const embeddings = await logStep(documentVersionId, "EMBED", () =>
      embedPassageBatch(chunks.map((c) => c.content))
    );

    await logStep(documentVersionId, "PUBLISH", async () => {
      await publishVersion(version.documentId, version.id, extractedText, chunks, embeddings);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur d'ingestion inconnue";
    await prisma.documentVersion.update({
      where: { id: documentVersionId },
      data: { status: "FAILED", errorMessage: message },
    });
    throw error;
  }
}

async function publishVersion(
  documentId: string,
  documentVersionId: string,
  extractedText: string,
  chunks: { content: string; position: number }[],
  embeddings: number[][]
) {
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  await prisma.$transaction(async (tx) => {
    // Deactivate chunks from any previously published version — never deleted, so
    // history and past citations still resolve, but retrieval only sees the current version.
    await tx.chunk.updateMany({
      where: { documentId, isActive: true },
      data: { isActive: false },
    });

    for (let i = 0; i < chunks.length; i++) {
      const id = randomUUID();
      const vectorLiteral = toVectorLiteral(embeddings[i]);
      await tx.$executeRaw`
        INSERT INTO chunks (id, "documentVersionId", "documentId", "companyId", content, position, "isActive", "createdAt", embedding)
        VALUES (${id}, ${documentVersionId}, ${documentId}, ${document.companyId}, ${chunks[i].content}, ${chunks[i].position}, true, now(), ${vectorLiteral}::vector)
      `;
    }

    await tx.documentVersion.update({
      where: { id: documentVersionId },
      data: { status: "READY", extractedText, errorMessage: null },
    });

    await tx.document.update({
      where: { id: documentId },
      data: { status: "PUBLISHED", currentVersionId: documentVersionId },
    });
  });
}

async function logStep<T>(
  documentVersionId: string,
  step: "EXTRACT" | "CHUNK" | "EMBED" | "PUBLISH",
  fn: () => Promise<T>
): Promise<T> {
  const job = await prisma.ingestionJob.create({
    data: { documentVersionId, step, status: "RUNNING" },
  });
  try {
    const result = await fn();
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "DONE", finishedAt: new Date() },
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: message, finishedAt: new Date() },
    });
    throw error;
  }
}
