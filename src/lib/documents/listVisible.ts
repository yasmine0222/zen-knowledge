import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth/authorizedDocs";

/** Documents visible in the library UI: broader than retrieval (includes the
 * caller's own DRAFT/processing uploads), but still scoped by company + visibility. */
export async function listVisibleDocuments(user: SessionUser) {
  if (!user.companyId) return [];

  return prisma.document.findMany({
    where: {
      companyId: user.companyId,
      status: { not: "DELETED" },
      OR:
        user.role === "ADMIN"
          ? undefined
          : [
              { visibility: "COMPANY" },
              ...(user.department
                ? [{ visibility: "DEPARTMENT" as const, department: user.department }]
                : []),
              { ownerId: user.id },
            ],
    },
    include: { owner: { select: { name: true, email: true } } },
    orderBy: { updatedAt: "desc" },
  });
}
