import { prisma } from "@/lib/prisma";
import { requireUser, toErrorResponse } from "@/lib/auth/requireUser";
import { getAuthorizedDocumentIds } from "@/lib/auth/authorizedDocs";
import { searchChunks } from "@/lib/retrieval/search";
import { buildSystemPrompt, NO_SOURCES_ANSWER } from "@/lib/llm/prompt";
import { generateGroundedAnswer } from "@/lib/llm/groq";
import { buildCitations } from "@/lib/llm/citations";

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const user = await requireUser();
    const body = await request.json();
    const question: string = body.question;
    let sessionId: string | undefined = body.sessionId;

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return Response.json({ error: "Question manquante." }, { status: 400 });
    }
    if (!user.companyId) {
      return Response.json({ error: "Aucune société associée à ce compte." }, { status: 400 });
    }

    if (!sessionId) {
      const session = await prisma.chatSession.create({
        data: {
          userId: user.id,
          companyId: user.companyId,
          title: question.slice(0, 60),
        },
      });
      sessionId = session.id;
    }

    await prisma.message.create({
      data: { sessionId, role: "USER", content: question },
    });

    // Permission filtering happens here, before retrieval ever runs.
    const authorizedDocIds = await getAuthorizedDocumentIds(user);
    const sources = await searchChunks(question, authorizedDocIds);

    let answer: string;
    let tokensIn = 0;
    let tokensOut = 0;
    let model = "n/a";
    const answeredWithSources = sources.length > 0;

    if (!answeredWithSources) {
      answer = NO_SOURCES_ANSWER;
    } else {
      const systemPrompt = buildSystemPrompt(sources);
      const result = await generateGroundedAnswer(systemPrompt, question);
      answer = result.content;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
      model = result.model;
    }

    const citations = buildCitations(sources);

    const assistantMessage = await prisma.message.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: answer,
        citationsJson: JSON.stringify(citations),
      },
    });

    await prisma.queryLog.create({
      data: {
        userId: user.id,
        companyId: user.companyId,
        question,
        answeredWithSources,
        latencyMs: Date.now() - startedAt,
        model,
        tokensIn,
        tokensOut,
        retrievedChunkIds: sources.map((s) => s.chunkId),
      },
    });

    return Response.json({
      sessionId,
      message: { id: assistantMessage.id, role: "ASSISTANT", content: answer, citations },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
