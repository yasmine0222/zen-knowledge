import { prisma } from "@/lib/prisma";
import { estimateCostUsd } from "@/lib/costs";

export async function getAdminStats(companyId: string) {
  const [failedVersions, zeroResultLogs, obsoleteQueue, recentLogs, feedbackRows] = await Promise.all([
    prisma.documentVersion.findMany({
      where: { status: "FAILED", document: { companyId } },
      include: { document: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.queryLog.findMany({
      where: { companyId, answeredWithSources: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.document.findMany({
      where: { companyId, status: "PUBLISHED", reviewDueAt: { lte: new Date() } },
      select: { id: true, title: true, reviewDueAt: true, reminderSentAt: true },
    }),
    prisma.queryLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.feedback.findMany({
      where: { message: { session: { companyId } } },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        message: { select: { id: true, content: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const estimatedCostUsd = recentLogs.reduce(
    (sum, log) => sum + estimateCostUsd(log.model, log.tokensIn, log.tokensOut),
    0
  );

  const usefulCount = feedbackRows.filter((f) => f.rating === "USEFUL").length;
  const inaccurateCount = feedbackRows.filter((f) => f.rating === "INACCURATE").length;
  const recentInaccurate = feedbackRows.filter((f) => f.rating === "INACCURATE").slice(0, 20);

  return {
    failedVersions,
    zeroResultLogs,
    obsoleteQueue,
    estimatedCostUsd,
    totalQueries: recentLogs.length,
    quality: { usefulCount, inaccurateCount, recentInaccurate },
  };
}
