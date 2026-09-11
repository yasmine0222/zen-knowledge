import { prisma } from "@/lib/prisma";
import { requireUser, toErrorResponse } from "@/lib/auth/requireUser";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, email: true } },
        versions: { orderBy: { version: "desc" } },
      },
    });

    if (!document || document.companyId !== user.companyId) {
      return Response.json({ error: "Document introuvable." }, { status: 404 });
    }

    return Response.json({ document });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const document = await prisma.document.findUnique({ where: { id } });
    if (!document || document.companyId !== user.companyId) {
      return Response.json({ error: "Document introuvable." }, { status: 404 });
    }
    if (document.ownerId !== user.id && user.role !== "ADMIN") {
      return Response.json({ error: "Non autorisé." }, { status: 403 });
    }

    // Soft delete: chunks are deactivated immediately (excluded from retrieval),
    // but the document row and past citations to it are kept for history.
    await prisma.$transaction([
      prisma.chunk.updateMany({ where: { documentId: id }, data: { isActive: false } }),
      prisma.document.update({ where: { id }, data: { status: "DELETED" } }),
    ]);

    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
