import { requireAdmin, toErrorResponse } from "@/lib/auth/requireUser";
import { getAdminStats } from "@/lib/admin/stats";

export async function GET() {
  try {
    const user = await requireAdmin();
    if (!user.companyId) return Response.json({ error: "Aucune société." }, { status: 400 });

    const stats = await getAdminStats(user.companyId);
    return Response.json(stats);
  } catch (error) {
    return toErrorResponse(error);
  }
}
