import { env } from "@/lib/env";

/** Verifies the shared-secret header n8n sends when calling /api/internal/* routes. */
export function verifyInternalSecret(request: Request): boolean {
  const provided = request.headers.get("x-internal-secret");
  return provided === env.INTERNAL_API_SECRET;
}

export function unauthorizedInternal(): Response {
  return Response.json({ error: "Secret interne invalide." }, { status: 401 });
}
