import { prisma } from "@/lib/prisma";

export interface SessionUser {
  id: string;
  companyId: string | null;
  role: "ADMIN" | "MEMBER";
  department: string | null;
}

/**
 * Computes the set of document ids a user is authorized to retrieve from.
 * This id-set must be injected directly into the vector search's SQL WHERE
 * clause (see lib/retrieval/search.ts) — permissions are enforced *before*
 * retrieval runs, never by filtering results after the fact.
 */
export async function getAuthorizedDocumentIds(user: SessionUser): Promise<string[]> {
  // Edge case: user with no company assigned gets zero document access.
  if (!user.companyId) return [];

  const docs = await prisma.document.findMany({
    where: {
      companyId: user.companyId,
      status: "PUBLISHED",
      OR: [
        { visibility: "COMPANY" },
        ...(user.department
          ? [{ visibility: "DEPARTMENT" as const, department: user.department }]
          : []),
        { visibility: "PRIVATE", ownerId: user.id },
      ],
    },
    select: { id: true },
  });

  return docs.map((d) => d.id);
}
