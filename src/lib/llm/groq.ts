import Groq from "groq-sdk";
import { env } from "@/lib/env";

let client: Groq | null = null;

function getClient(): Groq {
  if (!env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY manquant — configurez-le dans .env pour activer le chat.");
  }
  if (!client) client = new Groq({ apiKey: env.GROQ_API_KEY });
  return client;
}

export interface GenerateResult {
  content: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
}

export async function generateGroundedAnswer(
  systemPrompt: string,
  question: string
): Promise<GenerateResult> {
  const groq = getClient();
  const completion = await groq.chat.completions.create({
    model: env.GROQ_MODEL,
    temperature: 0.1,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  return {
    content,
    tokensIn: completion.usage?.prompt_tokens ?? 0,
    tokensOut: completion.usage?.completion_tokens ?? 0,
    model: env.GROQ_MODEL,
  };
}
