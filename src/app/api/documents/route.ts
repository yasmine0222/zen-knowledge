import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage/local";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { requireUser, toErrorResponse } from "@/lib/auth/requireUser";
import { listVisibleDocuments } from "@/lib/documents/listVisible";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

export async function GET() {
  try {
    const user = await requireUser();
    const documents = await listVisibleDocuments(user);
    return Response.json({ documents });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (!user.companyId) {
      return Response.json({ error: "Aucune société associée à ce compte." }, { status: 400 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const title = form.get("title");
    const department = form.get("department");
    const visibility = form.get("visibility");

    if (!(file instanceof File)) {
      return Response.json({ error: "Fichier manquant." }, { status: 400 });
    }
    if (typeof title !== "string" || title.trim().length === 0) {
      return Response.json({ error: "Titre manquant." }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json(
        { error: `Type de fichier non supporté: ${file.type || "inconnu"}` },
        { status: 400 }
      );
    }

    const visibilityValue =
      visibility === "DEPARTMENT" || visibility === "PRIVATE" ? visibility : "COMPANY";

    const document = await prisma.document.create({
      data: {
        companyId: user.companyId,
        ownerId: user.id,
        title: title.trim(),
        department: typeof department === "string" && department ? department : null,
        visibility: visibilityValue,
        status: "DRAFT",
        reviewDueAt: defaultReviewDueDate(),
      },
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = await storage.save({
      companyId: user.companyId,
      documentId: document.id,
      fileName: file.name,
      data: buffer,
    });

    const version = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: 1,
        filePath,
        mimeType: file.type,
        status: "PROCESSING",
      },
    });

    // Run inline so the demo works without n8n; the same pipeline is also
    // reachable via /api/internal/ingest for the n8n ingestion-pipeline workflow.
    runIngestionPipeline(version.id).catch((err) => {
      console.error(`Ingestion failed for version ${version.id}:`, err);
    });

    return Response.json({ document, versionId: version.id }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function defaultReviewDueDate(): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return d;
}
