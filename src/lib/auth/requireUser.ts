import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./authorizedDocs";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Non authentifié");

  // The session is a stateless JWT — it can outlive the user row it points to
  // (e.g. after a re-seed regenerates ids). Any FK write would otherwise fail
  // with a raw Prisma error; fail clearly instead so the client can prompt a
  // fresh login.
  const exists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!exists) {
    throw new UnauthorizedError("Session expirée, veuillez vous reconnecter.");
  }

  return {
    id: session.user.id,
    companyId: session.user.companyId,
    role: session.user.role,
    department: session.user.department,
  };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ForbiddenError("Réservé aux administrateurs");
  return user;
}

export function toErrorResponse(error: unknown): Response {
  if (error instanceof UnauthorizedError) {
    return Response.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  const message = error instanceof Error ? error.message : "Erreur interne";
  return Response.json({ error: message }, { status: 400 });
}
