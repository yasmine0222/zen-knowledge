import { prisma } from "@/lib/prisma";
import { requireUser, toErrorResponse } from "@/lib/auth/requireUser";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json();
    const { messageId, rating, comment } = body as {
      messageId?: string;
      rating?: "USEFUL" | "INACCURATE";
      comment?: string;
    };

    if (!messageId || (rating !== "USEFUL" && rating !== "INACCURATE")) {
      return Response.json({ error: "Paramètres invalides." }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: { messageId, userId: user.id, rating, comment: comment ?? null },
    });

    return Response.json({ feedback }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
