import { safeAuth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./authorizedDocs";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

// The session is a stateless JWT — it can outlive the user row it points to
// (e.g. after a re-seed regenerates ids). Checked both here (so API routes
// fail with a clean 401 instead of a raw Prisma FK error) and in the (app)
// layout (so pages redirect to /login instead of crashing the render — a
// thrown error from a Server Component isn't caught by a page's own try/catch
// the way it is in a route handler).
export async function sessionUserStillExists(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  return user !== null;
}

export async function requireUser(): Promise<SessionUser> {
  const session = await safeAuth();
  if (!session?.user) throw new UnauthorizedError("Non authentifié");

  if (!(await sessionUserStillExists(session.user.id))) {
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
