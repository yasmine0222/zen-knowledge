import { prisma } from "@/lib/prisma";
import { requireUser, toErrorResponse } from "@/lib/auth/requireUser";

export async function GET() {
  try {
    const user = await requireUser();
    const sessions = await prisma.chatSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ sessions });
  } catch (error) {
    return toErrorResponse(error);
  }
}
