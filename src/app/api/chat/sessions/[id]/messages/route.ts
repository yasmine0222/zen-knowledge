import { prisma } from "@/lib/prisma";
import { requireUser, toErrorResponse } from "@/lib/auth/requireUser";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;

    const session = await prisma.chatSession.findUnique({ where: { id } });
    if (!session || session.userId !== user.id) {
      return Response.json({ error: "Conversation introuvable." }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: "asc" },
    });

    const withParsedCitations = messages.map((m) => ({
      ...m,
      citations: m.citationsJson ? JSON.parse(m.citationsJson) : null,
    }));

    return Response.json({ messages: withParsedCitations });
  } catch (error) {
    return toErrorResponse(error);
  }
}
