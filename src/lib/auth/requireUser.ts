import { auth } from "@/auth";
import type { SessionUser } from "./authorizedDocs";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Non authentifié");
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
