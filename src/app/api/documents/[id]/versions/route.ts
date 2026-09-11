import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage/local";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { requireUser, toErrorResponse } from "@/lib/auth/requireUser";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

/** Uploads a new version of an existing document. Old chunks are deactivated
 * (not deleted) once the new version publishes — see publishVersion() in the
 * ingestion pipeline — so version history and past citations stay intact. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    });
    if (!document || document.companyId !== user.companyId) {
      return Response.json({ error: "Document introuvable." }, { status: 404 });
    }
    if (document.ownerId !== user.id && user.role !== "ADMIN") {
      return Response.json({ error: "Non autorisé." }, { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Fichier manquant." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json(
        { error: `Type de fichier non supporté: ${file.type || "inconnu"}` },
        { status: 400 }
      );
    }

    const nextVersionNumber = (document.versions[0]?.version ?? 0) + 1;

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await storage.save({
      companyId: document.companyId,
      documentId: document.id,
      fileName: file.name,
      data: buffer,
    });

    const version = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: nextVersionNumber,
        filePath,
        mimeType: file.type,
        status: "PROCESSING",
      },
    });

    runIngestionPipeline(version.id).catch((err) => {
      console.error(`Ingestion failed for version ${version.id}:`, err);
    });

    return Response.json({ versionId: version.id, version: nextVersionNumber }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
