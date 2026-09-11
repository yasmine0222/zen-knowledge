import { prisma } from "@/lib/prisma";
import { verifyInternalSecret, unauthorizedInternal } from "@/lib/internalAuth";

const DEPUBLISH_AFTER_DAYS = 14;

/**
 * Called by the n8n `obsolescence-review` cron workflow (W3):
 * GET returns documents due for a reminder or for depublishing;
 * POST applies the action n8n decided on for one document.
 */
export async function GET(request: Request) {
  if (!verifyInternalSecret(request)) return unauthorizedInternal();

  const now = new Date();
  const depublishCutoff = new Date(now.getTime() - DEPUBLISH_AFTER_DAYS * 24 * 60 * 60 * 1000);

  const [dueForReminder, overdueForDepublish] = await Promise.all([
    prisma.document.findMany({
      where: { status: "PUBLISHED", reviewDueAt: { lte: now }, reminderSentAt: null },
      include: { owner: { select: { email: true, name: true } } },
    }),
    prisma.document.findMany({
      where: {
        status: "PUBLISHED",
        reviewDueAt: { lte: depublishCutoff },
        reminderSentAt: { not: null },
      },
      include: { owner: { select: { email: true, name: true } } },
    }),
  ]);

  return Response.json({ dueForReminder, overdueForDepublish });
}

export async function POST(request: Request) {
  if (!verifyInternalSecret(request)) return unauthorizedInternal();

  const body = await request.json();
  const { documentId, action } = body as {
    documentId?: string;
    action?: "remind" | "depublish";
  };

  if (!documentId || (action !== "remind" && action !== "depublish")) {
    return Response.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  if (action === "remind") {
    await prisma.document.update({
      where: { id: documentId },
      data: { reminderSentAt: new Date() },
    });
  } else {
    await prisma.$transaction([
      prisma.chunk.updateMany({ where: { documentId }, data: { isActive: false } }),
      prisma.document.update({ where: { id: documentId }, data: { status: "OBSOLETE" } }),
    ]);
  }

  return Response.json({ ok: true });
}
