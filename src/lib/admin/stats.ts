import { prisma } from "@/lib/prisma";
import { estimateCostUsd } from "@/lib/costs";

export async function getAdminStats(companyId: string) {
  const [failedVersions, zeroResultLogs, obsoleteQueue, recentLogs] = await Promise.all([
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
  ]);

  const estimatedCostUsd = recentLogs.reduce(
    (sum, log) => sum + estimateCostUsd(log.model, log.tokensIn, log.tokensOut),
    0
  );

  return {
    failedVersions,
    zeroResultLogs,
    obsoleteQueue,
    estimatedCostUsd,
    totalQueries: recentLogs.length,
  };
}
