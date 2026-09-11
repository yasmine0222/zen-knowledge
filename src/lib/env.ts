import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  GROQ_API_KEY: z.string().min(1).optional(),
  GROQ_MODEL: z.string().default("llama-3.3-70b-versatile"),
  INTERNAL_API_SECRET: z.string().min(1),
  APP_BASE_URL: z.string().default("http://localhost:3000"),
  STORAGE_DIR: z.string().default("./storage"),
  RETRIEVAL_MIN_SIMILARITY: z.coerce.number().default(0.55),
  RETRIEVAL_TOP_K: z.coerce.number().int().default(6),
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
  APP_BASE_URL: process.env.APP_BASE_URL,
  STORAGE_DIR: process.env.STORAGE_DIR,
  RETRIEVAL_MIN_SIMILARITY: process.env.RETRIEVAL_MIN_SIMILARITY,
  RETRIEVAL_TOP_K: process.env.RETRIEVAL_TOP_K,
});
