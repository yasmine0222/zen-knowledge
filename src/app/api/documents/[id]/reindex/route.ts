import { prisma } from "@/lib/prisma";
import { runIngestionPipeline } from "@/lib/ingestion/pipeline";
import { requireUser, toErrorResponse } from "@/lib/auth/requireUser";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
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

    const latestVersion = document.versions[0];
    if (!latestVersion) {
      return Response.json({ error: "Aucune version à réindexer." }, { status: 400 });
    }

    await prisma.documentVersion.update({
      where: { id: latestVersion.id },
      data: { status: "PROCESSING", errorMessage: null },
    });

    runIngestionPipeline(latestVersion.id).catch((err) => {
      console.error(`Reindex failed for version ${latestVersion.id}:`, err);
    });

    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
